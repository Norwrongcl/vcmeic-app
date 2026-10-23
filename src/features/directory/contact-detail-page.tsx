import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Mail, Pencil, Phone, Trash2, UserRound } from 'lucide-react'
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
import { useDemoRole } from '@/features/vcm/model/use-vcm'
import { canOperate } from '@/features/vcm/model/workflow'

export function ContactDetailPage({ contactId }: { contactId: string }) {
  const navigate = useNavigate()
  const writable = canOperate(useDemoRole((s) => s.role))
  const contact = useAppStore((state) => state.contacts[contactId])
  const partners = useAppStore((state) => state.partners)
  const deleteContact = useAppStore((state) => state.deleteContact)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (!contact) {
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
                <UserRound />
              </EmptyMedia>
              <EmptyTitle>Contacto no encontrado</EmptyTitle>
              <EmptyDescription>
                Es posible que se haya eliminado o que el enlace sea incorrecto.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link to='/contacts'>Volver a contactos</Link>
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
          <Link to='/contacts'>
            <ArrowLeft data-icon='inline-start' /> Volver a contactos
          </Link>
        </Button>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              {contact.name}
            </h1>
            <p className='text-muted-foreground'>
              {contact.role || 'Contacto'}
            </p>
          </div>
          <div className={writable ? 'flex gap-2' : 'hidden'}>
            <Button asChild variant='outline'>
              <Link to='/contacts/$contactId/edit' params={{ contactId }}>
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
                {contact.email || 'Sin correo'}
              </p>
              <p className='flex items-center gap-3'>
                <Phone className='size-4 text-muted-foreground' />
                {contact.phone || 'Sin teléfono'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Organización relacionada</CardTitle>
            </CardHeader>
            <CardContent>
              {contact.partnerId && partners[contact.partnerId] ? (
                <Button asChild variant='outline'>
                  <Link
                    to='/partners/$partnerId'
                    params={{ partnerId: contact.partnerId }}
                  >
                    {partners[contact.partnerId].name}
                  </Link>
                </Button>
              ) : (
                <p className='text-sm text-muted-foreground'>
                  Sin socio relacionado.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </Main>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title='Eliminar contacto'
        desc='No se puede eliminar si es responsable de una actividad o evento.'
        confirmText='Eliminar contacto'
        destructive
        handleConfirm={() => {
          if (!deleteContact(contactId)) {
            toast.error(
              'Este contacto es responsable de una actividad o evento.'
            )
            return
          }
          toast.success('Contacto eliminado.')
          navigate({ to: '/contacts' })
        }}
      />
    </>
  )
}
