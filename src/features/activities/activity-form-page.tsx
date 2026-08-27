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
import { useAppStore } from '@/features/core/model/app-store'
import { ActivityForm } from './components/activity-form'

export function ActivityFormPage({ activityId }: { activityId?: string }) {
  const navigate = useNavigate()
  const activity = useAppStore((state) =>
    activityId ? state.activities[activityId] : undefined
  )
  const addActivity = useAppStore((state) => state.addActivity)
  const updateActivity = useAppStore((state) => state.updateActivity)
  const editingMissingActivity = Boolean(activityId && !activity)

  if (editingMissingActivity) {
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
              <EmptyTitle>Actividad no encontrada</EmptyTitle>
              <EmptyDescription>
                No es posible editar un registro que no existe.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link to='/activities'>Volver a actividades</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </Main>
      </>
    )
  }

  const cancelTo = activity ? '/activities/$activityId' : '/activities'

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
          {activity ? (
            <Link
              to='/activities/$activityId'
              params={{ activityId: activity.id }}
            >
              <ArrowLeft data-icon='inline-start' /> Volver a la actividad
            </Link>
          ) : (
            <Link to='/activities'>
              <ArrowLeft data-icon='inline-start' /> Volver a actividades
            </Link>
          )}
        </Button>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            {activity ? 'Editar actividad' : 'Registrar actividad'}
          </h1>
          <p className='text-muted-foreground'>
            Registra una acción puntual que ya ocurrió. Las altas web quedan
            aprobadas automáticamente.
          </p>
        </div>
        <Card>
          <CardContent className='pt-6'>
            <ActivityForm
              activity={activity}
              submitLabel={activity ? 'Guardar cambios' : 'Registrar actividad'}
              onCancel={() =>
                activity
                  ? navigate({
                      to: cancelTo,
                      params: { activityId: activity.id },
                    })
                  : navigate({ to: cancelTo })
              }
              onSubmit={(input) => {
                const id = activity?.id ?? addActivity(input)
                if (activity) updateActivity(activity.id, input)
                toast.success(
                  activity ? 'Actividad actualizada.' : 'Actividad registrada.'
                )
                navigate({
                  to: '/activities/$activityId',
                  params: { activityId: id },
                })
              }}
            />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
