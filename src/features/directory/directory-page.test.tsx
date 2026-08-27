import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { appStore } from '@/features/core/model/app-store'
import { EMPTY_APP_DATA } from '@/features/core/model/seed'
import { ContactFormDialog } from './components/contact-form-dialog'
import { PartnerFormDialog } from './components/partner-form-dialog'

describe('directory forms', () => {
  beforeEach(() => {
    appStore.setState({ ...EMPTY_APP_DATA, storageWarning: false })
  })

  it('creates a contact in the shared directory', async () => {
    const screen = await render(
      <ContactFormDialog open onOpenChange={vi.fn()} />
    )
    await userEvent.fill(screen.getByLabelText('Nombre'), 'Camila Soto')
    await userEvent.fill(screen.getByLabelText('Correo'), 'camila@example.org')
    await userEvent.click(
      screen.getByRole('button', { name: 'Guardar contacto' })
    )

    expect(Object.values(appStore.getState().contacts)).toContainEqual(
      expect.objectContaining({
        name: 'Camila Soto',
        email: 'camila@example.org',
      })
    )
  })

  it('requires a partner name before saving', async () => {
    const screen = await render(
      <PartnerFormDialog open onOpenChange={vi.fn()} />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Guardar socio' }))

    await expect
      .element(screen.getByText('Ingresa un nombre.'))
      .toBeInTheDocument()
    expect(Object.keys(appStore.getState().partners)).toHaveLength(0)
  })
})
