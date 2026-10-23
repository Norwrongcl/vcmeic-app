import { expect, it } from 'vitest'
import { EMPTY_APP_DATA } from '@/features/core/model/seed'
import { buildDashboard } from './dashboard'
import { emptyVcmData } from './migration'
import type { Actor } from './types'
import { applyCommand } from './workflow'

const actor: Actor = { id: 'c', name: 'Coordinación', role: 'coordination' }
it('filters management reporting by year without losing active cases on the operational home', () => {
  let vcm = emptyVcmData()
  for (const [id, year] of [
    ['a', 2026],
    ['b', 2025],
  ] as const)
    vcm = applyCommand(
      vcm,
      {
        type: 'createCase',
        id,
        kind: 'event',
        name: id,
        responsible: 'Ana',
        description: 'Evento',
        startsAt: `${year}-01-01`,
        endsAt: `${year}-12-31`,
        portfolio: 'Alumni',
      },
      actor
    )
  const app = {
    ...EMPTY_APP_DATA,
    vcm,
    budgetItems: {
      a: {
        id: 'a',
        eventId: 'a',
        name: '2026',
        plannedAmount: 100,
        createdAt: '',
        updatedAt: '',
      },
      b: {
        id: 'b',
        eventId: 'b',
        name: '2025',
        plannedAmount: 300,
        createdAt: '',
        updatedAt: '',
      },
    },
  }
  expect(
    buildDashboard(app, actor, new Date('2026-10-21T12:00:00Z'), 2026).finance
      .planned
  ).toBe(100)
  expect(
    buildDashboard(app, actor, new Date('2026-10-21T12:00:00Z')).cases
  ).toHaveLength(2)
})
it('keeps consolidated projection pending when any included project has no estimate', () => {
  let vcm = emptyVcmData()
  for (const id of ['a', 'b'])
    vcm = applyCommand(
      vcm,
      {
        type: 'createCase',
        id,
        kind: 'event',
        name: id,
        responsible: 'Ana',
        description: 'Evento',
        startsAt: '2026-01-01',
        endsAt: '2026-12-31',
        portfolio: 'Alumni',
      },
      actor
    )
  vcm.forecasts.a = {
    basis: '',
    projectId: 'a',
    remaining: 10,
    reason: 'Estimación',
    version: 1,
    actor,
    at: '',
  }
  expect(
    buildDashboard({ ...EMPTY_APP_DATA, vcm }, actor).finance.projected
  ).toBeNull()
})
