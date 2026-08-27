import { type EventStatus, type TaskPriority, type TaskStatus } from './types'

export const eventStatusLabels: Record<EventStatus, string> = {
  draft: 'Borrador',
  planned: 'Planificado',
  in_progress: 'En curso',
  completed: 'Finalizado',
  cancelled: 'Cancelado',
}

export const taskStatusLabels: Record<TaskStatus, string> = {
  todo: 'Por hacer',
  in_progress: 'En curso',
  review: 'Revisión',
  done: 'Completada',
  cancelled: 'Cancelada',
}

export const taskPriorityLabels: Record<TaskPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
}
