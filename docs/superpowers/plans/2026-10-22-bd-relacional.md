# Base relacional VcM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Crear y desplegar el esquema relacional VcM en PostgreSQL del VPS, con migraciones verificadas, diccionario físico y recuperación probada.

**Architecture:** Migraciones SQL ordenadas y versionadas, sin depender del navegador ni de NestJS para aplicar el esquema. Pruebas de integración contra PostgreSQL 18 en una base aislada. Los contratos del esquema y su catálogo semántico preparan la API posterior; todavía no habilitan acceso de Hermes.

**Tech Stack:** PostgreSQL 18, SQL, Node.js, TypeScript, `pg`, Vitest en entorno Node y Docker para pruebas aisladas. Versiones de herramientas fijadas en el lockfile al instalar; reutilizar TypeScript 6 y Vitest 4 del proyecto donde sean compatibles.

**Spec:** `docs/superpowers/specs/2026-10-22-bd-relacional-hermes-design.md`, complementado por `docs/superpowers/specs/2026-10-22-api-vps-design.md`.

## Global Constraints

- La web continúa en Hostinger Apps; PostgreSQL permanece privado en el VPS.
- IDs internos `text`, opacos e inmutables: conservar los existentes; nuevos generados por servidor.
- Fechas civiles `date`; instantes `timestamptz`; agenda con zona IANA, inicialmente America/Santiago.
- Dinero CLP en `bigint` no negativo; API lo serializa como cadena decimal para evitar pérdida de precisión.
- No se importan datos demo como datos institucionales.
- No modificar Hermes, publicar puertos SQL ni recrear el volumen existente.
- No inventar catálogos, autoridad institucional ni criterios de indicadores faltantes.
- Migraciones de negocio solo en esquema `vcm`; historial técnico en `vcm_meta`; preservar `infra_checks`.
- Ninguna aprobación es un booleano libre; refiere una revisión exacta.
- La API, conexión frontend, skill y primera automatización tienen planes posteriores, en ese orden.

## Review Focus

- Dos despliegues simultáneos: uno aplica; el otro espera y detecta lo ya aplicado, sin duplicar DDL.
- Evidencia o candidato de otro expediente: FK compuesta rechaza el vínculo aunque los IDs existan.
- Datos legacy incompletos: preservación y observación, sin convertir vacíos en cero ni asignar autoridad por nombre.
- Revisiones históricas: una edición no modifica el contenido aprobado anteriormente.
- Fallo durante migración/restauración: sin migración marcada completa ni escritura sobre la base activa durante ensayo.

## Entregables y estructura

- `database/package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vitest.config.ts`: herramientas independientes del frontend.
- `database/src/migrate.ts`, `cli.ts`: runner y CLI de migraciones.
- `database/migrations/0001_identity_catalogs.sql` a `0007_integrations_operations.sql`: esquema por dominio.
- `database/catalog/fields.json`, `states.json`, `actions.json`: contratos versionados, no secretos.
- `database/tests/helpers/database.ts`: base efímera por suite y limpieza solo de esas bases.
- `database/tests/*.test.ts`: pruebas reales PostgreSQL; no mocks para integridad SQL.
- `database/README.md`, `.env.example`, `.gitignore`: ejecución y custodia de credenciales.
- `docs/data/dictionary.md`, `p52-mapping.csv`, `relationships.md`: diseño físico, correspondencias y diagrama ER.
- `infra/vps/postgres/migrate.sh`, `verify-domain.sh`: aplicación y verificación privadas en VPS.

## Task 1: Contrato físico y correspondencia con el frontend

**Files:** Create `docs/data/dictionary.md`, `docs/data/p52-mapping.csv`, `docs/data/relationships.md`, `database/catalog/fields.json`, `states.json`, `actions.json`; test `database/tests/catalog.test.ts` en Task 2.

