# API compartida VcM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implementar y verificar la API NestJS sobre PostgreSQL existente para operar los procesos del PO y ofrecer a la web y Hermes un contrato común autorizado.

**Architecture:** Monolito modular en `server/`, SQL parametrizado con `pg`, DTOs cerrados con Zod y reglas puras en `packages/domain/`. Comandos transaccionales confirman datos, auditoría y outbox juntos; lecturas, consultas semánticas y SSE aplican autorización por objeto. La primera puesta en servicio es privada; publicar HTTPS requiere verificar configuración y destinatarios reales.

**Tech Stack:** Node.js 24, NestJS con adaptador Express, TypeScript, PostgreSQL 18, `pg`, Zod 4, Vitest y Supertest. Paquetes con lockfile propio; fijar versiones exactas verificadas al instalar, sin actualizar el frontend incidentalmente.

**Spec:** `docs/superpowers/specs/2026-10-22-api-vps-design.md`; contrato Hermes en `docs/superpowers/specs/2026-10-22-bd-relacional-hermes-design.md`; esquema vigente en `database/migrations/0001*` a `0008*` y `docs/data/dictionary.md`.

## Global Constraints

- Plataforma en Hostinger Apps; API y PostgreSQL en el VPS existente. PostgreSQL sin puertos públicos; no añadir Redis ni Workers.
- Mantener los siete roles: `coordination`, `leadership`, `direction`, `responsible`, `designer`, `technician`, `viewer`; perfiles de servicio separados.
- Ningún `actor`, `role`, `approved`, `validated` o permiso suministrado por cliente concede autoridad. Hermes no firma decisiones humanas.
- Documentos en Drive, detalle operativo acordado en Notion y publicación en Buffer. La API mantiene referencias y estados confirmados, sin simular efectos externos.
- CLP por HTTP como cadena decimal entera no negativa; fechas civiles `YYYY-MM-DD`; instantes ISO UTC; presentación America/Santiago; `null` distinto de cero.
- No SQL arbitrario, credenciales frontend, copia automática de localStorage ni criterios institucionales inferidos. Solo 4.2.5 tiene criterios completos disponibles.
- Preservar IDs y cambios previos del árbol de trabajo. No usar `git add .`, ni incluir cambios del frontend ajenos a cada tarea.
- No modificar migraciones aplicadas: adiciones desde `0009`. No conectar Hermes a PostgreSQL directamente.

## Review Focus

1. Un expediente legible puede relacionar presupuesto, convenio o documento no legible: filtrar cada objeto antes de joins, conteos y exportaciones (tareas 3 y 9).
2. Un reintento puede llegar a la vez que el original y después de revocarse acceso: no duplicar ni devolver una respuesta antigua sin reautorizar (tarea 4).
3. Secuencias PostgreSQL no expresan orden de commit: SSE no debe perder una transacción lenta al adelantar el cursor (tarea 10).
4. Una revocación de mandato/aprobación puede competir con gasto, cierre o programación: bloquear bases compartidas y revalidar en la transacción (tareas 6 y 7).
5. Un servicio puede declarar identidad humana o intentar autenticarse en una ruta de sesión: mantener identidades, alcances y mecanismos separados (tareas 2 y 3).

## Límite de esta entrega y secuencia posterior

Este plan implementa **la API completa y su despliegue privado**, no solo salud. Sus pruebas HTTP operan expedientes, gobierno, proyectos, finanzas, comunicaciones e indicadores contra PostgreSQL real.

La conexión integral del frontend es la siguiente entrega: sustituir `VcmRepository` y **todas** las escrituras core, login real, caché por usuario, importación revisada y SSE desde Hostinger Apps. No se activará un modo conectado parcial que guarde una parte localmente.

Después se instala la skill Hermes con claves separadas y pruebas por perfil. La activación del worker, cron de recuperación y primera regla de Drive constituye otra entrega, conforme a la especificación B. En esta API las automatizaciones se muestran deshabilitadas; no se ejecutan efectos externos.

## Contratos transversales

