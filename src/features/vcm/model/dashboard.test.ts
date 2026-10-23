import { expect, it } from 'vitest'
import { EMPTY_APP_DATA } from '@/features/core/model/seed'
import { buildDashboard } from './dashboard'
import { migrateVcmData } from './migration'
import type { Actor } from './types'
import { applyCommand } from './workflow'

const actor: Actor = {
  id: 'demo-coordination',
  name: 'Coordinación',
  role: 'coordination',
}
const now = new Date('2026-10-21T12:00:00Z')
function fixture() {
  let vcm = migrateVcmData(EMPTY_APP_DATA)
  for (const [id, date] of [
    ['past', '2026-01-01'],
    ['next', '2026-10-24'],
  ]) {
    vcm = applyCommand(
      vcm,
      {
        type: 'createCase',
        id,
        kind: 'event',
        name: id,
        responsible: 'Ana',
        description: 'Evento',
        startsAt: date,
        endsAt: date,
        portfolio: 'Alumni',
      },
      actor,
      now.toISOString()
    )
  }
  return { ...EMPTY_APP_DATA, vcm }
}
it('shows upcoming cases and overdue deadlines separately, using the same dossiers', () => {
  const dashboard = buildDashboard(fixture(), actor, now)
  expect(dashboard.upcoming.map((c) => c.id)).toEqual(['next'])
  expect(dashboard.overdue.map((c) => c.id)).toEqual(['past'])
  expect(dashboard.portfolios[0]).toMatchObject({
    name: 'Alumni',
    total: 2,
    completed: 0,
  })
})
it('counts project budgets only once and never equates spending with approved funding', () => {
  const app = fixture()
  app.vcm.cases.past.projectId = 'shared'
  app.vcm.cases.next.projectId = 'shared'
  app.budgetItems = {
    b: {
      id: 'b',
      eventId: 'shared',
      name: 'Logística',
      plannedAmount: 100,
      createdAt: '',
      updatedAt: '',
    },
  }
  app.expenses = {
    e: {
      id: 'e',
      eventId: 'shared',
      budgetItemId: 'b',
      amount: 150,
      concept: '',
      date: '',
      supplier: '',
      reference: '',
      createdAt: '',
      updatedAt: '',
    },
  }
  const result = buildDashboard(app, actor, now)
  expect(result.finance).toMatchObject({
    planned: 100,
    spent: 150,
    approved: 0,
    requested: 0,
    overBudget: 1,
    hasBudget: true,
  })
})
it('filters every dashboard aggregate by confidentiality and role', () => {
  const app = fixture()
  app.vcm.cases.past.confidentiality = 'sensitive'
  app.vcm.cases.next.confidentiality = 'sensitive'
  const result = buildDashboard(
    app,
    { id: 'reader', name: 'Consulta', role: 'viewer' },
    now
  )
  expect(result.cases).toHaveLength(0)
  expect(result.portfolios).toHaveLength(0)
  expect(result.upcoming).toHaveLength(0)
  expect(result.agreements).toHaveLength(0)
})
it('separates target and validated contribution without inventing risk thresholds', () => {
  const result = buildDashboard(fixture(), actor, now)
  expect(result.indicators.length).toBeGreaterThan(0)
  expect(
    result.indicators.every((i) => i.value === 0 && i.gap === i.target)
  ).toBe(true)
})
