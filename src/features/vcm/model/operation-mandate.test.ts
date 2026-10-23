import { expect, it } from 'vitest'
import { createAppStore } from '@/features/core/model/app-store'
import { EMPTY_APP_DATA } from '@/features/core/model/seed'
import { createVcmRepository } from './repository'
import type { Actor, Dossier } from './types'

const actor: Actor = { id: 'c', name: 'Coordinación', role: 'coordination' }
it('requires an approved plan before execution and renews approval for critical scope or budget changes', async () => {
  const store = createAppStore({
    initialData: EMPTY_APP_DATA,
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  })
  const repo = createVcmRepository(store)
  await repo.execute(
    {
      type: 'createCase',
      id: 'p',
      kind: 'event',
      name: 'Evento',
      responsible: 'Ana',
      description: 'Iniciativa',
      startsAt: '2026-10-21',
      endsAt: '2026-10-22',
      portfolio: '',
    },
    actor
  )
  const execution = (state: Dossier['executionState']) => ({
    type: 'updateCase' as const,
    caseId: 'p',
    priority: 'medium' as const,
    confidentiality: 'internal' as const,
    presenceType: '',
    portfolio: '',
    executionState: state,
  })
  await expect(repo.execute(execution('in_progress'), actor)).rejects.toThrow(
    /plan.*aprobado/i
  )
  await repo.execute(
    {
      type: 'proposeDecision',
      caseId: 'p',
      id: 'flow',
      kind: 'flow',
      title: 'Aprobar plan',
      amount: null,
      reason: 'Plan operativo',
    },
    actor
  )
  await expect(
    repo.execute(
      {
        type: 'decide',
        caseId: 'p',
        id: 'flow',
        status: 'approved',
        reason: 'Revisado',
      },
      actor
    )
  ).rejects.toThrow(/plan/i)
  for (const fieldId of [
    'objective',
    'resultsPlanned',
    'scopeIncluded',
    'scopeExcluded',
    'closingCriteria',
    'expectedEvidence',
    'risks',
  ])
    await repo.execute(
      {
        type: 'setField',
        caseId: 'p',
        fieldId,
        value: 'Antecedente del plan',
        status: 'confirmed',
        source: 'Plan revisado',
        observation: '',
      },
      actor
    )
  await repo.execute(
    {
      type: 'decide',
      caseId: 'p',
      id: 'flow',
      status: 'approved',
      reason: 'Plan revisado',
    },
    actor
  )
  await repo.execute(execution('in_progress'), actor)
  expect((await repo.read()).cases.p.executionState).toBe('in_progress')
  store.getState().addBudgetItem({
    eventId: 'p',
    name: 'Nueva necesidad',
    plannedAmount: 100,
  })
  await expect(repo.execute(execution('completed'), actor)).rejects.toThrow(
    /plan.*aprobado/i
  )
  await repo.execute(
    {
      type: 'decide',
      caseId: 'p',
      id: 'flow',
      status: 'returned',
      reason: 'Cambio presupuestario',
    },
    actor
  )
  await repo.execute(
    {
      type: 'decide',
      caseId: 'p',
      id: 'flow',
      status: 'pending',
      reason: 'Plan actualizado',
    },
    actor
  )
  await repo.execute(
    {
      type: 'decide',
      caseId: 'p',
      id: 'flow',
      status: 'approved',
      reason: 'Ajuste revisado',
    },
    actor
  )
  await repo.execute(execution('completed'), actor)
  expect((await repo.read()).cases.p.executionState).toBe('completed')
})
it('keeps legacy completed projects pending QA until the operational mandate is reviewed', async () => {
  const store = createAppStore({
    initialData: EMPTY_APP_DATA,
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  })
  const repo = createVcmRepository(store)
  await repo.execute(
    {
      type: 'createCase',
      id: 'legacy',
      kind: 'event',
      name: 'Evento',
      responsible: 'Ana',
      description: 'Iniciativa',
      startsAt: '2026-10-21',
      endsAt: '2026-10-22',
      portfolio: '',
    },
    actor
  )
  const c = store.getState().vcm!.cases.legacy
  c.executionState = 'completed'
  c.state = 'closed'
  const { getQaIssues } = await import('./workflow')
  expect(getQaIssues(store.getState().vcm!, 'legacy').join(' ')).toMatch(
    /plan de trabajo.*aprobado/i
  )
})
it('lets a presence with an activated project capture operational scope without changing its institutional kind', async () => {
  const store = createAppStore({
    initialData: EMPTY_APP_DATA,
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  })
  const repo = createVcmRepository(store)
  await repo.execute(
    {
      type: 'createCase',
      id: 'presence',
      kind: 'presence',
      name: 'Presencia',
      responsible: 'Ana',
      description: 'Iniciativa',
      startsAt: '2026-10-21',
      endsAt: '2026-10-22',
      portfolio: '',
    },
    actor
  )
  await repo.execute(
    {
      type: 'attachProject',
      caseId: 'presence',
      reason: 'Requiere coordinación activa',
    },
    actor
  )
  await expect(
    repo.execute(
      {
        type: 'setField',
        caseId: 'presence',
        fieldId: 'scopeIncluded',
        value: 'Coordinar la participación',
        status: 'partial',
        source: 'Plan',
        observation: '',
      },
      actor
    )
  ).resolves.toBeUndefined()
  expect((await repo.read()).cases.presence.kind).toBe('presence')
})
it('blocks plan approval for reversed dates or unresolved critical date conflicts', async () => {
  const { applyCommand } = await import('./workflow')
  const { emptyVcmData } = await import('./migration')
  const { operationPlanIssues } = await import('./operation-mandate')
  const d = applyCommand(
    emptyVcmData(),
    {
      type: 'createCase',
      id: 'p',
      kind: 'event',
      name: 'Evento',
      responsible: 'Ana',
      description: 'Proyecto',
      startsAt: '2026-10-21',
      endsAt: '2026-10-22',
      portfolio: '',
    },
    actor
  )
  d.cases.p.fields.endsAt.value = '2026-10-20'
  expect(operationPlanIssues(d, 'p').join(' ')).toMatch(/orden.*fechas/i)
  d.cases.p.fields.endsAt.value = '2026-10-22'
  d.cases.p.fields.startsAt.status = 'conflict'
  expect(operationPlanIssues(d, 'p').join(' ')).toMatch(/conflictos.*fechas/i)
})
