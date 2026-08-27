import { expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import {
  KanbanDndContext,
  KanbanDraggableCard,
  KanbanDroppableColumn,
  type KanbanMove,
} from './kanban-dnd'

function TestBoard({
  onMove,
  blockDone = false,
}: {
  onMove: (move: KanbanMove) => void
  blockDone?: boolean
}) {
  return (
    <KanbanDndContext
      onMove={onMove}
      isDropAllowed={({ toColumnId }) => toColumnId !== 'done' || !blockDone}
      renderOverlay={(itemId) => <div>Moviendo {itemId}</div>}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '240px 240px',
          gap: 16,
        }}
      >
        <KanbanDroppableColumn columnId='todo' label='Pendiente'>
          <KanbanDraggableCard itemId='task-a' columnId='todo' label='Tarea A'>
            <div>Tarea A</div>
          </KanbanDraggableCard>
        </KanbanDroppableColumn>
        <KanbanDroppableColumn columnId='done' label='Completada'>
          <div>Sin tareas</div>
        </KanbanDroppableColumn>
      </div>
    </KanbanDndContext>
  )
}

async function moveRightWithKeyboard() {
  await userEvent.click(
    document.querySelector('[aria-label="Mover Tarea A"]') as HTMLElement
  )
  await userEvent.keyboard('{Space}')
  await userEvent.keyboard('{ArrowRight}')
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await userEvent.keyboard('{Space}')
}

it('moves a card to a different allowed column with the keyboard', async () => {
  const onMove = vi.fn()
  await render(<TestBoard onMove={onMove} />)

  await moveRightWithKeyboard()

  expect(onMove).toHaveBeenCalledWith({
    itemId: 'task-a',
    fromColumnId: 'todo',
    toColumnId: 'done',
  })
})

it('does not move a card to a blocked column', async () => {
  const onMove = vi.fn()
  await render(<TestBoard onMove={onMove} blockDone />)

  await moveRightWithKeyboard()

  expect(onMove).not.toHaveBeenCalled()
})

it('moves a card with a pointer gesture from its own surface', async () => {
  const onMove = vi.fn()
  const screen = await render(<TestBoard onMove={onMove} />)
  const source = screen.getByRole('button', { name: 'Mover Tarea A' }).element()
  const target = screen.getByRole('region', { name: 'Completada' }).element()
  const sourceRect = source.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const pointer = {
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    bubbles: true,
  }

  source.dispatchEvent(
    new PointerEvent('pointerdown', {
      ...pointer,
      buttons: 1,
      clientX: sourceRect.left + 10,
      clientY: sourceRect.top + 10,
    })
  )
  document.dispatchEvent(
    new PointerEvent('pointermove', {
      ...pointer,
      buttons: 1,
      clientX: sourceRect.left + 30,
      clientY: sourceRect.top + 10,
    })
  )
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  document.dispatchEvent(
    new PointerEvent('pointermove', {
      ...pointer,
      buttons: 1,
      clientX: targetRect.left + targetRect.width / 2,
      clientY: targetRect.top + targetRect.height / 2,
    })
  )
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  document.dispatchEvent(
    new PointerEvent('pointerup', {
      ...pointer,
      clientX: targetRect.left + targetRect.width / 2,
      clientY: targetRect.top + targetRect.height / 2,
    })
  )
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

  expect(onMove).toHaveBeenCalledWith({
    itemId: 'task-a',
    fromColumnId: 'todo',
    toColumnId: 'done',
  })
})

it('does not start dragging from an interactive child', async () => {
  const onMove = vi.fn()
  const onEdit = vi.fn()
  const screen = await render(
    <KanbanDndContext onMove={onMove} isDropAllowed={() => true}>
      <KanbanDroppableColumn columnId='todo' label='Pendiente'>
        <KanbanDraggableCard itemId='task-a' columnId='todo' label='Tarea A'>
          <button onClick={onEdit}>Editar</button>
        </KanbanDraggableCard>
      </KanbanDroppableColumn>
    </KanbanDndContext>
  )

  await userEvent.click(screen.getByRole('button', { name: 'Editar' }))

  expect(onEdit).toHaveBeenCalledOnce()
  expect(onMove).not.toHaveBeenCalled()
})
