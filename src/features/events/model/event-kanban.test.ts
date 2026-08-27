import { expect, it } from 'vitest'
import { DEMO_APP_DATA } from '@/features/core/model/seed'
import { EVENT_KANBAN_COLUMNS, groupEventsByStatus } from './event-kanban'

it('keeps every event status as a stable Kanban column', () => {
  expect(EVENT_KANBAN_COLUMNS.map((column) => column.status)).toEqual([
    'draft',
    'planned',
    'in_progress',
    'completed',
  ])
})

it('groups filtered events into their operational status', () => {
  const events = Object.values(DEMO_APP_DATA.events)
  const groups = groupEventsByStatus(events)

  expect(groups.planned.map((event) => event.id)).toContain('event-territorial')
  expect(groups.draft.map((event) => event.id)).toContain('event-fair')
  expect(Object.values(groups).flat()).toHaveLength(events.length)
})
