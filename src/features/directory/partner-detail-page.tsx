import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Mail,
  Pencil,
  Phone,
  Trash2,
  UserRound,
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

export function PartnerDetailPage({ partnerId }: { partnerId: string }) {
  const navigate = useNavigate()
  const partner = useAppStore((state) => state.partners[partnerId])
  const contacts = useAppStore((state) => state.contacts)
  const agreements = useAppStore((state) => state.agreements)
  const deletePartner = useAppStore((state) => state.deletePartner)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (!partner) {
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
                <Building2 />
              </EmptyMedia>
              <EmptyTitle>Socio no encontrado</EmptyTitle>
              <EmptyDescription>
                Es posible que se haya eliminado o que el enlace sea incorrecto.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link to='/partners'>Volver a socios</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </Main>
      </>
    )
  }

  const linkedContacts = Object.values(contacts).filter(
    (contact) => contact.partnerId === partnerId
  )
  const linkedAgreements = Object.values(agreements).filter(
    (agreement) => agreement.partnerId === partnerId
  )

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
          <Link to='/partners'>
            <ArrowLeft data-icon='inline-start' /> Volver a socios
          </Link>
        </Button>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              {partner.name}
            </h1>
            <p className='text-muted-foreground'>
              {partner.type || 'Organización vinculada'}
            </p>
          </div>
          <div className='flex gap-2'>
            <Button asChild variant='outline'>
              <Link to='/partners/$partnerId/edit' params={{ partnerId }}>
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
              <CardTitle>Información de contacto</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-4 text-sm'>
              <p className='flex items-center gap-3'>
                <Mail className='size-4 text-muted-foreground' />
                {partner.email || 'Sin correo'}
              </p>
              <p className='flex items-center gap-3'>
                <Phone className='size-4 text-muted-foreground' />
                {partner.phone || 'Sin teléfono'}
              </p>
              {partner.website && (
                <a
                  href={partner.website}
                  target='_blank'
                  rel='noreferrer'
                  className='flex items-center gap-3 text-primary hover:underline'
                >
                  <ExternalLink className='size-4' /> Abrir sitio web
                </a>
              )}
              {partner.notes && (
                <p className='border-t pt-4 text-muted-foreground'>
                  {partner.notes}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Relaciones</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-4'>
              <div className='flex items-center justify-between rounded-md border p-4'>
                <span className='flex items-center gap-3'>
                  <UserRound className='size-4 text-muted-foreground' />{' '}
                  Contactos
                </span>
                <strong>{linkedContacts.length}</strong>
              </div>
              <div className='flex items-center justify-between rounded-md border p-4'>
                <span>Convenios</span>
                <strong>{linkedAgreements.length}</strong>
              </div>
            </CardContent>
          </Card>
        </div>
        {linkedContacts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Contactos relacionados</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
              {linkedContacts.map((contact) => (
                <div key={contact.id} className='rounded-md border p-4'>
                  <p className='font-medium'>{contact.name}</p>
                  <p className='text-sm text-muted-foreground'>
                    {contact.role || 'Sin función registrada'}
                  </p>
                  {contact.email && (
                    <p className='mt-2 truncate text-sm'>{contact.email}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </Main>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title='Eliminar socio'
        desc={
          linkedAgreements.length
            ? 'Este socio tiene convenios asociados y no se puede eliminar.'
            : 'Los contactos relacionados quedarán sin socio asociado.'
        }
        confirmText='Eliminar socio'
        destructive
        disabled={linkedAgreements.length > 0}
        handleConfirm={() => {
          if (!deletePartner(partnerId)) return
          toast.success('Socio eliminado.')
          navigate({ to: '/partners' })
        }}
      />
    </>
  )
}
