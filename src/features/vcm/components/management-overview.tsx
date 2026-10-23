import { Link } from '@tanstack/react-router'
import { useAppStore } from '@/features/core/model/app-store'
import { formatClp } from '@/features/events/model/formatters'
import { campaignIsApproved, contentIsApproved } from '../model/campaign-rules'
import { buildDashboard } from '../model/dashboard'
import { PLAN_STATES } from '../model/planning'
import { useVcm } from '../model/use-vcm'
import { EmptyState, Panel } from './primitives'

export function ManagementOverview({
  compact = false,
  period,
}: {
  compact?: boolean
  period?: number
}) {
  const app = useAppStore((s) => s)
  const { actor, data } = useVcm()
  const d = buildDashboard(app, actor, new Date(), period)
  const government = ['direction', 'leadership', 'coordination'].includes(
    actor.role
  )
  return (
    <div className='grid items-start gap-6 lg:grid-cols-2'>
      {government && (
        <Panel
          collapsible={compact}
          title={`Plan anual · ${d.year}`}
          description='Objetivos vinculados a los expedientes y a sus hitos operacionales. Ejecución y validación se calculan por separado.'
        >
          {d.plans.map((p) => (
            <div key={p.id} className='grid gap-3 text-sm'>
              <strong>
                {p.title} · {PLAN_STATES[p.status]} · v{p.version}
              </strong>
              {p.objectives.map((o) => (
                <p className='rounded border p-3' key={o.id}>
                  {o.title} · {o.responsible} · {o.dueDate}
                  <span className='block text-muted-foreground'>
                    Avance: {o.progress} / {o.target}{' '}
                    {o.measure === 'completed'
                      ? 'ejecutadas'
                      : 'elegibles y validadas'}{' '}
                    · Brecha: {o.gap} · Hitos:{' '}
                    {o.milestones.filter((t) => t.status === 'done').length}/
                    {o.milestones.length}
                  </span>
                </p>
              ))}
            </div>
          ))}
          {!d.plans.length && (
            <EmptyState>
              No hay plan anual visible para este período.
            </EmptyState>
          )}
          <Link className='text-sm underline' to='/portfolio'>
            Gestionar el plan anual en Portafolio
          </Link>
        </Panel>
      )}

      <Panel
        collapsible={compact}
        title={`Portafolios · ${d.portfolios.length} con iniciativas`}
        description='Ejecución y validación son etapas distintas. No representan el porcentaje de cumplimiento del plan anual.'
      >
        {d.portfolios.map((p) => (
          <div key={p.name} className='rounded-lg border p-4 text-sm'>
            <strong>{p.name}</strong>
            <p className='mt-2 text-muted-foreground'>
              {p.total} iniciativas · {p.completed} ejecutadas · {p.validated}{' '}
              elegibles y validadas
            </p>
          </div>
        ))}
        {!d.portfolios.length && (
          <EmptyState>No hay iniciativas visibles.</EmptyState>
        )}
      </Panel>
      <Panel
        collapsible={compact}
        title={`Indicadores y brechas · ${d.year}`}
        description='Avance local derivado únicamente de aportes elegibles y validados. Las metas se muestran por separado.'
      >
        {d.indicators.map((i) => (
          <div key={i.id} className='rounded-lg border p-3 text-sm'>
            <strong>{i.name}</strong>
            <dl className='mt-2 grid grid-cols-3 gap-2'>
              <div>
                <dt className='text-xs text-muted-foreground'>Avance</dt>
                <dd>{i.value}</dd>
              </div>
              <div>
                <dt className='text-xs text-muted-foreground'>Meta</dt>
                <dd>{i.target ?? 'Pendiente'}</dd>
              </div>
              <div>
                <dt className='text-xs text-muted-foreground'>Brecha</dt>
                <dd>{i.gap ?? 'Pendiente'}</dd>
              </div>
            </dl>
            <p className='mt-2 text-xs text-muted-foreground'>
              {i.unit} · {i.rule}
            </p>
          </div>
        ))}
        {!d.indicators.length && (
          <EmptyState>No hay metas definidas para el año actual.</EmptyState>
        )}
        <p className='text-xs text-muted-foreground'>
          Tendencia y riesgo de incumplimiento: pendientes de serie histórica y
          reglas de alerta aprobadas.
        </p>
        <Link className='text-sm underline' to='/reports'>
          Ver indicadores y registros de respaldo
        </Link>
      </Panel>
      {government && (
        <Panel
          collapsible={compact}
          title='Presupuesto y desviaciones'
          description='Montos locales de proyectos vinculados, sin duplicar iniciativas que compartan proyecto.'
        >
          <dl className='grid grid-cols-2 gap-3 text-sm'>
            <dt>Planificado</dt>
            <dd>
              {d.finance.hasBudget
                ? formatClp(d.finance.planned)
                : 'Sin registrar'}
            </dd>
            <dt>Solicitudes pendientes</dt>
            <dd>
              {d.finance.hasDecisions
                ? formatClp(d.finance.requested)
                : 'Sin registrar'}
            </dd>
            <dt>Aprobado por decisión</dt>
            <dd>
              {d.finance.hasDecisions
                ? formatClp(d.finance.approved)
                : 'Sin registrar'}
            </dd>
            <dt>Gastos registrados</dt>
            <dd>
              {d.finance.hasBudget
                ? formatClp(d.finance.spent)
                : 'Sin registrar'}
            </dd>
            <dt>Diferencia planificado − gastos</dt>
            <dd>
              {d.finance.hasBudget
                ? formatClp(d.finance.planned - d.finance.spent)
                : 'Sin registrar'}
            </dd>
            <dt>Proyectos sobre lo planificado</dt>
            <dd>{d.finance.overBudget}</dd>
          </dl>
          <dl className='grid grid-cols-2 gap-3 text-sm'>
            <dt>Comprometido total</dt>
            <dd>{formatClp(d.finance.committed)}</dd>
            <dt>Pendiente de pago</dt>
            <dd>{formatClp(d.finance.outstanding)}</dd>
            <dt>Saldo tras gastos y compromisos</dt>
            <dd>
              {d.finance.balance === null
                ? 'Pendiente de financiamiento'
                : formatClp(d.finance.balance)}
            </dd>
            <dt>Proyección total</dt>
            <dd>
              {d.finance.projected === null
                ? 'Estimación incompleta'
                : formatClp(d.finance.projected)}
            </dd>
            <dt>Desviación proyectada</dt>
            <dd>
              {d.finance.deviation === null
                ? 'Pendiente'
                : formatClp(d.finance.deviation)}
            </dd>
          </dl>
          <p className='text-xs text-muted-foreground'>
            {d.finance.missingForecasts} proyectos sin estimación de cierre ·{' '}
            {d.finance.unassignedDecisions} decisiones presupuestarias sin
            proyecto. Proyección = gastos + compromisos pendientes + gasto
            adicional estimado. El saldo consolidado requiere financiamiento
            aprobado en cada proyecto.
          </p>
          {d.finance.issues.map((issue, i) => (
            <p className='text-xs text-destructive' key={i}>
              {issue}
            </p>
          ))}
        </Panel>
      )}
      <Panel
        collapsible={compact}
        title={`Campañas y comunicaciones · ${d.contents.filter((c) => !contentIsApproved(data, c)).length} contenidos pendientes`}
        description='Resumen de preparación y aprobación; Buffer permanece desconectado.'
      >
        <div className='grid grid-cols-2 gap-3 text-sm'>
          <p>
            <strong>{d.campaigns.length}</strong> campañas con estrategia
          </p>
          <p>
            <strong>
              {d.campaigns.filter((c) => campaignIsApproved(c)).length}
            </strong>{' '}
            estrategias aprobadas
          </p>
          <p>
            <strong>
              {d.contents.filter((c) => !contentIsApproved(data, c)).length}
            </strong>{' '}
            contenidos por aprobar
          </p>
          <p>
            <strong>
              {d.contents.filter((c) => contentIsApproved(data, c)).length}
            </strong>{' '}
            contenidos aprobados
          </p>
        </div>
        {d.campaigns.map((c) => (
          <Link
            key={c.id}
            to='/portfolio/$caseId'
            params={{ caseId: c.caseId }}
            className='rounded border p-3 text-sm hover:bg-accent'
          >
            <strong>{data.cases[c.caseId].name}</strong>
            <p className='mt-1 text-muted-foreground'>
              Objetivo: {c.objective || 'Pendiente'} · Público:{' '}
              {c.audience || 'Pendiente'}
            </p>
            <p className='mt-1 text-xs text-muted-foreground'>
              Indicador de campaña: {c.kpi || 'Pendiente'} · Resultados: sin
              métricas integradas
            </p>
          </Link>
        ))}
        <p className='text-xs text-muted-foreground'>
          Programación, publicaciones y métricas externas pendientes de
          integración.
        </p>
      </Panel>
      <Panel
        collapsible={compact}
        title={`Convenios y compromisos · ${d.agreements.length} visibles`}
        description='Vigencia documental. La activación y los compromisos se verifican en cada convenio y expediente vinculado.'
      >
        {d.agreements.slice(0, 5).map((a) => (
          <Link
            key={a.id}
            to='/agreements/$agreementId'
            params={{ agreementId: a.id }}
            className='rounded border p-3 text-sm hover:bg-accent'
          >
            <strong>{a.name}</strong>
            <p className='mt-1 text-muted-foreground'>
              {a.status} · Vencimiento: {a.endsAt || 'Sin fecha'} · Responsable:{' '}
              {app.contacts[a.responsibleContactId ?? '']?.name ||
                'Sin asignar'}
            </p>
          </Link>
        ))}
        {!d.agreements.length && (
          <EmptyState>No hay convenios visibles.</EmptyState>
        )}
      </Panel>
      <Panel
        collapsible={compact}
        title={`Control documental · ${d.quality.length} expedientes con pendientes`}
        description='Señales verificables de los datos locales; no se asignan umbrales de riesgo institucional por inferencia.'
      >
        <dl className='grid grid-cols-2 gap-3 text-sm'>
          <dt>Fechas de término vencidas sin cierre</dt>
          <dd>{d.overdue.length}</dd>
          <dt>Expedientes con datos en conflicto</dt>
          <dd>{d.conflicts.length}</dd>
          <dt>Expedientes con faltantes o controles pendientes</dt>
          <dd>{d.quality.length}</dd>
          <dt>Observaciones institucionales abiertas</dt>
          <dd>{d.observations.length}</dd>
          <dt>Tareas bloqueadas</dt>
          <dd>{d.pendingTasks.filter((t) => t.blocked).length}</dd>
        </dl>
        <Link className='text-sm underline' to='/control'>
          Revisar faltantes, evidencia y observaciones
        </Link>
      </Panel>
    </div>
  )
}
