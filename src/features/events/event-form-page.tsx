import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { EventForm } from './components/event-form'
import { useEventsStore } from './model/events-store'

export function EventFormPage({ eventId }: { eventId?: string }) {
  const navigate = useNavigate()
  const event = useEventsStore((state) =>
    eventId ? state.events[eventId] : undefined
  )
  const addEvent = useEventsStore((state) => state.addEvent)
  const updateEvent = useEventsStore((state) => state.updateEvent)

  if (eventId && !event) {
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
                No es posible editar un registro que no existe.
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

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='mx-auto flex w-full max-w-4xl flex-col gap-6'>
        <Button
          asChild
          variant='ghost'
          className='w-fit px-0 hover:bg-transparent'
        >
          {event ? (
            <Link to='/events/$eventId' params={{ eventId: event.id }}>
              <ArrowLeft data-icon='inline-start' /> Volver al evento
            </Link>
          ) : (
            <Link to='/events'>
              <ArrowLeft data-icon='inline-start' /> Volver a eventos
            </Link>
          )}
        </Button>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            {event ? 'Editar evento' : 'Nuevo evento'}
          </h1>
          <p className='text-muted-foreground'>
            Define los datos generales. Las tareas y finanzas se administran
            desde el detalle.
          </p>
        </div>
        <Card>
          <CardContent className='pt-6'>
            <EventForm
              event={event}
              submitLabel={event ? 'Guardar cambios' : 'Crear evento'}
              onCancel={() =>
                event
                  ? navigate({
                      to: '/events/$eventId',
                      params: { eventId: event.id },
                    })
                  : navigate({ to: '/events' })
              }
              onSubmit={(input) => {
                const id = event?.id ?? addEvent(input)
                if (event) updateEvent(event.id, input)
                toast.success(event ? 'Evento actualizado.' : 'Evento creado.')
                navigate({
                  to: '/events/$eventId',
                  params: { eventId: id },
                })
              }}
            />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
