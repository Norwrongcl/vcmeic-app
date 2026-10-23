import { expect, it } from 'vitest'
import { EMPTY_APP_DATA } from '@/features/core/model/seed'
import { PRESENCE_TYPES } from './catalogs'
import { migrateVcmData } from './migration'
import type { Actor } from './types'
import { applyCommand, eligible, getQaIssues } from './workflow'

const actor: Actor = {
  id: 'coordination',
  name: 'Coordinación demo',
  role: 'coordination',
}
function presence() {
  let data = migrateVcmData(EMPTY_APP_DATA)
  data = applyCommand(
    data,
    {
      type: 'createCase',
      id: 'p',
      kind: 'presence',
      name: 'Exposición',
      responsible: 'Ana',
      description: 'Exposición técnica',
      startsAt: '2026-10-20',
      endsAt: '2026-10-20',
      portfolio: '',
    },
    actor
  )
  for (const [fieldId, value] of Object.entries({
    name: 'Exposición',
    responsible: 'Ana',
    description: 'Exposición técnica',
    startsAt: '2026-10-20',
    endsAt: '2026-10-20',
    executingUnit: 'EIC',
    reach: 'Regional',
    externalOrganization: 'Colegio',
  }))
    data = applyCommand(
      data,
      {
        type: 'setField',
        caseId: 'p',
        fieldId,
        value,
        status: 'confirmed',
        source: 'Programa revisado',
        observation: '',
      },
      actor
    )
  data = applyCommand(
    data,
    {
      type: 'updateCase',
      caseId: 'p',
      priority: 'medium',
      confidentiality: 'internal',
      presenceType: PRESENCE_TYPES[3],
      executionState: 'draft',
      portfolio: '',
    },
    actor
  )
  data = applyCommand(
    data,
    {
      type: 'addEvidence',
      caseId: 'p',
      id: 'e',
      name: 'Programa',
      url: 'https://example.com/programa',
      verified: true,
    },
    actor
  )
  for (const state of [
    'construction',
    'review',
    'validated',
    'closing',
    'qa',
    'rendered',
    'closed',
  ] as const)
    data = applyCommand(
      data,
      { type: 'transition', caseId: 'p', state, reason: 'Revisado' },
      actor
    )
  return data
}
it('requires an institutional response to close a cut and preserves observations when reopened', () => {
  let data = presence()
  data = applyCommand(
    data,
    {
      type: 'createCut',
      id: 'cut',
      name: 'Corte de prueba',
      period: '2026 S2',
      caseIds: ['p'],
    },
    actor
  )
  data = applyCommand(
    data,
    { type: 'transitionCut', cutId: 'cut', status: 'review', response: '' },
    actor
  )
  data = applyCommand(
    data,
    { type: 'transitionCut', cutId: 'cut', status: 'ready', response: '' },
    actor
  )
  expect(() =>
    applyCommand(
      data,
      { type: 'transitionCut', cutId: 'cut', status: 'closed', response: '' },
      actor
    )
  ).toThrow()
  data = applyCommand(
    data,
    {
      type: 'transitionCut',
      cutId: 'cut',
      status: 'closed',
      response: 'Respuesta recibida y archivada: conforme.',
    },
    actor
  )
  expect(data.cases.p.institutionalValidation).toBe('validated')
  data = applyCommand(
    data,
    {
      type: 'addObservation',
      cutId: 'cut',
      caseId: 'p',
      id: 'o',
      text: 'Precisar la organización.',
      category: 'ERROR DE DATO',
      responsible: 'Coordinación',
    },
    actor
  )
  expect(eligible(data, 'p')).toBe(false)
  expect(
    getQaIssues(data, 'p').some((issue) => issue.includes('observacion'))
  ).toBe(true)
  expect(() =>
    applyCommand(
      data,
      { type: 'transition', caseId: 'p', state: 'review', reason: 'Revisar' },
      actor
    )
  ).not.toThrow()
  const inReview = applyCommand(
    data,
    { type: 'transition', caseId: 'p', state: 'review', reason: 'Revisar' },
    actor
  )
  expect(() =>
    applyCommand(
      inReview,
      {
        type: 'transition',
        caseId: 'p',
        state: 'validated',
        reason: 'Intento prematuro',
      },
      actor
    )
  ).toThrow()
  expect(data.cuts.cut.status).toBe('review')
  expect(data.cases.p.state).toBe('returned')
  expect(data.cases.p.institutionalValidation).toBe('observed')
  data = applyCommand(
    data,
    {
      type: 'resolveObservation',
      cutId: 'cut',
      caseId: 'p',
      id: 'o',
      resolution: 'Se revisó y conservó el programa original.',
    },
    actor
  )
  expect(() =>
    applyCommand(
      data,
      { type: 'transitionCut', cutId: 'cut', status: 'ready', response: '' },
      actor
    )
  ).toThrow()
  for (const state of [
    'review',
    'validated',
    'closing',
    'qa',
    'rendered',
    'closed',
  ] as const)
    data = applyCommand(
      data,
      {
        type: 'transition',
        caseId: 'p',
        state,
        reason: 'Corrección y QA revisados',
      },
      actor
    )
  data = applyCommand(
    data,
    { type: 'transitionCut', cutId: 'cut', status: 'ready', response: '' },
    actor
  )
  data = applyCommand(
    data,
    {
      type: 'transitionCut',
      cutId: 'cut',
      status: 'closed',
      response: 'Respuesta de cierre recibida.',
    },
    actor
  )
  expect(data.cuts.cut.observations[0].text).toBe('Precisar la organización.')
  expect(data.cuts.cut.observations[0].status).toBe('resolved')
  expect(JSON.stringify(data.audit)).toContain(
    'Respuesta recibida y archivada: conforme.'
  )
})
it('keeps budget approval in Dirección and resolves escalations through Jefatura', () => {
  let data = presence()
  data = applyCommand(
    data,
    {
      type: 'proposeDecision',
      caseId: 'p',
      id: 'd',
      title: 'Presupuesto',
      kind: 'budget',
      amount: 100000,
      reason: 'Necesidad declarada',
    },
    actor
  )
  expect(() =>
    applyCommand(
      data,
      {
        type: 'decide',
        caseId: 'p',
        id: 'd',
        status: 'approved',
        reason: 'Conforme',
      },
      actor
    )
  ).toThrow()
  data = applyCommand(
    data,
    {
      type: 'decide',
      caseId: 'p',
      id: 'd',
      status: 'approved',
      reason: 'Presupuesto autorizado',
    },
    { ...actor, role: 'direction' }
  )
  expect(data.decisions.d.decidedBy?.role).toBe('direction')
})
