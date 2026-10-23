# Base relacional VcM y acceso autónomo de Hermes

Estado: diseño lógico propuesto para revisión; no es una migración ejecutada.

## Resultado y orden

Diseñar la base a partir del PO y de la plataforma, preparar y verificar migraciones, desplegarlas en PostgreSQL del VPS, implementar/conectar la API y finalmente instalar una skill de acceso en Hermes. La web continúa en Hostinger Apps. Este documento complementa `2026-10-22-api-vps-design.md`; ante diferencias sobre datos o autonomía de Hermes prevalece este diseño una vez aprobado.

La instancia PostgreSQL ya existe. Las tablas de negocio, API y skill descritas aquí todavía no están creadas. No se importan datos demo como datos institucionales.

## Evidencia y decisiones de modelado

Se contrastaron los tipos de `src/features/core/model/types.ts`, `src/features/vcm/model/types.ts`, `planning-types.ts`, catálogos y reglas con el PO: páginas 35–39, 41, 54, 93 y 97. El PO exige captura única, confidencialidad por objeto, estados controlados/versionados y autonomía dentro de un mandato aprobado. Hermes no adquiere autoridad institucional propia.

Alternativas consideradas:

1. **Modelo relacional de negocio con trazabilidad normalizada:** recomendado. Entidades, relaciones, estados y cantidades consultables; JSONB solo para contenido flexible, instantáneas y resultados técnicos.
2. Guardar el snapshot del frontend en una fila JSONB: facilita un primer volcado, pero debilita integridad, consultas concurrentes y relaciones. Solo se conserva como formato de importación/respaldo heredado.
3. Modelo genérico de atributos para todo: flexible, pero complica filtros, restricciones y reportes. Se usa exclusivamente donde el PO requiere campos trazables variables, no como sustituto de proyectos, finanzas o decisiones.

No se reproducen las colecciones `activities`, `events` y `cases` como tres registros maestros del mismo hecho. El expediente es el punto común; proyecto, presencia y registro institucional son componentes vinculados.

## Convenciones

- IDs internos `text`, opacos e inmutables: conservar los existentes; nuevos generados por servidor. Código visible e ID externo son diferentes.
- Fechas civiles `date`; instantes `timestamptz`; agenda con zona IANA, inicialmente America/Santiago. No transformar una fecha sin hora en medianoche UTC.
- Dinero CLP en `bigint` no negativo; API lo serializa como cadena decimal para evitar pérdida de precisión. Otras magnitudes usan `numeric` con escala definida por campo; desconocido es NULL, no cero.
- Objetos modificables: `version`, `created_at`, `updated_at`, autor y marcas de archivo. Los hijos se modifican bajo la versión del agregado padre cuando corresponda.
- Claves foráneas, índices de búsqueda y unicidad para vínculos. Borrado restringido en datos formales; archivo/cancelación con motivo. Borrado físico limitado a borradores sin dependencias y política expresa.
- Estados y tipologías mediante catálogos controlados/versionados, sin valores inventados por el modelo.
- No duplicar contraseñas de proveedores, archivos Drive ni conversaciones completas en tablas de negocio.

## Modelo lógico por dominio

Las listas siguientes son tablas propuestas, con claves y relaciones principales. En la especificación física cada tabla tendrá columnas, nulabilidad, restricciones e índices explícitos antes de generar SQL.

### Identidad y visibilidad

| Tabla | Claves y contenido |
|---|---|
| `principals` | PK id; tipo humano/servicio, nombre, activo, versión de permisos |
| `users` | PK/FK principal_id; email único normalizado, hash de contraseña; separado de contactos |
| `roles`, `principal_roles` | Roles de aplicación y asignaciones; los siete roles actuales, sin otorgar autoridad humana a servicios |
| `sessions` | PK id, FK user_id; hash de token, expiraciones, revocación |
| `service_credentials` | FK principal_id; hash de token, scopes, vencimiento y revocación; un servicio por perfil Hermes |
| `protected_objects` | PK id; tipo, confidencialidad, propietario; base común para objetos protegidos |
| `object_grants` | FK object_id, principal_id; permiso explícito y vigencia |
| `case_assignments` | FK case_id, principal_id; función y vigencia; asignar no concede más autoridad que el rol/scope |

