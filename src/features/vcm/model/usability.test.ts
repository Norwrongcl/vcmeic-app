import { expect, it } from 'vitest'
import { EMPTY_APP_DATA } from '@/features/core/model/seed'
import { migrateVcmData } from './migration'
import type { Actor } from './types'
import {
  reportCases,
  decisionOptions,
  weeklyPackageSnapshot,
} from './usability'
import { applyCommand } from './workflow'

const actor: Actor = { id: 'coord', name: 'Coord', role: 'coordination' }
it('keeps undated cases visible separately without assigning them to a reporting year', () => {
  let data = migrateVcmData(EMPTY_APP_DATA)
  for (const [id, startsAt] of [
    ['dated', '2026-10-21'],
    ['undated', ''],
    ['outside', '2025-01-01'],
  ])
    data = applyCommand(
      data,
      {
        type: 'createCase',
        id,
        kind: 'initiative',
        name: id,
        responsible: 'Ana',
        description: 'Contexto',
        startsAt,
        endsAt: '',
        portfolio: '',
      },
      actor
    )
  const result = reportCases(data, actor, '2026')
  expect(result.dated.map((c) => c.id)).toEqual(['dated'])
  expect(result.undated.map((c) => c.id)).toEqual(['undated'])
  expect(result.outside).toBe(1)
})
it('does not offer budget approval to Coordination, while preserving its return/escalation actions', () => {
  expect(
    decisionOptions({ kind: 'budget', status: 'pending' }, actor.role)
  ).toEqual(expect.arrayContaining(['returned', 'escalated']))
  expect(
    decisionOptions({ kind: 'budget', status: 'pending' }, 'direction')
  ).toContain('approved')
  expect(
    decisionOptions({ kind: 'exception', status: 'escalated' }, actor.role)
  ).toEqual([])
})
it('changes the package review snapshot when a piece is added, edited or its strategy changes', () => {
  const data = migrateVcmData(EMPTY_APP_DATA)
  const empty = weeklyPackageSnapshot(data, '2026-10-20')
  data.contents.a = {
    id: 'a',
    caseId: 'case',
    packageId: '2026-10-20',
    mode: 'weekly',
    version: 1,
  } as (typeof data.contents)[string]
  const first = weeklyPackageSnapshot(data, '2026-10-20')
  expect(first).not.toBe(empty)
  data.contents.a.version++
  expect(weeklyPackageSnapshot(data, '2026-10-20')).not.toBe(first)
})
