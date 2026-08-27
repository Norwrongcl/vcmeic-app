import { expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { ResourceForm } from './components/resource-form'

it('submits a reusable resource with its quantity', async () => {
  const onSubmit = vi.fn()
  const screen = await render(
    <ResourceForm onSubmit={onSubmit} onCancel={vi.fn()} />
  )
  await userEvent.fill(screen.getByLabelText('Nombre'), 'Proyector')
  await userEvent.fill(screen.getByLabelText('Cantidad disponible'), '3')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar recurso' }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Proyector', quantity: 3 })
  )
})