- `PrincipalContext`: `{ id: string; kind: 'human' | 'service'; roles: Role[]; scopes: string[]; permissionsVersion: number; sessionId?: string; credentialId?: string }`, construido exclusivamente al autenticar.
- `CommandEnvelope`: `{ command: DomainCommand; expectedVersion: number; idempotencyKey: string }`; alta usa versión `0`. Identificadores y reloj nuevos son del servidor.
- `CommandResult`: `{ objectId: string; version: number; result: unknown }`; respuesta tras commit.
- `ApiError`: `{ code: string; message: string; correlationId: string; issues?: { path: string; code: string }[] }`. Estados: 401 sin identidad válida; 403 acción denegada; 404 objeto inexistente/invisible; 409 versión/idempotencia; 422 regla/DTO; 429 límite; 503 dependencia no disponible.
- `Page<T>`: `{ items: T[]; nextCursor: string | null }`; tamaño 50 por defecto, máximo 100. Cursor ligado a filtro, orden y ámbito; desempate por ID.
- `TransactionContext`: `{ client: PoolClient; principal: PrincipalContext; correlationId: string; now: Date }`.
- `server/src/contracts/commands.ts` será unión discriminada Zod por `type`, con mapeo exhaustivo de los comandos actuales de `types.ts`, `planning-types.ts` y acciones core. Un comando no soportado se rechaza explícitamente; no se descarta.

## Task 1: Servidor ejecutable, contratos y arnés PostgreSQL

**Files:** crear `server/{package.json,pnpm-lock.yaml,pnpm-workspace.yaml,tsconfig.json,vitest.config.ts,.env.example}`, `server/src/{main.ts,app.module.ts,config.ts}`, `server/src/contracts/{common.ts,commands.ts}`, `server/src/http/{errors.ts,health.controller.ts}`, `server/test/{database.ts,health.test.ts}`, `server/scripts/test-local.ts`; modificar `vite.config.ts` para excluir `server/**` de pruebas de navegador.

**Interfaces:** `createApp(config: ServerConfig): Promise<INestApplication>` sin escuchar al importar; `withTestDatabase(run: (pool: Pool) => Promise<void>): Promise<void>` aplica bootstrap y migraciones en BD UUID aislada. `GET /health` devuelve solo `{status:'ok'}`; readiness privado comprueba checksum compatible y conexión.

- [x] Escribir `health.test.ts`: arranque, salud, error sin traza, límite JSON 1 MiB, configuración incompleta rechazada, BD inaccesible y esquema incompatible no ready.
- [x] Ejecutar `pnpm --dir server test:local -- health`; comprobar fallo por servidor aún ausente.
- [x] Implementar configuración validada, cierre ordenado del pool, límite inicial pool 8 y arnés reutilizando el enfoque de `database/scripts/test-local.ts` con puerto configurable sin colisiones. Generar inventario `server/docs/command-map.md`: cada comando local/core, recurso, DTO, permiso, tablas y prueba asignada a tareas 5–8.
- [x] Ejecutar prueba, `pnpm --dir server typecheck` y registrar versiones exactas instaladas.
- [x] Commit de archivos específicos: `feat(api): add server contracts and PostgreSQL test harness`.

## Task 2: Autenticación y provisión privada

**Files:** crear `server/src/identity/{identity.module.ts,password.ts,sessions.ts,service-credentials.ts,auth.guard.ts,session.controller.ts}`, `server/scripts/provision-user.ts`, `server/scripts/provision-service.ts`, `server/test/identity.test.ts`, `database/migrations/0009_api_identity.sql`.

**Interfaces:** `authenticate(request): Promise<PrincipalContext>`; `/v1/session/login`, `/logout`, `/me`, `/csrf`. CLI privada provisiona humanos y revoca sesiones/claves, sin endpoints de registro público. Contraseñas scrypt versionadas (N=32768,r=8,p=1,salt16,key64,maxmem64MiB), token aleatorio 32 bytes y hash SHA-256 en BD; cookie `__Host-vcm_session`, HttpOnly/Secure/SameSite=Lax/Path=/, sin Domain. Inactividad 30 min, máximo 12 h; cookie de desarrollo con nombre diferente y solo localhost explícito.

- [x] Escribir pruebas: login correcto/incorrecto con respuesta uniforme; expiración; logout; principal deshabilitado; token solo hasheado; cookie; origen/CSRF inválido; claves service revocadas/expiradas; Bearer rechazado en login humano. Limitar login por IP y cuenta: 5 intentos/15 min con estado durable en BD, sin registrar contraseña/token.
- [x] Ejecutar prueba y comprobar RED.
- [x] Implementar identidad, protección CSRF para cookie y CORS por origen exacto; autenticación Bearer exclusiva de servicios. Añadir tabla de límites y grants mínimos de identidad para runtime; no otorgar administración de roles/credenciales por HTTP. CLI usa identidad de operador privada. Secrets por fichero privado, nunca argumento de línea de comandos ni log; provisión de claves escribe destino privado indicado y solo muestra ID.
- [x] Ejecutar GREEN contra PG real y regresiones de DB; inspeccionar permisos con `SET ROLE vcm_runtime`.
- [x] Commit: `feat(api): add revocable human and service authentication`.

