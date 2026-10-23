import { expect, it } from 'vitest'
import { EMPTY_APP_DATA } from '@/features/core/model/seed'
import { emptyVcmData } from './migration'
import { buildReportCsv } from './report-export'
import type { Actor } from './types'
import { applyCommand } from './workflow'

const actor: Actor = { id: 'c', name: 'Coordinación', role: 'coordination' }
it('exports the selected report instead of returning operational cases for every view', () => {
  const vcm = applyCommand(
    emptyVcmData(),
    {
      type: 'createCase',
      id: 'a',
      kind: 'event',
      name: '=FORMULA',
      responsible: 'Ana',
      description: 'Evento',
      startsAt: '2026-10-21',
      endsAt: '2026-10-21',
      portfolio: 'Alumni',
    },
    actor,
    '2026-10-21T12:00:00Z'
  )
  const app = { ...EMPTY_APP_DATA, vcm }
  expect(buildReportCsv(app, actor, 2026, 'indicators')).toContain(
    'Presencias de académicos'
  )
  expect(buildReportCsv(app, actor, 2026, 'history')).toContain('createCase')
  expect(buildReportCsv(app, actor, 2026, 'operational')).toContain("'=FORMULA")
  expect(buildReportCsv(app, actor, 2025, 'history')).not.toContain(
    'createCase'
  )
})
