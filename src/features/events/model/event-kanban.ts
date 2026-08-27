import { type Event, type EventStatus } from './types'

export const EVENT_KANBAN_COLUMNS: Array<{
  status: EventStatus
  label: string
}> = [
  { status: 'draft', label: 'Borrador' },
  { status: 'planned', label: 'Planificado' },
  { status: 'in_progress', label: 'En curso' },
  { status: 'completed', label: 'Finalizado' },
]

export function groupEventsByStatus(events: Event[]) {
  const groups: Record<EventStatus, Event[]> = {
    draft: [],
    planned: [],
    in_progress: [],
    completed: [],
    cancelled: [],
  }
  events.forEach((event) => groups[event.status].push(event))
  return groups
}
