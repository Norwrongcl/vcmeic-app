# API VcM en el VPS y plataforma en Hostinger Apps

Estado: propuesta para revisión. No es una API implementada ni desplegada.

## Resultado acordado

La plataforma web se aloja en Hostinger Apps. NestJS, PostgreSQL y el ejecutor de automatizaciones funcionan en el VPS existente, junto a Hermes. Los usuarios y ambos perfiles de Hermes operan sobre expedientes compartidos. Las automatizaciones continúan con la web cerrada y los cambios confirmados se ven sin recargar.

Se conserva el documento del PO como fuente de reglas. Drive conserva documentos, Notion la operación acordada y Buffer la programación/publicación. La API conserva expedientes, aprobaciones, referencias externas e historial; no duplica todo el contenido de esos servicios.

Hermes ya tiene conexiones a Drive, Notion y Buffer, según el usuario. Antes de reutilizarlas se verificará el contrato de invocación y los permisos reales. No se presupone que esas conexiones entreguen notificaciones ni acceso automático al backend.

## Evidencia del proyecto

- Frontend React/Vite, sin servidor de aplicación implementado.
- `VcmRepository` es asíncrono, pero su implementación usa Zustand/localStorage.
- `useVcm` usa actores de demostración y el acceso actual no autentica contra un servidor.
- El store de core permite editar tareas, finanzas y entidades maestras directamente. Esas operaciones también deben pasar por la API antes de activar el modo conectado.
- Hay reglas de negocio y pruebas que se reutilizarán, pero sus permisos actuales no constituyen por sí solos una frontera de seguridad productiva.
- Snapshot local versión 4 y migraciones previas. No se importarán datos de demostración automáticamente.
- PostgreSQL 18.6 está healthy en el VPS, en red Docker privada, sin puertos publicados, con volumen y backup diario. La API todavía no existe.

## Alternativas y elección propuesta

1. **NestJS modular, PostgreSQL y proceso worker separado:** recomendado. Una única aplicación backend y un único esquema de negocio, con dos procesos desplegables para separar peticiones de trabajos largos. Aprovecha el VPS y evita microservicios o Redis innecesarios al inicio.
2. Backend administrado: reduce mantenimiento, pero añade otro proveedor y cuotas. No es necesario para el alcance inicial acordado.
3. API y sincronización en Workers: técnicamente posible, pero introduce otra plataforma de ejecución cuando el VPS ya tiene margen y Hermes permanece ahí.

El alcance se divide en dos entregas independientes. La primera deja la plataforma multiusuario; la segunda añade automatización. No se considerará terminada una entrega por tener solo endpoints de salud.

## Entrega A: API compartida y conexión de la web

### Despliegue y estructura

Backend en `server/`, con paquete, lockfile y build propios. Módulos de configuración, identidad, dominio, persistencia, auditoría y eventos. Extraer las funciones puras de reglas a un paquete compartido sin dependencias de React, Zustand, navegador o rutas de Vite. Mantener las pruebas actuales y sumar contratos de servidor.

API en contenedor no root, con healthcheck, límites de recursos, logs acotados y reinicio automático. Conectar a `vcm_backend` y a una red de salida cuando sea necesario; no conectar Hermes directamente a PostgreSQL. Usuario SQL de ejecución sin superusuario ni DDL; migraciones con identidad separada. Copias antes de migraciones y comprobación de compatibilidad al arrancar.

Publicación propuesta en `https://api.vcmeic.cl`, mediante Traefik existente, sin modificar el alojamiento de la web. Primero verificar desde loopback, después HTTPS. La apertura pública y el registro DNS se revisan como acciones de despliegue; no exponer rutas de administración ni PostgreSQL. No se requiere contratar Cloudflare Workers; el DNS actual puede seguir donde esté.

### Identidad y permisos

Autenticación real para personas mediante usuarios provisionados por administración; no hay registro público ni credenciales por defecto. Contraseñas con hash resistente y parámetros versionados; recuperación inicial mediante operación administrativa privada, sin correo ficticio. Sesiones opacas revocables, expiración por inactividad y duración máxima, tokens almacenados con hash en la base y cookie HttpOnly/Secure limitada al host de API.

Para la web se requiere un dominio HTTPS del mismo sitio que la API para no depender de cookies de terceros: usar un subdominio de `vcmeic.cl` alojado en Hostinger Apps. El origen exacto se toma del despliegue real y se permite explícitamente en CORS; no usar comodín con credenciales. Proteger escrituras con comprobación de origen y token CSRF. El modo local usa configuración explícita solo en desarrollo.

