import { useState } from 'react'
import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { Field, SaveForm } from './primitives'

function Probe({ fails = false }: { fails?: boolean }) {
  const [field, setField] = useState('name')
  return (
    <>
      <button onClick={() => setField(field === 'name' ? 'purpose' : 'name')}>
        Cambiar campo
      </button>
      <SaveForm
        key={field}
        draftKey={`test-draft-${field}`}
        onSave={async () => {
          if (fails) throw new Error('Corrige la fuente antes de guardar.')
          return true
        }}
      >
        <Field
          name='value'
          label='Dato'
          value={field === 'name' ? 'Original' : ''}
        />
      </SaveForm>
    </>
  )
}
it('keeps unsaved values when moving away and returning to a field', async () => {
  sessionStorage.clear()
  const screen = await render(<Probe />)
  await screen
    .getByRole('textbox', { name: 'Dato' })
    .fill('Borrador recuperable')
  await screen.getByRole('button', { name: 'Cambiar campo' }).click()
  await screen.getByRole('button', { name: 'Cambiar campo' }).click()
  await expect
    .element(screen.getByRole('textbox', { name: 'Dato' }))
    .toHaveValue('Borrador recuperable')
  await expect.element(screen.getByText(/Borrador conservado/)).toBeVisible()
})
it('keeps the draft and a persistent, actionable error after a failed save', async () => {
  sessionStorage.clear()
  const screen = await render(<Probe fails />)
  await screen.getByRole('textbox', { name: 'Dato' }).fill('No perder')
  await screen.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('Corrige la fuente')
  await screen.getByRole('button', { name: 'Cambiar campo' }).click()
  await screen.getByRole('button', { name: 'Cambiar campo' }).click()
  await expect
    .element(screen.getByRole('textbox', { name: 'Dato' }))
    .toHaveValue('No perder')
})
it('lets the user discard a draft explicitly', async () => {
  sessionStorage.clear()
  const screen = await render(<Probe />)
  await screen.getByRole('textbox', { name: 'Dato' }).fill('Descartable')
  await screen.getByRole('button', { name: 'Descartar borrador' }).click()
  await expect
    .element(screen.getByRole('textbox', { name: 'Dato' }))
    .toHaveValue('Original')
})
