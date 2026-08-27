import { useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CircleCheckBig,
  MapPin,
  Pencil,
  Trash2,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { VCM_LINE_LABELS } from '@/features/core/model/catalogs'
import { EventClosureForm } from './components/event-closure-form'
import { EventFinances } from './components/event-finances'
import { EventTasks } from './components/event-tasks'
import { MetricCard } from './components/metric-card'
import { EventStatusBadge } from './components/status-badges'
import { useEventsStore } from './model/events-store'
import { formatClp, formatEventDateTime } from './model/formatters'
import { getEventDeletionImpact, getEventFinancials } from './model/selectors'

export function EventDetailPage({ eventId }: { eventId: string }) {
  const navigate = useNavigate()
  const event = useEventsStore((state) => state.events[eventId])
  const events = useEventsStore((state) => state.events)
  const tasks = useEventsStore((state) => state.tasks)
  const budgetItems = useEventsStore((state) => state.budgetItems)
  const expenses = useEventsStore((state) => state.expenses)
  const contacts = useEventsStore((state) => state.contacts)
  const partners = useEventsStore((state) => state.partners)
  const deleteEvent = useEventsStore((state) => state.deleteEvent)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const data = useMemo(
    () => ({ events, tasks, budgetItems, expenses }),
    [budgetItems, events, expenses, tasks]
  )

  if (!event) {
    return (
      <>
        <Header>
          <Search className='me-auto' />
          <ThemeSwitch />
          <ProfileDropdown />
        </Header>
        <Main>
          <Empty className='min-h-96 border'>
            <EmptyHeader>
              <EmptyMedia variant='icon'>
                <CalendarDays />
              </EmptyMedia>
              <EmptyTitle>Evento no encontrado</EmptyTitle>
              <EmptyDescription>
                Es posible que se haya eliminado o que el enlace sea incorrecto.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link to='/events'>Volver a eventos</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </Main>
      </>
    )
  }

  const eventTasks = Object.values(tasks).filter(
    (task) => task.eventId === eventId
  )
  const completedTasks = eventTasks.filter(
    (task) => task.status === 'done'
  ).length
  const financials = getEventFinancials(data, eventId)
  const deletionImpact = getEventDeletionImpact(data, eventId)

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='flex flex-col gap-6'>
        <div className='flex flex-col gap-4'>
          <Button
            asChild
            variant='ghost'
            className='w-fit px-0 hover:bg-transparent'
          >
            <Link to='/events'>
              <ArrowLeft data-icon='inline-start' />
              Volver a eventos
            </Link>
          </Button>
          <div className='flex flex-wrap items-start justify-between gap-4'>
            <div className='flex flex-col gap-2'>
              <div className='flex flex-wrap items-center gap-2'>
                <h1 className='text-2xl font-bold tracking-tight'>
                  {event.name}
                </h1>
                <EventStatusBadge status={event.status} />
              </div>
              <p className='max-w-3xl text-muted-foreground'>
                {event.description || 'Sin descripción.'}
              </p>
            </div>
            <div className='flex gap-2'>
              <Button asChild variant='outline'>
                <Link to='/events/$eventId/edit' params={{ eventId }}>
                  <Pencil data-icon='inline-start' />
                  Editar
                </Link>
              </Button>
              <Button variant='destructive' onClick={() => setDeleteOpen(true)}>
                <Trash2 data-icon='inline-start' />
                Eliminar
              </Button>
            </div>
          </div>
        </div>

        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
          <MetricCard
            label='Inicio'
            value={formatEventDateTime(event.startsAt)}
            description={event.location || 'Sin ubicación'}
            icon={CalendarDays}
          />
          <MetricCard
            label='Coordinador'
            value={
              (event.coordinatorContactId
                ? contacts[event.coordinatorContactId]?.name
                : undefined) ?? event.owner
            }
            description='Coordinación principal'
            icon={UserRound}
            tone='violet'
          />
          <MetricCard
            label='Avance de tareas'
            value={`${completedTasks}/${eventTasks.length}`}
            description='Tareas completadas'
            icon={CircleCheckBig}
            tone='emerald'
          />
          <MetricCard
            label='Ejecución presupuestaria'
            value={`${financials.executionPercentage}%`}
            description={`${formatClp(financials.spent)} gastados`}
            icon={Banknote}
            tone='amber'
          />
        </div>

        <Tabs defaultValue='overview' className='flex flex-col gap-4'>
          <div className='overflow-x-auto pb-1'>
            <TabsList>
              <TabsTrigger value='overview'>Resumen</TabsTrigger>
              <TabsTrigger value='pre'>Pre-evento</TabsTrigger>
              <TabsTrigger value='during'>Durante</TabsTrigger>
              <TabsTrigger value='post'>Post-evento</TabsTrigger>
              <TabsTrigger value='finances'>Presupuesto y gastos</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value='overview'>
            <div className='grid gap-4 lg:grid-cols-2'>
              <Card>
                <CardHeader>
                  <CardTitle>Información general</CardTitle>
                  <CardDescription>
                    Datos principales del evento.
                  </CardDescription>
                </CardHeader>
                <CardContent className='grid gap-5 sm:grid-cols-2'>
                  <div className='flex gap-3'>
                    <CalendarDays className='shrink-0 text-muted-foreground' />
                    <div>
                      <p className='text-sm font-medium'>Inicio</p>
                      <p className='text-sm text-muted-foreground'>
                        {formatEventDateTime(event.startsAt)}
                      </p>
                    </div>
                  </div>
                  <div className='flex gap-3'>
                    <CalendarDays className='shrink-0 text-muted-foreground' />
                    <div>
                      <p className='text-sm font-medium'>Término</p>
                      <p className='text-sm text-muted-foreground'>
                        {formatEventDateTime(event.endsAt)}
                      </p>
                    </div>
                  </div>
                  <div className='flex gap-3'>
                    <MapPin className='shrink-0 text-muted-foreground' />
                    <div>
                      <p className='text-sm font-medium'>Ubicación</p>
                      <p className='text-sm text-muted-foreground'>
                        {event.location || 'Sin ubicación'}
                      </p>
                    </div>
                  </div>
                  <div className='flex gap-3'>
                    <UserRound className='shrink-0 text-muted-foreground' />
                    <div>
                      <p className='text-sm font-medium'>Coordinador</p>
                      <p className='text-sm text-muted-foreground'>
                        {(event.coordinatorContactId
                          ? contacts[event.coordinatorContactId]?.name
                          : undefined) ?? event.owner}
                      </p>
                    </div>
                  </div>
                  <div className='sm:col-span-2'>
                    <p className='text-sm font-medium'>Línea VcM principal</p>
                    <p className='text-sm text-muted-foreground'>
                      {event.vcmLine
                        ? VCM_LINE_LABELS[event.vcmLine]
                        : 'Sin línea VcM registrada'}
                    </p>
                  </div>
                  <div className='sm:col-span-2'>
                    <p className='text-sm font-medium'>Socios vinculados</p>
                    <p className='text-sm text-muted-foreground'>
                      {event.partnerIds?.length
                        ? event.partnerIds
                            .map(
                              (partnerId) =>
                                partners[partnerId]?.name ??
                                'Socio no disponible'
                            )
                            .join(', ')
                        : 'Sin socios vinculados'}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Resumen financiero</CardTitle>
                  <CardDescription>
                    Estado actual del presupuesto.
                  </CardDescription>
                </CardHeader>
                <CardContent className='grid gap-4 sm:grid-cols-2'>
                  <div>
                    <p className='text-sm text-muted-foreground'>
                      Presupuestado
                    </p>
                    <p className='text-xl font-semibold'>
                      {formatClp(financials.planned)}
                    </p>
                  </div>
                  <div>
                    <p className='text-sm text-muted-foreground'>Gastado</p>
                    <p className='text-xl font-semibold'>
                      {formatClp(financials.spent)}
                    </p>
                  </div>
                  <div>
                    <p className='text-sm text-muted-foreground'>Disponible</p>
                    <p className='text-xl font-semibold'>
                      {formatClp(financials.available)}
                    </p>
                  </div>
                  <div>
                    <p className='text-sm text-muted-foreground'>Ejecución</p>
                    <p className='text-xl font-semibold'>
                      {financials.executionPercentage}%
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value='pre'>
            <EventTasks eventId={eventId} phase='pre' />
          </TabsContent>
          <TabsContent value='during'>
            <EventTasks eventId={eventId} phase='during' />
          </TabsContent>
          <TabsContent value='post' className='grid gap-4'>
            <EventTasks eventId={eventId} phase='post' />
            <EventClosureForm eventId={eventId} />
          </TabsContent>
          <TabsContent value='finances'>
            <EventFinances eventId={eventId} />
          </TabsContent>
        </Tabs>
      </Main>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title='Eliminar evento'
        desc={`También se eliminarán ${deletionImpact.tasks} tareas, ${deletionImpact.budgetItems} partidas y ${deletionImpact.expenses} gastos.`}
        confirmText='Eliminar evento'
        destructive
        handleConfirm={() => {
          deleteEvent(eventId)
          toast.success('Evento eliminado.')
          navigate({ to: '/events' })
        }}
      />
    </>
  )
}
