import { describe, expect, it } from 'vitest'
import {
  type EventStatus,
  type TaskStatus,
} from '@/features/events/model/types'
import {
  canMoveEvent,
  canMoveTask,
  getActivityMove,
} from './kanban-transitions'
import { type ActivityApprovalStatus } from './types'

describe('task Kanban transitions', () => {
  const statuses: TaskStatus[] = [
    'todo',
    'in_progress',
    'review',
    'done',
    'cancelled',
  ]

  it.each(
    statuses.flatMap((from) =>
      statuses.map((to) => [from, to, from !== to] as const)
    )
  )('evaluates %s → %s', (from, to, expected) => {
    expect(canMoveTask(from, to)).toBe(expected)
  })
})

describe('event Kanban transitions', () => {
  const statuses: EventStatus[] = [
    'draft',
    'planned',
    'in_progress',
    'completed',
    'cancelled',
  ]

  it.each(
    statuses.flatMap((from) =>
      statuses.map(
        (to) =>
          [
            from,
            to,
            from !== to && from !== 'completed' && to !== 'completed',
          ] as const
      )
    )
  )('evaluates %s → %s', (from, to, expected) => {
    expect(canMoveEvent(from, to)).toBe(expected)
  })
})

describe('activity Kanban transitions', () => {
  it.each<
    [
      ActivityApprovalStatus,
      ActivityApprovalStatus,
      'approve' | 'reject' | null,
    ]
  >([
    ['pending', 'pending', null],
    ['pending', 'approved', 'approve'],
    ['pending', 'rejected', 'reject'],
    ['approved', 'pending', null],
    ['approved', 'approved', null],
    ['approved', 'rejected', 'reject'],
    ['rejected', 'pending', null],
    ['rejected', 'approved', 'approve'],
    ['rejected', 'rejected', null],
  ])('evaluates %s → %s', (from, to, expected) => {
    expect(getActivityMove(from, to)).toBe(expected)
  })
})
