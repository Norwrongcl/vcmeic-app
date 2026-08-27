import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { appStore } from '@/features/core/model/app-store'
import { EMPTY_APP_DATA } from '@/features/core/model/seed'
import { ActivityFormDialog } from './components/activity-form-dialog'

describe('ActivityFormDialog', () => {
  beforeEach(() => {
    appStore.setState({
      ...EMPTY_APP_DATA,
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

  it('creates a completed activity with one responsible and evidence link', async () => {
    const onOpenChange = vi.fn()
    const screen = await render(
      <ActivityFormDialog open onOpenChange={onOpenChange} />
    )

    await userEvent.fill(screen.getByLabelText('Nombre'), 'Taller territorial')
    await userEvent.fill(screen.getByLabelText('Inicio'), '2026-08-01T09:00')
    await userEvent.fill(screen.getByLabelText('Término'), '2026-08-01T13:00')
    await userEvent.fill(screen.getByLabelText('Participantes'), '32')
    await userEvent.click(screen.getByLabelText('Responsable'))
    await userEvent.click(screen.getByText('Ana Pérez'))
    await userEvent.click(
      screen.getByRole('button', { name: 'Agregar evidencia' })
    )
    await userEvent.fill(
      screen.getByLabelText('Nombre de la evidencia'),
      'Lista de asistencia'
    )
    await userEvent.fill(
      screen.getByLabelText('Enlace de la evidencia'),
      'https://example.org/lista'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Guardar actividad' })
    )

    expect(Object.values(appStore.getState().activities)).toContainEqual(
      expect.objectContaining({
        name: 'Taller territorial',
        responsibleContactId: 'contact1',
        participantCount: 32,
        evidences: [
          { name: 'Lista de asistencia', url: 'https://example.org/lista' },
        ],
      })
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
