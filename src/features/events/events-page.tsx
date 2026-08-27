import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  CalendarClock,
  CalendarDays,
  CircleDot,
  Plus,
  SearchIcon,
  WalletCards,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { EntityViewSwitcher } from '@/features/core/components/entity-view-switcher'
import { VCM_LINE_LABELS } from '@/features/core/model/catalogs'
import { useEntityViewPreference } from '@/features/core/model/view-preferences'
import { EventKanbanBoard } from './components/event-kanban-board'
import { MetricCard } from './components/metric-card'
import { EventStatusBadge } from './components/status-badges'
import { useEventsStore } from './model/events-store'
import { formatClp, formatEventDateTime } from './model/formatters'
import { eventStatusLabels } from './model/labels'
import { getEventFinancials } from './model/selectors'
import { type Event, type EventStatus } from './model/types'

const EVENT_VIEW_MODES = ['table', 'cards', 'kanban'] as const

function EventCard({
  event,
  showStatus = true,
}: {
  event: Event
  showStatus?: boolean
}) {
  return (
    <Link
      to='/events/$eventId'
      params={{ eventId: event.id }}
      className='block rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
    >
      <Card className='h-full transition-colors hover:bg-muted/40'>
        <CardHeader className='gap-3'>
          <div className='flex items-start justify-between gap-3'>
            <CardTitle className='text-base leading-snug'>
              {event.name}
            </CardTitle>
            {showStatus && <EventStatusBadge status={event.status} />}
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
    </Link>
  )
}

export function EventsPage() {
  const events = useEventsStore((state) => state.events)
  const tasks = useEventsStore((state) => state.tasks)
  const budgetItems = useEventsStore((state) => state.budgetItems)
  const expenses = useEventsStore((state) => state.expenses)
  const updateEvent = useEventsStore((state) => state.updateEvent)
  const storageWarning = useEventsStore((state) => state.storageWarning)
  const dismissStorageWarning = useEventsStore(
    (state) => state.dismissStorageWarning
  )
  const [view, setView] = useEntityViewPreference('events', EVENT_VIEW_MODES)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<EventStatus | 'all'>('all')
  const [owner, setOwner] = useState('all')
  const data = useMemo(
    () => ({ events, tasks, budgetItems, expenses }),
    [budgetItems, events, expenses, tasks]
  )

  useEffect(() => {
    if (!storageWarning) return
    toast.warning(
      'Los datos locales no eran compatibles. Se cargaron datos de demostración.'
    )
    dismissStorageWarning()
  }, [dismissStorageWarning, storageWarning])

  const allEvents = useMemo(
    () =>
      [...Object.values(events)].sort((a, b) =>
        a.startsAt.localeCompare(b.startsAt)
      ),
    [events]
  )
  const owners = useMemo(
    () =>
      [
        ...new Set(allEvents.map((event) => event.owner).filter(Boolean)),
      ].sort(),
    [allEvents]
  )
  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es-CL')
    return allEvents.filter((event) => {
      const matchesQuery =
        !normalizedQuery ||
        [event.name, event.location, event.owner].some((value) =>
          value.toLocaleLowerCase('es-CL').includes(normalizedQuery)
        )
      return (
        matchesQuery &&
        (status === 'all' || event.status === status) &&
        (owner === 'all' || event.owner === owner)
      )
    })
  }, [allEvents, owner, query, status])

  const totalPlanned = allEvents.reduce(
    (sum, event) => sum + getEventFinancials(data, event.id).planned,
    0
  )
  const now = new Date().toISOString().slice(0, 16)

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='flex flex-col gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Eventos</h1>
            <p className='text-muted-foreground'>
              Planifica hitos, tareas y ejecución presupuestaria.
            </p>
          </div>
          <Button asChild>
            <Link to='/events/new'>
              <Plus data-icon='inline-start' /> Nuevo evento
            </Link>
          </Button>
        </div>

        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
          <MetricCard
            label='Total'
            value={String(allEvents.length)}
            icon={CalendarDays}
          />
          <MetricCard
            label='Próximos'
            value={String(
              allEvents.filter(
                (event) =>
                  event.startsAt >= now &&
                  event.status !== 'completed' &&
                  event.status !== 'cancelled'
              ).length
            )}
            icon={CalendarClock}
            tone='violet'
          />
          <MetricCard
            label='En curso'
            value={String(
              allEvents.filter((event) => event.status === 'in_progress').length
            )}
            icon={CircleDot}
            tone='emerald'
          />
          <MetricCard
            label='Presupuesto'
            value={formatClp(totalPlanned)}
            icon={WalletCards}
            tone='amber'
          />
        </div>

        <div className='flex flex-col gap-3'>
          <div className='grid gap-3 md:grid-cols-[minmax(240px,1fr)_220px_220px]'>
            <div className='relative'>
              <SearchIcon
                aria-hidden='true'
                className='absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground'
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder='Buscar por nombre, ubicación o responsable'
                aria-label='Buscar eventos'
                className='ps-9'
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as EventStatus | 'all')}
            >
              <SelectTrigger aria-label='Filtrar por estado'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value='all'>Todos los estados</SelectItem>
                  {Object.entries(eventStatusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger aria-label='Filtrar por responsable'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value='all'>Todos los responsables</SelectItem>
                  {owners.map((eventOwner) => (
                    <SelectItem key={eventOwner} value={eventOwner}>
                      {eventOwner}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className='flex justify-end'>
            <EntityViewSwitcher
              value={view}
              modes={EVENT_VIEW_MODES}
              onValueChange={setView}
            />
          </div>
        </div>

        {!filteredEvents.length ? (
          <p className='rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground'>
            No hay eventos que coincidan con los filtros.
          </p>
        ) : view === 'table' ? (
          <div className='overflow-hidden rounded-lg border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead className='hidden md:table-cell'>Fecha</TableHead>
                  <TableHead className='hidden lg:table-cell'>
                    Coordinador
                  </TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className='hidden xl:table-cell'>
                    Línea VcM
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => {
                  const linkProps = {
                    to: '/events/$eventId' as const,
                    params: { eventId: event.id },
                  }
                  return (
                    <TableRow key={event.id} className='group'>
                      <TableCell>
                        <Link
                          {...linkProps}
                          className='block font-medium group-hover:underline'
                        >
                          {event.name}
                          <span className='mt-1 block text-xs font-normal text-muted-foreground md:hidden'>
                            {formatEventDateTime(event.startsAt)}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className='hidden md:table-cell'>
                        <Link {...linkProps} className='block'>
                          {formatEventDateTime(event.startsAt)}
                        </Link>
                      </TableCell>
                      <TableCell className='hidden lg:table-cell'>
                        <Link {...linkProps} className='block'>
                          {event.owner || 'Sin coordinador'}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link {...linkProps} className='block'>
                          <EventStatusBadge status={event.status} />
                        </Link>
                      </TableCell>
                      <TableCell className='hidden xl:table-cell'>
                        <Link {...linkProps} className='block'>
                          {event.vcmLine
                            ? VCM_LINE_LABELS[event.vcmLine]
                            : 'Sin línea VcM'}
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : view === 'cards' ? (
          <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <EventKanbanBoard
            events={filteredEvents}
            onStatusChange={(event, nextStatus) => {
              updateEvent(event.id, { status: nextStatus })
              toast.success(`Evento movido a ${eventStatusLabels[nextStatus]}.`)
            }}
          />
        )}
      </Main>
    </>
  )
}
