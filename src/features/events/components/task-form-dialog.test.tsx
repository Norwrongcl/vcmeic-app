import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { eventsStore } from '../model/events-store'
import { TaskFormDialog } from './task-form-dialog'

const metadata = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('TaskFormDialog', () => {
  beforeEach(() => {
    eventsStore.setState({
      tasks: {},
      contacts: {
        contact1: {
          id: 'contact1',
          name: 'Ana Pérez',
          email: '',
          phone: '',
          role: '',
          partnerId: null,
          ...metadata,
        },
        contact2: {
          id: 'contact2',
          name: 'Luis Soto',
          email: '',
          phone: '',
          role: '',
          partnerId: null,
          ...metadata,
        },
      },
    })
  })

  it('assigns an event task to multiple contacts and one phase', async () => {
    const screen = await render(
      <TaskFormDialog
        open
        onOpenChange={vi.fn()}
        eventId='event1'
        phase='during'
      />
    )

    await userEvent.fill(screen.getByLabelText('Título'), 'Coordinar montaje')
    await userEvent.fill(screen.getByLabelText('Vencimiento'), '2026-09-10')
    await userEvent.click(screen.getByLabelText('Responsables'))
    await userEvent.click(screen.getByText('Ana Pérez'))
    await userEvent.click(screen.getByText('Luis Soto'))
    await userEvent.click(screen.getByLabelText('Responsables'))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar tarea' }))

    expect(Object.values(eventsStore.getState().tasks)).toContainEqual(
      expect.objectContaining({
        phase: 'during',
        assigneeContactIds: ['contact1', 'contact2'],
        assignee: 'Ana Pérez, Luis Soto',
      })
    )
  })
})
