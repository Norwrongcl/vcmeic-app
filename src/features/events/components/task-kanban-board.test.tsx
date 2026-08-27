import { expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { type Event, type EventTask } from '../model/types'
import { TaskKanbanBoard } from './task-kanban-board'

const metadata = {
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
}

const task: EventTask = {
  id: 'task-1',
  eventId: 'event-1',
  title: 'Confirmar proveedores',
  description: '',
  assignee: 'Ana Pérez',
  phase: 'pre',
  dueDate: '2026-08-13',
  priority: 'high',
  status: 'todo',
  blocked: true,
  ...metadata,
}

it('shows blocked work as a transversal alert without creating another column', async () => {
  const screen = await render(
    <TaskKanbanBoard
      tasks={[task]}
      events={{}}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onStatusChange={vi.fn()}
    />
  )

  await expect.element(screen.getByText('Bloqueada')).toBeInTheDocument()
  await expect
    .element(screen.getByRole('region', { name: 'Revisión' }))
    .toBeInTheDocument()
  await expect
    .element(screen.getByRole('region', { name: 'Cancelada' }))
    .not.toBeInTheDocument()
})

const event: Event = {
  id: 'event-1',
  name: 'Feria territorial',
  description: '',
  status: 'planned',
  startsAt: '2026-08-20T09:00',
  endsAt: '2026-08-20T18:00',
  location: '',
  owner: '',
  ...metadata,
}

it('renders stable columns and keeps task actions accessible', async () => {
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  const onStatusChange = vi.fn()
  const screen = await render(
    <TaskKanbanBoard
      tasks={[task]}
      events={{ 'event-1': event }}
      onEdit={onEdit}
      onDelete={onDelete}
      onStatusChange={onStatusChange}
    />
  )

  await expect.element(screen.getByText('Por hacer')).toBeInTheDocument()
  await expect.element(screen.getByText('En curso')).toBeInTheDocument()
  await expect.element(screen.getByText('Revisión')).toBeInTheDocument()
  await expect.element(screen.getByText('Completada')).toBeInTheDocument()
  await expect.element(screen.getByText('Cancelada')).not.toBeInTheDocument()
  await expect
    .element(screen.getByText('Confirmar proveedores'))
    .toBeInTheDocument()

  await userEvent.click(
    screen.getByRole('button', { name: 'Editar Confirmar proveedores' })
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Eliminar Confirmar proveedores' })
  )

  expect(onEdit).toHaveBeenCalledWith(task)
  expect(onDelete).toHaveBeenCalledWith(task)
})

it('requests a valid task status change from the Kanban', async () => {
  const onStatusChange = vi.fn()
  await render(
    <TaskKanbanBoard
      tasks={[task]}
      events={{ 'event-1': event }}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onStatusChange={onStatusChange}
    />
  )

  await userEvent.click(
    document.querySelector(
      '[aria-label="Mover Confirmar proveedores"]'
    ) as HTMLElement
  )
  await userEvent.keyboard('{Space}')
  await userEvent.keyboard('{ArrowRight}')
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await userEvent.keyboard('{Space}')

  expect(onStatusChange).toHaveBeenCalledWith(task, 'in_progress')
})