El rol y la identidad se resuelven en el servidor, nunca del cuerpo enviado por el cliente. Mantener los siete roles actuales y revisar permisos por operación, expediente, relaciones y confidencialidad. El selector de demostración no puede cambiar el rol efectivo en modo conectado. Los listados, búsquedas, agregaciones, respaldos y eventos aplican el mismo control.

Hermes usará cuentas de servicio separadas y revocables: entrevistador y Coordinación. Credenciales diferentes por perfil, con hash en servidor, sin privilegios de administración. El entrevistador solo crea/aporta antecedentes y referencias en expedientes asignados; no valida evidencia, clasifica institucionalmente, aprueba, publica, exporta todo ni consulta otros expedientes. El perfil de Coordinación prepara y gestiona según permisos explícitos, pero no recibe por defecto la autoridad humana de Jefatura/Dirección. Auditoría identifica perfil técnico y, cuando exista, al solicitante humano verificado; no acepta identidad humana declarada libremente por el modelo.

La provisión de cuentas y la instalación de credenciales en Hermes se realizan al final, con el destinatario y alcance revisables. No copiar las credenciales actuales de Drive/Notion/Buffer al frontend.

### Persistencia, comandos y concurrencia

Tablas con IDs estables para usuarios/sesiones, expedientes, campos trazables, fuentes, evidencias, decisiones, proyectos/tareas, finanzas, campañas/contenidos, planes, indicadores/aportes y cortes/observaciones. Usar columnas tipadas para IDs, relaciones, estado, versión y consultas; JSONB para estructuras de antecedentes trazables y payloads versionados. No guardar toda la plataforma como un snapshot mutable único.

Cada comando se valida en ejecución contra un esquema cerrado: un tipo TypeScript por sí solo no valida peticiones. Comprobar referencias, pertenencia al expediente, autoridad y reglas del PO. Escritura, nueva versión, auditoría y evento se confirman en la misma transacción.

Las modificaciones llevan la versión esperada del agregado y una clave de idempotencia. Una versión obsoleta produce `409` sin sobrescritura silenciosa. Repetir la misma clave con el mismo comando devuelve el resultado previo; con otro payload se rechaza. Importes CLP como enteros; fechas de evento y fechas civiles se modelan sin conversiones implícitas. Auditoría append-only para la identidad de ejecución.

### Contrato HTTP inicial

Prefijo `/v1`. Rutas públicas únicamente para salud superficial y autenticación limitada. El detalle de readiness queda privado. Errores con código estable, mensaje útil y correlationId, sin secretos ni trazas internas.

| Área | Contrato |
|---|---|
| Sesión | inicio/cierre, usuario actual, token CSRF; administración privada de cuentas |
| Expedientes | listado paginado, detalle autorizado, comandos validados por versión |
| Entidades operativas | organizaciones, contactos, convenios, recursos, proyectos, tareas, presupuestos y gastos |
| Procesos PO | planes, decisiones, campañas/contenidos, evidencia, QA/cierre, indicadores y cortes |
| Lecturas agregadas | Inicio, Control y Reportes desde la misma base autorizada |
| Respaldo/importación | exportación con alcance autorizado; importación administrativa prevalidada y sin fusión silenciosa |
| Tiempo real | stream SSE autenticado con cursor y reconexión |

La documentación OpenAPI detalla DTOs, permisos, versiones, paginación y errores. El catálogo exacto de endpoints y migraciones será parte del plan de implementación, sin redefinir reglas institucionales.

### Tiempo real

SSE es suficiente para avisar de cambios: las escrituras siguen por HTTP y el servidor envía eventos de invalidación mínimos, sin contenido confidencial. Eventos durables con secuencia, tipo, agregado y versión; publicación después del commit. PostgreSQL puede notificar para despertar emisores, pero la tabla de eventos es el respaldo durable.

Revalidar autorización en cada entrega y cerrar sesiones revocadas. Reconectar desde cursor; si queda fuera de retención, pedir recarga autorizada. Los clientes vuelven a consultar datos del expediente y no aplican estados inventados. No incluye edición colaborativa carácter a carácter ni presencia de cursores.

### Migración y conexión del frontend

Modo local y modo API explícitos. En API, todas las escrituras —incluidas las del store core— pasan por servidor; sin fallback silencioso a localStorage. La caché local no es fuente de verdad y se limpia o invalida al cambiar de usuario.

Importar snapshots mediante vista previa de conteos, IDs y referencias. Respaldar antes, distinguir registros demo y exigir revisión de vínculos entre responsables locales y usuarios reales. IDs `demo-*` no otorgan permisos. No transferir contraseñas ni sesiones. La primera importación se hace sobre una base vacía de negocio; importaciones posteriores nunca reemplazan la base productiva como si fuera un archivo local.

