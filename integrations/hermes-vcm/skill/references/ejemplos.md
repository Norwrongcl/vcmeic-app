# Ejemplos de uso de la API VcM

Estos ejemplos son orientativos. Primero llama `vcm_contract` y adapta nombres, esquemas y catálogos a la versión activa.

## Buscar expedientes con evidencia pendiente

`vcm_query`:

```json
{"query":{"entity":"cases","select":["id","name","state","endsAt"],"where":{"and":[{"field":"portfolio","op":"eq","value":"Alumni"},{"field":"evidence.reviewStatus","op":"eq","value":"pending"}]},"orderBy":[{"field":"endsAt","direction":"asc"}],"page":{"limit":25}}}
```

Un resultado vacío significa que no hay filas **visibles** que coincidan. Si devuelve cursor, continúa la paginación antes de afirmar que revisaste todo.

## Crear un expediente de entrevista

`vcm_write` con `resource: "cases"` y sin `id`:

```json
{"resource":"cases","request":{"command":{"type":"createCase","kind":"initiative","name":"Taller comunitario","responsible":"Docente entrevistada","description":"Antecedente comunicado en entrevista"},"expectedVersion":0,"idempotencyKey":"entrevista-2026-10-24-uuid-unico"}}
```

La respuesta confirmada contiene el ID y la nueva versión. Para agregar varios datos se usa el ID de la ruta y dentro del comando, y `expectedVersion` se toma de la última lectura:

```json
{"resource":"cases","id":"ID_DEL_EXPEDIENTE","request":{"command":{"type":"setFields","caseId":"ID_DEL_EXPEDIENTE","fields":[{"fieldId":"studentsPlanned","value":20,"status":"confirmed","source":{"name":"Entrevista docente"},"observation":"Cifra planificada"}]},"expectedVersion":1,"idempotencyKey":"captura-uuid-unico"}}
```

Antes de usar `fieldId`, `status` o `source`, verifica su esquema exacto en el catálogo y OpenAPI vivos. No conviertas una cifra real en planificada. Si un dato contradice una afirmación anterior, conserva ambas y registra la nueva fuente; Coordinación resuelve el conflicto.

## Errores

- 401: credencial vencida o revocada; detener escrituras y avisar al operador.
- 403: falta scope, visibilidad o autoridad; no buscar otra vía.
- 404: invisible o inexistente; no deducir cuál.
- 409: versión obsoleta o idempotencia incompatible; releer, comparar y decidir una nueva intención.
- 422: esquema o regla institucional incumplida; consultar contrato vigente y explicar la precondición.
- 429/503: esperar/avisar; ante posible escritura ambigua, consultar antes de reintentar con la misma clave.
