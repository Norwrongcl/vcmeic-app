import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { FileText, Plus, SearchIcon } from 'lucide-react'
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
import {
  getAgreementTemporalStatus,
  type AgreementTemporalStatus,
} from '@/features/core/model/selectors'
import { useEntityViewPreference } from '@/features/core/model/view-preferences'

const VIEW_MODES = ['table', 'cards'] as const
const statusLabels: Record<AgreementTemporalStatus, string> = {
  upcoming: 'Próximo',
  active: 'Vigente',
  expired: 'Vencido',
  cancelled: 'Cancelado',
}
const statusStyles: Record<AgreementTemporalStatus, string> = {
  upcoming:
    'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200',
  active:
    'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  expired:
    'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  cancelled:
    'border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200',
}

export function AgreementsPage() {
  const agreements = useAppStore((state) => state.agreements)
  const partners = useAppStore((state) => state.partners)
  const [view, setView] = useEntityViewPreference('agreements', VIEW_MODES)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<AgreementTemporalStatus | 'all'>('all')
  const rows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es-CL')
    return Object.values(agreements)
      .filter((agreement) => {
        const partnerName = partners[agreement.partnerId]?.name ?? ''
        return (
          [agreement.name, agreement.type, partnerName].some((value) =>
            value.toLocaleLowerCase('es-CL').includes(normalized)
          ) &&
          (status === 'all' || getAgreementTemporalStatus(agreement) === status)
        )
      })
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
  }, [agreements, partners, query, status])
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
            <h1 className='text-2xl font-bold tracking-tight'>Convenios</h1>
            <p className='text-muted-foreground'>
              Acuerdos formales relacionados con organizaciones socias.
            </p>
          </div>
          <Button asChild>
            <Link to='/agreements/new'>
              <Plus data-icon='inline-start' /> Nuevo convenio
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
                placeholder='Buscar convenio o socio…'
                className='ps-9'
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) =>
                setStatus(value as AgreementTemporalStatus | 'all')
              }
            >
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todas las vigencias</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
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
                <FileText />
              </EmptyMedia>
              <EmptyTitle>Sin convenios</EmptyTitle>
              <EmptyDescription>
                Registra un acuerdo y relaciónalo con un socio.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link to='/agreements/new'>Crear convenio</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : view === 'table' ? (
          <div className='overflow-hidden rounded-lg border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Convenio</TableHead>
                  <TableHead className='hidden md:table-cell'>Socio</TableHead>
                  <TableHead>Vigencia</TableHead>
                  <TableHead className='hidden lg:table-cell'>
                    Período
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((agreement) => {
                  const link = {
                    to: '/agreements/$agreementId' as const,
                    params: { agreementId: agreement.id },
                  }
                  return (
                    <TableRow key={agreement.id} className='group'>
                      <TableCell>
                        <Link
                          {...link}
                          className='block font-medium group-hover:underline'
                        >
                          {agreement.name}
                          <span className='block text-xs font-normal text-muted-foreground'>
                            {agreement.type || 'Sin tipo'}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className='hidden md:table-cell'>
                        <Link {...link} className='block'>
                          {partners[agreement.partnerId]?.name ??
                            'Socio no disponible'}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link {...link} className='block'>
                          <Badge
                            variant='outline'
                            className={
                              statusStyles[
                                getAgreementTemporalStatus(agreement)
                              ]
                            }
                          >
                            {
                              statusLabels[
                                getAgreementTemporalStatus(agreement)
                              ]
                            }
                          </Badge>
                        </Link>
                      </TableCell>
                      <TableCell className='hidden lg:table-cell'>
                        <Link {...link} className='block'>
                          {agreement.startsAt} —{' '}
                          {agreement.endsAt ?? 'Indefinido'}
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
            {rows.map((agreement) => (
              <Link
                key={agreement.id}
                to='/agreements/$agreementId'
                params={{ agreementId: agreement.id }}
                className='block rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
              >
                <Card
                  className={cn(
                    'h-full border-t-4 transition-transform hover:-translate-y-0.5',
                    getAgreementTemporalStatus(agreement) === 'active'
                      ? 'border-t-emerald-500'
                      : getAgreementTemporalStatus(agreement) === 'upcoming'
                        ? 'border-t-blue-500'
                        : getAgreementTemporalStatus(agreement) === 'expired'
                          ? 'border-t-amber-400'
                          : 'border-t-rose-400'
                  )}
                >
                  <CardHeader>
                    <div className='flex items-start justify-between gap-3'>
                      <CardTitle className='text-base'>
                        {agreement.name}
                      </CardTitle>
                      <Badge
                        variant='outline'
                        className={
                          statusStyles[getAgreementTemporalStatus(agreement)]
                        }
                      >
                        {statusLabels[getAgreementTemporalStatus(agreement)]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className='grid gap-2 text-sm'>
                    <p>
                      {partners[agreement.partnerId]?.name ??
                        'Socio no disponible'}
                    </p>
                    <p className='text-muted-foreground'>
                      {agreement.startsAt} — {agreement.endsAt ?? 'Indefinido'}
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