## Task 3: Autorización por acción, objeto y relación

**Files:** crear `server/src/access/{policy.ts,visibility.ts,access.module.ts}`, `server/test/access.test.ts`, `server/docs/permissions.md`.

**Interfaces:** `assertAction(tx, action: string, objectId?: string): Promise<void>` y `visibilityPredicate(principal, entity, alias): SqlFragment` con parámetros separados. Registro cerrado de ámbitos por entidad; objetos relacionados se comprueban individualmente. Roles no implican lectura global de información restringida/sensible: requieren concesión explícita vigente; responsables y entrevistador requieren asignación. Entidades maestras globales solo contienen campos del catálogo público; notas/contactos personales requieren permiso explícito.

- [x] Probar siete roles, grants vencidos, expediente asignado/no asignado, documento y presupuesto ocultos dentro de caso visible, contactos personales y servicio que inyecta rol/humano. Cada acción de `database/catalog/actions.json` tiene prueba de permitido y denegado.
- [x] Ejecutar RED.
- [x] Implementar política con denegación por defecto; `coordination:read/write/execute` e `interview:read/capture` independientes. En servicio `roles` permanece vacío. Primera entrevista se crea/asigna atómicamente por acción acotada, sin aceptar principal arbitrario como asignatario.
- [x] Ejecutar GREEN; comprobar 404 uniforme de objeto invisible y cero datos en joins denegados.
- [x] Commit: `feat(api): enforce object and action authorization`.

## Task 4: Transacciones, versiones, idempotencia e historial

**Files:** crear `server/src/persistence/{database.module.ts,transaction.ts}`, `server/src/commands/{executor.ts,registry.ts}`, `server/src/events/record-event.ts`, `server/test/commands.test.ts`.

**Interfaces:** `executeCommand(principal, envelope: CommandEnvelope, correlationId: string): Promise<CommandResult>`; handlers reciben `TransactionContext`. Canonicalizar JSON antes de SHA-256; clave ámbito principal+operación, retención 7 días. Bloquear agregado y comprobar versión; auditoría y outbox en la misma transacción; rollback completo ante error.

- [x] Probar dos actualizaciones concurrentes (un éxito/un 409), mismo comando concurrente con misma clave (una mutación), clave con payload distinto (409), rollback sin auditoría/evento, replay después de revocación (denegado) y mismo key entre dos principales (independiente).
- [x] Ejecutar RED.
- [x] Implementar executor y orden estable de locks. Revalidar acceso antes de devolver replay. Clave expirada se rechaza como expirada y exige nueva clave, no vuelve a ejecutar silenciosamente. Manejar deadlock/serialización con rollback y respuesta reintentable sin efectos externos.
- [x] Ejecutar GREEN contra PG real con conexiones simultáneas.
- [x] Commit: `feat(api): add transactional commands and idempotent writes`.

## Task 5: Expedientes, captura trazable, evidencia y cierre

**Files:** crear `server/src/cases/{cases.module.ts,cases.controller.ts,cases.service.ts,cases.read.ts}`, `server/src/capture/{capture.ts,evidence.ts,qa.ts}`, `packages/domain/{package.json,tsconfig.json,src/index.ts,src/cases.ts}`, `server/test/{cases.test.ts,capture.test.ts}`.

**Interfaces:** `/v1/cases` GET/POST, `/v1/cases/:id` GET, `/v1/cases/:id/commands` POST. Captura y revisiones se ejecutan a través del executor; `getCase(principal,id): Promise<CaseDetailDto>`. Extraer reglas puras de `workflow.ts`, `dates.ts`, catálogos y tipos necesarios sin imports de navegador; mantener fachadas frontend para compatibilidad.

