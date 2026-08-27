import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ExternalLink, FileText, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
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
import { getAgreementTemporalStatus } from '@/features/core/model/selectors'

const statusLabels = {
  upcoming: 'Próximo',
  active: 'Vigente',
  expired: 'Vencido',
  cancelled: 'Cancelado',
} as const

export function AgreementDetailPage({ agreementId }: { agreementId: string }) {
  const navigate = useNavigate()
  const agreement = useAppStore((state) => state.agreements[agreementId])
  const partners = useAppStore((state) => state.partners)
  const contacts = useAppStore((state) => state.contacts)
  const deleteAgreement = useAppStore((state) => state.deleteAgreement)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (!agreement) {
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
                <FileText />
              </EmptyMedia>
              <EmptyTitle>Convenio no encontrado</EmptyTitle>
              <EmptyDescription>
                El registro no está disponible.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link to='/agreements'>Volver a convenios</Link>
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
          <Link to='/agreements'>
            <ArrowLeft data-icon='inline-start' /> Volver a convenios
          </Link>
        </Button>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <div className='flex flex-wrap items-center gap-2'>
              <h1 className='text-2xl font-bold tracking-tight'>
                {agreement.name}
              </h1>
              <Badge variant='outline'>
                {statusLabels[getAgreementTemporalStatus(agreement)]}
              </Badge>
            </div>
            <p className='text-muted-foreground'>
              {agreement.description || agreement.type || 'Sin descripción'}
            </p>
          </div>
          <div className='flex gap-2'>
            <Button asChild variant='outline'>
              <Link to='/agreements/$agreementId/edit' params={{ agreementId }}>
                <Pencil data-icon='inline-start' /> Editar
              </Link>
            </Button>
            <Button variant='destructive' onClick={() => setDeleteOpen(true)}>
              <Trash2 data-icon='inline-start' /> Eliminar
            </Button>
          </div>
        </div>
        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle>Información del convenio</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-4 text-sm'>
              <div>
                <p className='text-muted-foreground'>Socio</p>
                <p className='font-medium'>
                  {partners[agreement.partnerId]?.name ?? 'Socio no disponible'}
                </p>
              </div>
              <div>
                <p className='text-muted-foreground'>Responsable</p>
                <p className='font-medium'>
                  {agreement.responsibleContactId
                    ? (contacts[agreement.responsibleContactId]?.name ??
                      'Contacto no disponible')
                    : 'Sin responsable'}
                </p>
              </div>
              <div>
                <p className='text-muted-foreground'>Período</p>
                <p className='font-medium'>
                  {agreement.startsAt} — {agreement.endsAt ?? 'Indefinido'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Documento y notas</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-4'>
              {agreement.documentUrl ? (
                <Button asChild variant='outline' className='w-fit'>
                  <a
                    href={agreement.documentUrl}
                    target='_blank'
                    rel='noreferrer'
                  >
                    <ExternalLink data-icon='inline-start' /> Abrir documento
                  </a>
                </Button>
              ) : (
                <p className='text-sm text-muted-foreground'>
                  Sin enlace documental.
                </p>
              )}
              <p className='text-sm whitespace-pre-wrap text-muted-foreground'>
                {agreement.notes || 'Sin notas.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </Main>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title='Eliminar convenio'
        desc='Esta acción no se puede deshacer.'
        confirmText='Eliminar convenio'
        destructive
        handleConfirm={() => {
          deleteAgreement(agreementId)
          toast.success('Convenio eliminado.')
          navigate({ to: '/agreements' })
        }}
      />
    </>
  )
}
