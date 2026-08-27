import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Building2, UserRound } from 'lucide-react'
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
import { ContactForm } from './components/contact-form'
import { PartnerForm } from './components/partner-form'

export function DirectoryFormPage({
  entity,
  entityId,
}: {
  entity: 'partners' | 'contacts'
  entityId?: string
}) {
  const navigate = useNavigate()
  const partners = useAppStore((state) => state.partners)
  const contacts = useAppStore((state) => state.contacts)
  const addPartner = useAppStore((state) => state.addPartner)
  const updatePartner = useAppStore((state) => state.updatePartner)
  const addContact = useAppStore((state) => state.addContact)
  const updateContact = useAppStore((state) => state.updateContact)
  const partner =
    entity === 'partners' && entityId ? partners[entityId] : undefined
  const contact =
    entity === 'contacts' && entityId ? contacts[entityId] : undefined
  const existing = partner ?? contact
  const singular = entity === 'partners' ? 'socio' : 'contacto'

  if (entityId && !existing) {
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
                {entity === 'partners' ? <Building2 /> : <UserRound />}
              </EmptyMedia>
              <EmptyTitle>
                {entity === 'partners'
                  ? 'Socio no encontrado'
                  : 'Contacto no encontrado'}
              </EmptyTitle>
              <EmptyDescription>
                No es posible editar un registro que no existe.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link to={entity === 'partners' ? '/partners' : '/contacts'}>
                  Volver al listado
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        </Main>
      </>
    )
  }

  const cancel = () => {
    if (partner)
      navigate({
        to: '/partners/$partnerId',
        params: { partnerId: partner.id },
      })
    else if (contact)
      navigate({
        to: '/contacts/$contactId',
        params: { contactId: contact.id },
      })
    else if (entity === 'partners') navigate({ to: '/partners' })
    else navigate({ to: '/contacts' })
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
          variant='ghost'
          className='w-fit px-0 hover:bg-transparent'
          onClick={cancel}
        >
          <ArrowLeft data-icon='inline-start' /> Volver
        </Button>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            {existing ? `Editar ${singular}` : `Nuevo ${singular}`}
          </h1>
          <p className='text-muted-foreground'>
            {entity === 'partners'
              ? 'Registra una organización para relacionarla con iniciativas y contactos.'
              : 'Un contacto puede existir sin tener acceso como usuario.'}
          </p>
        </div>
        <Card>
          <CardContent className='pt-6'>
            {entity === 'partners' ? (
              <PartnerForm
                partner={partner}
                onCancel={cancel}
                onSubmit={(input) => {
                  const id = partner?.id ?? addPartner(input)
                  if (partner) updatePartner(partner.id, input)
                  toast.success(
                    partner ? 'Socio actualizado.' : 'Socio creado.'
                  )
                  navigate({
                    to: '/partners/$partnerId',
                    params: { partnerId: id },
                  })
                }}
              />
            ) : (
              <ContactForm
                contact={contact}
                onCancel={cancel}
                onSubmit={(input) => {
                  const id = contact?.id ?? addContact(input)
                  if (contact) updateContact(contact.id, input)
                  toast.success(
                    contact ? 'Contacto actualizado.' : 'Contacto creado.'
                  )
                  navigate({
                    to: '/contacts/$contactId',
                    params: { contactId: id },
                  })
                }}
              />
            )}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
