import { Link } from '@tanstack/react-router'
import {
  CircleCheck,
  ClipboardList,
  FolderKanban,
  OctagonAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/features/core/model/app-store'
import { HomeCharts } from '../components/home-charts'
import { ManagementOverview } from '../components/management-overview'
import { EmptyState, Panel, StateBadge } from '../components/primitives'
import { VcmShell } from '../components/shell'
import { ROLE_LABELS } from '../model/catalogs'
import { buildDashboard } from '../model/dashboard'
import { decisionAuthority } from '../model/decisions'
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
      <Panel
        title='Siguiente paso'
        description='Accesos a pendientes comprobables; revisa las prioridades declaradas antes de actuar.'
      >
        <div className='flex flex-wrap gap-3 text-sm'>
          <Link
            to='/control'
            className='rounded border p-3 text-primary underline'
          >
            Revisar {d.quality.length} expedientes con faltantes
          </Link>
          <Link
            to='/portfolio'
            className='rounded border p-3 text-primary underline'
          >
            Abrir portafolio, plan y decisiones
          </Link>
          <Link
            to='/reports'
            className='rounded border p-3 text-primary underline'
          >
            Consultar reportes y registros sin fecha
          </Link>
        </div>
      </Panel>

      <div className='grid gap-6 lg:grid-cols-2'>
        <Panel
          title={
            executive
              ? 'Iniciativas estratégicas prioritarias'
              : 'Prioridades del día'
          }
          description='Orden por prioridad operativa declarada; luego pertinencia, urgencia y fecha de término. Evaluación humana, sin puntajes institucionales automáticos.'
        >
          {priorities.map((c) => (
            <Link
              to='/portfolio/$caseId'
              params={{ caseId: c.id }}
              key={c.id}
              className='flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 hover:bg-accent'
            >
              <div>
                <p className='font-medium'>{c.name}</p>
                <p className='mt-1 text-xs text-muted-foreground'>
                  {c.responsible} · Prioridad{' '}
                  {c.priority === 'high'
                    ? 'alta'
                    : c.priority === 'low'
                      ? 'baja'
                      : 'media'}{' '}
                  · Término:{' '}
                  {c.fields.endsAt?.value.slice(0, 10) || 'Pendiente'}
                </p>
              </div>
              <StateBadge state={c.state} />
            </Link>
          ))}
          {!priorities.length && (
            <EmptyState>No hay expedientes abiertos visibles.</EmptyState>
          )}
        </Panel>
        <Panel
          title='Decisiones y aprobaciones pendientes'
          description='Las decisiones de presupuesto requieren Dirección; las excepciones escaladas, Jefatura. El fundamento se conserva en el expediente.'
        >
          {d.pendingDecisions.slice(0, 3).map((v) => (
            <Link
              key={v.id}
              to='/portfolio/$caseId'
              params={{ caseId: v.caseId }}
              className='rounded-lg border p-4 text-sm hover:bg-accent'
            >
              <strong>{v.title}</strong>
              <p className='mt-1 text-xs text-muted-foreground'>
                {data.cases[v.caseId].name} · {v.reason}
              </p>
              <p className='mt-2 text-xs'>
                Autoridad requerida:{' '}
                {
                  {
                    coordination: 'Coordinación',
                    leadership: 'Jefatura',
                    direction: 'Dirección',
                  }[decisionAuthority(v)]
                }{' '}
                · Solicitada por {v.requestedBy.name}
              </p>
            </Link>
          ))}
          {!d.pendingDecisions.length && (
            <EmptyState>No hay decisiones pendientes.</EmptyState>
          )}
        </Panel>
        <Panel
          title='Próximas iniciativas y eventos'
          description='Fechas futuras declaradas. Calendar permanece desconectado.'
        >
          {d.upcoming.slice(0, 3).map((c) => (
            <Link
              key={c.id}
              to='/portfolio/$caseId'
              params={{ caseId: c.id }}
              className='flex justify-between gap-3 rounded border p-3 text-sm hover:bg-accent'
            >
              <span>{c.name}</span>
              <span className='shrink-0'>
                {c.fields.startsAt.value.slice(0, 10)}
              </span>
            </Link>
          ))}
          {!d.upcoming.length && (
            <EmptyState>No hay próximas fechas informadas.</EmptyState>
          )}
        </Panel>
        <Panel
          title='Vencimientos y bloqueos'
          description='Fechas de término pasadas y tareas pendientes vencidas o bloqueadas. No se envían recordatorios externos.'
        >
          {d.overdue.slice(0, 3).map((c) => (
            <Link
              key={c.id}
              to='/portfolio/$caseId'
              params={{ caseId: c.id }}
              className='rounded border p-3 text-sm hover:bg-accent'
            >
              {c.name} · Término vencido: {c.fields.endsAt.value.slice(0, 10)}
            </Link>
          ))}
          {d.pendingTasks
            .filter(
              (t) =>
                t.blocked || (t.dueDate && t.dueDate.slice(0, 10) < d.today)
            )
            .slice(0, 3)
            .map((t) => (
              <p key={t.id} className='rounded border p-3 text-sm'>
                {t.title} · {t.assignee || 'Sin responsable'} ·{' '}
                {t.blocked ? 'Bloqueada' : 'Vencida'} ·{' '}
                {t.dueDate?.slice(0, 10)}
              </p>
            ))}
          {!d.overdue.length &&
            !d.pendingTasks.some(
              (t) =>
                t.blocked || (t.dueDate && t.dueDate.slice(0, 10) < d.today)
            ) && (
              <EmptyState>
                No hay vencimientos ni bloqueos detectados.
              </EmptyState>
            )}
        </Panel>
      </div>
      <ManagementOverview compact />
    </VcmShell>
  )
}
