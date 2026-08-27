import { expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { appStore } from '@/features/core/model/app-store'
import { EMPTY_APP_DATA } from '@/features/core/model/seed'
import { ContactForm } from './components/contact-form'
import { PartnerForm } from './components/partner-form'

it('submits a valid partner from the reusable page form', async () => {
  const onSubmit = vi.fn()
  const screen = await render(
    <PartnerForm onSubmit={onSubmit} onCancel={vi.fn()} />
  )

  await userEvent.fill(screen.getByLabelText('Nombre'), 'Fundación Horizonte')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar socio' }))

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Fundación Horizonte' })
  )
})

it('keeps the partner relationship in the reusable contact form', async () => {
  appStore.setState({
    ...EMPTY_APP_DATA,
    partners: {
      partner1: {
        id: 'partner1',
        name: 'Municipalidad de Quillota',
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
  const onSubmit = vi.fn()
  const screen = await render(
    <ContactForm onSubmit={onSubmit} onCancel={vi.fn()} />
  )

  await userEvent.fill(screen.getByLabelText('Nombre'), 'Camila Soto')
  await userEvent.click(screen.getByLabelText('Socio relacionado'))
  await userEvent.click(screen.getByText('Municipalidad de Quillota').last())
  await userEvent.click(
    screen.getByRole('button', { name: 'Guardar contacto' })
  )

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Camila Soto', partnerId: 'partner1' })
  )
})
