import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { eventsStore } from '../model/events-store'
import { EventFormDialog } from './event-form-dialog'

describe('EventFormDialog', () => {
  beforeEach(() => {
    eventsStore.setState({
      events: {},
      tasks: {},
      budgetItems: {},
      expenses: {},
      contacts: {
        contact1: {
          id: 'contact1',
          name: 'Ana Pérez',
          email: 'ana@example.org',
          phone: '',
          role: 'Coordinadora',
          partnerId: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      storageWarning: false,
    })
  })

  it('shows validation errors for missing required fields', async () => {
    const screen = await render(<EventFormDialog open onOpenChange={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Crear evento' }))

    await expect
      .element(screen.getByText('Ingresa un nombre.'))
      .toBeInTheDocument()
    await expect
      .element(screen.getByText('Ingresa una persona responsable.'))
      .toBeInTheDocument()
    await expect
      .element(screen.getByText('Selecciona una fecha de inicio.'))
      .toBeInTheDocument()
    expect(Object.keys(eventsStore.getState().events)).toHaveLength(0)
  })

  it('creates an event and closes the dialog', async () => {
    const onOpenChange = vi.fn()
    const screen = await render(
      <EventFormDialog open onOpenChange={onOpenChange} />
    )

    await userEvent.fill(screen.getByLabelText('Nombre'), 'Seminario regional')
    await userEvent.click(screen.getByLabelText('Coordinador'))
    await userEvent.click(screen.getByText('Ana Pérez'))
    await userEvent.fill(screen.getByLabelText('Inicio'), '2026-09-10T09:00')
    await userEvent.fill(screen.getByLabelText('Término'), '2026-09-10T18:00')
    await userEvent.click(screen.getByRole('button', { name: 'Crear evento' }))

    expect(Object.values(eventsStore.getState().events)).toContainEqual(
      expect.objectContaining({
        name: 'Seminario regional',
        owner: 'Ana Pérez',
        coordinatorContactId: 'contact1',
        startsAt: '2026-09-10T09:00',
      })
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
