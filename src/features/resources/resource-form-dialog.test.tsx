import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { appStore } from '@/features/core/model/app-store'
import { EMPTY_APP_DATA } from '@/features/core/model/seed'
import { ResourceFormDialog } from './components/resource-form-dialog'

describe('ResourceFormDialog', () => {
  beforeEach(() => {
    appStore.setState({ ...EMPTY_APP_DATA, storageWarning: false })
  })

  it('creates a reusable equipment resource', async () => {
    const screen = await render(
      <ResourceFormDialog open onOpenChange={vi.fn()} />
    )

    await userEvent.fill(screen.getByLabelText('Nombre'), 'Proyector')
    await userEvent.fill(screen.getByLabelText('Cantidad disponible'), '2')
    await userEvent.click(
      screen.getByRole('button', { name: 'Guardar recurso' })
    )

    expect(Object.values(appStore.getState().resources)).toContainEqual(
      expect.objectContaining({
        name: 'Proyector',
        category: 'equipment',
        quantity: 2,
      })
    )
  })
})
