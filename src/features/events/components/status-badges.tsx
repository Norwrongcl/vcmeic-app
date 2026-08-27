import { Badge } from '@/components/ui/badge'
import { eventStatusLabels, taskStatusLabels } from '../model/labels'
import { type EventStatus, type TaskStatus } from '../model/types'

const eventStatusStyles: Record<EventStatus, string> = {
  draft:
    'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
  planned:
    'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200',
  in_progress:
    'border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200',
  completed:
    'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  cancelled:
    'border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200',
}

const taskStatusStyles: Record<TaskStatus, string> = {
  todo: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  in_progress:
    'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200',
  review:
    'border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200',
  done: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  cancelled:
    'border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200',
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <Badge variant='outline' className={eventStatusStyles[status]}>
      {eventStatusLabels[status]}
    </Badge>
  )
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant='outline' className={taskStatusStyles[status]}>
      {taskStatusLabels[status]}
    </Badge>
  )
}
