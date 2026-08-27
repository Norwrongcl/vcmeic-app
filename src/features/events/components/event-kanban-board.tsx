import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  KanbanDndContext,
  KanbanDraggableCard,
  KanbanDroppableColumn,
} from '@/features/core/components/kanban-dnd'
import { canMoveEvent } from '@/features/core/model/kanban-transitions'
import {
  EVENT_KANBAN_COLUMNS,
  groupEventsByStatus,
} from '../model/event-kanban'
import { formatEventDateTime } from '../model/formatters'
import { type Event, type EventStatus } from '../model/types'

const eventColumnStyles: Record<EventStatus, string> = {
  draft: 'border-t-slate-400 bg-slate-50/60 dark:bg-slate-950/20',
  planned: 'border-t-blue-500 bg-blue-50/55 dark:bg-blue-950/20',
  in_progress: 'border-t-violet-500 bg-violet-50/55 dark:bg-violet-950/20',
  completed: 'border-t-emerald-500 bg-emerald-50/55 dark:bg-emerald-950/20',
  cancelled: 'border-t-rose-400 bg-rose-50/55 dark:bg-rose-950/20',
}

function EventCard({
  event,
  overlay = false,
}: {
  event: Event
  overlay?: boolean
}) {
  return (
    <Card className='h-full transition-colors hover:bg-muted/40'>
      <CardHeader className='gap-3'>
        <div className='flex items-start justify-between gap-3'>
          <CardTitle className='text-base leading-snug'>
            {overlay ? (
              event.name
            ) : (
              <Link
                to='/events/$eventId'
                params={{ eventId: event.id }}
                className='rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
              >
                {event.name}
              </Link>
            )}
          </CardTitle>
        </div>
        <p className='text-sm text-muted-foreground'>
          {formatEventDateTime(event.startsAt)}
        </p>
      </CardHeader>
      <CardContent className='grid gap-2 text-sm'>
        <p className='line-clamp-1'>{event.owner || 'Sin coordinador'}</p>
        <p className='line-clamp-1 text-muted-foreground'>
          {event.location || 'Sin ubicación'}
        </p>
      </CardContent>
    </Card>
  )
}

export function EventKanbanBoard({
  events,
  onStatusChange,
}: {
  events: Event[]
  onStatusChange: (event: Event, status: EventStatus) => void
}) {
  const groups = groupEventsByStatus(events)
  const eventsById = Object.fromEntries(
    events.map((event) => [event.id, event])
  )

  return (
    <KanbanDndContext
      isDropAllowed={({ itemId, toColumnId }) => {
        const event = eventsById[itemId]
        return !!event && canMoveEvent(event.status, toColumnId as EventStatus)
      }}
      onMove={({ itemId, toColumnId }) => {
        const event = eventsById[itemId]
        if (event) onStatusChange(event, toColumnId as EventStatus)
      }}
      renderOverlay={(itemId) => {
        const event = eventsById[itemId]
        return event ? <EventCard event={event} overlay /> : null
      }}
    >
      <div className='grid auto-cols-[minmax(280px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-3'>
        {EVENT_KANBAN_COLUMNS.map((column) => (
          <KanbanDroppableColumn
            key={column.status}
            columnId={column.status}
            label={column.label}
            className={cn(
              'rounded-lg border border-t-4 p-3 transition-[box-shadow,background-color]',
              eventColumnStyles[column.status]
            )}
          >
            <div className='mb-3 flex items-center justify-between'>
              <h2 className='font-semibold'>{column.label}</h2>
              <span className='text-sm text-muted-foreground'>
                {groups[column.status].length}
              </span>
            </div>
            <div className='grid gap-3'>
              {groups[column.status].length ? (
                groups[column.status].map((event) =>
                  event.status === 'completed' ? (
                    <EventCard key={event.id} event={event} />
                  ) : (
                    <KanbanDraggableCard
                      key={event.id}
                      itemId={event.id}
                      columnId={event.status}
                      label={event.name}
                    >
                      <EventCard event={event} />
                    </KanbanDraggableCard>
                  )
                )
              ) : (
                <p className='rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground'>
                  Sin eventos
                </p>
              )}
            </div>
          </KanbanDroppableColumn>
        ))}
      </div>
    </KanbanDndContext>
  )
}
