import { expect, it } from 'vitest'
import { type AgendaItem } from '@/features/core/model/selectors'
import { buildCalendarMonth } from './calendar-model'

const items: AgendaItem[] = [
  {
    id: 'event-start',
    kind: 'event-start',
    title: 'Inicio: Feria territorial',
    date: '2026-08-13T09:30',
    eventId: 'event-1',
    status: 'planned',
  },
  {
    id: 'task-due',
    kind: 'task-due',
    title: 'Confirmar proveedores',
    date: '2026-08-13',
    taskId: 'task-1',
    status: 'todo',
  },
]

it('builds a complete Monday-first grid for the visible month', () => {
  const days = buildCalendarMonth(
    new Date(2026, 7, 15),
    [],
    new Date(2026, 7, 13)
  )

  expect(days).toHaveLength(42)
  expect(days[0]?.key).toBe('2026-07-27')
  expect(days[6]?.key).toBe('2026-08-02')
  expect(days[41]?.key).toBe('2026-09-06')
  expect(days.filter((day) => day.inCurrentMonth)).toHaveLength(31)
})

it('groups dated items into their calendar day and marks the injected today', () => {
  const days = buildCalendarMonth(
    new Date(2026, 7, 15),
    items,
    new Date(2026, 7, 13, 18)
  )
  const augustThirteenth = days.find((day) => day.key === '2026-08-13')

  expect(augustThirteenth?.isToday).toBe(true)
  expect(augustThirteenth?.items.map((item) => item.id)).toEqual([
    'event-start',
    'task-due',
  ])
})