Expedientes, decisiones, presupuestos y referencias documentales tienen FK única a `protected_objects`. Sus hijos heredan esa protección salvo protección más restrictiva explícita. Una unión o agregado nunca amplía visibilidad por herencia del expediente. Se filtra antes de contar, paginar o exportar.

La API aplica permisos por objeto y acción. El usuario SQL de ejecución no es propietario ni superusuario. No se ofrece SQL arbitrario; por ello no se depende de que Hermes recuerde añadir filtros de seguridad. RLS puede añadirse como defensa complementaria mediante políticas verificadas; no se presenta como implementado en esta fase.

### Maestros compartidos

| Tabla | Claves y contenido |
|---|---|
| `portfolios` | PK id, código, nombre y estado |
| `organizations` | PK id; datos de contraparte, identificadores opcionales, contacto general |
| `contacts` | PK id; persona de contacto, datos mínimos; vínculo opcional a usuario autenticado |
| `organization_contacts` | FK organization_id/contact_id; cargo y vigencia |
| `agreements` | PK id, FK organization_id, responsable, fechas, estado, objeto protegido |
| `agreement_documents` | FK agreement_id/document_id |
| `resources` | PK id; categoría, unidad, capacidad/cantidad y estado |
| `catalog_versions`, `catalog_entries` | Tipo, versión, código, etiqueta, fuente, vigencia; catálogo incompleto marcado pendiente |

Los catálogos institucionales requieren fuente autorizada; los siete tipos de presencia y los campos actuales se conservan con su procedencia. No crear códigos externos ficticios.

### Expediente, fuentes, campos y evidencia

| Tabla | Claves y contenido |
|---|---|
| `cases` | PK id; código único, nombre, tipo, portafolio, responsable, estado documental, versión y demo |
| `case_organizations`, `case_agreements` | Relaciones N:M con rol del vínculo |
| `presence_records` | PK id, FK case_id; tipología, versión y estado institucional; no segundo expediente |
| `activity_records` | PK id, FK case_id; esquema P5.2/version y estado institucional |
| `field_definitions` | PK compuesto schema_version/field_key; etiqueta, grupo, tipo, unidad, clasificación, multiplicidad |
| `case_fields` | PK case_id/field_key; definición versionada, estado y observación; FK a valor seleccionado |
| `field_assertions` | PK id; FK compuesto case_id/field_key; valor tipado, fuente, capturado_por y fecha; inmutable |
| `sources` | PK id, FK case_id; canal, autor, fecha, referencia externa y origen declarado |
| `field_resolutions` | Campo, afirmaciones involucradas, valor elegido o nuevo, actor, motivo y fecha |
| `document_references` | PK id; proveedor, ID externo opcional, URL, nombre, versión/checksum si disponible y protección |
| `evidences` | PK id, FK case_id/document_id/source_id; estado de revisión y versión |
| `evidence_reviews` | FK evidence_id; revisor, resultado, motivo y versión de evidencia revisada |

Las afirmaciones de un campo conservan todas las versiones incompatibles. El valor elegido debe pertenecer al mismo expediente/campo mediante FK compuesta. Una corrección no borra la afirmación anterior. Para campos multivalor se tipa la colección y sus referencias; no se separa una lista por comas para luego inferir relaciones.

Los 49 campos P5.2 se documentarán uno a uno en una matriz origen → definición/tipo/tabla. Las siete tipologías P5.1 permanecen controladas. Los campos adicionales del plan de trabajo no se cuentan como campos oficiales nuevos.

Los nombres, fechas y relaciones usados como columnas del maestro son proyecciones del valor seleccionado cuando tengan captura trazable: actualización conjunta en la misma transacción, sin permitir editar dos verdades independientes. Evidencia y convenio del formulario se enlazan a entidades, conservando el texto heredado si la correspondencia es incierta.

### Planificación y operación

