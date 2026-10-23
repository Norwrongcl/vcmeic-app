import { expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { EMPTY_APP_DATA } from '@/features/core/model/seed'
import { blankField, migrateVcmData } from '../model/migration'
import type { Command } from '../model/types'
import { applyCommand } from '../model/workflow'
import { GroupRecordEditor } from './group-record-editor'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(async (_command: unknown) => true),
}))
vi.mock('../model/use-vcm', () => ({
  useVcm: () => ({
    actor: { id: 'demo-responsible', role: 'responsible' },
    execute: mocks.execute,
  }),
}))
it('submits only intended changes while preserving confirmed values and legacy timestamps', async () => {
  sessionStorage.clear()
  mocks.execute.mockClear()
  const dossier = applyCommand(
    migrateVcmData(EMPTY_APP_DATA),
    {
      type: 'createCase',
      id: 'case',
      kind: 'activity',
      name: 'Actividad',
      responsible: 'Ana',
      description: 'Contexto',
      startsAt: '',
      endsAt: '',
      portfolio: '',
    },
    { id: 'coord', role: 'coordination', name: 'Coordinación' }
  ).cases.case
  dossier.fields = {
    name: {
      ...blankField(),
      value: 'Nombre confirmado',
      status: 'confirmed',
    },
    description: {
      ...blankField(),
      value: 'Descripción original',
      status: 'partial',
    },
    startsAt: {
      ...blankField(),
      value: '2026-07-05T09:00',
      status: 'partial',
    },
  }
  const definitions = [
    { id: 'name', label: 'Nombre', group: 'General' },
    { id: 'description', label: 'Descripción', group: 'General' },
    { id: 'startsAt', label: 'Fecha inicio', group: 'General' },
  ]
  const screen = await render(
    <GroupRecordEditor
      dossier={dossier}
      definitions={definitions}
      group='General'
    />
  )
  await screen
    .getByRole('textbox', { name: 'Descripción', exact: true })
    .fill('Descripción aportada')
  await screen
    .getByRole('textbox', { name: 'Fuente común de los datos modificados' })
    .fill('Correo del responsable')
  await screen
    .getByRole('button', { name: 'Guardar cambios del grupo' })
    .click()
  await expect.poll(() => mocks.execute.mock.calls.length).toBe(1)
  const command = mocks.execute.mock.calls[0][0] as Extract<
    Command,
    { type: 'setFields' }
  >
  expect(command.fields).toEqual([
    {
      fieldId: 'description',
      value: 'Descripción aportada',
      status: 'partial',
      source: 'Correo del responsable',
      observation: '',
    },
  ])
})
