# Kanban Drag and Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir cambios de estado accesibles por arrastre en los Kanban de tareas, eventos y actividades, respetando las reglas del negocio y persistiendo en `localStorage`.

**Architecture:** Un componente compartido basado en `@dnd-kit/core` administrará sensores, identificadores de tarjetas/columnas, overlay, destinos válidos y anuncios accesibles. Cada vista seguirá agrupando desde su store y decidirá si un cambio de estado se ejecuta, se bloquea o abre una confirmación de negocio.

**Tech Stack:** React 19, TypeScript 6, `@dnd-kit/core`, Zustand con persistencia local, Vitest Browser, Tailwind CSS y shadcn/ui.

## Global Constraints

- No reordenar tarjetas dentro de una columna ni persistir posición manual.
- La tarjeta completa será arrastrable, excepto controles y enlaces interactivos.
- Soportar mouse, pantalla táctil y teclado con el mismo resultado funcional.
- Mantener los filtros activos; una tarjeta puede desaparecer si el nuevo estado deja de coincidir.
- No completar eventos desde el Kanban ni permitir arrastre de eventos completados.
- No devolver actividades a `pending`; rechazar exige motivo y aprobar limpia el rechazo anterior.
- Los stores existentes son la única fuente de verdad y continúan persistiendo en `localStorage`.

---

### Task 1: Capa compartida de arrastre accesible

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/features/core/components/kanban-dnd.tsx`
- Create: `src/features/core/components/kanban-dnd.test.tsx`

**Interfaces:**
- Consumes: `ReactNode`, identificadores string de tarjetas y columnas, y callback de movimiento.
- Produces: `KanbanDndContext`, `KanbanDroppableColumn` y `KanbanDraggableCard`; `onMove(itemId: string, fromColumnId: string, toColumnId: string): void`; `isDropAllowed(itemId, fromColumnId, toColumnId): boolean`.

- [ ] **Step 1: Instalar la dependencia de arrastre**

Run: `npm install @dnd-kit/core`

Expected: `package.json` y `package-lock.json` registran una versión compatible con React 19.

- [ ] **Step 2: Escribir pruebas fallidas del contrato compartido**

```tsx
it('moves a card only to an allowed different column', async () => {
  const onMove = vi.fn()
  const screen = await render(<TestBoard onMove={onMove} />)
  await dragWithKeyboard(screen.getByRole('button', { name: /Mover Tarea A/ }), 'ArrowRight')
  expect(onMove).toHaveBeenCalledWith('task-a', 'todo', 'done')
})