**Interfaces:** Produce `fields.json`: array de `{schemaVersion,key,label,valueType,unit,multiple,classification,storage}`; `states.json`: catálogo por objeto y transición; `actions.json`: acción, roles/scopes, precondiciones y autoridad. La API posterior consume estos contratos, no nombres físicos arbitrarios.

- [x] Enumerar cada tabla propuesta con PK/FK, nulabilidad, default, índices, unicidad, protección, revisión y política de archivo/borrado; cada tabla de la especificación debe aparecer o tener consolidación justificada.
- [x] Mapear exactamente los 49 elementos de `ACTIVITY_FIELDS` a tipos/relaciones, conservando sus keys; documentar campos adicionales y P5.1 por separado. Registrar valores planificados/reales por separado; cantidades desconocidas NULL.
- [x] Definir claves compuestas que impidan cruzar expediente/campo/afirmación, evidencia/aporte y proyecto/partida/gasto; registrar las invariantes que corresponden a transacciones de API.
- [x] Documentar estados actuales y estados PO que requieren correspondencia explícita; no convertir silenciosamente estados legacy ni cambiar reglas UI en este trabajo.
- [x] Documentar `eventId → project_id`, `partner → organization`, IDs locales conservados y vínculos inciertos pendientes; ilustrar cardinalidades en Mermaid.
- [x] Revisar contra tipos core/VcM y PO, comprobar `git diff --check`, y realizar commit limitado a estos archivos.

## Task 2: Runner transaccional y pruebas PostgreSQL

**Files:** Create herramientas `database/`, `src/migrate.ts`, `src/cli.ts`, `tests/helpers/database.ts`, `tests/migrations.test.ts`, `tests/catalog.test.ts`, `.env.example`, `.gitignore`, `README.md`.

**Interfaces:** `migrate(client: PoolClient, directory: string): Promise<{applied: string[]}>`; tabla `vcm_meta.schema_migrations(version text PK, checksum text, applied_at timestamptz)`. CLI `pnpm --dir database migrate`, `pnpm --dir database test`, `pnpm --dir database typecheck`.

- [x] Escribir pruebas: `appliesOnce`, `rejectsChangedChecksum`, `rollsBackFailedMigration`, `serializesConcurrentRunners`; afirmar cero registro de versión fallida y ausencia de su tabla parcial. Catálogo: 49 keys oficiales únicas y siete tipologías de presencia.
- [x] Ejecutarlas y confirmar fallo por runner inexistente; crear primero el arnés mínimo necesario, sin afirmar cobertura SQL si no hay conexión real.
- [x] Implementar lectura ordenada, SHA256, advisory lock de sesión exclusivo, una transacción por archivo y registro en la misma transacción; liberar lock/conexión en finally. Si cambia un checksum aplicado, abortar.
- [x] Usar URL de prueba privada; arnés crea bases con prefijo `vcm_test_`, comprueba nombre antes de borrar y nunca usa la base `vcm` como destino destructivo. Docker local si está disponible; alternativa contenedor efímero aislado en VPS.
- [x] Ejecutar test y typecheck con éxito; registrar versión PG, comandos y resultados. Commit solo de este entregable.

## Task 3: Identidad, maestros y trazabilidad del expediente

**Files:** Create migraciones `0001_identity_catalogs.sql`, `0002_cases_traceability.sql`; tests `identity.test.ts`, `traceability.test.ts`.

**Interfaces:** Esquema físico de Task 1: principals/users/roles/sesiones/scopes, objetos protegidos y grants, maestros, expedientes/registros, campos/afirmaciones/resoluciones/fuentes/documentos/evidencias. Incluye índices de todas las FK usadas en búsquedas.