Probar el origen real de Hostinger Apps, cookies, CORS, reconexión, dos navegadores y operaciones de core. El cambio de web productiva requiere backend y migración verificados; no se despliega una web que aparente guardar en servidor mientras usa datos locales.

## Entrega B: ejecutor persistente e integración de Hermes

Proceso worker separado con cola persistente en PostgreSQL, concurrencia inicial 1 y tareas cortas de reclamación mediante bloqueo de filas. Cada trabajo tiene regla/version, expediente, condición, estado, vencimiento, intentos, próxima ejecución, lease, idempotencia, resultado y motivo de bloqueo. No mantener una transacción SQL abierta durante una llamada a un proveedor.

Un cambio de expediente crea, actualiza o cancela trabajos en la misma transacción. Un barrido periódico recupera pendientes vencidos y leases expirados. Antes de actuar, volver a leer condición, permisos y versión de aprobación. Reintentos con backoff y límite; al agotarlos, incidencia visible para Coordinación. Evitar bucles de eventos originados por la propia sincronización.

No prometer ejecución externa exactamente una vez: usar claves del proveedor cuando existan y conciliación ante resultados ambiguos. Distinguir preparado, solicitado, confirmado y fallido. Cambios de contenido aprobado invalidan el permiso previo conforme al PO.

Primer caso candidato: falta encuesta en Drive. La condición necesita carpeta/referencia, encuesta esperada, plazo y política de revisión explícitos. Buscar un archivo no certifica contenido ni calidad. Hallazgo registra referencia y deja revisión cuando corresponda; ausencia vuelve a programar y vencimiento crea incidencia. Sin acceso o definición suficiente, trabajo bloqueado con razón, no encuesta inventada. Crear formularios, enviar mensajes o publicar tiene su propia acción y autorización; no se deriva automáticamente de «falta encuesta».

La verificación de conectores Hermes, webhook/polling y la primera regla se diseña como subproyecto después de A. Hasta completar B, la API muestra automatizaciones no habilitadas; un timer de backup no se presenta como automatización de negocio.

## Verificación y entrega

1. Pruebas contra PostgreSQL real: migraciones, rollback de transacciones, referencias y persistencia después de reiniciar API/base.
2. Usuario sin sesión rechazado; cambios de rol/actor enviados por cliente no elevan privilegios; cuenta deshabilitada pierde acceso, incluido SSE.
3. Responsables y entrevistador no leen expedientes ajenos ni exportan datos no autorizados; relaciones y eventos tampoco filtran datos.
4. Dos clientes modifican la misma versión: uno confirma, otro recibe conflicto; reintentos no duplican gasto, evidencia o decisión.
5. El mismo expediente se ve consistente en Portafolio, Control y Reportes; cierre, QA, indicadores y aprobaciones conservan reglas actuales.
6. Copias y migraciones locales sin pérdida, datos demo identificados, sin importación automática ni elevación de IDs heredados.
7. Prueba real desde Hostinger Apps por HTTPS, actualización sin recargar, reconexión con cursor y ninguna escritura local en modo conectado.
8. Build/lint y pruebas frontend/backend, logs sin tokens, SQL privado, healthchecks y consumo medido junto a Hermes.
9. Restauración de respaldo, procedimiento de rollback y copia externa antes de incorporar datos operativos.
10. Para B: reinicio durante un trabajo, lease vencido, acceso revocado, condición resuelta, aprobación obsoleta y resultado externo ambiguo.

## Exclusiones y configuración operativa pendiente de comprobar

No se cambia el alojamiento de la plataforma al VPS, no se añade Redis por defecto y no se modifica el modelo/proveedor de Hermes. No se recrean conectores que ya funcionan sin inspeccionarlos. No se inventan criterios faltantes del Manual de Indicadores.

El origen definitivo de Hostinger Apps, cuentas humanas iniciales, asignaciones de expedientes y destino de respaldo externo se verifican durante la preparación del despliegue. La API se prueba de forma privada hasta disponer de esa configuración; no se usa un origen comodín ni se abre PostgreSQL como alternativa.

## Fuentes técnicas

- [NestJS: Server-Sent Events](https://docs.nestjs.com/techniques/server-sent-events).
- [NestJS: Authentication](https://docs.nestjs.com/security/authentication).
- [PostgreSQL: SELECT y SKIP LOCKED](https://www.postgresql.org/docs/18/sql-select.html).
- Código local: `src/features/vcm/model/repository.ts`, `use-vcm.ts`, `workflow.ts`, `src/features/core/model/app-store.ts` y `src/stores/auth-store.ts`.
