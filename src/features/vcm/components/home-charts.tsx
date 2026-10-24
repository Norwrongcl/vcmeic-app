import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, ChartNoAxesCombined, Target } from 'lucide-react'
import { formatClp } from '@/features/events/model/formatters'
import type { buildDashboard } from '../model/dashboard'
import { PLAN_STATES } from '../model/planning'
import { EmptyState } from './primitives'

type Dashboard = ReturnType<typeof buildDashboard>
const number = new Intl.NumberFormat('es-CL')
const percent = (value: number, target: number) =>
  target > 0 ? Math.round((value / target) * 100) : null
const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#94a3b8']
const executionLabels = [
  ['draft', 'En preparación'],
  ['planned', 'Planificadas'],
  ['in_progress', 'En ejecución'],
  ['completed', 'Ejecutadas'],
  ['cancelled', 'Canceladas'],
] as const

function ChartPanel({
  title,
  description,
  children,
  className = '',
}: {
  title: string
  description: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`min-w-0 rounded-2xl border bg-card p-5 shadow-sm sm:p-6 ${className}`}
    >
      <h2 className='text-base font-semibold tracking-tight'>{title}</h2>
      <p className='mt-1 text-xs leading-relaxed text-muted-foreground'>
        {description}
      </p>
      <div className='mt-6'>{children}</div>
    </section>
  )
}

