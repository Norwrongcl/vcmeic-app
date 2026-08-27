import { expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { EntityViewSwitcher } from './entity-view-switcher'

it('announces the selected view and changes it from an accessible button', async () => {
  const onValueChange = vi.fn()
  const screen = await render(
    <EntityViewSwitcher
      value='table'
      modes={['table', 'cards', 'kanban']}
      onValueChange={onValueChange}
    />
  )

  await expect
    .element(screen.getByRole('button', { name: 'Tabla' }))
    .toHaveAttribute('aria-pressed', 'true')

  await userEvent.click(screen.getByRole('button', { name: 'Tarjetas' }))

  expect(onValueChange).toHaveBeenCalledWith('cards')
})

it('renders only the modes supported by a module', async () => {
  const screen = await render(
    <EntityViewSwitcher
      value='cards'
      modes={['table', 'cards']}
      onValueChange={vi.fn()}
    />
  )

  await expect
    .element(screen.getByRole('button', { name: 'Tabla' }))
    .toBeInTheDocument()
  await expect
    .element(screen.getByRole('button', { name: 'Tarjetas' }))
    .toBeInTheDocument()
  await expect
    .element(screen.getByRole('button', { name: 'Kanban' }))
    .not.toBeInTheDocument()
})
