import {
  type Agreement,
  type AppData,
  type Event,
  type EventStatus,
  type VcmLineId,
} from './types'

export type AgreementTemporalStatus =
  | 'upcoming'
  | 'active'
  | 'expired'
  | 'cancelled'

export type EventTemporalStatus = 'upcoming' | 'ongoing' | 'ended'

export type AgendaItem = {
  id: string
  kind: 'event-start' | 'event-end' | 'task-due'
  title: string
  date: string
  eventId?: string
  taskId?: string
  status: EventStatus | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getContactName(data: AppData, contactId?: string | null) {
  if (!contactId) return 'Sin responsable'
  return data.contacts[contactId]?.name ?? 'Contacto no disponible'
}

export function getPartnerName(data: AppData, partnerId?: string | null) {
  if (!partnerId) return 'Sin socio'
  return data.partners[partnerId]?.name ?? 'Socio no disponible'
}

export function getAgreementTemporalStatus(
  agreement: Agreement,
  now = new Date()
): AgreementTemporalStatus {
  if (agreement.cancelled) return 'cancelled'
  const today = dateKey(now)
  if (agreement.startsAt > today) return 'upcoming'
  if (agreement.endsAt && agreement.endsAt < today) return 'expired'
  return 'active'
}

export function getEventTemporalStatus(
  event: Event,
  now = new Date()
): EventTemporalStatus {
  const timestamp = now.getTime()
  if (new Date(event.startsAt).getTime() > timestamp) return 'upcoming'
  if (new Date(event.endsAt).getTime() >= timestamp) return 'ongoing'
  return 'ended'
}

export function getAgendaItems(data: AppData): AgendaItem[] {
  const eventItems = Object.values(data.events).flatMap<AgendaItem>((event) => [
    {
      id: `${event.id}-start`,
      kind: 'event-start',
      title: `Inicio: ${event.name}`,
      date: event.startsAt,
      eventId: event.id,
      status: event.status,
    },
    {
      id: `${event.id}-end`,
      kind: 'event-end',
      title: `Término: ${event.name}`,
      date: event.endsAt,
      eventId: event.id,
      status: event.status,
    },
  ])
  const taskItems = Object.values(data.tasks).map<AgendaItem>((task) => ({
    id: `${task.id}-due`,
    kind: 'task-due',
    title: task.title,
    date: task.dueDate,
    eventId: task.eventId,
    taskId: task.id,
    status: task.status,
  }))

  return [...eventItems, ...taskItems].sort((a, b) =>
    a.date.localeCompare(b.date)
  )
}

export function getDashboardMetrics(data: AppData, now = new Date()) {
  const timestamp = now.getTime()
  const inThirtyDays = timestamp + 30 * 24 * 60 * 60 * 1000
  return {
    activities: Object.keys(data.activities).length,
    upcomingEvents: Object.values(data.events).filter((event) => {
      const start = new Date(event.startsAt).getTime()
      return (
        event.status !== 'cancelled' &&
        start >= timestamp &&
        start <= inThirtyDays
      )
    }).length,
    activeEvents: Object.values(data.events).filter(
      (event) => event.status === 'in_progress'
    ).length,
    pendingTasks: Object.values(data.tasks).filter(
      (task) =>
        task.status === 'todo' ||
        task.status === 'in_progress' ||
        task.status === 'review'
    ).length,
    expiringAgreements: Object.values(data.agreements).filter((agreement) => {
      if (getAgreementTemporalStatus(agreement, now) !== 'active') return false
      if (!agreement.endsAt) return false
      const end = new Date(`${agreement.endsAt}T23:59:59`).getTime()
      return end >= timestamp && end <= inThirtyDays
    }).length,
  }
}

export function getReportMetrics(data: AppData) {
  const completedEvents = Object.values(data.events).filter(
    (event) => event.status === 'completed' && event.closedAt
  )
  const counts = new Map<VcmLineId, number>()
  for (const activity of Object.values(data.activities)) {
    counts.set(activity.vcmLine, (counts.get(activity.vcmLine) ?? 0) + 1)
  }
  for (const event of completedEvents) {
    if (event.vcmLine) {
      counts.set(event.vcmLine, (counts.get(event.vcmLine) ?? 0) + 1)
    }
  }

  const plannedBudget = Object.values(data.budgetItems).reduce(
    (sum, item) => sum + item.plannedAmount,
    0
  )
  const spentBudget = Object.values(data.expenses).reduce(
    (sum, expense) => sum + expense.amount,
    0
  )

  return {
    activities: Object.keys(data.activities).length,
    completedEvents: completedEvents.length,
    participants:
      Object.values(data.activities).reduce(
        (sum, activity) => sum + activity.participantCount,
        0
      ) +
      completedEvents.reduce(
        (sum, event) => sum + (event.participantCount ?? 0),
        0
      ),
    byVcmLine: Array.from(counts, ([line, count]) => ({ line, count })),
    plannedBudget,
    spentBudget,
    budgetExecution:
      plannedBudget === 0 ? 0 : Math.round((spentBudget / plannedBudget) * 100),
  }
}