function GoalBar({
  title,
  value,
  target,
  note,
  color = '#6366f1',
}: {
  title: string
  value: number
  target: number | null
  note: string
  color?: string
}) {
  const progress = target === null ? null : percent(value, target)
  return (
    <div className='min-w-0 space-y-2.5'>
      <div className='flex items-start justify-between gap-4 text-sm'>
        <h3 className='font-medium'>{title}</h3>
        <span className='shrink-0 font-semibold tabular-nums' style={{ color }}>
          {progress === null ? 'Sin meta' : `${progress}%`}
        </span>
      </div>
      <div
        role={progress === null ? undefined : 'meter'}
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={target ?? undefined}
        aria-valuenow={
          target && target > 0 ? Math.min(value, target) : undefined
        }
        aria-valuetext={`${value} de ${target ?? 'meta sin definir'}`}
        className='h-2.5 overflow-hidden rounded-full bg-muted'
      >
        <div
          className='h-full rounded-full motion-safe:transition-all motion-safe:duration-700'
          style={{
            width: `${Math.min(100, Math.max(0, progress ?? 0))}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <div className='flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground'>
        <span>
          {number.format(value)} /{' '}
          {target === null ? 'sin definir' : number.format(target)} · {note}
        </span>
        {target !== null && (
          <span>Brecha: {number.format(Math.max(0, target - value))}</span>
        )}
      </div>
    </div>
  )
}

export function HomeCharts({
  dashboard: d,
  government,
}: {
  dashboard: Dashboard
  government: boolean
}) {
  const distribution = executionLabels.map(([state, name], index) => ({
    name,
    value: d.cases.filter((c) => c.executionState === state).length,
    color: palette[index],
  }))
  const segments = distribution.map((item, index) => ({
    ...item,
    length: d.cases.length ? (item.value / d.cases.length) * 100 : 0,
    offset: d.cases.length
      ? (distribution.slice(0, index).reduce((sum, s) => sum + s.value, 0) /
          d.cases.length) *
        100
      : 0,
  }))
  const objectives = d.plans.flatMap((p) => p.objectives)
  const maxPortfolio = Math.max(1, ...d.portfolios.map((p) => p.total))
  const execution = percent(d.finance.spent, d.finance.planned)

  return (
    <div className='space-y-5'>
      <div className='grid gap-5 xl:grid-cols-[1fr_1.35fr]'>
        <ChartPanel
          title='Estado de las iniciativas'
          description='Distribución por etapa de ejecución · expedientes visibles para tu rol'
        >
          <div className='flex flex-col items-center gap-6 sm:flex-row sm:justify-around'>
            <div className='relative size-48 shrink-0'>
              <svg
                viewBox='0 0 120 120'
                className='size-full -rotate-90'
                role='img'
                aria-label={`Distribución de ${d.cases.length} iniciativas. ${distribution.map((s) => `${s.name}: ${s.value}`).join('. ')}`}
              >
                <circle
                  cx='60'
                  cy='60'
                  r='48'
                  fill='none'
                  stroke='currentColor'
                  className='text-muted'
                  strokeWidth='13'
                />
                {segments
                  .filter((s) => s.value > 0)
                  .map((s) => (
                    <circle
                      key={s.name}
                      cx='60'
                      cy='60'
                      r='48'
                      pathLength='100'
                      fill='none'
                      stroke={s.color}
                      strokeWidth='13'
                      strokeDasharray={`${s.length} ${100 - s.length}`}
                      strokeDashoffset={-s.offset}
                    />
                  ))}
              </svg>
              <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center'>
                <span className='text-4xl font-semibold tracking-tight tabular-nums'>
                  {d.cases.length}
                </span>
                <span className='mt-1 text-xs text-muted-foreground'>
                  iniciativas
                </span>
              </div>
            </div>
            <ul className='grid w-full max-w-64 gap-3.5 text-sm'>
              {distribution.map((s) => (
                <li key={s.name} className='flex items-center gap-2.5'>
                  <span
                    className='size-2.5 shrink-0 rounded-full'
                    style={{ backgroundColor: s.color }}
                  />
                  <span className='text-muted-foreground'>{s.name}</span>
                  <span className='ml-auto font-semibold tabular-nums'>
                    {s.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {!d.cases.length && (
            <p className='mt-4 text-center text-xs text-muted-foreground'>
              Las iniciativas aparecerán aquí cuando tengas expedientes
              visibles.
            </p>
          )}
        </ChartPanel>

        <ChartPanel
          title='Iniciativas por portafolio'
          description='Compara el volumen de trabajo y las iniciativas ejecutadas en cada portafolio.'
        >
          <div className='mb-5 flex flex-wrap gap-4 text-xs text-muted-foreground'>
            <span className='flex items-center gap-2'>
              <span className='size-2.5 rounded-sm bg-indigo-500' />
              Ejecutadas
            </span>
            <span className='flex items-center gap-2'>
              <span className='size-2.5 rounded-sm bg-indigo-200 dark:bg-indigo-900' />
              Otras etapas
            </span>
          </div>
          <div className='space-y-5'>
            {d.portfolios.map((p) => (
              <div key={p.name}>
                <div className='mb-2 flex items-center justify-between gap-3 text-sm'>
                  <span className='min-w-0 font-medium break-words'>
                    {p.name}
                  </span>
                  <span className='shrink-0 text-xs text-muted-foreground'>
                    {p.completed} / {p.total} ejecutadas
                  </span>
                </div>
                <div
                  role='img'
                  aria-label={`${p.name}: ${p.total} iniciativas, ${p.completed} ejecutadas y ${p.validated} elegibles y validadas`}
                  className='h-4 rounded bg-muted/70'
                >
                  <div
                    className='h-full overflow-hidden rounded bg-indigo-200 dark:bg-indigo-900'
                    style={{ width: `${(p.total / maxPortfolio) * 100}%` }}
                  >
                    <div
                      className='h-full rounded bg-indigo-500'
                      style={{ width: `${(p.completed / p.total) * 100}%` }}
                    />
                  </div>
                </div>
                <p className='mt-1.5 text-xs text-muted-foreground'>
                  {p.validated} elegibles y validadas
                </p>
              </div>
            ))}
            {!d.portfolios.length && (
              <EmptyState>
                No hay portafolios con iniciativas visibles.
              </EmptyState>
            )}
          </div>
        </ChartPanel>
      </div>

      <div
        className={`grid gap-5 ${government ? 'xl:grid-cols-[1.35fr_1fr]' : ''}`}
      >
        <ChartPanel
          title={`Metas e indicadores · ${d.year}`}
          description='Avance frente a las metas definidas. Solo se suman aportes elegibles y validados.'
        >
          <div className='space-y-6'>
            {d.indicators.map((i, index) => (
              <GoalBar
                key={i.id}
                title={i.name}
                value={i.value}
                target={i.target}
                note={i.unit}
                color={palette[index % palette.length]}
              />
            ))}
            {!d.indicators.length && (
              <EmptyState>
                No hay metas definidas para este año. Puedes revisarlas en
                Reportes.
              </EmptyState>
            )}
          </div>
          <Link
            to='/reports'
            className='mt-6 inline-flex items-center gap-1 text-xs font-medium text-primary'
          >
            Explorar indicadores <ArrowUpRight className='size-3.5' />
          </Link>
        </ChartPanel>
        {government && (
          <ChartPanel
            title='Ejecución del presupuesto'
            description='Gastos registrados frente al presupuesto planificado de los proyectos visibles.'
          >
            <div className='flex items-end justify-between gap-3'>
              <div>
                <p className='text-3xl font-semibold tracking-tight tabular-nums'>
                  {execution === null ? 'Sin base' : `${execution}%`}
                </p>
                <p className='mt-1 text-xs text-muted-foreground'>
                  del presupuesto planificado
                </p>
              </div>
              <ChartNoAxesCombined
                className='size-9 text-emerald-500'
                strokeWidth={1.5}
              />
            </div>
            <div
              role='img'
              aria-label={`Gastos: ${formatClp(d.finance.spent)}. Planificado: ${formatClp(d.finance.planned)}`}
              className='mt-5 h-5 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950'
            >
              <div
                className={`h-full rounded-full ${d.finance.spent > d.finance.planned ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, execution ?? 0)}%` }}
              />
            </div>
            <dl className='mt-5 grid grid-cols-2 gap-4'>
              {[
                [
                  'Gastos registrados',
                  d.finance.hasBudget
                    ? formatClp(d.finance.spent)
                    : 'Sin registrar',
                ],
                [
                  'Planificado',
                  d.finance.hasBudget
                    ? formatClp(d.finance.planned)
                    : 'Sin registrar',
                ],
                ['Pendiente de pago', formatClp(d.finance.outstanding)],
                [
                  'Saldo aprobado',
                  d.finance.balance === null
                    ? 'Sin financiamiento completo'
                    : formatClp(d.finance.balance),
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className='text-xs text-muted-foreground'>{label}</dt>
                  <dd className='mt-1 text-sm font-semibold tabular-nums'>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {d.finance.spent > d.finance.planned && (
              <p className='mt-4 text-xs font-medium text-amber-700 dark:text-amber-400'>
                Los gastos superan lo planificado en{' '}
                {formatClp(d.finance.spent - d.finance.planned)}.
              </p>
            )}
          </ChartPanel>
        )}
      </div>
      {government && (
        <ChartPanel
          title={`Objetivos del plan anual · ${d.year}`}
          description='Cada objetivo conserva su propia meta: ejecución y validación se miden por separado.'
        >
          {d.plans.map((plan) => (
            <div key={plan.id} className='mb-6 last:mb-0'>
              <div className='mb-5 flex flex-wrap items-center gap-2'>
                <Target className='size-4 text-primary' />
                <h3 className='text-sm font-semibold'>{plan.title}</h3>
                <span className='rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground'>
                  {PLAN_STATES[plan.status]}
                </span>
              </div>
              <div className='grid gap-6 lg:grid-cols-2'>
                {plan.objectives.map((o) => (
                  <div key={o.id} className='rounded-xl border bg-muted/20 p-4'>
                    <GoalBar
                      title={o.title}
                      value={o.progress}
                      target={o.target}
                      note={
                        o.measure === 'completed'
                          ? 'ejecutadas'
                          : 'elegibles y validadas'
                      }
                    />
                    <p className='mt-3 text-xs text-muted-foreground'>
                      {o.responsible} · Vence {o.dueDate} ·{' '}
                      {o.milestones.filter((m) => m.status === 'done').length}/
                      {o.milestones.length} hitos
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!objectives.length && (
            <EmptyState>
              El plan anual aún no tiene objetivos visibles para este período.
            </EmptyState>
          )}
          <Link
            to='/portfolio'
            className='mt-5 inline-flex items-center gap-1 text-xs font-medium text-primary'
          >
            Ver plan y portafolio <ArrowUpRight className='size-3.5' />
          </Link>
        </ChartPanel>
      )}
    </div>
  )
}
