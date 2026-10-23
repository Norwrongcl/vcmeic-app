import { expect, it } from 'vitest'
import { PRESENCE_TYPES } from './catalogs'
import { emptyVcmData } from './migration'
import type { Actor } from './types'
import { applyCommand, eligible, getIndicatorValue } from './workflow'

const actor: Actor = { id: 'c', name: 'Coordinación', role: 'coordination' }
function fixture() {
  const data = applyCommand(
    emptyVcmData(),
    {
      type: 'createCase',
      id: 'p',
      kind: 'presence',
      name: 'Presencia',
      responsible: 'Ana',
      description: 'Exposición',
      startsAt: '2026-10-21',
      endsAt: '2026-10-21',
      portfolio: '',
    },
    actor
  )
  const c = data.cases.p
  c.state = 'validated'
  c.presenceType = PRESENCE_TYPES[0]
  for (const name of [
    'name',
    'responsible',
    'description',
    'startsAt',
    'endsAt',
    'executingUnit',
    'reach',
    'externalOrganization',
  ])
    c.fields[name] = {
      value:
        name === 'startsAt' || name === 'endsAt' ? '2026-10-21' : 'Confirmado',
      status: 'confirmed',
      sourceIds: [],
      candidates: [],
      observation: '',
    }
  data.evidences.e = {
    id: 'e',
    caseId: 'p',
    name: 'Evidencia',
    url: 'https://example.org',
    verified: true,
    sourceId: 's',
    version: 1,
    confidentiality: 'internal',
  }
  expect(eligible(data, 'p')).toBe(true)
  return data
}
it('rejects periods without a configured institutional rule even for pending links', () => {
  const data = fixture()
  data.cases.p.fields.startsAt.value = '2027-01-01'
  data.cases.p.fields.endsAt.value = '2027-01-01'
  expect(() =>
    applyCommand(
      data,
      {
        type: 'linkIndicator',
        caseId: 'p',
        id: 'l',
        indicatorId: '4.2.5',
        value: 1,
        period: 2027,
        rule: 'Presencia',
        evidenceIds: ['e'],
        validate: false,
      },
      actor
    )
  ).toThrow(/regla.*período/i)
})
it('never counts imported validated links for unavailable institutional criteria or incompatible values', () => {
  const data = fixture()
  data.indicatorLinks.l = {
    id: 'l',
    caseId: 'p',
    indicatorId: '4.2.3',
    period: 2026,
    value: 240,
    rule: 'Criterio inventado',
    evidenceIds: ['e'],
    status: 'validated',
    actor,
    version: 1,
  }
  expect(getIndicatorValue(data, '4.2.3', 2026)).toBe(0)
  data.indicatorLinks.l.indicatorId = '4.2.5'
  data.indicatorLinks.l.value = 2
  expect(getIndicatorValue(data, '4.2.5', 2026)).toBe(0)
  data.indicatorLinks.l.value = 1
  expect(getIndicatorValue(data, '4.2.5', 2026)).toBe(1)
  data.cases.p.fields.startsAt.value = '2027-01-01'
  expect(getIndicatorValue(data, '4.2.5', 2026)).toBe(0)
})
