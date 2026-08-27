import { expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { appStore } from '@/features/core/model/app-store'
import { DEMO_APP_DATA } from '@/features/core/model/seed'
import { AgreementForm } from './components/agreement-form'

it('submits an agreement with its catalog relationships', async () => {
  appStore.setState({ ...DEMO_APP_DATA, storageWarning: false })
  const onSubmit = vi.fn()
  const screen = await render(
    <AgreementForm onSubmit={onSubmit} onCancel={vi.fn()} />
  )
  await userEvent.fill(screen.getByLabelText('Nombre'), 'Convenio territorial')
  await userEvent.click(screen.getByLabelText('Socio'))
  await userEvent.click(
    screen.getByText('Centro Cultural de Valparaíso').last()
  )
  await userEvent.fill(screen.getByLabelText('Inicio'), '2026-08-01')
  await userEvent.click(
    screen.getByRole('button', { name: 'Guardar convenio' })
  )
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Convenio territorial',
      partnerId: 'partner-cultural-center',
    })
  )
})
