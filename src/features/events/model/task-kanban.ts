import { type EventTask, type TaskStatus } from './types'

export const TASK_KANBAN_COLUMNS: Array<{
  status: TaskStatus
  label: string
}> = [
  { status: 'todo', label: 'Por hacer' },
  { status: 'in_progress', label: 'En curso' },
  { status: 'review', label: 'Revisión' },
  { status: 'done', label: 'Completada' },
]

export function groupTasksByStatus(tasks: EventTask[]) {
  const groups: Record<TaskStatus, EventTask[]> = {
    todo: [],
    in_progress: [],
    review: [],
    done: [],
    cancelled: [],
  }
  tasks.forEach((task) => groups[task.status].push(task))
  return groups
}