- [x] Probar alta sin validación automática, siete presencias/49 campos, evidencia con referencia, planificado/real, respuesta completa sin pérdida, contradicción 10/15 conservada, resolución motivada, referencia del mismo campo/caso y cierre bloqueado por conflicto/evidencia pendiente/operación sin mandato. Entrevistador no clasifica ni valida.
- [x] Ejecutar RED.
- [x] Implementar DTOs cerrados y persistencia relacional; actualizar proyecciones maestras y dato seleccionado conjuntamente. No reconstruir ni guardar snapshot global para cada comando. Versionar campos/caso y preservar fuentes; adjunto no procesado queda pendiente explícito.
- [x] Ejecutar GREEN, pruebas existentes de workflow y frontend; completar entradas de inventario de esta área.
- [x] Commit: `feat(api): implement traceable case intake and institutional review`.

## Task 6: Maestros, planes, proyectos, decisiones y finanzas

**Files:** crear `server/src/operations/{operations.module.ts,operations.controller.ts,masters.ts,projects.ts,planning.ts,finance.ts,decisions.ts}`, `packages/domain/src/{planning.ts,finance.ts,mandates.ts,decisions.ts}`, `server/test/{operations.test.ts,finance.test.ts,authority.test.ts}`.

**Interfaces:** GET/POST `/v1/{organizations,contacts,agreements,resources,projects,plans,decisions}`; GET `/:id` y POST `/:id/commands` por recurso. Presupuesto, compromisos, gastos y tareas se operan desde proyecto por comandos tipados del inventario. Solo campos editables; archivo lógico motivado para borradores sin dependientes formales.

- [x] Probar proyecto compartido por dos casos sin duplicar totales, tareas sin ciclos, operaciones sin plan vigente denegadas, autorización presupuestaria exacta e inmutable, gastos/compromisos simultáneos sin exceder límite, revocación concurrente, gasto vinculado descontado una vez y servicio incapaz de decidir por Dirección.
- [x] Ejecutar RED.
- [x] Implementar invariantes con bloqueos de autorización/mandato/proyecto compartidos y orden estable, extrayendo funciones puras actuales sin conservar stores como fuente de datos. Registrar versión/fundamento/autor real; modificaciones relevantes invalidan vigencia por base revisada. Notion no se sincroniza aún.
- [x] Ejecutar GREEN y pruebas locales de planificación/mandatos/finanzas; inventario de acciones core completamente asignado.
- [x] Commit: `feat(api): implement operational governance and financial controls`.

## Task 7: Campañas, contenido, paquetes y aprobaciones

**Files:** crear `server/src/communications/{communications.module.ts,communications.controller.ts,campaigns.ts,contents.ts,packages.ts}`, `packages/domain/src/campaigns.ts`, `server/test/communications.test.ts`.

**Interfaces:** GET/POST `/v1/{campaigns,contents,editorial-packages}`, GET `/:id`, POST `/:id/commands`. Charter, copy, activos y miembros son revisiones; solicitudes de publicación generan intención pendiente de integración, nunca confirmación externa.

- [x] Probar campaña sin charter completo, aprobación humana requerida, estrategia ajena rechazada, paquete de revisiones exactas, edición posterior exige nueva aprobación, activo agregado después de aprobación denegado y revocación concurrente con solicitud. API nunca responde `published` sin confirmación verificable de proveedor.
- [x] Ejecutar RED.
- [x] Implementar comandos con bloqueo y revisión actual dentro de transacción; contratos de publicaciones/automatizaciones devuelven estado `integration_pending` en vistas, mapeado a estados SQL existentes, sin fabricar enum SQL nuevo ni trabajo ejecutándose.
- [x] Ejecutar GREEN y regresiones de campaña/paquetes de frontend y DB.
- [x] Commit: `feat(api): implement revision-based communications approvals`.

## Task 8: Indicadores, cortes e informes consistentes

**Files:** crear `server/src/reporting/{reporting.module.ts,reporting.controller.ts,indicators.ts,cuts.ts,overview.ts}`, `packages/domain/src/indicators.ts`, `server/test/reporting.test.ts`.

**Interfaces:** GET `/v1/{overview,control,reports,indicators,cuts}` con filtros tipados; POST `/v1/indicators/:id/commands`, `/v1/cuts` y `/v1/cuts/:id/commands`. Metas y avance separados; vistas comparten IDs y base autorizada.

