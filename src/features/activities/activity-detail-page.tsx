import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Pencil,
  Trash2,
  UserRound,
  UsersRound,
  XCircle,
} from 'lucide-react'
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
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useAppStore } from '@/features/core/model/app-store'
import { VCM_LINE_LABELS } from '@/features/core/model/catalogs'
import { formatEventDateTime } from '@/features/events/model/formatters'
import { ActivityApprovalBadge } from './components/activity-approval-badge'
import { RejectActivityDialog } from './components/reject-activity-dialog'

export function ActivityDetailPage({ activityId }: { activityId: string }) {
  const navigate = useNavigate()
  const activity = useAppStore((state) => state.activities[activityId])
  const contacts = useAppStore((state) => state.contacts)
  const partners = useAppStore((state) => state.partners)
  const deleteActivity = useAppStore((state) => state.deleteActivity)
  const approveActivity = useAppStore((state) => state.approveActivity)
  const rejectActivity = useAppStore((state) => state.rejectActivity)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)

  if (!activity) {
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
                Es posible que se haya eliminado o que el enlace sea incorrecto.
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

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='flex flex-col gap-6'>
        <Button
          asChild
          variant='ghost'
          className='w-fit px-0 hover:bg-transparent'
        >
          <Link to='/activities'>
            <ArrowLeft data-icon='inline-start' /> Volver a actividades
          </Link>
        </Button>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <div className='flex flex-wrap items-center gap-3'>
              <h1 className='text-2xl font-bold tracking-tight'>
                {activity.name}
              </h1>
              <ActivityApprovalBadge status={activity.approvalStatus} />
            </div>
            <p className='max-w-3xl text-muted-foreground'>
              {activity.description || 'Sin descripción.'}
            </p>
          </div>
          <div className='flex gap-2'>
            <Button asChild variant='outline'>
              <Link to='/activities/$activityId/edit' params={{ activityId }}>
                <Pencil data-icon='inline-start' /> Editar
              </Link>
            </Button>
            <Button variant='destructive' onClick={() => setDeleteOpen(true)}>
              <Trash2 data-icon='inline-start' /> Eliminar
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className='flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <p className='font-semibold'>Revisión interna</p>
              <p className='text-sm text-muted-foreground'>
                {activity.approvalStatus === 'pending'
                  ? 'Este registro necesita una decisión antes de considerarse validado.'
                  : activity.approvalStatus === 'approved'
                    ? 'Este registro fue validado.'
                    : activity.rejectionReason}
              </p>
            </div>
            <div className='flex flex-wrap gap-2'>
              {activity.approvalStatus !== 'approved' && (
                <Button onClick={() => setApproveOpen(true)}>
                  <CheckCircle2 data-icon='inline-start' /> Aprobar
                </Button>
              )}
              {activity.approvalStatus !== 'rejected' && (
                <Button
                  variant='outline'
                  className='text-destructive hover:text-destructive'
                  onClick={() => setRejectOpen(true)}
                >
                  <XCircle data-icon='inline-start' /> Rechazar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
          {[
            {
              label: 'Fecha de ejecución',
              value: formatEventDateTime(activity.startsAt),
              icon: CalendarDays,
            },
            {
              label: 'Responsable',
              value:
                contacts[activity.responsibleContactId]?.name ??
                'Contacto no disponible',
              icon: UserRound,
            },
            {
              label: 'Participantes',
              value: String(activity.participantCount),
              icon: UsersRound,
            },
            {
              label: 'Lugar o territorio',
              value: activity.location || 'Sin ubicación',
              icon: MapPin,
            },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className='flex items-start gap-3 pt-6'>
                <item.icon className='mt-0.5 size-5 text-muted-foreground' />
                <div>
                  <p className='text-sm text-muted-foreground'>{item.label}</p>
                  <p className='font-semibold'>{item.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle>Clasificación y relaciones</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-4'>
              <div>
                <p className='text-sm text-muted-foreground'>
                  Línea VcM principal
                </p>
                <p className='font-medium'>
                  {VCM_LINE_LABELS[activity.vcmLine]}
                </p>
              </div>
              <div>
                <p className='text-sm text-muted-foreground'>
                  Socios vinculados
                </p>
                <p className='font-medium'>
                  {activity.partnerIds.length
                    ? activity.partnerIds
                        .map(
                          (id) => partners[id]?.name ?? 'Socio no disponible'
                        )
                        .join(', ')
                    : 'Sin socios vinculados'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Resultados u observaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-sm whitespace-pre-wrap text-muted-foreground'>
                {activity.results || 'Sin resultados u observaciones.'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Evidencias</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.evidences.length ? (
              <div className='grid gap-3 sm:grid-cols-2'>
                {activity.evidences.map((evidence, index) => (
                  <a
                    key={`${evidence.url}-${index}`}
                    href={evidence.url}
                    target='_blank'
                    rel='noreferrer'
                    className='flex items-center justify-between gap-3 rounded-md border p-4 transition-colors hover:bg-muted/50'
                  >
                    <span className='truncate font-medium'>
                      {evidence.name}
                    </span>
                    <ExternalLink className='size-4 shrink-0 text-muted-foreground' />
                  </a>
                ))}
              </div>
            ) : (
              <p className='text-sm text-muted-foreground'>
                No se registraron enlaces de evidencia.
              </p>
            )}
          </CardContent>
        </Card>
      </Main>
      <RejectActivityDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onConfirm={(reason) => {
          if (rejectActivity(activityId, reason)) {
            toast.success('Actividad rechazada.')
          }
        }}
      />
      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title='Aprobar actividad'
        desc='El registro quedará validado y se eliminará cualquier motivo de rechazo anterior.'
        confirmText='Aprobar actividad'
        handleConfirm={() => {
          approveActivity(activityId)
          setApproveOpen(false)
          toast.success('Actividad aprobada.')
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title='Eliminar actividad'
        desc='El registro y sus enlaces de evidencia se eliminarán.'
        confirmText='Eliminar actividad'
        destructive
        handleConfirm={() => {
          deleteActivity(activityId)
          toast.success('Actividad eliminada.')
          navigate({ to: '/activities' })
        }}
      />
    </>
  )
}
