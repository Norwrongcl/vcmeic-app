# Inventario de comandos para conexión API

Este inventario cubre el árbol de trabajo actual. Los nombres legacy se traducen a DTOs relacionales; los endpoints no aceptan actores ni flags de aprobación libres. Completar estado/prueba concreta al implementar cada dominio.

| Entrada local | Recurso/destino | DTO | Permiso | Persistencia | Verificación |
|---|---|---|---|---|---|
| `createCase` | cases | `createCaseSchema` (cerrado) | acción + objeto autorizado | cases + auditoría/outbox | `cases.test.ts`, tarea 5 |
| `setField` | cases | `setFieldSchema` (cerrado) | acción + objeto autorizado | cases + auditoría/outbox | `cases.test.ts`, tarea 5 |
| `setFields` | cases | `setFieldsSchema` (cerrado) | acción + objeto autorizado | cases + auditoría/outbox | `cases.test.ts`, tarea 5 |
| `resolveField` | cases | `resolveFieldSchema` (cerrado) | humano + autoridad según acción | cases + auditoría/outbox | `cases.test.ts`, tarea 5 |
| `transition` | cases | `transitionSchema` (cerrado) | acción + objeto autorizado | cases + auditoría/outbox | `cases.test.ts`, tarea 5 |
| `updateCase` | cases | `updateCaseSchema` (cerrado) | acción + objeto autorizado | cases + auditoría/outbox | `cases.test.ts`, tarea 5 |
| `setRelations` | cases | `setRelationsSchema` (cerrado) | acción + objeto autorizado | cases + auditoría/outbox | `cases.test.ts`, tarea 5 |
| `attachProject` | operations | `attachProjectSchema` (cerrado) | acción + objeto autorizado | operations + auditoría/outbox | `operations.test.ts`, tarea 6 |
| `reviewEvidence` | cases | `reviewEvidenceSchema` (cerrado) | humano + autoridad según acción | cases + auditoría/outbox | `cases.test.ts`, tarea 5 |
| `addEvidence` | cases | `addEvidenceSchema` (cerrado) | acción + objeto autorizado | cases + auditoría/outbox | `cases.test.ts`, tarea 5 |
| `proposeDecision` | operations | `proposeDecisionSchema` (cerrado) | acción + objeto autorizado | operations + auditoría/outbox | `operations.test.ts`, tarea 6 |
| `decide` | operations | `decideSchema` (cerrado) | humano + autoridad según acción | operations + auditoría/outbox | `operations.test.ts`, tarea 6 |
| `saveCampaign` | communications | `saveCampaignSchema` (cerrado) | acción + objeto autorizado | communications + auditoría/outbox | `communications.test.ts`, tarea 7 |
| `approveCampaign` | communications | `approveCampaignSchema` (cerrado) | humano + autoridad según acción | communications + auditoría/outbox | `communications.test.ts`, tarea 7 |
| `saveContent` | communications | `saveContentSchema` (cerrado) | acción + objeto autorizado | communications + auditoría/outbox | `communications.test.ts`, tarea 7 |
| `approveContent` | communications | `approveContentSchema` (cerrado) | humano + autoridad según acción | communications + auditoría/outbox | `communications.test.ts`, tarea 7 |
| `approvePackage` | communications | `approvePackageSchema` (cerrado) | humano + autoridad según acción | communications + auditoría/outbox | `communications.test.ts`, tarea 7 |
| `linkIndicator` | reporting | `linkIndicatorSchema` (cerrado) | acción + objeto autorizado | reporting + auditoría/outbox | `reporting.test.ts`, tarea 8 |
| `createCut` | reporting | `createCutSchema` (cerrado) | acción + objeto autorizado | reporting + auditoría/outbox | `reporting.test.ts`, tarea 8 |
| `addObservation` | reporting | `addObservationSchema` (cerrado) | acción + objeto autorizado | reporting + auditoría/outbox | `reporting.test.ts`, tarea 8 |
| `resolveObservation` | reporting | `resolveObservationSchema` (cerrado) | acción + objeto autorizado | reporting + auditoría/outbox | `reporting.test.ts`, tarea 8 |
| `transitionCut` | reporting | `transitionCutSchema` (cerrado) | humano + autoridad según acción | reporting + auditoría/outbox | `reporting.test.ts`, tarea 8 |
| `savePlan` | operations | `savePlanSchema` (cerrado) | acción + objeto autorizado | operations + auditoría/outbox | `operations.test.ts`, tarea 6 |
| `transitionPlan` | operations | `transitionPlanSchema` (cerrado) | humano + autoridad según acción | operations + auditoría/outbox | `operations.test.ts`, tarea 6 |
| `saveTriage` | operations | `saveTriageSchema` (cerrado) | acción + objeto autorizado | operations + auditoría/outbox | `operations.test.ts`, tarea 6 |
| `saveCommitment` | operations | `saveCommitmentSchema` (cerrado) | acción + objeto autorizado | operations + auditoría/outbox | `operations.test.ts`, tarea 6 |
| `saveForecast` | operations | `saveForecastSchema` (cerrado) | acción + objeto autorizado | operations + auditoría/outbox | `operations.test.ts`, tarea 6 |
| `replaceVcmData` (core) | adaptador de caché; sin endpoint que reemplace BD | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `addActivity` (core) | cases/proyectos; un evento no duplica expediente | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `updateActivity` (core) | cases/proyectos; un evento no duplica expediente | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `approveActivity` (core) | cases: revisión institucional humana; nunca aprobar por alta | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `rejectActivity` (core) | cases: revisión institucional humana; nunca aprobar por alta | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `deleteActivity` (core) | cases/proyectos; un evento no duplica expediente | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `addPartner` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `updatePartner` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `deletePartner` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `addContact` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `updateContact` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `deleteContact` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `addEvent` (core) | cases/proyectos; un evento no duplica expediente | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `updateEvent` (core) | cases/proyectos; un evento no duplica expediente | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `deleteEvent` (core) | cases/proyectos; un evento no duplica expediente | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `addTask` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `updateTask` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `deleteTask` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `addBudgetItem` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `updateBudgetItem` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `deleteBudgetItem` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `addExpense` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `updateExpense` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `deleteExpense` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `addAgreement` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `updateAgreement` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `deleteAgreement` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `addResource` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `updateResource` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `deleteResource` (core) | operations: recurso tipado; delete se vuelve archivo motivado | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `exportSnapshot` (core) | exports/imports; resetDemo solo modo local | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `importSnapshot` (core) | exports/imports; resetDemo solo modo local | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `resetData` (core) | exports/imports; resetDemo solo modo local | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |
| `dismissStorageWarning` (core) | adaptador de caché; sin endpoint que reemplace BD | DTO cerrado del recurso | permiso por acción, sin actor cliente | tablas del recurso + auditoría/outbox | `operations.test.ts` / `imports.test.ts`, tareas 6/11 |