- [x] Escribir y ejecutar pruebas fallidas: email duplicado rechazado, usuario distinto de contacto, relación huérfana rechazada, selección de afirmación de otro campo/expediente rechazada, dos cifras incompatibles preservadas, NULL distinto de cero y borrado de fuente referenciada rechazado.
- [x] Implementar ambas migraciones con restricciones nombradas y sin seeds de usuarios/credenciales. Insertar solo catálogos respaldados por fuente y siete roles; los scopes de servicio son capacidades distintas de roles humanos.
- [x] Probar historial de revisiones de evidencia y confidencialidad independiente del documento; no declarar autorización API probada por existir una tabla de permisos.
- [x] Ejecutar suites Task 2–3 y typecheck. Commit de migraciones/tests y ajuste de diccionario si se detecta discrepancia.

## Task 4: Operación, gobierno y finanzas

**Files:** Create `0003_planning_operations.sql`, `0004_governance_finance.sql`; tests `projects.test.ts`, `finance.test.ts`, `approvals.test.ts`.

**Interfaces:** Planes/revisiones/objetivos; proyectos con expedientes N:M; tareas/dependencias/asignaciones/recursos; riesgos/incidencias/seguimientos; decisiones/versiones/resoluciones/aprobaciones/mandatos; partidas/autorizaciones/compromisos/gastos/estimaciones.

- [x] Escribir y ejecutar pruebas fallidas: dos expedientes comparten proyecto sin duplicarlo; gasto de otra partida/proyecto rechazado; gasto no se imputa a dos compromisos; monto negativo rechazado; revisión aprobada queda inmutable al crear revisión nueva; mandato conserva revisión de plan y aprobación.
- [x] Implementar migraciones; revisiones inmutables protegidas contra UPDATE/DELETE del runtime, sin cascadas que borren decisiones o gastos. Gastos referencian partida y proyecto mediante clave compuesta; vínculos financieros conservan versiones de autorización.
- [x] Registrar en `actions.json` operaciones que necesitan validación transaccional futura: ausencia de ciclos, saldo autorizado, autoridad, mandato vigente y cambios críticos. No confiar en CHECK entre tablas para resolverlas.
- [x] Probar `9223372036854775807` en bigint donde el dominio admita ese límite técnico sin pérdida de representación del cliente; la política financiera del negocio podrá fijar un máximo menor posteriormente.
- [x] Ejecutar suites completas y typecheck; commit limitado.

## Task 5: Campañas, contenido, indicadores y cortes

**Files:** Create `0005_campaigns_communications.sql`, `0006_indicators_reporting.sql`; tests `communications.test.ts`, `indicators.test.ts`, `cuts.test.ts`.

**Interfaces:** Campañas/contenidos/revisiones/paquetes/operaciones externas; indicadores/reglas/metas/aportes/evidencias/cortes/observaciones/report_runs conforme al diccionario.

- [x] Escribir y ejecutar pruebas fallidas: paquete conserva revisiones exactas, cambiar copy crea otra revisión, operación de publicación apunta a revisión aprobada identificable; aporte con evidencia ajena rechazado; aporte 4.2.5 duplicado por registro/indicador/período rechazado; meta no crea avance; corte conserva revisión histórica.
- [x] Implementar migraciones con referencias compuestas y unicidad. Estado solicitado no equivale a confirmado; conservar IDs y respuesta de conciliación externa sin guardar tokens.
- [x] Sembrar definiciones/metas conocidas con fuente explícita; reglas no disponibles quedan pendientes. Preparar fixtures de aportes pendientes/validados sin afirmar que la BD sola aplica elegibilidad completa.
- [x] Ejecutar suites completas y typecheck; commit limitado.

## Task 6: Auditoría, cola, importación y permisos SQL

**Files:** Create `0007_integrations_operations.sql`, `tests/audit.test.ts`, `tests/queue.test.ts`, `tests/privileges.test.ts`, `tests/import-mapping.test.ts`; Modify `database/README.md`.

**Interfaces:** Tablas externas, conexiones, reglas/trabajos/intentos, auditoría/outbox/idempotencia y lotes/mapeos/incidencias de importación. Roles SQL `vcm_migrator` y `vcm_runtime`, claves provisionadas fuera de SQL versionado.

