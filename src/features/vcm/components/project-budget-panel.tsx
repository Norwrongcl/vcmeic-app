import { useState } from 'react'
import { useAppStore } from '@/features/core/model/app-store'
import { formatClp } from '@/features/events/model/formatters'
import { text } from '../model/form-utils'
import { projectFinance } from '../model/planning'
import type { Commitment } from '../model/planning-types'
import type { Dossier } from '../model/types'
import { useVcm } from '../model/use-vcm'
import { canOperate } from '../model/workflow'
import { EmptyState, Field, Panel, SaveForm } from './primitives'

export function ProjectBudgetPanel({ dossier: c }: { dossier: Dossier }) {
  const app = useAppStore((s) => s)
  const { actor, data, execute } = useVcm()
  const [selected, setSelected] = useState('new')
  const f = projectFinance(app, c.projectId!)
  const commitments = Object.values(data.commitments).filter(
    (v) => v.projectId === c.projectId
  )
  const commitment = commitments.find((v) => v.id === selected)
  const expenses = Object.values(app.expenses).filter(
    (e) => e.eventId === c.projectId
  )
  const decisions = Object.values(data.decisions).filter(
    (d) =>
      d.kind === 'budget' &&
      d.status === 'approved' &&
      d.decidedBy?.role === 'direction' &&
      data.cases[d.caseId]?.projectId === c.projectId
  )
  if (!['coordination', 'leadership', 'direction'].includes(actor.role))
    return null
  return (
    <Panel
      title='Compromisos, saldo y proyección'
      description='Registro de autorizaciones y compromisos humanos ya confirmados. No contrata proveedores, reserva fondos ni genera pagos externos.'
    >
      <dl className='grid grid-cols-2 gap-3 text-sm'>
        <dt>Financiamiento aprobado</dt>
        <dd>
          {f.hasFunding ? formatClp(f.approved) : 'Pendiente de aprobación'}
        </dd>
        <dt>Compromisos registrados (total)</dt>
        <dd>{formatClp(f.committed)}</dd>
        <dt>Gastos ejecutados registrados</dt>
        <dd>{formatClp(f.spent)}</dd>
        <dt>Comprometido pendiente de pago</dt>
        <dd>{formatClp(f.outstanding)}</dd>
        <dt>Saldo aprobado − ejecutado − pendiente</dt>
        <dd>
          {f.balance === null
            ? 'Sin financiamiento aprobado'
            : formatClp(f.balance)}
        </dd>
        <dt>Proyección total</dt>
        <dd>
          {f.projected === null
            ? 'Estimación pendiente'
            : formatClp(f.projected)}
        </dd>
        <dt>Desviación proyectada sobre lo aprobado</dt>
        <dd>{f.deviation === null ? 'Pendiente' : formatClp(f.deviation)}</dd>
      </dl>
      <p className='text-xs text-muted-foreground'>
        Proyección = ejecutado + compromisos pendientes de pago + estimación
        adicional aún no comprometida. Un pago conciliado reduce el pendiente;
        no se cuenta dos veces. Una desviación positiva supera el financiamiento
        aprobado.
      </p>
      {f.issues.length > 0 && (
        <div
          className='rounded border border-destructive p-3 text-sm'
          role='alert'
        >
          <strong>Conciliación pendiente</strong>
          {f.issues.map((issue, i) => (
            <p key={i}>{issue}</p>
          ))}
        </div>
      )}
      {commitments.map((v) => (
        <div className='rounded border p-3 text-sm' key={v.id}>
          <strong>{v.title}</strong>
          <p>
            {formatClp(v.amount)} ·{' '}
            {v.status === 'active' ? 'Activo' : 'Cancelado'} · Referencia:{' '}
            {v.reference} · v{v.version}
          </p>
          <p className='text-xs text-muted-foreground'>
            {v.reason} · {v.expenseIds.length} gastos vinculados
          </p>
        </div>
      ))}
      {!commitments.length && (
        <EmptyState>
          No hay compromisos registrados. El presupuesto planificado no equivale
          a gasto comprometido.
        </EmptyState>
      )}
      {canOperate(actor.role) && (
        <details className='rounded border p-4'>
          <summary className='cursor-pointer text-sm font-medium'>
            Registrar o conciliar compromiso
          </summary>
          <label className='my-3 grid gap-2 text-sm'>
            Compromiso
            <select
              className='w-full rounded border bg-background p-2'
              aria-label='Compromiso a editar'
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value='new'>Nuevo compromiso</option>
              {commitments.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </select>
          </label>
          <SaveForm
            key={`${selected}:${commitment?.version ?? 0}`}
            draftKey={`${actor.id}:${c.projectId}:commitment:${selected}`}
            label='Guardar compromiso y conciliación'
            onSave={(form) =>
              execute({
                type: 'saveCommitment',
                caseId: c.id,
                id: commitment?.id ?? crypto.randomUUID(),
                title: text(form, 'commitmentTitle'),
                amount: Number(text(form, 'commitmentAmount')),
                expenseIds: form.getAll('expenseIds').map(String),
                decisionId: text(form, 'decisionId'),
                reference: text(form, 'commitmentRef'),
                status: text(form, 'commitmentStatus') as Commitment['status'],
                reason: text(form, 'commitmentReason'),
              })
            }
          >
            <Field
              label='Descripción del compromiso'
              name='commitmentTitle'
              value={commitment?.title}
              required
            />
            <Field
              label='Monto total comprometido CLP'
              name='commitmentAmount'
              value={commitment ? String(commitment.amount) : ''}
              type='number'
              required
            />
            <Field
              label='Decisión presupuestaria autorizante'
              name='decisionId'
              value={commitment?.decisionId ?? ''}
              required
            >
              <option value=''>Seleccionar aprobación de Dirección</option>
              {decisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} · {formatClp(d.amount ?? 0)} · v{d.version}
                </option>
              ))}
              {commitment &&
                !decisions.some((d) => d.id === commitment.decisionId) && (
                  <option value={commitment.decisionId}>
                    Autorización anterior · requiere revisión
                  </option>
                )}
            </Field>
            <Field
              label='Referencia de autorización o documento'
              name='commitmentRef'
              value={commitment?.reference}
              required
            />
            <Field
              label='Estado del compromiso'
              name='commitmentStatus'
              value={commitment?.status ?? 'active'}
            >
              <option value='active'>Activo</option>
              <option value='cancelled'>Cancelado</option>
            </Field>
            <fieldset className='grid gap-2'>
              <legend className='mb-2 text-sm font-medium'>
                Pagos registrados que corresponden a este compromiso
              </legend>
              {expenses.map((e) => (
                <label className='flex items-start gap-2 text-sm' key={e.id}>
                  <input
                    name='expenseIds'
                    type='checkbox'
                    value={e.id}
                    defaultChecked={commitment?.expenseIds.includes(e.id)}
                  />
                  {e.concept} · {formatClp(e.amount)} ·{' '}
                  {e.reference || 'Sin referencia'}
                </label>
              ))}
              {!expenses.length && (
                <p className='text-xs text-muted-foreground'>
                  Registra los pagos en las finanzas del proyecto para
                  conciliarlos aquí.
                </p>
              )}
            </fieldset>
            <Field
              label='Fuente y fundamento del compromiso o conciliación'
              name='commitmentReason'
              multiline
              required
            />
          </SaveForm>
        </details>
      )}
      {f.forecast && (
        <p className='text-xs text-muted-foreground'>
          Estimación adicional: {formatClp(f.forecast.remaining)} ·{' '}
          {f.forecast.reason} · {f.forecast.actor.name} ·{' '}
          {new Date(f.forecast.at).toLocaleDateString('es-CL')}. Revisa la
          estimación al registrar nuevos gastos o compromisos.
        </p>
      )}
      {canOperate(actor.role) && (
        <details className='rounded border p-4'>
          <summary className='cursor-pointer text-sm font-medium'>
            Actualizar estimación de cierre
          </summary>
          <SaveForm
            key={f.forecast?.version ?? 0}
            draftKey={`${actor.id}:${c.projectId}:forecast`}
            label='Guardar estimación de cierre'
            onSave={(form) =>
              execute({
                type: 'saveForecast',
                caseId: c.id,
                remaining: Number(text(form, 'remaining')),
                reason: text(form, 'forecastReason'),
              })
            }
          >
            <Field
              label='Gasto adicional aún no comprometido CLP'
              name='remaining'
              type='number'
              value={f.forecast ? String(f.forecast.remaining) : ''}
              required
            />
            <Field
              label='Base y supuestos de la estimación'
              name='forecastReason'
              multiline
              required
            />
          </SaveForm>
        </details>
      )}
    </Panel>
  )
}
