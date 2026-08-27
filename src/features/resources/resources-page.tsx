import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Boxes, Plus, SearchIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { RESOURCE_CATEGORY_LABELS } from '@/features/core/model/catalogs'
import { type ResourceCategory } from '@/features/core/model/types'
import { useEntityViewPreference } from '@/features/core/model/view-preferences'

const VIEW_MODES = ['table', 'cards'] as const
const categoryStyles: Record<ResourceCategory, string> = {
  space:
    'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200',
  equipment:
    'border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200',
  material:
    'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  service:
    'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
}
export function ResourcesPage() {
  const resources = useAppStore((state) => state.resources)
  const [view, setView] = useEntityViewPreference('resources', VIEW_MODES)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ResourceCategory | 'all'>('all')
  const rows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es-CL')
    return Object.values(resources)
      .filter(
        (resource) =>
          [resource.name, resource.description, resource.notes].some((value) =>
            value.toLocaleLowerCase('es-CL').includes(normalized)
          ) &&
          (category === 'all' || resource.category === category)
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [category, query, resources])
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
            <h1 className='text-2xl font-bold tracking-tight'>Recursos</h1>
            <p className='text-muted-foreground'>
              Catálogo reutilizable para la organización de eventos.
            </p>
          </div>
          <Button asChild>
            <Link to='/resources/new'>
              <Plus data-icon='inline-start' /> Nuevo recurso
            </Link>
          </Button>
        </div>
        <div className='flex flex-col gap-3'>
          <div className='grid gap-3 md:grid-cols-[minmax(240px,1fr)_220px]'>
            <div className='relative'>
              <SearchIcon className='absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder='Buscar recurso…'
                className='ps-9'
              />
            </div>
            <Select
              value={category}
              onValueChange={(value) =>
                setCategory(value as ResourceCategory | 'all')
              }
            >
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todas las categorías</SelectItem>
                {Object.entries(RESOURCE_CATEGORY_LABELS).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className='flex justify-end'>
            <EntityViewSwitcher
              value={view}
              modes={VIEW_MODES}
              onValueChange={setView}
            />
          </div>
        </div>
        {!rows.length ? (
          <Empty className='min-h-80 border'>
            <EmptyHeader>
              <EmptyMedia variant='icon'>
                <Boxes />
              </EmptyMedia>
              <EmptyTitle>Sin recursos</EmptyTitle>
              <EmptyDescription>
                Agrega espacios, equipamiento, materiales o servicios.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link to='/resources/new'>Crear recurso</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : view === 'table' ? (
          <div className='overflow-hidden rounded-lg border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recurso</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className='text-end'>Cantidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((resource) => {
                  const link = {
                    to: '/resources/$resourceId' as const,
                    params: { resourceId: resource.id },
                  }
                  return (
                    <TableRow key={resource.id} className='group'>
                      <TableCell>
                        <Link
                          {...link}
                          className='block font-medium group-hover:underline'
                        >
                          {resource.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link {...link} className='block'>
                          <Badge
                            variant='outline'
                            className={categoryStyles[resource.category]}
                          >
                            {RESOURCE_CATEGORY_LABELS[resource.category]}
                          </Badge>
                        </Link>
                      </TableCell>
                      <TableCell className='text-end'>
                        <Link {...link} className='block font-semibold'>
                          {resource.quantity}
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
            {rows.map((resource) => (
              <Link
                key={resource.id}
                to='/resources/$resourceId'
                params={{ resourceId: resource.id }}
                className='block rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
              >
                <Card
                  className={cn(
                    'h-full border-t-4 transition-transform hover:-translate-y-0.5',
                    resource.category === 'space'
                      ? 'border-t-blue-500'
                      : resource.category === 'equipment'
                        ? 'border-t-violet-500'
                        : resource.category === 'material'
                          ? 'border-t-amber-400'
                          : 'border-t-emerald-500'
                  )}
                >
                  <CardHeader>
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <CardTitle className='text-base'>
                          {resource.name}
                        </CardTitle>
                        <Badge
                          variant='outline'
                          className={cn(
                            'mt-2',
                            categoryStyles[resource.category]
                          )}
                        >
                          {RESOURCE_CATEGORY_LABELS[resource.category]}
                        </Badge>
                      </div>
                      <span className='text-2xl font-bold'>
                        {resource.quantity}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className='line-clamp-3 text-sm text-muted-foreground'>
                      {resource.description || 'Sin descripción.'}
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