| Tabla | Claves y contenido |
|---|---|
| `annual_plans`, `plan_revisions` | Año, título, estado; versiones inmutables sometidas a revisión |
| `plan_objectives`, `objective_cases` | Meta, medida, responsable, plazo, recursos y expedientes vinculados por revisión |
| `triage_assessments` | FK case_id; pertinencia, urgencia, recomendación, prioridad resuelta, autor y fundamento |
| `projects`, `project_cases` | Proyecto operativo único; relación N:M con expedientes, estado de ejecución separado |
| `work_plan_revisions` | FK project_id; alcance, exclusiones, entregables, criterios de cierre, riesgos y versión |
| `tasks`, `task_dependencies`, `task_assignees` | Tareas/hitos del proyecto, fechas, responsables, bloqueos; dependencias sin ciclos |
| `project_resources` | Proyecto/recurso; cantidad y fase planificada/real |
| `risks`, `issues`, `follow_ups` | Riesgo/incidencia/pendiente, objeto afectado, responsable, fecha y resolución |

El modelo admite varios expedientes documentales asociados al mismo proyecto, sin duplicar presupuesto ni tareas. Al migrar el `projectId` actual se conserva ese vínculo. Los eventos se representan por tipo de iniciativa, no por otro plan de ejecución.

Notion es el detalle operativo acordado por el PO. Las tareas locales actuales se conservan como datos pendientes de vinculación; una sincronización posterior tendrá identidad externa y propietario de cada campo para impedir dos backlogs maestros.

### Gobierno, autorizaciones y finanzas

| Tabla | Claves y contenido |
|---|---|
| `decisions`, `decision_revisions` | Objeto protegido, propuesta, alternativas, recomendación Hermes, autoridad requerida y fundamento |
| `decision_outcomes` | Revisión decidida, humano, resolución, fecha y alcance; evidencia de decisión por canal cuando exista |
| `approval_records` | Objeto/revisión exacta, tipo de aprobación, aprobador, fundamento, vigencia/revocación |
| `operation_mandates`, `mandate_actions` | Proyecto/plan aprobado, clases de acción permitidas, límites, vigencia y aprobación humana |
| `budget_items` | Proyecto, concepto, monto planificado, objeto protegido |
| `budget_authorizations` | Decisión/revisión aprobada, proyecto, monto y vigencia; no confundir con presupuesto solicitado |
| `commitments` | Proyecto, expediente, autorización, monto confirmado, referencia, estado y versión |
| `expenses`, `commitment_expenses` | Gasto real, fecha, partida, proveedor; vínculo de gasto a compromiso sin doble imputación |
| `forecasts` | Proyecto, estimación restante adicional, base/versiones utilizadas, autor y fecha |

Planificado, solicitado, aprobado, comprometido, ejecutado y proyectado son magnitudes diferentes. El saldo y los totales se calculan con las reglas verificadas actuales, sin sumar un proyecto varias veces por tener varios expedientes. El saldo de compromiso descuenta únicamente gastos vinculados.

Las aprobaciones refieren una revisión concreta, no un booleano editable. Cambiar alcance, contenido, presupuesto o una base relevante deja obsoleta la aprobación correspondiente. Los límites entre tablas y las decisiones de autoridad se validan dentro de la transacción; no se intentan representar con un CHECK que consulte otras tablas.

### Campañas, contenidos y comunicaciones

| Tabla | Claves y contenido |
|---|---|
| `campaigns`, `campaign_revisions` | FK case_id; Campaign Charter completo, responsable, objetivo estratégico y estrategia versionada |
| `editorial_packages`, `package_items` | Paquete, período y conjunto exacto de revisiones revisadas |
| `contents`, `content_revisions` | Expediente/campaña, brief, copy, canal, activos referenciados y programación propuesta |
| `publication_operations` | Revisión autorizada, proveedor, estado solicitado/confirmado/fallido/ambiguo, ID externo y conciliación |
| `communication_operations` | Destino autorizado, clase, mandato/decisión, borrador, envío y resultado externo |

Paquetes y contenidos excepcionales tienen aprobación explícita. Aprobar una estrategia no aprueba todas sus publicaciones. Un cambio de copy requiere nueva validación. Guardar o programar localmente no significa publicar; un resultado confirmado necesita respuesta verificable del proveedor.

### Indicadores y reportabilidad

