import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { Field } from './primitives'

it('exposes a concise accessible label for native selects', async () => {
  const screen = await render(
    <Field label='Tipo de caso' name='type'>
      <option>Presencia</option>
      <option>Actividad</option>
    </Field>
  )
  await expect
    .element(
      screen.getByRole('combobox', { name: 'Tipo de caso', exact: true })
    )
    .toBeVisible()
})
