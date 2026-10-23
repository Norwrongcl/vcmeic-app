import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAppStore } from '@/features/core/model/app-store'
import { text } from '../model/form-utils'
import { PLAN_STATES, planProgress } from '../model/planning'
import type { AnnualPlan, PlanObjective } from '../model/planning-types'
import { useVcm } from '../model/use-vcm'
import { canOperate, canRead } from '../model/workflow'
import { EmptyState, Field, Panel, SaveForm } from './primitives'

export function AnnualPlanPanel({
  year = new Date().getFullYear(),
  readOnly = false,
}: {
  year?: number
  readOnly?: boolean
}) {
  const { actor, data } = useVcm()
  const app = useAppStore((s) => s)
  const plans = planProgress(app, actor, year)
  if (!['coordination', 'leadership', 'direction'].includes(actor.role))
    return (
      <EmptyState>
        El plan anual está disponible para los roles de gobierno.
      </EmptyState>
    )
  return (
    <div className='grid min-w-0 grid-cols-1 gap-6'>
      <p className='text-sm text-muted-foreground'>
        Plan anual {year} · Coordinación propone, Jefatura sanciona y Dirección
        aprueba. Las aprobaciones del presupuesto se registran por separado.
        Editar el plan requiere una nueva validación.
      </p>
      {plans.map((p) => (
        <Panel
          key={p.id}
          title={p.title}
          description={`${PLAN_STATES[p.status]} · versión ${p.version} · ${p.actor.name}`}
        >
          {p.objectives.map((o) => (
            <div key={o.id} className='grid gap-2 rounded border p-4 text-sm'>
              <strong>{o.title}</strong>
              <p>
                {o.responsible} · Plazo: {o.dueDate}
              </p>
              <p>
                Meta: {o.target}{' '}
                {o.measure === 'completed'
                  ? 'iniciativas ejecutadas'
                  : 'expedientes elegibles y validados'}{' '}
                · Avance: {o.progress} · Brecha: {o.gap}
              </p>
              <p className='text-muted-foreground'>
                {o.completed} ejecutadas · {o.validated} elegibles y validadas.{' '}
                {p.status !== 'approved'
                  ? 'Propuesta pendiente de aprobación.'
                  : ''}
              </p>
              <p>
                Recursos: {o.resources || 'Pendiente'} · Dependencias:{' '}
                {o.dependencies || 'Sin informar'}
              </p>
              <div className='flex flex-wrap gap-3'>
                {o.caseIds.map((id) => (
                  <Link
                    className='underline'
                    key={id}
                    to='/portfolio/$caseId'
                    params={{ caseId: id }}
                  >
                    {data.cases[id]?.name}
                  </Link>
                ))}
              </div>
              <details>
                <summary className='cursor-pointer'>
                  Hitos vinculados · {o.milestones.length}
                </summary>
                {o.milestones.map((t) => (
                  <p className='mt-2' key={t.id}>
                    {t.title} · {t.dueDate || 'Sin fecha'} ·{' '}
                    {t.status === 'done'
                      ? 'Completado'
                      : t.status === 'cancelled'
                        ? 'Cancelado'
                        : 'Pendiente'}
                  </p>
                ))}
                {!o.milestones.length && (
                  <p className='mt-2 text-muted-foreground'>
                    Crea los hitos en la Operación del expediente. Se reutilizan
                    aquí sin otro plan de tareas.
                  </p>
                )}
              </details>
            </div>
          ))}
          {!readOnly && (
            <>
              {canOperate(actor.role) && (
                <PlanEditor
                  key={`${actor.id}:${p.id}:${p.version}`}
                  plan={p}
                  year={year}
                />
              )}
              <PlanTransition
                key={`${actor.id}:${p.id}:${p.status}`}
                plan={p}
              />
            </>
          )}
          <details>
            <summary className='cursor-pointer text-sm'>
              Historial de planificación
            </summary>
            {data.audit
              .filter(
                (a) =>
                  ['savePlan', 'transitionPlan'].includes(a.action) &&
                  (a.after as AnnualPlan)?.id === p.id
              )
              .slice()
              .reverse()
              .map((a) => (
                <p key={a.id} className='mt-2 text-xs'>
                  {new Date(a.at).toLocaleString('es-CL')} · {a.actor.name} ·{' '}
                  {a.reason} · {PLAN_STATES[(a.after as AnnualPlan).status]}
                </p>
              ))}
          </details>
        </Panel>
      ))}
      {!plans.length && (
        <EmptyState>No hay plan anual visible para este período.</EmptyState>
      )}
      {!readOnly &&
        canOperate(actor.role) &&
        !Object.values(data.plans).some((p) => p.year === year) && (
          <Panel
            title='Crear plan anual'
            description='Registra el primer objetivo y vincula sus iniciativas. Puedes añadir otros objetivos después.'
          >
            <PlanEditor key={`${actor.id}:${year}:new`} year={year} />
          </Panel>
        )}
    </div>
  )
}
function PlanEditor({ plan, year }: { plan?: AnnualPlan; year: number }) {
  const { actor, data, execute } = useVcm()
  const [objectiveId, setObjectiveId] = useState(
    plan?.objectives[0]?.id ?? 'new'
  )
  const o = plan?.objectives.find((o) => o.id === objectiveId)
  const cases = Object.values(data.cases).filter((c) => canRead(c, actor))
  return (
    <details className='rounded border p-4'>
      <summary className='cursor-pointer text-sm font-medium'>
        {plan ? 'Editar plan u objetivos' : 'Preparar propuesta'}
      </summary>
      {plan && (
        <label className='my-3 grid gap-2 text-sm'>
          Objetivo a editar
          <select
            className='w-full min-w-0 rounded border bg-background p-2'
            aria-label='Objetivo a editar'
            value={objectiveId}
            onChange={(e) => setObjectiveId(e.target.value)}
          >
            <option value='new'>Añadir objetivo</option>
            {plan.objectives.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <SaveForm
        key={objectiveId}
        draftKey={`${actor.id}:plan:${plan?.id ?? year}:${objectiveId}`}
        label={
          plan ? 'Guardar nueva versión del plan' : 'Crear propuesta de plan'
        }
        onSave={async (f) => {
          const objective: PlanObjective = {
            id: o?.id ?? crypto.randomUUID(),
            title: text(f, 'objectiveTitle'),
            responsible: text(f, 'objectiveResponsible'),
            dueDate: text(f, 'objectiveDate'),
            target: Number(text(f, 'target')),
            measure: text(f, 'measure') as PlanObjective['measure'],
            caseIds: f.getAll('caseIds').map(String),
            resources: text(f, 'resources'),
            dependencies: text(f, 'dependencies'),
          }
          return execute({
            type: 'savePlan',
            id: plan?.id ?? crypto.randomUUID(),
            year,
            title: text(f, 'planTitle'),
            objectives: [
              ...(plan?.objectives.filter((v) => v.id !== objective.id) ?? []),
              objective,
            ],
            reason: text(f, 'reason'),
          })
        }}
      >
        <Field
          label='Título del plan'
          name='planTitle'
          value={plan?.title ?? `Plan anual VcM ${year}`}
          required
        />
        <Field
          label='Objetivo operativo'
          name='objectiveTitle'
          value={o?.title}
          required
        />
        <div className='grid gap-4 sm:grid-cols-2'>
          <Field
            label='Responsable del objetivo'
            name='objectiveResponsible'
            value={o?.responsible}
            required
          />
          <Field
            label='Plazo del objetivo'
            name='objectiveDate'
            type='date'
            value={o?.dueDate}
            required
          />
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          <Field
            label='Meta del objetivo'
            name='target'
            type='number'
            value={o ? String(o.target) : ''}
            required
          />
          <Field
            label='Medición del objetivo'
            name='measure'
            value={o?.measure ?? 'completed'}
          >
            <option value='completed'>Iniciativas ejecutadas</option>
            <option value='validated'>Expedientes elegibles y validados</option>
          </Field>
        </div>
        <p className='text-xs text-muted-foreground'>
          La meta es operativa y declarada; no sustituye un indicador
          institucional. Cada expediente cuenta una vez por objetivo. Los
          objetivos no se suman entre sí.
        </p>
        <fieldset className='grid gap-2'>
          <legend className='mb-2 text-sm font-medium'>
            Iniciativas vinculadas
          </legend>
          {cases.map((c) => (
            <label key={c.id} className='flex items-start gap-2 text-sm'>
              <input
                type='checkbox'
                name='caseIds'
                value={c.id}
                defaultChecked={o?.caseIds.includes(c.id)}
              />
              {c.name}
            </label>
          ))}
          {!cases.length && (
            <p className='text-sm'>
              Crea un expediente en Portafolio antes de preparar el plan.
            </p>
          )}
        </fieldset>
        <Field
          label='Necesidades de recursos'
          name='resources'
          value={o?.resources}
          multiline
        />
        <Field
          label='Dependencias y compromisos'
          name='dependencies'
          value={o?.dependencies}
          multiline
        />
        <Field
          label='Fuente y fundamento de la propuesta o cambio'
          name='reason'
          required
          multiline
        />
      </SaveForm>
    </details>
  )
}
function PlanTransition({ plan }: { plan: AnnualPlan }) {
  const { actor, execute } = useVcm()
  const options: AnnualPlan['status'][] = []
  if (plan.status === 'draft' && canOperate(actor.role)) options.push('review')
  if (plan.status === 'review' && actor.role === 'leadership')
    options.push('sanctioned')
  if (plan.status === 'sanctioned' && actor.role === 'direction')
    options.push('approved')
  if (plan.status !== 'draft') options.push('draft')
  if (!options.length)
    return (
      <p className='text-sm text-muted-foreground'>
        Continúa con el rol responsable de la siguiente revisión.
      </p>
    )
  return (
    <SaveForm
      label='Registrar resolución del plan'
      onSave={(f) =>
        execute({
          type: 'transitionPlan',
          id: plan.id,
          status: text(f, 'status') as AnnualPlan['status'],
          reason: text(f, 'planReason'),
        })
      }
    >
      <Field label='Resolución del plan' name='status'>
        {options.map((s) => (
          <option key={s} value={s}>
            {s === 'draft' ? 'Devolver a borrador' : PLAN_STATES[s]}
          </option>
        ))}
      </Field>
      <Field
        label='Fundamento de la resolución del plan'
        name='planReason'
        required
      />
      <p className='text-xs text-muted-foreground'>
        La aprobación queda registrada localmente; no envía ni publica
        información fuera de la plataforma.
      </p>
    </SaveForm>
  )
}
