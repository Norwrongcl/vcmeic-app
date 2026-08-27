import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { appStore } from '@/features/core/model/app-store'
import { EMPTY_APP_DATA } from '@/features/core/model/seed'
import { AgreementFormDialog } from './components/agreement-form-dialog'

describe('AgreementFormDialog', () => {
  beforeEach(() => {
    appStore.setState({
      ...EMPTY_APP_DATA,
      partners: {
        partner1: {
          id: 'partner1',
          name: 'Municipalidad de Valparaíso',
          type: 'Institución pública',
          taxId: '',
          email: '',
          phone: '',
          website: '',
          notes: '',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      storageWarning: false,
    })
  })

  it('creates an agreement linked to a catalog partner', async () => {
    const screen = await render(
      <AgreementFormDialog open onOpenChange={vi.fn()} />
    )

    await userEvent.fill(
      screen.getByLabelText('Nombre'),
      'Convenio de colaboración'
    )
    await userEvent.fill(screen.getByLabelText('Inicio'), '2026-08-01')
    await userEvent.click(screen.getByLabelText('Socio'))
    await userEvent.click(screen.getByText('Municipalidad de Valparaíso'))
    await userEvent.click(
      screen.getByRole('button', { name: 'Guardar convenio' })
    )

    expect(Object.values(appStore.getState().agreements)).toContainEqual(
      expect.objectContaining({
        name: 'Convenio de colaboración',
        partnerId: 'partner1',
      })
    )
  })
})
