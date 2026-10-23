import { Badge } from '@/components/ui/badge'
import { formatClp } from '@/features/events/model/formatters'
import { DECISION_LABELS, decisionAuthority } from '../model/decisions'
import { text } from '../model/form-utils'
import type { Decision, Dossier } from '../model/types'
import { decisionOptions } from '../model/usability'
import { useVcm } from '../model/use-vcm'
import { canOperate } from '../model/workflow'
import { EmptyState, Field, Panel, SaveForm } from './primitives'
import { TriagePanel } from './triage-panel'

export function GovernancePanel({ dossier: c }: { dossier: Dossier }) {
  const { data, actor, execute } = useVcm()
  const decisions = Object.values(data.decisions).filter(
    (d) => d.caseId === c.id
  )
  return (
    <div className='grid gap-6 xl:grid-cols-2'>
      <TriagePanel dossier={c} />
      <Panel
        title='Decisiones y aprobaciones'
        description='El mandato operativo, presupuesto y excepciones conservan su propia decisión humana.'
      >
        {decisions.map((d) => {
          const options = decisionOptions(d, actor.role)
          return (
            <div key={d.id} className='grid gap-3 rounded-lg border p-4'>
              <div className='flex flex-wrap justify-between gap-2'>
                <strong className='text-sm'>{d.title}</strong>
                <Badge variant='outline'>{DECISION_LABELS[d.status]}</Badge>
              </div>
              <p className='text-sm text-muted-foreground'>{d.reason}</p>
              <p className='text-xs text-muted-foreground'>
                Alternativas: {d.alternatives || 'Sin informar'} · Impacto:{' '}
                {d.impact || 'Sin informar'}
              </p>
              {d.amount !== null ? (
                <p className='text-sm'>
                  {formatClp(d.amount)} ·{' '}
                  {d.status === 'approved'
                    ? 'monto aprobado'
                    : 'propuesta presupuestaria'}
                </p>
              ) : null}
              <p className='text-xs text-muted-foreground'>
                v{d.version} · {d.decidedBy?.name ?? d.requestedBy.name}
              </p>
              {options.length ? (
                <SaveForm
                  draftKey={`${actor.id}:${c.id}:decision:${d.id}`}
                  key={d.version}
                  disabled={
                    !canOperate(actor.role) && actor.role !== 'direction'
                  }
                  label='Registrar decisión'
                  onSave={(f) =>
                    execute({
                      type: 'decide',
                      caseId: c.id,
                      id: d.id,
                      status: text(f, 'decisionStatus') as Decision['status'],
                      reason: text(f, 'decisionReason'),
                    })
                  }
                >
                  <Field label='Resolución' name='decisionStatus'>
                    {options.map((status) => (
                      <option key={status} value={status}>
                        {status === 'approved'
                          ? 'Aprobar'
                          : status === 'returned'
                            ? 'Devolver para ajuste'
                            : status === 'escalated'
                              ? 'Escalar'
                              : DECISION_LABELS[status]}
                      </option>
                    ))}
                  </Field>
                  <Field
                    label='Fundamento de la resolución'
                    name='decisionReason'
                    required
                  />
                </SaveForm>
              ) : (
                <p className='text-sm text-muted-foreground'>
                  {d.status === 'closed'
                    ? 'Decisión cerrada.'
                    : `Autoridad para resolver: ${{ coordination: 'Coordinación', leadership: 'Jefatura', direction: 'Dirección' }[decisionAuthority(d)]}. Cambia al rol correspondiente para continuar.`}
                </p>
              )}
              {d.kind === 'budget' &&
                actor.role !== 'direction' &&
                options.length > 0 && (
                  <p className='text-xs text-muted-foreground'>
                    La aprobación del presupuesto corresponde a Dirección.
                    {options.includes('escalated')
                      ? 'Puedes devolver o escalar la propuesta.'
                      : 'Puedes solicitar un ajuste de la autorización.'}
                  </p>
                )}
            </div>
          )
        })}
        {!decisions.length ? (
          <EmptyState>No hay decisiones registradas.</EmptyState>
        ) : null}
      </Panel>
      <Panel
        title='Proponer decisión'
        description='Dirección aprueba presupuesto; Jefatura resuelve excepciones escaladas. No se compromete gasto desde esta demo.'
      >
        <SaveForm
          draftKey={`${actor.id}:${c.id}:new-decision`}
          disabled={!canOperate(actor.role)}
          label='Enviar a revisión local'
          onSave={(f) =>
            execute({
              type: 'proposeDecision',
              caseId: c.id,
              id: crypto.randomUUID(),
              title: text(f, 'title'),
              kind: text(f, 'kind') as Decision['kind'],
              amount: text(f, 'amount') ? Number(text(f, 'amount')) : null,
              authority: text(f, 'authority') as Decision['authority'],
              alternatives: text(f, 'alternatives'),
              impact: text(f, 'impact'),
              reason: text(f, 'reason'),
            })
          }
        >
          <Field label='Asunto' name='title' required />
          <Field label='Tipo' name='kind'>
            <option value='flow'>Mandato / flujo operativo</option>
            <option value='priority'>Prioridad</option>
            <option value='budget'>Presupuesto</option>
            <option value='exception'>Excepción</option>
          </Field>
          <Field label='Autoridad requerida' name='authority'>
            <option value='coordination'>Coordinación</option>
            <option value='leadership'>Jefatura</option>
            <option value='direction'>Dirección</option>
          </Field>
          <p className='text-xs text-muted-foreground'>
            Las propuestas presupuestarias requieren siempre Dirección.
          </p>
          <Field
            label='Alternativas consideradas'
            name='alternatives'
            multiline
          />
          <Field
            label='Impacto y compromisos asociados'
            name='impact'
            multiline
          />
          <Field
            label='Monto propuesto CLP (si aplica)'
            name='amount'
            type='number'
          />
          <Field
            label='Fundamento y antecedentes'
            name='reason'
            multiline
            required
          />
        </SaveForm>
      </Panel>
    </div>
  )
}
