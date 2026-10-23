# VcM API

API NestJS independiente del frontend. Implementa autenticación, permisos por objeto, captura/QA, proyectos, gobierno, finanzas, campañas/contenidos, indicadores/cortes, consulta semántica y SSE sobre PostgreSQL real. La web sigue local hasta su entrega de conexión. No hay worker ni llamadas externas a Drive, Notion o Buffer.

## Desarrollo y verificación

Node 24; instalar con `pnpm --dir database install` y `pnpm --dir server install --frozen-lockfile --ignore-scripts`. El arnés local reutiliza el PostgreSQL de desarrollo de database (en macOS debe tener las bibliotecas/symlinks del runtime verificado). No usa `DATABASE_URL`: solo `TEST_DATABASE_URL` para bases aisladas UUID. Elige puerto loopback disponible; `TEST_PG_PORT` lo fija explícitamente.

```sh
pnpm --dir server test:local
pnpm --dir server typecheck
pnpm --dir server build
node server/scripts/generate-openapi.mjs
```

La imagen de verificación prueba PostgreSQL real del VPS mediante bases desechables; las pruebas no limpian la base principal. El frontend conserva sus pruebas separadas.

## Arranque y secretos

Ejecutar desde `server/`: `pnpm start`, después de aplicar las migraciones con identidad de operador. El servicio verifica todos los checksums al iniciar; no migra automáticamente.

Producción: `NODE_ENV=production`, `WEB_ORIGINS` lista explícita de orígenes HTTPS, `DATABASE_URL_FILE` y `CURSOR_KEY_FILE` apuntan a ficheros privados. Alternativamente las variables servidor `DATABASE_URL`/`CURSOR_KEY` existen para herramientas locales; nunca son variables VITE. Clave de cursor: 32 bytes aleatorios representados por 64 caracteres hexadecimales. No guardar valores reales en este repositorio.

Pool SQL 8; runtime sin DDL, administración de usuarios ni DELETE. El secreto de aplicación debe corresponder a un LOGIN limitado miembro de `vcm_runtime`, nunca postgres/migrator. Operadores usan credencial separada. Ninguna cuenta humana ni credencial Hermes se crea al arrancar.

## Identidad y autoridad

Sesiones humanas opacas en BD, cookie HttpOnly/Secure/SameSite=Lax, inactividad 30 minutos, máximo 12 horas. Escrituras con cookie requieren origen permitido y CSRF de `/v1/session/csrf`; login requiere origen y limita intentos por IP/cuenta. Roles y scopes se leen del servidor. Claves de servicio distintas por perfil y revocables. Saber un endpoint no concede permiso ni permite firmar por un humano.

Scripts privados `scripts/provision-user.ts`, `scripts/provision-service.ts`, `scripts/issue-import-backup.ts`: reciben **ruta de JSON 0600**, no contraseñas por argumentos. Los dos primeros funcionan con el operador SQL separado; el de servicios escribe credencial solo a destino privado nuevo y muestra ID, nunca token. No hay registro público, reset por email simulado ni contraseña por defecto.

## Contratos

- OpenAPI generado: [docs/openapi.json](docs/openapi.json); `/v1/openapi.json` requiere identidad válida.
- Catálogo `/v1/catalog`: entidades, campos públicos, comandos según perfil y catálogos controlados.
- Escritura: `{command, expectedVersion, idempotencyKey}`. Alta versión 0; cada agregado aumenta su propia versión. El cuerpo nunca asigna actor/rol/validación libre.
- Reintento idéntico devuelve confirmación previa tras reautorizar; misma clave/otro comando o versión obsoleta: 409. Claves vencen en siete días y no se reejecutan automáticamente.
- CLP: cadena decimal entera; fecha civil `YYYY-MM-DD`; instantes ISO con zona; `null` distinto de 0.
- GET de colecciones: `limit` 1–100 y `cursor`; GET de detalle separado. Consulta compuesta por `POST /v1/query` ([ejemplos](docs/query-examples.json)); SQL no aceptado. Agregación sobre registros autorizados; SUM omite null. Los avances institucionales se obtienen de `/v1/indicators`, y finanzas del resumen de proyecto.
- `/v1/overview`, `/v1/control`, `/v1/reports` ofrecen resumen operativo limitado a 100 expedientes/decisiones/tareas por bloque. Para recorrer la base usar colecciones paginadas, consulta y exportación; el resumen no es un volcado completo.
- SSE `/v1/events`: invalidaciones, cursor cifrado ligado a identidad/sesión/permisos, heartbeat 15 s. Cursor fuera de retención (7 días) requiere recargar datos autorizados. La entrega usa cursor asignado después del commit; no asume orden de commit de secuencias SQL. Archivar emite invalidación autorizada sin exponer contenido eliminado de las vistas.

