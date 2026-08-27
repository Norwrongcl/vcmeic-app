import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Building2, Plus, SearchIcon, UserRound } from 'lucide-react'
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
import { useEntityViewPreference } from '@/features/core/model/view-preferences'

const DIRECTORY_VIEW_MODES = ['table', 'cards'] as const

export function DirectoryPage({ entity }: { entity: 'partners' | 'contacts' }) {
  const partners = useAppStore((state) => state.partners)
  const contacts = useAppStore((state) => state.contacts)
  const [view, setView] = useEntityViewPreference(entity, DIRECTORY_VIEW_MODES)
  const [query, setQuery] = useState('')
  const isPartners = entity === 'partners'
  const normalizedQuery = query.trim().toLocaleLowerCase('es-CL')
  const partnerRows = useMemo(
    () =>
      Object.values(partners)
        .filter((partner) =>
          [partner.name, partner.type, partner.email].some((value) =>
            value.toLocaleLowerCase('es-CL').includes(normalizedQuery)
          )
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [normalizedQuery, partners]
  )
  const contactRows = useMemo(
    () =>
      Object.values(contacts)
        .filter((contact) =>
          [contact.name, contact.role, contact.email].some((value) =>
            value.toLocaleLowerCase('es-CL').includes(normalizedQuery)
          )
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [contacts, normalizedQuery]
  )
  const rowCount = isPartners ? partnerRows.length : contactRows.length
  const newRoute = isPartners ? '/partners/new' : '/contacts/new'

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
            <h1 className='text-2xl font-bold tracking-tight'>
              {isPartners ? 'Socios' : 'Contactos'}
            </h1>
            <p className='text-muted-foreground'>
              {isPartners
                ? 'Organizaciones vinculadas a las iniciativas VcM.'
                : 'Personas responsables y colaboradoras, tengan o no acceso al sistema.'}
            </p>
          </div>
          <Button asChild>
            <Link to={newRoute}>
              <Plus data-icon='inline-start' />
              {isPartners ? 'Nuevo socio' : 'Nuevo contacto'}
            </Link>
          </Button>
        </div>

        <Card className='max-w-sm'>
          <CardHeader className='flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              {isPartners ? 'Socios registrados' : 'Contactos registrados'}
            </CardTitle>
            {isPartners ? (
              <Building2 className='size-4 text-muted-foreground' />
            ) : (
              <UserRound className='size-4 text-muted-foreground' />
            )}
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold'>{rowCount}</p>
          </CardContent>
        </Card>

        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div className='relative w-full max-w-xl'>
            <SearchIcon className='absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Buscar ${isPartners ? 'socio' : 'contacto'}…`}
              className='ps-9'
            />
          </div>
          <EntityViewSwitcher
            value={view}
            modes={DIRECTORY_VIEW_MODES}
            onValueChange={setView}
          />
        </div>

        {!rowCount ? (
          <Empty className='min-h-80 border'>
            <EmptyHeader>
              <EmptyMedia variant='icon'>
                {isPartners ? <Building2 /> : <UserRound />}
              </EmptyMedia>
              <EmptyTitle>
                {query
                  ? 'Sin resultados'
                  : `Aún no hay ${isPartners ? 'socios' : 'contactos'}`}
              </EmptyTitle>
              <EmptyDescription>
                {query
                  ? 'Prueba con otro término de búsqueda.'
                  : 'Crea el primer registro para comenzar a relacionar iniciativas.'}
              </EmptyDescription>
            </EmptyHeader>
            {!query && (
              <EmptyContent>
                <Button asChild>
                  <Link to={newRoute}>
                    <Plus data-icon='inline-start' /> Crear
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
                  <TableHead>Nombre</TableHead>
                  <TableHead className='hidden md:table-cell'>
                    {isPartners ? 'Tipo' : 'Cargo o función'}
                  </TableHead>
                  <TableHead className='hidden lg:table-cell'>
                    {isPartners ? 'Correo' : 'Socio relacionado'}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPartners
                  ? partnerRows.map((partner) => {
                      const link = {
                        to: '/partners/$partnerId' as const,
                        params: { partnerId: partner.id },
                      }
                      return (
                        <TableRow key={partner.id} className='group'>
                          <TableCell>
                            <Link
                              {...link}
                              className='block font-medium group-hover:underline'
                            >
                              {partner.name}
                            </Link>
                          </TableCell>
                          <TableCell className='hidden md:table-cell'>
                            <Link {...link} className='block'>
                              {partner.type || 'Sin tipo'}
                            </Link>
                          </TableCell>
                          <TableCell className='hidden lg:table-cell'>
                            <Link {...link} className='block'>
                              {partner.email || 'Sin correo'}
                            </Link>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  : contactRows.map((contact) => {
                      const link = {
                        to: '/contacts/$contactId' as const,
                        params: { contactId: contact.id },
                      }
                      return (
                        <TableRow key={contact.id} className='group'>
                          <TableCell>
                            <Link
                              {...link}
                              className='block font-medium group-hover:underline'
                            >
                              {contact.name}
                            </Link>
                          </TableCell>
                          <TableCell className='hidden md:table-cell'>
                            <Link {...link} className='block'>
                              {contact.role || 'Sin función'}
                            </Link>
                          </TableCell>
                          <TableCell className='hidden lg:table-cell'>
                            <Link {...link} className='block'>
                              {contact.partnerId
                                ? (partners[contact.partnerId]?.name ??
                                  'Socio no disponible')
                                : 'Sin socio relacionado'}
                            </Link>
                          </TableCell>
                        </TableRow>
                      )
                    })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
            {isPartners
              ? partnerRows.map((partner) => (
                  <Link
                    key={partner.id}
                    to='/partners/$partnerId'
                    params={{ partnerId: partner.id }}
                    className='block rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
                  >
                    <Card className='h-full transition-colors hover:bg-muted/40'>
                      <CardHeader>
                        <CardTitle className='text-base'>
                          {partner.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className='grid gap-2 text-sm'>
                        <p>{partner.type || 'Sin tipo'}</p>
                        <p className='text-muted-foreground'>
                          {partner.email || 'Sin correo'}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              : contactRows.map((contact) => (
                  <Link
                    key={contact.id}
                    to='/contacts/$contactId'
                    params={{ contactId: contact.id }}
                    className='block rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
                  >
                    <Card className='h-full transition-colors hover:bg-muted/40'>
                      <CardHeader>
                        <CardTitle className='text-base'>
                          {contact.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className='grid gap-2 text-sm'>
                        <p>{contact.role || 'Sin función'}</p>
                        <p className='text-muted-foreground'>
                          {contact.partnerId
                            ? (partners[contact.partnerId]?.name ??
                              'Socio no disponible')
                            : 'Sin socio relacionado'}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
          </div>
        )}
      </Main>
    </>
  )
}