| Tabla | Claves y contenido |
|---|---|
| `indicators`, `indicator_rule_versions` | Definición, unidad, criterios/fuente y estado de disponibilidad |
| `indicator_targets` | Indicador/período, meta; separado de los aportes |
| `indicator_contributions` | Registro de presencia/actividad, indicador/regla/período, cantidad, estado y validación |
| `contribution_evidences` | FK contribution_id/evidence_id, versiones revisadas |
| `institutional_cuts`, `cut_cases` | Corte, período, versión, expedientes y revisiones incluidas |
| `cut_observations` | Corte/expediente, responsable, observación, estado, corrección y resolución |
| `report_runs` | Filtros autorizados, regla, fecha de corte, versión y referencias a datos utilizados |

Los aportes requieren un registro tipado y el mismo expediente de sus evidencias, sin FK polimórfica sin verificar. Para 4.2.5, unicidad por presencia/indicador/período y las reglas actuales de elegibilidad. Otros indicadores conservan sus metas, pero no generan aportes automáticos hasta disponer de criterios. El avance se recalcula desde datos elegibles; un corte histórico conserva las revisiones utilizadas.

### Integraciones, autonomía y auditoría

| Tabla | Claves y contenido |
|---|---|
| `external_links` | Objeto interno, proveedor, tipo e ID externo únicos; estado de sincronización |
| `integration_connections` | Estado, capacidades verificadas y referencia de secreto; nunca token del proveedor expuesto al frontend |
| `automation_rules`, `automation_rule_versions` | Disparador, condiciones, acción permitida, política de reintentos y habilitación |
| `jobs`, `job_attempts` | Regla/expediente, próxima ejecución, lease, intentos, resultado, bloqueo e idempotencia |
| `audit_events` | Actor real, servicio actuante, objeto, antes/después acotados, motivo, regla y correlation_id |
| `outbox_events` | Evento durable de cambio, objeto protegido, secuencia y publicación |
| `idempotency_requests` | Principal/ruta/clave, hash de solicitud y respuesta; ámbito y expiración |
| `import_batches`, `import_mappings`, `import_issues` | Archivo/version/hash, correspondencias legacy, demo, conflictos y resolución |

Credenciales de Drive/Notion/Buffer permanecen donde ya funcionan hasta verificar su contrato real. Los secretos futuros viven fuera del catálogo público de datos. La skill no contiene tokens.

Un cambio confirmado escribe datos, auditoría y evento en una transacción. La regla puede generar trabajo durable. El worker revisa nuevamente permisos, condición, mandato y revisión aprobada antes del efecto externo; un cron de recuperación complementa los eventos.

## Contrato para que Hermes razone consultas

Hermes recibe un catálogo de dominio navegable por API: entidades, campos públicos, tipos, relaciones permitidas, filtros, agregaciones, operaciones y reglas. Se publica OpenAPI versionado y ejemplos en la skill. El catálogo es una vista semántica autorizada, no un volcado de credenciales/tablas técnicas.

Se propone `POST /v1/query` con lenguaje JSON tipado: entidad, selección, filtros AND/OR, relaciones permitidas, orden, paginación y agregaciones. El servidor compila consultas parametrizadas con un registro cerrado de entidades/campos/operadores; límites de costo, filas, profundidad y duración. Nunca acepta fragmentos SQL, nombres de tablas arbitrarios ni funciones aportadas por el cliente.

Ejemplo de intención: «iniciativas del portafolio Alumni de este año, en cierre, con evidencia pendiente, ordenadas por vencimiento». Hermes arma la consulta desde el catálogo, consulta relaciones, inspecciona resultados y decide siguientes operaciones. Consultas que el contrato no soporte devuelven un error explícito; no se hacen pasar por resultados vacíos.

CRUD de datos editables mediante recursos tipados; operaciones con significado institucional mediante comandos: agregar antecedente, resolver conflicto, proponer decisión, revisar evidencia, solicitar transición, aprobar revisión, archivar borrador. El servidor conserva sus invariantes aunque Hermes conozca el esquema completo.