## Fuentes e integraciones

Datos confirmados por un entrevistado no equivalen a validación institucional. Contradicciones conservan afirmaciones; la resolución selecciona un ID y fundamento. Una corrección de expediente validado requiere devolución y revisión. Evidencia sin adjunto procesado permanece pendiente; URLs son referencias, no archivos subidos.

Aprobaciones refieren revisión exacta. Cambiar estrategia/copy/activo requiere validación nueva. Las operaciones externas quedan preparadas/pending de integración, nunca publicadas o enviadas por guardar. Hermes ya tiene conexiones según el usuario; aquí no se reinstalan ni se usan automáticamente. El entrevistador no administra ni consulta expedientes ajenos.

## Importación y recuperación

`POST /v1/imports/preview` acepta snapshots 1–4 hasta 10 MiB. Presenta IDs, relaciones, problemas y responsables por vincular. Los formatos sin marca demo requieren clasificación explícita por caso. `commit` requiere hash, mapa de humanos activos, `includeDemo` explícito, clave idempotente y recibo de backup emitido por operador después del backup verificado, ligado a base/esquema/lote y vigente una hora. Solo primera importación sobre base de negocio vacía; no fusiona/reemplaza producción.

Se activan maestros, expedientes y campos tipados/fuentes/evidencias, vínculos de proyecto, tareas y montos planificados. Estado institucional y evidencia quedan pendientes; las afirmaciones contradictorias permanecen. **Planes, decisiones, campañas/contenidos, gastos históricos, compromisos, forecasts, cortes y aportes del archivo se conservan en staging restringido con problemas pendientes de revisión.** No se fabrican autorizaciones humanas para incorporarlos como aprobados. `GET /v1/imports/:id` distingue correspondencias activadas (`internalId`) de originales pendientes. El archivo depurado de secretos se conserva completo; el nuevo historial identifica al importador, no suplanta autores antiguos.

`GET /v1/exports` es intercambio JSON autorizado, no reemplaza `pg_dump`. Incluye expedientes trazables y vínculos visibles; fuentes originales de importación solo con alcance completo visible. No exporta cuentas, sesiones, hashes ni blobs de auditoría sin filtrar. Los originales permiten repetir la migración revisada en otra base; recuperar **toda** la BD con exactitud requiere el backup privado PostgreSQL. Copia externa/retención pendiente antes de datos operativos reales.

Archivo lógico de borradores conserva filas/historia y bloquea antecedentes formales. Restaurar archivos lógicos requiere operador en esta etapa.

## Límite operativo

No hay conexión web/Hermes, claves de canal ni crons de negocio instalados por este paquete. SQL y API deben seguir privados hasta verificar origen de Hostinger Apps, usuarios iniciales, configuración del proxy y respaldo externo. Ver [operación VPS](../infra/vps/api/README.md).

### Lecturas de detalle y relaciones

`GET /v1/plans/:id` incluye `revision` con objetivos y casos autorizados. `GET /v1/decisions/:id` incluye propuesta, alternativas, impacto, monto, revisión y resultados; `GET /v1/projects/:id` incluye `workPlanRevision`, `mandates`, `budgetAuthorizations` y responsables/dependencias de tareas. Estos IDs permiten continuar comandos desde otro cliente, sin conservar respuestas de altas. Las referencias invisibles se omiten o se devuelven como null; los objetos relacionados no heredan acceso automáticamente.

Las expansiones semánticas conservan sus arrays y añaden por fila `relationPages.<nombre>.nextCursor`. Para seguir una relación, filtra la consulta raíz al ID de ese padre y envía `relations[].cursor` sin cambiar la selección/filtro/límite de esa relación. Un cursor pertenece a ese padre e identidad; se comprueba la visibilidad otra vez. `null` significa final. Las filas de gastos archivados no participan en consultas, expansiones, sumas ni exportaciones actuales; su historia permanece en la BD/auditoría.
