import type { AppData } from '@/features/core/model/types'
import { KIND_LABELS, STATE_LABELS } from './catalogs'
import { buildDashboard } from './dashboard'
import { PLAN_STATES } from './planning'
import type { Actor } from './types'
import { canRead } from './workflow'

export function reportHistory(app: AppData, actor: Actor, period: number) {
  const data = app.vcm!
  const plans = new Set(
    buildDashboard(app, actor, new Date(), period).plans.map((p) => p.id)
  )
  return data.audit.filter(
    (a) =>
      a.at.startsWith(`${period}-`) &&
      (a.caseId
        ? !!data.cases[a.caseId] && canRead(data.cases[a.caseId], actor)
        : ['savePlan', 'transitionPlan'].includes(a.action) &&
          !!a.after &&
          plans.has((a.after as { id: string }).id))
  )
}
export function reportCuts(app: AppData, actor: Actor, period: number) {
  return Object.values(app.vcm!.cuts).filter(
    (cut) =>
      (new RegExp(`(^|\\D)${period}(\\D|$)`).test(cut.period) ||
        !/\d{4}/.test(cut.period)) &&
      cut.caseIds.every(
        (id) => app.vcm!.cases[id] && canRead(app.vcm!.cases[id], actor)
      )
  )
}
export function buildReportCsv(
  app: AppData,
  actor: Actor,
  period: number,
  view: string
) {
  const d = buildDashboard(app, actor, new Date(), period)
  let rows: (string | number | null)[][]
  if (view === 'plan')
    rows = [
      [
        'Plan',
        'Año',
        'Estado',
        'Versión',
        'Objetivo',
        'Responsable',
        'Plazo',
        'Medición',
        'Meta',
        'Avance',
        'Brecha',
        'Expedientes',
      ],
      ...d.plans.flatMap((p) =>
        p.objectives.map((o) => [
          p.title,
          p.year,
          PLAN_STATES[p.status],
          p.version,
          o.title,
          o.responsible,
          o.dueDate,
          o.measure === 'completed'
            ? 'Iniciativas ejecutadas'
            : 'Expedientes elegibles y validados',
          o.target,
          o.progress,
          o.gap,
          o.caseIds.join('; '),
        ])
      ),
    ]
  else if (view === 'indicators')
    rows = [
      [
        'Indicador',
        'Nombre',
        'Período',
        'Meta',
        'Avance validado',
        'Brecha',
        'Regla',
      ],
      ...d.indicators.map((i) => [
        i.id,
        i.name,
        period,
        i.target,
        i.value,
        i.gap,
        i.rule,
      ]),
    ]
  else if (view === 'history')
    rows = [
      [
        'Fecha',
        'Expediente u objeto',
        'Acción',
        'Actor',
        'Fundamento',
        'Regla',
        'Correlación',
      ],
      ...reportHistory(app, actor, period).map((a) => [
        a.at,
        a.caseId || String((a.after as { id?: string })?.id ?? ''),
        a.action,
        a.actor.name,
        a.reason,
        a.ruleVersion,
        a.correlationId,
      ]),
    ]
  else if (view === 'cuts')
    rows = [
      [
        'Corte',
        'Período declarado',
        'Estado',
        'Versión',
        'Expedientes',
        'Observaciones abiertas',
        'Respuesta',
      ],
      ...reportCuts(app, actor, period).map((c) => [
        c.name,
        c.period,
        c.status,
        c.version,
        c.caseIds.join('; '),
        c.observations.filter((o) => o.status === 'open').length,
        c.response,
      ]),
    ]
  else if (view === 'executive') {
    rows = [
      ['Sección', 'Referencia', 'Concepto', 'Valor', 'Estado', 'Período'],
      ...d.portfolios.map((p) => [
        'Portafolio',
        p.name,
        'Ejecutadas / expedientes',
        `${p.completed} / ${p.total}`,
        'Ejecución declarada',
        period,
      ]),
      ...d.indicators.map((i) => [
        'Indicador',
        i.id,
        'Avance / meta',
        `${i.value} / ${i.target ?? 'Pendiente'}`,
        i.rule,
        period,
      ]),
    ]
    if (['coordination', 'leadership', 'direction'].includes(actor.role))
      rows.push(
        ...d.plans.flatMap((p) =>
          p.objectives.map((o) => [
            'Plan anual',
            p.title,
            o.title,
            `${o.progress} / ${o.target}`,
            PLAN_STATES[p.status],
            period,
          ])
        ),
        ...d.finance.projects.flatMap((f) => [
          [
            'Presupuesto',
            f.projectId,
            'Planificado',
            f.planned,
            'Local',
            period,
          ],
          [
            'Presupuesto',
            f.projectId,
            'Aprobado',
            f.hasFunding ? f.approved : null,
            'Decisión de Dirección',
            period,
          ],
          [
            'Presupuesto',
            f.projectId,
            'Ejecutado',
            f.spent,
            'Gastos registrados',
            period,
          ],
          [
            'Presupuesto',
            f.projectId,
            'Comprometido pendiente',
            f.outstanding,
            'Conciliado con pagos',
            period,
          ],
          [
            'Presupuesto',
            f.projectId,
            'Saldo',
            f.balance,
            'Aprobado − ejecutado − pendiente',
            period,
          ],
          [
            'Presupuesto',
            f.projectId,
            'Proyección',
            f.projected,
            'Estimación vigente requerida',
            period,
          ],
          [
            'Presupuesto',
            f.projectId,
            'Desviación proyectada',
            f.deviation,
            'Proyección − aprobado',
            period,
          ],
        ])
      )
  } else
    rows = [
      [
        'ID',
        'Nombre',
        'Tipo',
        'Estado EIC',
        'Validación institucional',
        'Responsable',
        'Portafolio',
        'Versión',
      ],
      ...d.cases.map((c) => [
        c.id,
        c.name,
        KIND_LABELS[c.kind],
        STATE_LABELS[c.state],
        c.institutionalValidation,
        c.responsible,
        c.portfolio,
        c.version,
      ]),
    ]
  return rows
    .map((row) =>
      row
        .map(
          (v) =>
            `"${String(v ?? 'Pendiente')
              .replace(/^[\s]*[=+@-]/, "'$&")
              .split('"')
              .join('""')}"`
        )
        .join(',')
    )
    .join('\n')
}