- [x] Probar 4.2.5 solo con registro elegible validado y evidencia aprobada, excluir pendientes/rechazados, evitar duplicación, otros indicadores pendientes de criterios, corte histórico por revisión exacta, observación/corrección y sello que impide nuevos miembros. Comparar el mismo caso entre Portafolio/Control/Reportes.
- [x] Ejecutar RED.
- [x] Implementar reglas autorizadas y trazabilidad regla/período/evidencia; lock de corte al sellar. No conceder conteo a través de una edición de estado enviada por cliente.
- [x] Ejecutar GREEN y pruebas existentes de indicadores/cortes/reportes; inventario de comandos sin entradas omitidas.
- [x] Commit: `feat(api): implement validated indicators and institutional reporting`.

## Task 9: Consulta semántica y catálogo para Hermes

**Files:** crear `server/src/query/{query.module.ts,catalog.ts,schema.ts,compiler.ts,query.controller.ts}`, `server/test/query.test.ts`, `server/docs/query-examples.json`.

**Interfaces:** GET `/v1/catalog` devuelve entidades/campos/acciones accesibles con versión; POST `/v1/query` acepta `{entity,select,where?,relations?,orderBy?,page?,aggregate?}`. Entidades iniciales: cases, presences, activities, evidence, projects, tasks, decisions, budgets, commitments, expenses, campaigns, contents, indicators, contributions, cuts, organizations, contacts, agreements, resources. Campos y relaciones declarados individualmente en catálogo; sin nombres SQL en cliente.

- [x] Probar filtros AND/OR, `eq/ne/in/lt/lte/gt/gte/isNull/contains`, relaciones, orden estable y `count/sum`; inyección y campo/operador desconocido rechazados, `null` distinto de 0, BigInt CLP string, agregado y relación sin filtración, entrevistador sin finanzas generales. Consulta ejemplo: portafolio Alumni/año/en cierre/evidencia pendiente.
- [x] Ejecutar RED.
- [x] Implementar compilación parametrizada y whitelist, máximo 100 filas, 20 selecciones, 20 predicados, profundidad 2, 50 valores `in`, timeout SQL 2 s, relaciones paginadas sin multiplicar sumas. Rechazar costo excesivo con error explícito; no disfrazarlo de cero resultados.
- [x] Ejecutar GREEN; catálogo nunca incluye credenciales, hashes, sesiones, datos de otros objetos ni tablas técnicas.
- [x] Commit: `feat(api): add authorized semantic query contract for Hermes`.

## Task 10: Eventos durables y tiempo real sin saltos

**Files:** crear `server/src/events/{events.module.ts,events.controller.ts,stream.ts,dispatcher.ts}`, `server/test/events.test.ts`, `database/migrations/0010_event_delivery_cursor.sql`.

**Interfaces:** GET `/v1/events` autenticado, `Last-Event-ID` opaco/string; invalidación `{type,objectId,version}`. Heartbeat 15 s, revalidar credencial/sesión y acceso en cada entrega y heartbeat. Sesión revocada cierra stream. Retención inicial 7 días; cursor vencido envía `reset-required` para refetch autorizado.

- [x] Probar commit lento con secuencia menor y commit rápido mayor: ambos se entregan; rollback sin evento; reconexión; duplicados tolerables por cliente; permiso retirado; cursor vencido/manipulado; ningún ID invisible filtrado; cancelación de stream devuelve recursos al pool.
- [x] Ejecutar RED.
- [x] Añadir `event_deliveries(cursor bigint identity, outbox_sequence unique FK)` append-only; dispatcher único mediante advisory lock transaccional recoge solo outbox ya confirmado, inserta entregas y commit antes de liberar lock. SSE recorre cursor de entrega, nunca secuencia cruda de outbox. Polling 1 s de respaldo; NOTIFY solo despierta. Payload sin datos confidenciales. No activar jobs externos.
- [x] Ejecutar GREEN con dos conexiones y barreras de concurrencia; índices por cursor y pruebas de rol SQL.
- [x] Commit: `feat(api): add durable authorized SSE delivery`.

## Task 11: Exportación e importación revisada

**Files:** crear `server/src/imports/{imports.module.ts,imports.controller.ts,preview.ts,apply.ts,export.ts}`, `server/test/imports.test.ts`.

**Interfaces:** POST `/v1/imports/preview` recibe snapshot v1–v4 (límite específico 10 MiB); GET `/v1/imports/:id`; POST `/v1/imports/:id/commit` requiere hash de vista previa, mappings de actores revisados, exclusión demo explícita y clave de idempotencia. GET `/v1/exports` exporta solo objetos autorizados, sin tokens/contraseñas/sesiones.

