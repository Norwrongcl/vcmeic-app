import { expect, it } from 'vitest'
import { createAppStore } from '@/features/core/model/app-store'
import { EMPTY_APP_DATA } from '@/features/core/model/seed'
import { planProgress, projectFinance, sortedPriorities } from './planning'
import { createVcmRepository } from './repository'
import type { Actor } from './types'

const coordination: Actor = {
  id: 'c',
  name: 'Coordinación',
  role: 'coordination',
}
const leadership: Actor = { id: 'l', name: 'Jefatura', role: 'leadership' }
const direction: Actor = { id: 'd', name: 'Dirección', role: 'direction' }
function setup() {
  const values = new Map<string, string>()
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v)
    },
    removeItem: (k: string) => {
      values.delete(k)
    },
  }
  const store = createAppStore({ initialData: EMPTY_APP_DATA, storage })
  return { store, storage, repo: createVcmRepository(store) }
}
async function fixture() {
  const x = setup()
  await x.repo.execute(
    {
      type: 'createCase',
      id: 'case',
      kind: 'event',
      name: 'Caso',
      responsible: 'Ana',
      description: 'Iniciativa',
      startsAt: '2026-10-20',
      endsAt: '2026-10-22',
      portfolio: 'Alumni',
    },
    coordination
  )
  return x
}
const plan = {
  type: 'savePlan' as const,
  id: '2026',
  year: 2026,
  title: 'Plan anual',
  reason: 'Lineamientos y necesidades',
  objectives: [
    {
      id: 'obj',
      title: 'Vinculación',
      responsible: 'Ana',
      dueDate: '2026-12-31',
      target: 1,
      measure: 'completed' as const,
      caseIds: ['case'],
      resources: 'Equipo',
      dependencies: 'Convenio',
    },
  ],
}
it('requires leadership sanction then Direction approval; editing invalidates approval and keeps history', async () => {
  const { repo } = await fixture()
  await repo.execute(plan, coordination)
  await expect(
    repo.execute(
      {
        type: 'transitionPlan',
        id: '2026',
        status: 'approved',
        reason: 'Aprobar',
      },
      direction
    )
  ).rejects.toThrow()
  await repo.execute(
    {
      type: 'transitionPlan',
      id: '2026',
      status: 'review',
      reason: 'Propuesta',
    },
    coordination
  )
  await expect(
    repo.execute(
      {
        type: 'transitionPlan',
        id: '2026',
        status: 'sanctioned',
        reason: 'Sancionar',
      },
      coordination
    )
  ).rejects.toThrow()
  await repo.execute(
    {
      type: 'transitionPlan',
      id: '2026',
      status: 'sanctioned',
      reason: 'Prioridades',
    },
    leadership
  )
  await repo.execute(
    {
      type: 'transitionPlan',
      id: '2026',
      status: 'approved',
      reason: 'Autorizado',
    },
    direction
  )
  expect((await repo.read()).plans['2026'].approvedVersion).toBe(1)
  await repo.execute({ ...plan, title: 'Plan ajustado' }, coordination)
  const data = await repo.read()
  expect(data.plans['2026']).toMatchObject({
    version: 2,
    status: 'draft',
    approvedVersion: null,
  })
  expect(data.audit.filter((a) => a.action === 'transitionPlan')).toHaveLength(
    3
  )
})
it('rejects missing references, duplicates, invalid targets and dates atomically', async () => {
  const { repo } = await fixture()
  for (const objective of [
    { ...plan.objectives[0], caseIds: ['missing'] },
    { ...plan.objectives[0], target: 0 },
    { ...plan.objectives[0], dueDate: '2027-01-01' },
    { ...plan.objectives[0], caseIds: ['case', 'case'] },
  ]) {
    await expect(
      repo.execute({ ...plan, objectives: [objective] }, coordination)
    ).rejects.toThrow()
  }
  expect(Object.keys((await repo.read()).plans)).toHaveLength(0)
})
it('derives objective execution and validation separately and hides plans with inaccessible references', async () => {
  const { repo, store } = await fixture()
  await repo.execute(plan, coordination)
  store.getState().vcm!.cases.case.executionState = 'completed'
  const p = planProgress(store.getState(), coordination, 2026)[0]
  expect(p.objectives[0]).toMatchObject({
    completed: 1,
    validated: 0,
    progress: 1,
    gap: 0,
  })
  store.getState().vcm!.cases.case.confidentiality = 'sensitive'
  expect(
    planProgress(
      store.getState(),
      { id: 'v', name: 'Consulta', role: 'viewer' },
      2026
    )
  ).toHaveLength(0)
})
it('records manual pertinence and urgency independently from confidentiality, with rationale', async () => {
  const { repo } = await fixture()
  await expect(
    repo.execute(
      {
        type: 'saveTriage',
        caseId: 'case',
        pertinence: 'high',
        urgency: 'high',
        reason: '',
      },
      coordination
    )
  ).rejects.toThrow()
  await repo.execute(
    {
      type: 'saveTriage',
      caseId: 'case',
      pertinence: 'high',
      urgency: 'high',
      reason: 'Compromiso estratégico próximo',
    },
    coordination
  )
  const d = await repo.read()
  expect(d.cases.case.confidentiality).toBe('internal')
  expect(sortedPriorities(d, coordination)[0].id).toBe('case')
  expect(d.triage.case.reason).toBe('Compromiso estratégico próximo')
})
it('reconciles commitments with expenses without counting paid amounts twice', async () => {
  const { repo, store } = await fixture()
  const b = store
    .getState()
    .addBudgetItem({ eventId: 'case', name: 'Servicios', plannedAmount: 100 })
  const e = store
    .getState()
    .addExpense({
      eventId: 'case',
      budgetItemId: b,
      amount: 30,
      concept: 'Pago parcial',
      date: '2026-10-21',
      supplier: 'Proveedor',
      reference: 'Boleta',
    })
  await repo.execute(
    {
      type: 'proposeDecision',
      caseId: 'case',
      id: 'fund',
      kind: 'budget',
      title: 'Financiamiento',
      amount: 100,
      reason: 'Necesidad',
    },
    coordination
  )
  await repo.execute(
    {
      type: 'decide',
      caseId: 'case',
      id: 'fund',
      status: 'approved',
      reason: 'Autorizado',
    },
    direction
  )
  await repo.execute(
    {
      type: 'saveCommitment',
      caseId: 'case',
      id: 'co',
      title: 'Servicio contratado',
      amount: 80,
      expenseIds: [e],
      decisionId: 'fund',
      reference: 'OC-1',
      status: 'active',
      reason: 'Compromiso confirmado',
    },
    coordination
  )
  await repo.execute(
    {
      type: 'saveForecast',
      caseId: 'case',
      remaining: 10,
      reason: 'Estimación de gastos aún no comprometidos',
    },
    coordination
  )
  expect(projectFinance(store.getState(), 'case')).toMatchObject({
    spent: 30,
    committed: 80,
    outstanding: 50,
    approved: 100,
    balance: 20,
    projected: 90,
    deviation: -10,
  })
  await expect(
    repo.execute(
      {
        type: 'saveCommitment',
        caseId: 'case',
        id: 'other',
        title: 'Otro',
        amount: 30,
        expenseIds: [e],
        decisionId: 'fund',
        reference: 'OC-2',
        status: 'active',
        reason: 'Otro',
      },
      coordination
    )
  ).rejects.toThrow()
  expect(Object.keys((await repo.read()).commitments)).toHaveLength(1)
})
it('requires actual project references, approval and reconciliation; stale funding and missing projection are explicit', async () => {
  const { repo, store } = await fixture()
  await expect(
    repo.execute(
      {
        type: 'saveCommitment',
        caseId: 'case',
        id: 'co',
        title: 'Servicio',
        amount: 80,
        expenseIds: [],
        decisionId: 'missing',
        reference: 'OC-1',
        status: 'active',
        reason: 'Confirmado',
      },
      coordination
    )
  ).rejects.toThrow()
  expect(projectFinance(store.getState(), 'case').projected).toBeNull()
  await repo.execute(
    {
      type: 'proposeDecision',
      caseId: 'case',
      id: 'fund',
      kind: 'budget',
      title: 'Financiamiento',
      amount: 100,
      reason: 'Necesidad',
    },
    coordination
  )
  await repo.execute(
    {
      type: 'decide',
      caseId: 'case',
      id: 'fund',
      status: 'approved',
      reason: 'Autorizado',
    },
    direction
  )
  await repo.execute(
    {
      type: 'saveCommitment',
      caseId: 'case',
      id: 'co',
      title: 'Servicio',
      amount: 80,
      expenseIds: [],
      decisionId: 'fund',
      reference: 'OC-1',
      status: 'active',
      reason: 'Confirmado',
    },
    coordination
  )
  await repo.execute(
    {
      type: 'decide',
      caseId: 'case',
      id: 'fund',
      status: 'returned',
      reason: 'Revisar',
    },
    direction
  )
  expect(
    projectFinance(store.getState(), 'case').issues.length
  ).toBeGreaterThan(0)
})
it('migrates v3 and preserves plans, reconciliation and audit through v4 backup/reload', async () => {
  const { repo, store, storage } = await fixture()
  const old = JSON.parse(await repo.exportBackup())
  old.version = 3
  delete old.data.vcm.plans
  delete old.data.vcm.triage
  delete old.data.vcm.commitments
  delete old.data.vcm.forecasts
  await repo.importBackup(JSON.stringify(old))
  expect((await repo.read()).cases.case.id).toBe('case')
  expect((await repo.read()).plans).toEqual({})
  await repo.execute(plan, coordination)
  const reloaded = createVcmRepository(createAppStore({ storage }))
  expect(await reloaded.read()).toEqual(store.getState().vcm)
  expect(JSON.parse(await reloaded.exportBackup()).version).toBe(4)
})
it('requires re-estimating the forecast after financial facts change', async () => {
  const { repo, store } = await fixture()
  const b = store
    .getState()
    .addBudgetItem({ eventId: 'case', name: 'Servicios', plannedAmount: 100 })
  await repo.execute(
    {
      type: 'saveForecast',
      caseId: 'case',
      remaining: 100,
      reason: 'Saldo estimado de compras',
    },
    coordination
  )
  expect(projectFinance(store.getState(), 'case').projected).toBe(100)
  store
    .getState()
    .addExpense({
      eventId: 'case',
      budgetItemId: b,
      amount: 30,
      concept: 'Pago',
      date: '2026-10-21',
      supplier: 'Proveedor',
      reference: 'Boleta',
    })
  expect(projectFinance(store.getState(), 'case').projected).toBeNull()
  expect(projectFinance(store.getState(), 'case').issues.join(' ')).toMatch(
    /estimación/i
  )
})
