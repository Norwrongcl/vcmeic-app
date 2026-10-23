import { expect, it } from 'vitest'
import { emptyVcmData } from './migration'
import type { Actor } from './types'
import { applyCommand, getQaIssues } from './workflow'

const actor: Actor = { id: 'c', name: 'Coordinación', role: 'coordination' }
const create = {
  type: 'createCase' as const,
  id: 'a',
  kind: 'activity' as const,
  name: 'Actividad',
  description: 'Actividad',
  responsible: 'Ana',
  startsAt: '2026-10-21',
  endsAt: '2026-10-21',
  portfolio: '',
}
it('rejects impossible dates without changing the existing dossier', () => {
  expect(() =>
    applyCommand(emptyVcmData(), { ...create, startsAt: '2026-02-30' }, actor)
  ).toThrow(/fecha/i)
  const data = applyCommand(emptyVcmData(), create, actor)
  expect(() =>
    applyCommand(
      data,
      {
        type: 'setField',
        caseId: 'a',
        fieldId: 'startsAt',
        value: '2026-13-01',
        status: 'confirmed',
        source: 'Correo',
        observation: '',
      },
      actor
    )
  ).toThrow(/fecha/i)
  expect(data.cases.a.fields.startsAt.value).toBe('2026-10-21')
})
it('keeps malformed imported dates as pending QA instead of accepting closure', () => {
  const data = applyCommand(emptyVcmData(), create, actor)
  data.cases.a.fields.startsAt = {
    ...data.cases.a.fields.startsAt,
    value: '2026-02-30',
    status: 'confirmed',
  }
  expect(getQaIssues(data, 'a').join(' ')).toMatch(/fecha.*válida/i)
})