## Traducción del prototipo al contrato actual

Los DTOs vigentes y sus límites están en OpenAPI y en el catálogo autenticado. No enviar literalmente el antiguo `Command` del navegador: hay que resolver el agregado y su versión.

| Entrada antigua | Adaptación necesaria |
|---|---|
| `createCase.id` | ID nuevo generado por servidor; preservar IDs antiguos únicamente en importación revisada |
| `setField.value` texto universal | Tipar con `/v1/catalog`: número, cadena CLP, fecha civil o referencias `{type,id}`; `source` pasa a objeto con nombre |
| `resolveField.value` | Seleccionar `assertionId` concreto; no introducir otra cifra como resolución implícita |
| `reviewEvidence.verified` | Comando humano con `result=verified/rejected` y fundamento; nunca flag libre en el alta |
| `updateCase.executionState/presenceType` | Ejecución por comando del proyecto con mandato; tipología por campo institucional revisado |
| `savePlan`, tareas, gastos, forecast | Usar versión del plan/proyecto, no versión del expediente padre; importes CLP string |
| `saveCampaign`, `saveContent`, paquetes | Endpoints de recurso con revisiones exactas, Charter/brief/copy/activos referenciados; no booleanos aprobados |
| `linkIndicator.validate` | Proponer aporte y después comando humano `validateContribution` con QA y evidencia elegibles |
| `approveActivity/rejectActivity` | Revisión/validación/devolución del expediente; crear desde web no aprueba |
| `deleteActivity/deleteEvent` | Archivo lógico de borrador sin antecedentes formales; nunca borrar expedientes como cascada |
| `replaceVcmData/resetData` | Caché y modo demo local. No hay endpoint que reemplace la BD por un snapshot |
| `export/import` | Intercambio autorizado y migración inicial revisada; recuperación exacta por backup privado PostgreSQL |

La conexión del frontend sustituirá también cada escritura core. No activar parcialmente el modo API ni conservar un fallback silencioso a localStorage.
