# Diseño: navegación por rutas, vistas múltiples y aprobación de actividades

**Fecha:** 2026-08-09  
**Estado:** Aprobado para implementación

## Objetivo

Reducir la densidad de los listados y convertir cada registro en un recurso navegable con URLs propias para crear, ver y editar. Al mismo tiempo, incorporar un flujo interno de revisión exclusivo para Actividades que permita recibir en el futuro registros provenientes de WhatsApp sin confundirlos con Eventos ni cambiar la naturaleza factual de una actividad ya realizada.

## Decisiones principales

1. Las altas, detalles y ediciones dejan de usar diálogos como superficie principal y pasan a rutas dedicadas.
2. La fila o tarjeta completa abre el detalle; los listados dejan de mostrar una columna `Acciones`.
3. Actividades y Eventos ofrecen vistas Tabla, Tarjetas y Kanban.
4. Socios, Contactos, Convenios y Recursos ofrecen vistas Tabla y Tarjetas. No tendrán Kanban porque no poseen etapas naturales.
5. Actividades recibe un estado interno de aprobación independiente de su carácter factual. Todas las creadas desde la web nacen aprobadas.
6. El almacenamiento continúa siendo local y debe migrar los datos existentes sin descartarlos.

## Arquitectura de rutas

Cada módulo de datos adopta el mismo contrato:

| Módulo | Listado | Nuevo | Detalle | Edición |
| --- | --- | --- | --- | --- |
| Actividades | `/activities` | `/activities/new` | `/activities/:activityId` | `/activities/:activityId/edit` |
| Eventos | `/events` | `/events/new` | `/events/:eventId` | `/events/:eventId/edit` |
| Socios | `/partners` | `/partners/new` | `/partners/:partnerId` | `/partners/:partnerId/edit` |
| Contactos | `/contacts` | `/contacts/new` | `/contacts/:contactId` | `/contacts/:contactId/edit` |
| Convenios | `/agreements` | `/agreements/new` | `/agreements/:agreementId` | `/agreements/:agreementId/edit` |
| Recursos | `/resources` | `/resources/new` | `/resources/:resourceId` | `/resources/:resourceId/edit` |

Las rutas de alta y edición renderizan formularios de página completa reutilizando los campos y validaciones existentes. Guardar una alta navega al detalle recién creado; guardar una edición vuelve al detalle actualizado. Cancelar una alta vuelve al listado y cancelar una edición vuelve al detalle.

Una ruta con un identificador inexistente muestra un estado vacío con enlace al listado. Eliminar permanece disponible únicamente desde el detalle, con confirmación, y después navega al listado.

## Listados y densidad de información

### Regla transversal

- La fila o tarjeta completa es un enlace accesible al detalle.
- Se elimina la columna `Acciones` y los botones de editar/eliminar del listado.
- Tabla y tarjetas conservan sólo información de reconocimiento rápido: nombre, una clasificación o estado relevante y uno o dos datos contextuales.
- Filtros, búsqueda y contadores existentes se conservan cuando aportan valor.
- El selector de vista se ubica junto a los filtros y su elección se persiste por módulo en `localStorage`.
- Los registros filtrados son los mismos en todos los modos de vista.

### Actividades

- **Tabla:** actividad y fecha, línea VcM, responsable, estado de aprobación.
- **Tarjetas:** nombre, fecha, línea VcM, responsable y estado.
- **Kanban:** tres columnas fijas: `Por aprobar`, `Aprobadas` y `Rechazadas`, con contador y tarjetas compactas.

### Eventos

- **Tabla:** evento y fecha, estado operativo, coordinador y línea VcM.
- **Tarjetas:** nombre, fecha, estado, coordinador y ubicación.
- **Kanban:** columnas derivadas de los estados ya existentes: `Borrador`, `Planificado`, `En curso`, `Completado` y `Cancelado`.

El Kanban inicial es una vista de navegación, no incorpora arrastrar y soltar. Los cambios de aprobación de Actividades se realizan desde su detalle y el estado operativo de Eventos sigue editándose mediante su formulario. Esto evita transiciones accidentales y mantiene una única validación por flujo.

### Otros módulos

Socios, Contactos, Convenios y Recursos ofrecen Tabla y Tarjetas. Sus tarjetas muestran únicamente el nombre, la relación o categoría principal y el dato secundario más útil. No se inventan estados para habilitar Kanban.

## Modelo de aprobación de Actividades

Se agregan los siguientes tipos:

```ts
type ActivityApprovalStatus = 'pending' | 'approved' | 'rejected'
type ActivitySource = 'web' | 'whatsapp'
```

Cada `Activity` incorpora:

```ts
approvalStatus: ActivityApprovalStatus
source: ActivitySource
rejectionReason: string | null
```

### Invariantes