Cada escritura exige versión esperada e idempotencia cuando pueda reintentarse. Los campos `actor`, `role`, `approved`, `validated` y permisos no son atributos libremente asignables. Una decisión humana por Telegram puede persistirse como delegación verificable, conservando al humano decisor y al servicio registrador; Hermes no la firma como propia.

### Alcance propuesto por perfil

- **Coordinación/Telegram:** consultas y CRUD operativo amplio sobre objetos autorizados; crear/editar expedientes, proyectos, tareas, briefs y propuestas; ejecutar acciones dentro de mandatos vigentes. La modificación crítica invalida aprobación. Sin autoaprobar estrategia, presupuesto, contratación, clasificación/validación institucional o publicación fuera del permiso aprobado.
- **Entrevistador/WhatsApp:** mantener el alcance acordado de captura; crear borrador de entrevista y actualizar antecedentes/evidencias del expediente asignado a la sesión. El primer borrador recibe asignación controlada por servidor. No consulta conversaciones ajenas, finanzas generales ni opera como Coordinación.
- **Ambos:** claves separadas, revocables, trazabilidad propia, errores de permiso explícitos. No acceso directo a PostgreSQL, DDL ni borrado de auditoría.

Esto permite iniciativa propia sin pedir aprobación por cada lectura o edición rutinaria. Solo se detiene donde el PO exige autoridad, donde falte mandato o exista un conflicto que requiera resolución humana.

## Skill que se implementará después de la API

Contenido versionado: mapa del dominio, descubrimiento del catálogo, relaciones, sintaxis de consulta, contratos CRUD/comandos, semántica de estados y NULL, fuentes/conflictos, permisos por perfil, paginación, manejo 409/403/422, idempotencia, ejemplos y comprobación del resultado. Configuración por perfil apunta a la URL y a una credencial local privada separada.

La skill debe consultar el contrato vigente cuando cambie la versión, no memorizar SQL físico. Conocer un endpoint no concede permisos. No afirma éxito hasta recibir confirmación; ante resultado externo ambiguo consulta/conciliación antes de reintentar.

## Migración, pruebas y despliegue

1. Congelar diccionario físico, matriz de los 49 campos, estados/transiciones y matriz de acciones por rol/perfil, vinculados a este diseño.
2. Crear migraciones versionadas y fixtures identificados; probar en PostgreSQL aislado: integridad, conflictos, concurrencia, consulta autorizada y reglas.
3. Vista previa de importación v1–v4, relaciones y actores `demo-*`; no asignar autoridad por coincidencia de nombre. Archivar payload original restringido para recuperación, sin conservar sesiones de frontend.
4. Backup del VPS y restauración de prueba; aplicar migraciones sin tocar Hermes ni sobrescribir bases existentes. Crear usuario limitado de ejecución y separado de migraciones.
5. Verificar API privada contra esta base; conectar toda escritura frontend, no solo `VcmRepository`. Después probar HTTPS y origen real de Hostinger Apps.
6. Instalar skill y credenciales separadas; ensayar consultas compuestas, edición con versiones, no duplicación y restricciones por canal.
7. Activar primera automatización con mandato/configuración reales; primero ensayo sin efectos externos, luego caso autorizado. El backup cron no cuenta como automatización de negocio.

Criterios de aceptación: un caso en todas las vistas sin duplicación; evidencia y fuentes conservadas; cero vs desconocido diferenciados; sin conteo de aportes no elegibles; cierre bloqueado por conflicto; historial persistente; aprobación obsoleta rechazada; servicios sin elevación de rol; reinicios sin pérdida; consulta Hermes filtrada antes de agregación; reintentos sin escrituras duplicadas; restauración verificable.

No se fija un número de tablas como objetivo. Las tablas de relación y revisiones responden a invariantes concretas. No se construye un motor universal de workflows ni un segundo Notion.

## Referencias técnicas

- [PostgreSQL 18: restricciones y claves foráneas](https://www.postgresql.org/docs/18/ddl-constraints.html): integridad y límites de los CHECK entre tablas.
- [PostgreSQL 18: políticas por fila](https://www.postgresql.org/docs/18/ddl-rowsecurity.html): posible defensa adicional, con atención a propietario, superusuario y BYPASSRLS.
