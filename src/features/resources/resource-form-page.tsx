import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Boxes } from 'lucide-react'
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
import { ResourceForm } from './components/resource-form'

export function ResourceFormPage({ resourceId }: { resourceId?: string }) {
  const navigate = useNavigate()
  const resource = useAppStore((state) =>
    resourceId ? state.resources[resourceId] : undefined
  )
  const addResource = useAppStore((state) => state.addResource)
  const updateResource = useAppStore((state) => state.updateResource)
  if (resourceId && !resource)
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
                <Boxes />
              </EmptyMedia>
              <EmptyTitle>Recurso no encontrado</EmptyTitle>
              <EmptyDescription>
                No es posible editar un registro que no existe.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link to='/resources'>Volver a recursos</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </Main>
      </>
    )
  const cancel = () =>
    resource
      ? navigate({
          to: '/resources/$resourceId',
          params: { resourceId: resource.id },
        })
      : navigate({ to: '/resources' })
  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='mx-auto flex w-full max-w-3xl flex-col gap-6'>
        <Button
          variant='ghost'
          className='w-fit px-0 hover:bg-transparent'
          onClick={cancel}
        >
          <ArrowLeft data-icon='inline-start' /> Volver
        </Button>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            {resource ? 'Editar recurso' : 'Nuevo recurso'}
          </h1>
          <p className='text-muted-foreground'>
            Agrega un elemento reutilizable para la organización de eventos.
          </p>
        </div>
        <Card>
          <CardContent className='pt-6'>
            <ResourceForm
              resource={resource}
              onCancel={cancel}
              onSubmit={(input) => {
                const id = resource?.id ?? addResource(input)
                if (resource) updateResource(resource.id, input)
                toast.success(
                  resource ? 'Recurso actualizado.' : 'Recurso creado.'
                )
                navigate({
                  to: '/resources/$resourceId',
                  params: { resourceId: id },
                })
              }}
            />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