- `createActivity` representa un registro creado por la interfaz web y siempre asigna `source: 'web'`, `approvalStatus: 'approved'` y `rejectionReason: null`.
- La futura integración de WhatsApp asignará `source: 'whatsapp'` y `approvalStatus: 'pending'`. La integración en sí no forma parte de este alcance.
- Rechazar exige un motivo no vacío después de quitar espacios laterales.
- Aprobar asigna `approvalStatus: 'approved'` y limpia `rejectionReason`.
- Una actividad pendiente tiene `rejectionReason: null`.
- La edición de los datos factuales no modifica automáticamente su aprobación.
- No se agrega un estado de ejecución, planificación ni publicación. La aprobación es un control interno sobre la validez del registro ya ocurrido.

No se registra aún el usuario revisor porque el MVP no posee autenticación ni un modelo definitivo de Usuarios. Ese dato se incorporará junto con el backend y los permisos.

## Experiencia del detalle de Actividad

La cabecera muestra el nombre y una etiqueta discreta con el estado. Las acciones principales dependen del estado:

- `Por aprobar`: botones `Aprobar` y `Rechazar`.
- `Aprobada`: se permite `Rechazar` para corregir una validación posterior.
- `Rechazada`: se muestra el motivo y se permite `Aprobar`.

`Rechazar` abre una confirmación con un campo obligatorio para el motivo. `Aprobar` solicita una confirmación sencilla. Editar y eliminar permanecen en la cabecera, pero Editar navega a la ruta dedicada.

## Estado local, migración y respaldo

El snapshot de la aplicación sube de versión 1 a versión 2.

Al leer un snapshot v1 válido:

1. Se preservan todas las entidades y relaciones existentes.
2. Cada actividad existente recibe `source: 'web'`, `approvalStatus: 'approved'` y `rejectionReason: null`.
3. El resultado se valida como snapshot v2 antes de persistirse.

Los datos semilla se actualizan al nuevo contrato. Importar un respaldo v1 aplica la misma migración; exportar genera siempre v2. Un respaldo inválido continúa rechazándose sin reemplazar el estado actual.

Las preferencias de visualización se almacenan en claves separadas del snapshot de dominio para que reiniciar los datos no corrompa la navegación. Cada módulo valida la preferencia leída y vuelve a Tabla si recibe un valor desconocido.

## Componentes y límites

- Un selector reutilizable representa los modos Tabla, Tarjetas y Kanban.
- Los modos de vista reciben registros ya filtrados; no duplican lógica de búsqueda o filtros.
- Las etiquetas de aprobación y de estado de Evento continúan separadas porque representan conceptos distintos.
- Los formularios reutilizan un componente de campos compartidos entre alta y edición, envuelto por una página específica para navegación y encabezado.
- Las mutaciones de aprobación viven en el store y no dentro de componentes visuales.
- Cada módulo conserva responsabilidad sobre la anatomía de sus filas, tarjetas y detalle.

## Errores y accesibilidad

- Las filas y tarjetas usan enlaces reales, navegables con teclado y compatibles con abrir en otra pestaña.
- Todos los selectores de vista tienen nombre accesible y estado seleccionado.
- Los Kanban admiten desplazamiento horizontal en pantallas estrechas sin provocar desborde global de la página.
- Los formularios mantienen mensajes de validación junto al campo correspondiente.
- Un rechazo sin motivo se bloquea y muestra un mensaje claro.
- Los cambios exitosos muestran notificación y actualizan inmediatamente todas las vistas mediante el store central.

## Pruebas y verificación

### Modelo y persistencia

- Migración completa de snapshot v1 a v2 sin perder entidades.
- Alta web aprobada por defecto.
- Rechazo exige motivo, lo guarda y cambia el estado.
- Aprobación limpia el motivo de rechazo.
- Edición factual conserva el estado de aprobación.
- Importación y exportación funcionan con la versión 2.
- Preferencias de vista aceptan sólo modos válidos por módulo.

### Rutas y componentes

- Alta, detalle y edición renderizan en sus URLs dedicadas.
- Guardar y cancelar navegan al destino correcto.
- Fila y tarjeta abren el detalle y no existe columna `Acciones`.
- Los filtros producen el mismo conjunto en Tabla, Tarjetas y Kanban.
- Kanban de Actividades agrupa por aprobación; Kanban de Eventos agrupa por estado operativo.
- Socios, Contactos, Convenios y Recursos no ofrecen Kanban.

### Verificación visible

- Recorrido de alta, detalle, edición, aprobación, rechazo y eliminación.
- Recarga del navegador para confirmar persistencia.
- Revisión de todos los modos en escritorio y móvil.
- Verificación de enlaces directos y estados de entidad inexistente.
- Ejecución de pruebas focalizadas, lint y build.

## Fuera de alcance

- Integración real con WhatsApp.
- Backend, S3, autenticación, roles o permisos de aprobación.
- Historial/auditoría de decisiones de aprobación.
- Arrastrar y soltar en Kanban.
- Estados artificiales para Socios, Contactos, Convenios o Recursos.
- Cambios en el significado operativo de los Eventos.