- [x] Escribir y ejecutar pruebas fallidas: idempotencia única por principal/operación/clave; clave de otra identidad independiente; claim de dos workers no toma el mismo trabajo; fallo transaccional no deja auditoría/outbox parcial; runtime sin DDL, sin alterar/borrar revisiones y auditoría.
- [x] Implementar estructura de cola/lease/índices, no worker ni automatizaciones activas. Delimitar permisos por tabla; runtime no es propietario, superusuario ni BYPASSRLS; catálogo público excluye secretos.
- [x] Probar lote legacy con ID estable, dato demo y responsable sin identidad: se conservan referencias y quedan incidencias pendientes; no crear usuarios privilegiados ni importar sesiones. Este trabajo verifica estructura de staging, no implementa aún la importación completa del frontend.
- [x] Ejecutar todas las pruebas y typecheck; documentar qué invariantes requieren API y no pueden declararse entregadas todavía. Commit limitado.

## Task 7: Aplicación privada y recuperación en el VPS

**Files:** Create `infra/vps/postgres/migrate.sh`, `verify-domain.sh`; Modify `infra/vps/postgres/README.md`; Create `docs/reviews/2026-10-22-bd-relacional-verificacion.md`.

**Interfaces:** Scripts con `set -euo pipefail`, logs privados sin secretos, `psql -v ON_ERROR_STOP=1` dentro de red privada; no instalación de Node en host requerida: runner en contenedor temporal con versiones fijadas. Migraciones se ejecutan como migrator; provisión de roles desde administración privada.

- [x] Inspeccionar base, roles y versiones actuales sin imprimir secretos; confirmar que no contiene datos de negocio inesperados. Si los hay, comparar y preparar migración, no limpiar ni sobrescribir.
- [x] Ejecutar backup existente y comprobar COMPLETE/checksums. Provisionar roles con secretos generados y custodiados en VPS; probar migraciones primero en base nueva de ensayo.
- [x] Ensayar interrupción/error en base de prueba y restaurar el dump en otra base nueva; verificar tablas, relaciones y conteos de fixture. Conservar logs y no restaurar sobre `vcm`.
- [x] Aplicar migraciones verificadas a `vcm`, confirmar checksums/versiones/roles, FK e índices; reiniciar solo PostgreSQL si la prueba lo requiere y verificar conservación. Hermes y frontend permanecen operativos como antes.
- [x] Ejecutar nuevo respaldo del esquema desplegado y restaurarlo en base de ensayo. Registrar que backup local no cubre pérdida del VPS; destino externo sigue requerido antes de datos reales.
- [x] Entregar diccionario, diagrama, matriz de campos, versiones aplicadas, evidencia de pruebas y recuperación. Commit del reporte sin secretos ni dumps.

## Handoff posterior

Con esta entrega aprobada y verificada, preparar un plan específico para API/identidad/autorización/consultas semánticas/transacciones/SSE/importación/frontend, apoyado en nombres y contratos reales del esquema. Después preparar el de skill/credenciales por perfil/worker/primera regla autorizada.

No considerar terminado el proyecto completo por tener tablas: hasta conectar API y web, los usuarios seguirán usando datos locales; hasta instalar/verificar la skill, Hermes no tendrá acceso a esta base.

## Registro de ejecución

Ejecutado en esta sesión. Se añadió 0008 por ocho hallazgos de revisión independiente, todos reproducidos y corregidos; 36 pruebas finales en PostgreSQL 18.4 local y 18.6 VPS. No se emitieron credenciales: los roles se prepararon como grupos NOLOGIN; la identidad de ejecución se provisionará con la API. El diccionario se generó desde una base migrada para evitar divergencia con el SQL. Evidencia de aplicación y recuperación en `docs/reviews/2026-10-22-bd-relacional-verificacion.md`.
