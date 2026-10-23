import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Boxes, Pencil, Trash2 } from 'lucide-react'
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
import { RESOURCE_CATEGORY_LABELS } from '@/features/core/model/catalogs'
import { useDemoRole } from '@/features/vcm/model/use-vcm'
import { canOperate } from '@/features/vcm/model/workflow'

export function ResourceDetailPage({ resourceId }: { resourceId: string }) {
  const navigate = useNavigate()
  const writable = canOperate(useDemoRole((s) => s.role))
  const resource = useAppStore((state) => state.resources[resourceId])
  const deleteResource = useAppStore((state) => state.deleteResource)
  const [deleteOpen, setDeleteOpen] = useState(false)
  if (!resource)
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
                El registro no está disponible.
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
          <Link to='/resources'>
            <ArrowLeft data-icon='inline-start' /> Volver a recursos
          </Link>
        </Button>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div className='grid gap-2'>
            <div className='flex items-center gap-3'>
              <h1 className='text-2xl font-bold tracking-tight'>
                {resource.name}
              </h1>
              <Badge variant='outline'>
                {RESOURCE_CATEGORY_LABELS[resource.category]}
              </Badge>
            </div>
            <p className='text-muted-foreground'>
              {resource.description || 'Sin descripción.'}
            </p>
          </div>
          <div className={writable ? 'flex gap-2' : 'hidden'}>
            <Button asChild variant='outline'>
              <Link to='/resources/$resourceId/edit' params={{ resourceId }}>
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
              <CardTitle>Cantidad disponible</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-4xl font-bold'>{resource.quantity}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-sm whitespace-pre-wrap text-muted-foreground'>
                {resource.notes || 'Sin notas.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </Main>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title='Eliminar recurso'
        desc='Esta acción no se puede deshacer.'
        confirmText='Eliminar recurso'
        destructive
        handleConfirm={() => {
          deleteResource(resourceId)
          toast.success('Recurso eliminado.')
          navigate({ to: '/resources' })
        }}
      />
    </>
  )
}
