import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/features/core/model/app-store'
import { AnnualPlanPanel } from '../components/annual-plan-panel'
import { CaseList } from '../components/case-list'
import { EmptyState, Panel } from '../components/primitives'
import { VcmShell } from '../components/shell'
import { KIND_LABELS, PORTFOLIOS } from '../model/catalogs'
import { useSessionView } from '../model/use-session-view'
import { useVcm } from '../model/use-vcm'
import { canOperate, canRead } from '../model/workflow'

export function PortfolioPage({
  initialView = 'all',
}: {
  initialView?: string
}) {
  const { data, actor } = useVcm()
  const [view, setView] = useSessionView(
    `${actor.id}:portfolio:${initialView}:view`,
    initialView
  )
  const [query, setQuery] = useSessionView(`${actor.id}:portfolio:query`, '')
  const [portfolio, setPortfolio] = useSessionView(
    `${actor.id}:portfolio:filter`,
    ''
  )
  const masterView = ['agreements', 'partners'].includes(view)
  const partners = useAppStore((s) => s.partners)
  const agreements = useAppStore((s) => s.agreements)
  const cases = Object.values(data.cases).filter(
    (c) =>
      canRead(c, actor) &&
      (view === 'all' || c.kind === view) &&
      (!portfolio || c.portfolio === portfolio) &&
      `${c.name} ${c.responsible} ${c.code}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase())
  )
  const tabs = [
    ['all', 'Todos'],
    ...(['coordination', 'leadership', 'direction'].includes(actor.role)
      ? [['plan', 'Plan anual']]
      : []),
    ...Object.entries(KIND_LABELS).filter(
      ([id]) => !['activity', 'presence'].includes(id)
    ),
    ['agreements', 'Convenios'],
    ['partners', 'Organizaciones'],
  ]
  return (
    <VcmShell
      title='Portafolio'
      description='Iniciativas, eventos y campañas conectados al expediente maestro. Una sola captura, múltiples vistas.'
      actions={
        canOperate(actor.role) ? (
          <Button asChild>
            <Link to='/portfolio/new'>
              <Plus />
              Nuevo expediente
            </Link>
          </Button>
        ) : null
      }
    >
      <div
        className='flex flex-wrap gap-2'
        role='group'
        aria-label='Tipo de portafolio'
      >
        {tabs.map(([id, label]) => (
          <Button
            key={id}
            variant={view === id ? 'default' : 'outline'}
            size='sm'
            onClick={() => setView(id)}
            aria-pressed={view === id}
          >
            {label}
          </Button>
        ))}
      </div>
      {view !== 'plan' && (
        <div className='flex flex-wrap gap-3'>
          <Input
            aria-label='Buscar portafolio'
            placeholder={
              masterView
                ? 'Buscar por nombre'
                : 'Buscar por nombre, responsable o código'
            }
            className='max-w-md'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!masterView && (
            <select
              aria-label='Filtrar por portafolio'
              className='max-w-full rounded-md border bg-background p-2 text-sm'
              value={portfolio}
              onChange={(e) => setPortfolio(e.target.value)}
            >
              <option value=''>Todos los portafolios</option>
              {PORTFOLIOS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          )}
          {(query || (!masterView && portfolio)) && (
            <Button
              variant='ghost'
              onClick={() => {
                setQuery('')
                setPortfolio('')
              }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>
      )}
      {view === 'plan' ? (
        <AnnualPlans />
      ) : view === 'partners' ? (
        <Panel
          title='Organizaciones compartidas'
          description='Contrapartes maestras reutilizadas por los expedientes.'
        >
          {canOperate(actor.role) ? (
            <Button asChild variant='outline'>
              <Link to='/partners/new'>Nueva organización</Link>
            </Button>
          ) : null}
          {!Object.values(partners).some((p) =>
            p.name.toLowerCase().includes(query.toLowerCase())
          ) && (
            <EmptyState>
              No hay organizaciones para esta búsqueda. Cambia el nombre o
              limpia los filtros.
            </EmptyState>
          )}
          {Object.values(partners)
            .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
            .map((p) => (
              <Link
                key={p.id}
                to='/partners/$partnerId'
                params={{ partnerId: p.id }}
                className='rounded-lg border p-4 hover:bg-accent'
              >
                {p.name}
                <span className='block text-xs text-muted-foreground'>
                  {p.type}
                </span>
              </Link>
            ))}
        </Panel>
      ) : view === 'agreements' ? (
        <Panel
          title='Convenios compartidos'
          description='Acuerdos vinculados a organizaciones y expedientes.'
        >
          {canOperate(actor.role) ? (
            <Button asChild variant='outline'>
              <Link to='/agreements/new'>Nuevo convenio</Link>
            </Button>
          ) : null}
          {Object.values(agreements)
            .filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
            .map((a) => (
              <Link
                key={a.id}
                to='/agreements/$agreementId'
                params={{ agreementId: a.id }}
                className='rounded-lg border p-4 hover:bg-accent'
              >
                {a.name}
              </Link>
            ))}
          {!Object.values(agreements).some((a) =>
            a.name.toLowerCase().includes(query.toLowerCase())
          ) ? (
            <EmptyState>
              No hay convenios para esta búsqueda. Cambia el nombre o limpia los
              filtros.
            </EmptyState>
          ) : null}
        </Panel>
      ) : (
        <>
          <p className='text-xs text-muted-foreground'>
            {cases.length} expedientes · incluye Presencias y Actividades en la
            vista Todos
          </p>
          <CaseList cases={cases} />
        </>
      )}
    </VcmShell>
  )
}

function AnnualPlans() {
  const [year, setYear] = useSessionView(
    'annual-plan:year',
    String(new Date().getFullYear())
  )
  return (
    <div className='grid gap-4'>
      <label className='flex items-center gap-2 text-sm'>
        Año del plan
        <input
          className='w-28 rounded border bg-background p-2'
          aria-label='Año del plan'
          type='number'
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />
      </label>
      {/^\d{4}$/.test(year) && (
        <AnnualPlanPanel key={year} year={Number(year)} />
      )}
    </div>
  )
}