- [x] Probar IDs y relaciones preservados, revisiones, fuentes contradictorias, demo separado, actor legacy no concede privilegios, snapshot con fecha/monto inválido, usuario real sin mapear bloquea, repetición no duplica e importación sobre base de negocio no vacía rechazada. Exportar/reimportar fixture recupera datos y vínculos.
- [x] Ejecutar RED.
- [x] Implementar staging trazable con issues, respaldo obligatorio antes de commit, importación inicial atómica y sin resolver conflictos por inferencia. Fallo deja lote diagnosticable sin datos parciales. Lotes/raw restringidos, no visibles al entrevistador. Importaciones posteriores no soportadas se rechazan expresamente, nunca reemplazan producción.
- [x] Ejecutar GREEN y regresiones de migración/snapshot frontend.
- [x] Commit: `feat(api): add reviewed legacy import and scoped export`.

## Task 12: OpenAPI, despliegue privado, recuperación y aceptación

**Files:** crear `server/{Dockerfile,.dockerignore,README.md}`, `server/src/openapi.ts`, `server/test/journeys.test.ts`, `infra/vps/api/{compose.yaml,install.sh,verify.sh,README.md}`, `docs/reviews/2026-10-22-api-verificacion.md` (actualizar fecha si cambia).

**Interfaces:** imagen inmutable no root, readonlyroot/tmpfs, caps drop, no-newprivileges, memoria inicial 512 MiB/CPU 0.5, logs rotados, pool 8, reinicio saludable. Red privada `vcm_backend`; acceso operador loopback. SQL login API limitado miembro runtime, secreto 0600; migraciones y operador separados. API no puede ejecutar DDL ni administrar identidades.

- [x] Escribir recorridos HTTP: entrevistador captura → Coordinación revisa conflicto → humano aprueba revisión → operación registra ejecución → QA valida → aporte/corte; negativas por rol, concurrencia y reintento. Probar restart, revocación y filtrado SSE.
- [x] Ejecutar RED en recorrido aún incompleto y completar faltantes sin rebajar asserts.
- [x] Generar OpenAPI versionado con DTOs reales, errores, cookies/Bearer, CSRF, versiones y permisos; comprobar contrato contra rutas, inventario y catálogo. Ejecutar todas las pruebas backend/DB/frontend, typecheck, lint y build.
- [x] Realizar una revisión independiente de la rama completa conforme a `executing-plans`; corregir hallazgos con regresiones antes de desplegar. Preservar cambios anteriores del usuario fuera de commits de esta entrega.
- [x] Tomar backup privado y restaurarlo en otra base; aplicar nuevas migraciones en staging, verificar con identidad limitada e imagen exacta; después migrar principal y desplegar API privada. Reiniciar API y comprobar persistencia, health, logs y consumo junto a Hermes; no reiniciar Hermes incidentalmente.
- [x] Preparar HTTPS `api.vcmeic.cl` con Traefik existente y configuración CORS del origen real de Hostinger Apps. Si origen/cuentas/destino offsite todavía faltan, mantener API privada y consignar bloqueo concreto para publicación y datos reales; no sustituir por CORS comodín, contraseña por defecto ni respaldo ficticio.
- [x] Documentar evidencias, límites, archivos de secreto por ruta sin valores, recuperación en nueva base, rollback de imagen compatible y corte posterior de frontend. Provisionar destinatarios/alcances de claves solo cuando estén concretos; instalación en Hermes queda en su entrega propia.
- [x] Commit: `feat(api): deliver verified private backend and recovery procedures`.

## Verificación del plan

Cobertura revisada contra ambas especificaciones y migración 0008: identidad (2), confidencialidad (3), atomicidad (4), captura/QA (5), MP1/MP2/finanzas (6), comunicaciones (7), indicadores/cortes (8), consultas Hermes (9), realtime (10), migración de datos (11), operación/recuperación (12). Los cinco riesgos de Review Focus tienen pruebas asignadas. Conectar web, instalar skill y ejecutar automatizaciones tienen límites explícitos y se planifican sobre el contrato verificado, sin presentarlos como ya implementados.

Fuentes consultadas: [NestJS autenticación](https://docs.nestjs.com/security/authentication), [PostgreSQL 18 aislamiento](https://www.postgresql.org/docs/18/transaction-iso.html). Las secuencias no aseguran orden de commit; de ahí la entrega SSE ordenada después de observar transacciones confirmadas, en vez de avanzar directamente por la secuencia outbox.
