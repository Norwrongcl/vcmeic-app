# Arrastre entre columnas Kanban

## Objetivo

Permitir que las tarjetas cambien de columna mediante arrastre cuando la columna represente una transición válida del negocio. El cambio debe persistirse inmediatamente en `localStorage`, conservar las reglas actuales y no convertir el Kanban en un editor de orden manual.

## Interacción compartida

- La tarjeta completa será arrastrable, excepto sus controles y enlaces interactivos.
- Mouse, pantalla táctil y teclado tendrán el mismo resultado funcional.
- Al iniciar el movimiento, la tarjeta original reducirá su énfasis y se mostrará una representación flotante.
- Las columnas válidas se resaltarán al pasar sobre ellas. Las columnas bloqueadas no aceptarán la tarjeta.
- Soltar en la columna de origen o fuera de un destino válido no modificará datos.
- Un cambio exitoso actualizará el store, se persistirá mediante el mecanismo existente y mostrará una confirmación breve.
- El foco permanecerá recuperable después del movimiento y los cambios se anunciarán a tecnologías de asistencia.

No habrá reordenamiento de tarjetas dentro de una misma columna. El orden seguirá derivándose de los criterios actuales de cada vista.

## Reglas por entidad

### Tareas

Las tareas podrán moverse libremente entre `todo`, `in_progress`, `done` y `cancelled`. El cambio actualizará únicamente `status` mediante `updateTask`; los demás datos permanecerán intactos.

### Eventos

Los eventos podrán moverse entre `draft`, `planned`, `in_progress` y `cancelled`. La columna `completed` será visible, pero no aceptará arrastre porque completar un evento exige participantes, fecha de cierre y el flujo post-evento existente.

Los eventos ya completados tampoco serán arrastrables: su cierre es un registro consolidado y cualquier corrección debe pasar por la ficha. Las demás transiciones actualizarán únicamente `status` mediante `updateEvent` y conservarán la validación del store.

### Actividades

La columna `pending` no aceptará tarjetas. Una actividad puede moverse a `approved`; esta acción usará `approveActivity` y limpiará cualquier motivo de rechazo anterior.

Mover una actividad a `rejected` abrirá el diálogo existente de rechazo y exigirá una razón. La actividad no cambiará de columna hasta confirmar una razón válida. Cancelar el diálogo mantendrá el estado original. Esto permite aprobar una actividad pendiente o rechazada y rechazar una actividad pendiente o aprobada, sin inventar una acción para devolverla a revisión.

## Arquitectura

Se añadirá una capa reutilizable de arrastre accesible basada en `@dnd-kit`, con identificadores tipados para tarjetas y columnas. Cada página conservará la propiedad de sus reglas y callbacks; la capa compartida solo resolverá sensores, estado visual, destino y anuncio accesible.

Los componentes Kanban existentes recibirán callbacks de cambio de estado. No se duplicará la persistencia ni se mantendrá una copia paralela de las entidades: el store seguirá siendo la única fuente de verdad y el agrupamiento existente reaccionará al cambio.

## Manejo de errores

- Un identificador inexistente o un destino inválido no producirá cambios.
- Si una validación de evento impide la actualización, la tarjeta conservará su columna y se mostrará un mensaje de error.
- Rechazar una actividad sin razón seguirá siendo imposible.
- Los filtros activos no se modificarán. Si el nuevo estado deja de coincidir con un filtro, la tarjeta desaparecerá de la vista filtrada como consecuencia esperada.

## Pruebas y verificación

- Pruebas unitarias para la matriz de transiciones de Tareas, Eventos y Actividades.
- Pruebas de componente para arrastre exitoso, destino bloqueado y cancelación.
- Prueba del diálogo de rechazo iniciado desde el Kanban.
- Verificación de persistencia mediante los stores existentes.
- Revisión en navegador con mouse y teclado, además de una comprobación táctil en viewport móvil.
- Ejecución de pruebas enfocadas, lint, build y revisión visual en modo claro y oscuro.

## Fuera de alcance

- Reordenar tarjetas dentro de una columna.
- Guardar una posición manual.
- Completar eventos directamente desde el Kanban.
- Devolver actividades a `pending`.
- Cambiar tablas, tarjetas, rutas o formularios fuera de lo necesario para la interacción.
