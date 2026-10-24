import { Link } from '@tanstack/react-router'
import {
  CircleCheck,
  ClipboardList,
  FolderKanban,
  OctagonAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/features/core/model/app-store'
import { HomeCharts, HomeOperations } from '../components/home-charts'
import { EmptyState, StateBadge } from '../components/primitives'
import { VcmShell } from '../components/shell'
import { ROLE_LABELS } from '../model/catalogs'
import { buildDashboard } from '../model/dashboard'
import { sortedPriorities } from '../model/planning'
import { useVcm } from '../model/use-vcm'
import { canOperate, eligible } from '../model/workflow'

export function VcmHomePage() {
  const { data, actor } = useVcm()
  const app = useAppStore((s) => s)
  const d = buildDashboard(app, actor)
  const executive = actor.role === 'direction'
  const leadership = actor.role === 'leadership'
  const priorities = sortedPriorities(data, actor).slice(0, 3)
  return (
    <VcmShell
      title='Tu gestión, de un vistazo'
      description={
        executive
          ? 'Visión ejecutiva de portafolios, presupuesto, metas, convenios y decisiones estratégicas.'
          : leadership
            ? 'Gobierno y control: prioridades, presupuesto, indicadores, observaciones y excepciones.'
            : 'Iniciativas, metas y avance de tu equipo. Detecta pendientes y decide dónde enfocar el trabajo.'
      }
      actions={
        canOperate(actor.role) ? (
          <Button asChild>
            <Link to='/portfolio/new'>Nuevo expediente</Link>
          </Button>
        ) : null
      }
    >
      <p className='text-xs text-muted-foreground'>
        Vista de {ROLE_LABELS[actor.role]} · Actualizado al {d.today} · Datos de
        demostración
      </p>
      <div className='grid grid-cols-2 gap-3 xl:grid-cols-4'>
        {[
          {
            label: 'Iniciativas del portafolio',
            value: d.cases.length,
            note: 'Según visibilidad del rol',
            icon: FolderKanban,
            tone: 'text-indigo-600 dark:text-indigo-400',
            background: 'bg-indigo-50 dark:bg-indigo-950/50',
          },
          {
            label: executive
              ? 'Elegibles y validadas'
              : 'Expedientes con pendientes',
            value: executive
              ? d.cases.filter((c) => eligible(data, c.id)).length
              : d.quality.length,
            note: executive
              ? 'Con evidencia revisada'
              : 'Faltantes por resolver',
            icon: CircleCheck,
            tone: 'text-emerald-600 dark:text-emerald-400',
            background: 'bg-emerald-50 dark:bg-emerald-950/50',
          },
          {
            label: 'Decisiones pendientes',
            value: d.pendingDecisions.length,
            note: 'Por revisar y aprobar',
            icon: ClipboardList,
            tone: 'text-sky-600 dark:text-sky-400',
            background: 'bg-sky-50 dark:bg-sky-950/50',
          },
          {
            label: executive
              ? 'Portafolios con iniciativas'
              : 'Bloqueos operativos',
            value: executive
              ? d.portfolios.length
              : d.pendingTasks.filter((t) => t.blocked).length,
            note: executive
              ? 'Con trabajo registrado'
              : `${d.pendingTasks.length} tareas activas vinculadas`,
            icon: OctagonAlert,
            tone: 'text-amber-600 dark:text-amber-400',
            background: 'bg-amber-50 dark:bg-amber-950/50',
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className='relative min-w-0 rounded-2xl border bg-card p-4 shadow-sm sm:p-5'
          >
            <metric.icon
              aria-hidden='true'
              className={`absolute top-4 right-4 size-8 rounded-lg p-1.5 ${metric.tone} ${metric.background}`}
            />
            <p className='min-h-10 pr-9 text-xs font-medium text-muted-foreground'>
              {metric.label}
            </p>
            <p className='mt-1 text-3xl font-semibold tracking-tight tabular-nums'>
              {metric.value}
            </p>
            <p className='mt-1 text-xs text-muted-foreground'>{metric.note}</p>
          </div>
        ))}
      </div>
      <HomeCharts
        dashboard={d}
        government={['direction', 'leadership', 'coordination'].includes(
          actor.role
        )}
      />
      <HomeOperations dashboard={d} data={data} />
      <div className='grid gap-5 lg:grid-cols-2'>
        <section className='min-w-0 rounded-2xl border bg-card p-5'>
          <div className='mb-4 flex items-center justify-between gap-3'>
            <h2 className='font-semibold'>Prioridades</h2>
            <Link to='/portfolio' className='text-xs font-medium text-primary'>
              Ver portafolio ↗
            </Link>
          </div>
          <div className='divide-y'>
            {priorities.map((c) => (
              <Link
                key={c.id}
                to='/portfolio/$caseId'
                params={{ caseId: c.id }}
                className='flex items-center justify-between gap-3 py-3 text-sm hover:text-primary'
              >
                <span className='min-w-0'>
                  <span className='block font-medium'>{c.name}</span>
                  <span className='mt-1 block text-xs text-muted-foreground'>
                    {c.responsible}
                  </span>
                </span>
                <StateBadge state={c.state} />
              </Link>
            ))}
            {!priorities.length && (
              <EmptyState>Sin iniciativas pendientes.</EmptyState>
            )}
          </div>
        </section>
        <section className='min-w-0 rounded-2xl border bg-card p-5'>
          <div className='mb-4 flex items-center justify-between gap-3'>
            <h2 className='font-semibold'>Próximas fechas</h2>
            <span className='text-xs text-muted-foreground'>
              {d.upcoming.length} iniciativas
            </span>
          </div>
          <div className='divide-y'>
            {d.upcoming.slice(0, 3).map((c) => (
              <Link
                key={c.id}
                to='/portfolio/$caseId'
                params={{ caseId: c.id }}
                className='flex items-center gap-3 py-3 text-sm hover:text-primary'
              >
                <span className='flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary'>
                  <span className='text-lg font-semibold'>
                    {c.fields.startsAt.value.slice(8, 10)}
                  </span>
                  <span className='text-[10px]'>
                    {new Intl.DateTimeFormat('es-CL', {
                      month: 'short',
                      timeZone: 'UTC',
                    }).format(
                      new Date(
                        c.fields.startsAt.value.slice(0, 10) + 'T12:00:00Z'
                      )
                    )}
                  </span>
                </span>
                <span className='font-medium'>{c.name}</span>
              </Link>
            ))}
            {!d.upcoming.length && (
              <EmptyState>Sin próximas fechas.</EmptyState>
            )}
          </div>
        </section>
      </div>
    </VcmShell>
  )
}