it('keeps blocked destinations disabled for keyboard users', async () => {
  const onMove = vi.fn()
  const screen = await render(<TestBoard onMove={onMove} blockDone />)
  await dragWithKeyboard(screen.getByRole('button', { name: /Mover Tarea A/ }), 'ArrowRight')
  expect(onMove).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Ejecutar la prueba y confirmar el rojo**

Run: `npm test -- src/features/core/components/kanban-dnd.test.tsx`

Expected: FAIL porque `kanban-dnd.tsx` todavía no existe.

- [ ] **Step 4: Implementar la capa mínima compartida**

```ts
export type KanbanMove = {
  itemId: string
  fromColumnId: string
  toColumnId: string
}

export function KanbanDndContext(props: {
  children: ReactNode
  onMove: (move: KanbanMove) => void
  isDropAllowed: (move: KanbanMove) => boolean
  renderOverlay?: (itemId: string) => ReactNode
})
```

Usar `PointerSensor` con distancia de activación, `TouchSensor` con demora/tolerancia y `KeyboardSensor`. Prefijar IDs como `kanban-card:` y `kanban-column:`; guardar `{ itemId, columnId, label }` en `data`; resolver `over` sobre tarjeta o columna; ignorar origen, exterior y destino bloqueado. Añadir `DragOverlay`, opacidad de origen, anillo de destino válido y anuncios de `DndContext` en español.

- [ ] **Step 5: Ejecutar prueba y confirmar verde**

Run: `npm test -- src/features/core/components/kanban-dnd.test.tsx`

Expected: PASS para movimiento permitido, destino bloqueado, mismo origen y controles interactivos.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/features/core/components/kanban-dnd.tsx src/features/core/components/kanban-dnd.test.tsx
git commit -m "feat: add accessible kanban drag layer"
```

### Task 2: Reglas puras de transición

**Files:**
- Create: `src/features/core/model/kanban-transitions.ts`
- Create: `src/features/core/model/kanban-transitions.test.ts`

**Interfaces:**
- Consumes: `TaskStatus`, `EventStatus` y `ActivityApprovalStatus`.
- Produces: `canMoveTask(from, to): boolean`, `canMoveEvent(from, to): boolean` y `getActivityMove(from, to): 'approve' | 'reject' | null`.

- [ ] **Step 1: Escribir la matriz fallida**

```ts
it.each(TASK_STATUSES.flatMap((from) => TASK_STATUSES.map((to) => [from, to])))('%s → %s', (from, to) => {
  expect(canMoveTask(from, to)).toBe(from !== to)
})

expect(canMoveEvent('planned', 'completed')).toBe(false)
expect(canMoveEvent('completed', 'planned')).toBe(false)
expect(canMoveEvent('planned', 'in_progress')).toBe(true)
expect(getActivityMove('pending', 'approved')).toBe('approve')
expect(getActivityMove('approved', 'rejected')).toBe('reject')
expect(getActivityMove('rejected', 'pending')).toBeNull()
```

- [ ] **Step 2: Ejecutar la prueba y confirmar el rojo**

Run: `npm test -- src/features/core/model/kanban-transitions.test.ts`

Expected: FAIL porque las funciones aún no existen.

- [ ] **Step 3: Implementar las reglas puras**

```ts
export const canMoveTask = (from: TaskStatus, to: TaskStatus) => from !== to

export const canMoveEvent = (from: EventStatus, to: EventStatus) =>
  from !== to && from !== 'completed' && to !== 'completed'

export function getActivityMove(from: ActivityApprovalStatus, to: ActivityApprovalStatus) {
  if (from === to || to === 'pending') return null
  return to === 'approved' ? 'approve' : 'reject'
}
```

- [ ] **Step 4: Ejecutar prueba y confirmar verde**

Run: `npm test -- src/features/core/model/kanban-transitions.test.ts`

Expected: PASS para todas las combinaciones.

- [ ] **Step 5: Commit**

```bash
git add src/features/core/model/kanban-transitions.ts src/features/core/model/kanban-transitions.test.ts
git commit -m "test: define kanban transition rules"
```

### Task 3: Tareas arrastrables

**Files:**
- Modify: `src/features/events/components/task-kanban-board.tsx:30-132`
- Modify: `src/features/events/components/task-kanban-board.test.tsx`
- Modify: `src/features/events/global-tasks-page.tsx:253-261`

**Interfaces:**
- Consumes: `KanbanDndContext`, `KanbanDroppableColumn`, `KanbanDraggableCard`, `canMoveTask` y `useEventsStore.updateTask`.
- Produces: nueva prop `onStatusChange(task: EventTask, status: TaskStatus): void` en `TaskKanbanBoard`.

- [ ] **Step 1: Escribir prueba fallida de cambio de estado**

```tsx
it('requests a valid task status change from the Kanban', async () => {
  const onStatusChange = vi.fn()
  const screen = await render(<TaskKanbanBoard {...baseProps} onStatusChange={onStatusChange} />)
  await moveCardWithKeyboard(screen, 'Confirmar proveedores', 'En curso')
  expect(onStatusChange).toHaveBeenCalledWith(task, 'in_progress')
})
```

Comprobar también que los botones Editar y Eliminar siguen funcionando y no inician arrastre.

- [ ] **Step 2: Ejecutar prueba y confirmar el rojo**

Run: `npm test -- src/features/events/components/task-kanban-board.test.tsx`

Expected: FAIL porque la prop y wrappers de arrastre no existen.

- [ ] **Step 3: Integrar el tablero y el store**

Envolver las columnas y tarjetas con la capa compartida. En `GlobalTasksPage`, pasar:

```tsx
onStatusChange={(task, nextStatus) => {
  updateTask(task.id, { status: nextStatus })
  toast.success(`Tarea movida a ${taskStatusLabels[nextStatus]}.`)
}}
```

Preservar los callbacks de edición/eliminación y marcar sus botones como zonas interactivas no arrastrables.

- [ ] **Step 4: Ejecutar pruebas enfocadas**

Run: `npm test -- src/features/events/components/task-kanban-board.test.tsx src/features/events/model/events-store.test.ts`

Expected: PASS y estado persistido por `updateTask`.

- [ ] **Step 5: Commit**

```bash
git add src/features/events/components/task-kanban-board.tsx src/features/events/components/task-kanban-board.test.tsx src/features/events/global-tasks-page.tsx
git commit -m "feat: move tasks between kanban columns"
```

### Task 4: Eventos arrastrables con cierre protegido

**Files:**
- Modify: `src/features/events/events-page.tsx:50-384`
- Modify: `src/features/events/model/event-kanban.test.ts`

**Interfaces:**
- Consumes: capa compartida, `canMoveEvent`, `useEventsStore.updateEvent` y `eventStatusLabels`.
- Produces: Kanban de eventos que actualiza solo `status`; `completed` no arrastra ni recibe.

- [ ] **Step 1: Escribir prueba fallida de las reglas visibles**

```ts
expect(EVENT_KANBAN_COLUMNS.find((column) => column.status === 'completed')).toMatchObject({ acceptsDrop: false })
```

Añadir prueba de componente que compruebe que un evento `completed` no expone control de movimiento y que `planned → in_progress` invoca `updateEvent` una sola vez.

- [ ] **Step 2: Ejecutar pruebas y confirmar el rojo**

Run: `npm test -- src/features/events/model/event-kanban.test.ts src/features/events/events-page.test.tsx`

Expected: FAIL por metadatos y comportamiento ausentes.

- [ ] **Step 3: Integrar arrastre en `EventsPage`**

Obtener `updateEvent` del store, envolver tablero/columnas/tarjetas, deshabilitar draggable cuando `event.status === 'completed'` y permitir destino solo cuando `canMoveEvent` sea verdadero. En un movimiento válido:

```ts
updateEvent(event.id, { status: nextStatus })
toast.success(`Evento movido a ${eventStatusLabels[nextStatus]}.`)
```

Mantener el `Link` de detalle como control interactivo y renderizar una copia visual sin enlace en el overlay.

- [ ] **Step 4: Ejecutar pruebas enfocadas**

Run: `npm test -- src/features/events/model/event-kanban.test.ts src/features/events/events-page.test.tsx src/features/core/model/app-store.test.ts`

Expected: PASS; `completed` permanece consolidado y el resto persiste.

- [ ] **Step 5: Commit**

```bash
git add src/features/events/events-page.tsx src/features/events/events-page.test.tsx src/features/events/model/event-kanban.test.ts
git commit -m "feat: move events between kanban columns"
```

### Task 5: Aprobación y rechazo por arrastre

**Files:**
- Modify: `src/features/activities/activities-page.tsx:63-406`
- Modify: `src/features/activities/activity-approval.test.tsx`
- Modify: `src/features/core/model/app-store.test.ts`

**Interfaces:**
- Consumes: capa compartida, `getActivityMove`, `approveActivity`, `rejectActivity` y `RejectActivityDialog`.
- Produces: aprobar por drop inmediato; rechazo pendiente hasta confirmar un motivo; `pending` bloqueado como destino.

- [ ] **Step 1: Escribir pruebas fallidas del flujo**

```tsx
it('approves an activity when dropped on approved', async () => {
  await moveActivity('Actividad pendiente', 'Aprobadas')
  expect(useAppStore.getState().activities[id].approvalStatus).toBe('approved')
  expect(useAppStore.getState().activities[id].rejectionReason).toBeNull()
})

it('waits for a rejection reason and keeps state when cancelled', async () => {
  await moveActivity('Actividad aprobada', 'Rechazadas')
  await expect.element(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(useAppStore.getState().activities[id].approvalStatus).toBe('approved')
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(useAppStore.getState().activities[id].approvalStatus).toBe('approved')
})
```

- [ ] **Step 2: Ejecutar pruebas y confirmar el rojo**

Run: `npm test -- src/features/activities/activity-approval.test.tsx src/features/activities/activities-page.test.tsx`

Expected: FAIL porque la vista no responde a drops.

- [ ] **Step 3: Integrar transiciones y diálogo**

Guardar `activityPendingRejection` en estado local. Ante `approve`, llamar `approveActivity` y mostrar toast. Ante `reject`, abrir `RejectActivityDialog`; confirmar llama `rejectActivity(id, reason)`, cierra el diálogo y muestra toast; cancelar solo limpia el estado pendiente. `pending` no se registra como destino válido.

- [ ] **Step 4: Ejecutar pruebas enfocadas**

Run: `npm test -- src/features/activities/activity-approval.test.tsx src/features/activities/activities-page.test.tsx src/features/core/model/app-store.test.ts`

Expected: PASS para aprobación, rechazo validado, cancelación, limpieza de motivo y persistencia.

- [ ] **Step 5: Commit**

```bash
git add src/features/activities/activities-page.tsx src/features/activities/activities-page.test.tsx src/features/activities/activity-approval.test.tsx src/features/core/model/app-store.test.ts
git commit -m "feat: review activities from kanban"
```

### Task 6: Accesibilidad, regresión y verificación visual

**Files:**
- Modify: `src/features/core/components/kanban-dnd.tsx`
- Modify: `src/features/core/components/kanban-dnd.test.tsx`
- Modify: only files implicated by verification defects.

**Interfaces:**
- Consumes: las tres integraciones anteriores.
- Produces: comportamiento verificado en teclado, mouse, touch, claro/oscuro y responsive.

- [ ] **Step 1: Ejecutar todas las pruebas enfocadas**

Run: `npm test -- src/features/core/components/kanban-dnd.test.tsx src/features/core/model/kanban-transitions.test.ts src/features/events/components/task-kanban-board.test.tsx src/features/events/model/event-kanban.test.ts src/features/activities/activity-approval.test.tsx src/features/core/model/app-store.test.ts`

Expected: PASS.

- [ ] **Step 2: Ejecutar controles estáticos**

Run: `npm run lint && npm run build`

Expected: ambos comandos terminan con exit code 0.

- [ ] **Step 3: Probar en navegador**

Abrir `http://127.0.0.1:5173/tasks`, `/events` y `/activities`; cambiar a Kanban y verificar: arrastre con mouse, movimiento con teclado, botones/enlaces, destino bloqueado, diálogo de rechazo, persistencia tras recarga, viewport móvil y tema oscuro.

- [ ] **Step 4: Ejecutar suite completa**

Run: `npm test`

Expected: todas las pruebas nuevas pasan; documentar por separado cualquier timeout heredado reproducible y no relacionado.

- [ ] **Step 5: Revisar el diff final y commit**

```bash
git diff --check
git status --short
git add src package.json package-lock.json
git commit -m "test: verify kanban drag and drop"
```
