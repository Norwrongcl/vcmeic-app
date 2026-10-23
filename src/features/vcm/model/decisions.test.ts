import { expect, it } from 'vitest'
import { emptyVcmData } from './migration'
import type { Actor } from './types'
import { applyCommand, getQaIssues } from './workflow'

const coordination: Actor = {
  id: 'c',
  name: 'Coordinación',
  role: 'coordination',
}
const leadership: Actor = { id: 'l', name: 'Jefatura', role: 'leadership' }
const direction: Actor = { id: 'd', name: 'Dirección', role: 'direction' }
function fixture() {
  let d = applyCommand(
    emptyVcmData(),
    {
      type: 'createCase',
      id: 'c',
      kind: 'presence',
      name: 'Caso',
      responsible: 'Ana',
      description: 'Registro',
      startsAt: '2026-10-21',
      endsAt: '2026-10-21',
      portfolio: '',
    },
    coordination
  )
  d = applyCommand(
    d,
    {
      type: 'proposeDecision',
      caseId: 'c',
      id: 'd',
      kind: 'exception',
      title: 'Compromiso institucional',
      amount: null,
      reason: 'Requiere autoridad',
      authority: 'direction',
      alternatives: 'Derivar o aprobar',
      impact: 'Compromete a la Escuela',
    },
    coordination
  )
  return d
}
it('enforces the requested authority and traces rejection, resubmission, execution and closure', () => {
  let d = fixture()
  expect(() =>
    applyCommand(
      d,
      {
        type: 'decide',
        caseId: 'c',
        id: 'd',
        status: 'approved',
        reason: 'Aprobar',
      },
      coordination
    )
  ).toThrow(/autoridad/i)
  d = applyCommand(
    d,
    {
      type: 'decide',
      caseId: 'c',
      id: 'd',
      status: 'direction_required',
      reason: 'Elevar',
    },
    leadership
  )
  d = applyCommand(
    d,
    {
      type: 'decide',
      caseId: 'c',
      id: 'd',
      status: 'rejected',
      reason: 'No procede',
    },
    direction
  )
  expect(() =>
    applyCommand(
      d,
      {
        type: 'decide',
        caseId: 'c',
        id: 'd',
        status: 'in_execution',
        reason: 'Ejecutar',
      },
      coordination
    )
  ).toThrow()
  d = applyCommand(
    d,
    {
      type: 'decide',
      caseId: 'c',
      id: 'd',
      status: 'pending',
      reason: 'Reformular',
    },
    coordination
  )
  d = applyCommand(
    d,
    {
      type: 'decide',
      caseId: 'c',
      id: 'd',
      status: 'approved',
      reason: 'Autorizado',
    },
    direction
  )
  d = applyCommand(
    d,
    {
      type: 'decide',
      caseId: 'c',
      id: 'd',
      status: 'in_execution',
      reason: 'Iniciar',
    },
    coordination
  )
  d = applyCommand(
    d,
    {
      type: 'decide',
      caseId: 'c',
      id: 'd',
      status: 'closed',
      reason: 'Compromiso cumplido',
    },
    coordination
  )
  expect(d.decisions.d.status).toBe('closed')
  expect(d.decisions.d.alternatives).toBe('Derivar o aprobar')
  expect(d.audit.filter((a) => a.action === 'decide')).toHaveLength(6)
})
it('keeps postponed and review decisions blocking QA until they are resolved', () => {
  const d = applyCommand(
    fixture(),
    {
      type: 'decide',
      caseId: 'c',
      id: 'd',
      status: 'leadership_review',
      reason: 'Revisar',
    },
    coordination
  )
  expect(getQaIssues(d, 'c').join(' ')).toContain('decisiones pendientes')
})
it('requires a rationale when changing the declared operational priority', () => {
  const d = fixture()
  const cmd = {
    type: 'updateCase' as const,
    caseId: 'c',
    priority: 'high' as const,
    confidentiality: 'internal' as const,
    presenceType: '',
    executionState: 'draft' as const,
    portfolio: '',
  }
  expect(() => applyCommand(d, cmd, coordination)).toThrow(/fundamento/i)
  const updated = applyCommand(
    d,
    { ...cmd, reason: 'Ventana de oportunidad que exige reordenar la agenda' },
    coordination
  )
  expect(updated.audit[updated.audit.length - 1].reason).toContain(
    'Ventana de oportunidad'
  )
})
