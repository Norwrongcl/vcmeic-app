import { expect, it } from 'vitest'
import { DEMO_APP_DATA } from '@/features/core/model/seed'
import { TASK_KANBAN_COLUMNS, groupTasksByStatus } from './task-kanban'

it('keeps every task status as a stable Kanban column', () => {
  expect(TASK_KANBAN_COLUMNS.map((column) => column.status)).toEqual([
    'todo',
    'in_progress',
    'review',
    'done',
  ])
})

it('groups every filtered task into its operational status', () => {
  const tasks = Object.values(DEMO_APP_DATA.tasks)
  const groups = groupTasksByStatus(tasks)

  expect(Object.values(groups).flat()).toHaveLength(tasks.length)
  for (const task of tasks) {
    expect(groups[task.status].map((item) => item.id)).toContain(task.id)
  }
})
