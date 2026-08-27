# Diseño del MVP VcM con persistencia local

## Objetivo

Completar las secciones principales de la aplicación VcM con datos relacionados y persistidos en `localStorage`, conservando la interfaz visual existente y preparando el dominio para una futura API, autenticación y almacenamiento de evidencias en S3.

## Alcance funcional

El MVP incluye Inicio, Actividades, Eventos, Agenda, Convenios, Socios, Contactos, Recursos, Tareas, Reportes y Configuración. No incluye autenticación real, permisos, subida de archivos, S3 ni sincronización multiusuario.

## Modelo centralizado

La aplicación utiliza un único snapshot versionado. Las entidades se guardan normalizadas en registros por identificador:

- `activities`
- `events`
- `tasks`
- `budgetItems`
- `expenses`
- `partners`
- `contacts`
- `agreements`
- `resources`

Las relaciones utilizan identificadores. Los nombres visibles se resuelven desde los catálogos y no se copian en cada entidad. El almacenamiento debe validar snapshots al cargar, respaldar la migración desde `contenthub-events-v1` y mostrar una advertencia recuperable ante datos inválidos.

## Líneas VcM

La única clasificación institucional de Actividades y Eventos es una línea VcM principal. El catálogo es fijo en el MVP:

1. Docencia vinculada
2. Desarrollo profesional
3. Servicios comunitarios
4. Investigación aplicada
5. Innovación, Transferencia Tecnológica y Emprendimiento
6. Asistencia técnica
7. Extensión artístico-cultural
8. Divulgación de conocimiento
9. Desarrollo de Políticas públicas

No se modelan ámbitos ni subtipos.

## Contactos, usuarios y socios

Un Contacto representa a cualquier persona, tenga o no acceso a la plataforma. Un futuro Usuario será un Contacto con credenciales, pero el MVP no implementa esa conversión. Un Contacto puede pertenecer opcionalmente a un Socio.

Los responsables se seleccionan desde Contactos mediante búsqueda/autocompletado. Los formularios que necesitan un contacto o socio permiten crear el registro faltante sin abandonar el flujo.

Un Socio representa una organización. Sus datos mínimos son nombre, tipo, identificador opcional, correo, teléfono, sitio web y notas. Un Contacto contiene nombre, cargo, correo, teléfono y socio opcional.

## Actividades

Una Actividad es una ejecución puntual que ya ocurrió. No tiene estado, aprobación ni planificación. Contiene:

- nombre y descripción;
- fecha/hora de inicio y término;
- lugar o territorio;
- una línea VcM principal;
- un Contacto responsable;
- cero o más Socios vinculados;
- cantidad total de participantes;
- resultados u observaciones;
- cero o más evidencias con nombre y enlace.

El término debe ser igual o posterior al inicio y no puede ser futuro. La cantidad de participantes es un entero total sin desglose. La sección ofrece listado, búsqueda, filtros, alta, edición, detalle y eliminación confirmada.

## Eventos

Un Evento es el flujo especial para iniciativas que requieren planificación. Conserva un único registro y no genera automáticamente una Actividad.

Datos generales: nombre, descripción, ubicación, inicio, término, línea VcM principal, un Contacto coordinador, Socios relacionados, estado administrativo, presupuesto y gastos.

El trabajo se organiza en tres etapas: `pre`, `during` y `post`. Cada tarea pertenece a una etapa y contiene título, descripción, fecha límite, prioridad, estado y uno o más Contactos responsables.

La condición temporal —próximo, en curso o terminado cronológicamente— se deriva de las fechas. El estado administrativo conserva borrador, planificado, en curso, finalizado y cancelado. Finalizar exige registrar explícitamente el cierre post-evento. El cierre guarda cantidad total de participantes, resultados/observaciones y evidencias con nombre y enlace.

Presupuesto y gastos continúan usando partidas, montos planificados, gastos reales y cálculo de ejecución. La Agenda incorpora las fechas del evento y los vencimientos de tareas.

## Convenios

Un Convenio se relaciona con un Socio y opcionalmente con un Contacto responsable. Contiene nombre, tipo, descripción, inicio, término opcional, enlace al documento y notas. Su vigencia —próximo, vigente o vencido— se deriva de las fechas; puede marcarse cancelado manualmente.

## Recursos

Recursos es un catálogo operativo reutilizable en la organización de eventos. Cada recurso contiene nombre, categoría (`espacio`, `equipamiento`, `material` o `servicio`), descripción, cantidad disponible y notas. En este MVP no se implementan reservas ni inventario histórico.

## Inicio, Agenda y Reportes

Inicio resume actividades recientes, eventos próximos/en curso, tareas pendientes, convenios próximos a vencer y cifras generales.

Agenda consolida eventos y vencimientos de tareas en una vista cronológica filtrable. Las Actividades no aparecen porque son registros históricos ya ejecutados.

Reportes deriva indicadores sin duplicar datos: total de Actividades, Eventos finalizados, participantes de ambas fuentes, distribución por línea VcM, ejecución presupuestaria y actividad reciente. Un Evento se cuenta únicamente desde Eventos.

## Configuración y respaldo

Configuración permite exportar el snapshot como JSON, importar un JSON validado y restablecer los datos de demostración con confirmación. No expone edición del catálogo de líneas VcM.

## Experiencia e interfaz

Se conserva el shell actual: barra lateral, cabecera, tipografía, tokens, tarjetas, tablas, diálogos y comportamiento responsive. Las pantallas nuevas reutilizan los componentes Shadcn existentes, proporcionan estados vacíos, confirmaciones destructivas, mensajes de éxito y controles accesibles.

## Verificación

El desarrollo sigue TDD para el dominio y las validaciones. Se ejecutarán pruebas específicas del MVP y Eventos, TypeScript/build, lint y un recorrido en navegador por los flujos principales en escritorio y móvil. Las fallas heredadas del template en pruebas traducidas se documentarán por separado y no se confundirán con regresiones nuevas.
