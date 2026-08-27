import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CalendarCheck2, Clock3, Plus, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
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
import { useAppStore } from '@/features/core/model/app-store'
import { VCM_LINES, VCM_LINE_LABELS } from '@/features/core/model/catalogs'
import {
  type Activity,
  type ActivityApprovalStatus,
} from '@/features/core/model/types'
import { useEntityViewPreference } from '@/features/core/model/view-preferences'
import { formatEventDateTime } from '@/features/events/model/formatters'
import { ActivityApprovalBadge } from './components/activity-approval-badge'
import { ActivityKanbanBoard } from './components/activity-kanban-board'

const ACTIVITY_VIEW_MODES = ['table', 'cards', 'kanban'] as const
function ActivityCard({
  activity,
  responsibleName,
  showStatus = true,
}: {
  activity: Activity
  responsibleName: string
  showStatus?: boolean
}) {
  return (
    <Link
      to='/activities/$activityId'
      params={{ activityId: activity.id }}
      className='block rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
    >
      <Card className='h-full transition-colors hover:bg-muted/40'>
        <CardHeader className='gap-3'>
          <div className='flex items-start justify-between gap-3'>
            <CardTitle className='text-base leading-snug'>
              {activity.name}
            </CardTitle>
            {showStatus && (
              <ActivityApprovalBadge status={activity.approvalStatus} />
            )}
          </div>
          <p className='text-sm text-muted-foreground'>
            {formatEventDateTime(activity.endsAt)}
          </p>
        </CardHeader>
        <CardContent className='grid gap-2 text-sm'>
          <p className='line-clamp-1'>{VCM_LINE_LABELS[activity.vcmLine]}</p>
          <p className='line-clamp-1 text-muted-foreground'>
            {responsibleName}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}

export function ActivitiesPage() {
  const activities = useAppStore((state) => state.activities)
  const contacts = useAppStore((state) => state.contacts)
  const partners = useAppStore((state) => state.partners)
  const approveActivity = useAppStore((state) => state.approveActivity)
  const rejectActivity = useAppStore((state) => state.rejectActivity)
  const [view, setView] = useEntityViewPreference(
    'activities',
    ACTIVITY_VIEW_MODES
  )
  const [query, setQuery] = useState('')
  const [line, setLine] = useState('all')
  const [contact, setContact] = useState('all')
  const [partner, setPartner] = useState('all')
  const [approval, setApproval] = useState<ActivityApprovalStatus | 'all'>(
    'all'
  )

  const rows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es-CL')
    return Object.values(activities)
      .filter((activity) => {
        const matchesQuery = [
          activity.name,
          activity.description,
          activity.location,
          activity.results,
        ].some((value) => value.toLocaleLowerCase('es-CL').includes(normalized))
        return (
          matchesQuery &&
          (line === 'all' || activity.vcmLine === line) &&
          (contact === 'all' || activity.responsibleContactId === contact) &&
          (partner === 'all' || activity.partnerIds.includes(partner)) &&
          (approval === 'all' || activity.approvalStatus === approval)
        )
      })
      .sort((a, b) => b.endsAt.localeCompare(a.endsAt))
  }, [activities, approval, contact, line, partner, query])

  const pendingCount = Object.values(activities).filter(
    (activity) => activity.approvalStatus === 'pending'
  ).length

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='flex flex-col gap-6'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Actividades</h1>
            <p className='text-muted-foreground'>
              Registro histórico de acciones puntuales ya realizadas.
            </p>
          </div>
          <Button asChild>
            <Link to='/activities/new'>
              <Plus data-icon='inline-start' /> Registrar actividad
            </Link>
          </Button>
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <Card className='border-t-4 border-t-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/15'>
            <CardHeader className='flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Registradas</CardTitle>
              <CalendarCheck2 className='size-4 text-emerald-600 dark:text-emerald-400' />
            </CardHeader>
            <CardContent>
              <p className='text-3xl font-bold'>
                {Object.keys(activities).length}
              </p>
            </CardContent>
          </Card>
          <Card className='border-t-4 border-t-amber-400 bg-amber-50/40 dark:bg-amber-950/15'>
            <CardHeader className='flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Por aprobar</CardTitle>
              <Clock3 className='size-4 text-amber-600 dark:text-amber-400' />
            </CardHeader>
            <CardContent>
              <p className='text-3xl font-bold'>{pendingCount}</p>
            </CardContent>
          </Card>
        </div>

        <div className='flex flex-col gap-3'>
          <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-5'>
            <div className='relative xl:col-span-2'>
              <SearchIcon className='absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder='Buscar actividad…'
                className='ps-9'
              />
            </div>
            <Select value={line} onValueChange={setLine}>
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todas las líneas VcM</SelectItem>
                {VCM_LINES.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={contact} onValueChange={setContact}>
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos los responsables</SelectItem>
                {Object.values(contacts).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={approval}
              onValueChange={(value) =>
                setApproval(value as ActivityApprovalStatus | 'all')
              }
            >
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos los estados</SelectItem>
                <SelectItem value='pending'>Por aprobar</SelectItem>
                <SelectItem value='approved'>Aprobadas</SelectItem>
                <SelectItem value='rejected'>Rechazadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <Select value={partner} onValueChange={setPartner}>
              <SelectTrigger className='w-full sm:w-64'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos los socios</SelectItem>
                {Object.values(partners).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <EntityViewSwitcher
              value={view}
              modes={ACTIVITY_VIEW_MODES}
              onValueChange={setView}
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <Empty className='min-h-80 border'>
            <EmptyHeader>
              <EmptyMedia variant='icon'>
                <CalendarCheck2 />
              </EmptyMedia>
              <EmptyTitle>Sin actividades</EmptyTitle>
              <EmptyDescription>
                {Object.keys(activities).length
                  ? 'No hay resultados para los filtros aplicados.'
                  : 'Registra la primera actividad ejecutada.'}
              </EmptyDescription>
            </EmptyHeader>
            {!Object.keys(activities).length && (
              <EmptyContent>
                <Button asChild>
                  <Link to='/activities/new'>
                    <Plus data-icon='inline-start' /> Registrar actividad
                  </Link>
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : view === 'table' ? (
          <div className='overflow-hidden rounded-lg border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Actividad</TableHead>
                  <TableHead className='hidden md:table-cell'>
                    Línea VcM
                  </TableHead>
                  <TableHead className='hidden lg:table-cell'>
                    Responsable
                  </TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((activity) => {
                  const linkProps = {
                    to: '/activities/$activityId' as const,
                    params: { activityId: activity.id },
                  }
                  return (
                    <TableRow key={activity.id} className='group'>
                      <TableCell>
                        <Link
                          {...linkProps}
                          className='block font-medium group-hover:underline'
                        >
                          {activity.name}
                          <span className='mt-1 block text-xs font-normal text-muted-foreground'>
                            {formatEventDateTime(activity.endsAt)}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className='hidden md:table-cell'>
                        <Link {...linkProps} className='block'>
                          {VCM_LINE_LABELS[activity.vcmLine]}
                        </Link>
                      </TableCell>
                      <TableCell className='hidden lg:table-cell'>
                        <Link {...linkProps} className='block'>
                          {contacts[activity.responsibleContactId]?.name ??
                            'Contacto no disponible'}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link {...linkProps} className='block'>
                          <ActivityApprovalBadge
                            status={activity.approvalStatus}
                          />
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
            {rows.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                responsibleName={
                  contacts[activity.responsibleContactId]?.name ??
                  'Contacto no disponible'
                }
              />
            ))}
          </div>
        ) : (
          <ActivityKanbanBoard
            activities={rows}
            getResponsibleName={(activity) =>
              contacts[activity.responsibleContactId]?.name ??
              'Contacto no disponible'
            }
            onApprove={(activity) => {
              approveActivity(activity.id)
              toast.success('Actividad aprobada.')
            }}
            onReject={(activity, reason) => {
              const rejected = rejectActivity(activity.id, reason)
              if (rejected) toast.success('Actividad rechazada.')
              return rejected
            }}
          />
        )}
      </Main>
    </>
  )
}
