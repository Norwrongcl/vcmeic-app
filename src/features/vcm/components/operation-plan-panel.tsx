import { useAppStore } from '@/features/core/model/app-store'
import { text } from '../model/form-utils'
import {
  hasOperationalMandate,
  OPERATION_FIELDS,
  operationPlanIssues,
} from '../model/operation-mandate'
import type { Dossier } from '../model/types'
import { useVcm } from '../model/use-vcm'
import { canOperate } from '../model/workflow'
import { Field, Panel, SaveForm } from './primitives'

export function OperationPlanPanel({ dossier: c }: { dossier: Dossier }) {
  const app = useAppStore((s) => s)
  const { actor, data, execute } = useVcm()
  const valid = hasOperationalMandate(app, c.id)
  const issues = operationPlanIssues(data, c.id)
  return (
    <Panel
      title='Plan de trabajo y mandato'
      description='Coordinación revisa el plan antes de activar la ejecución. Los datos pertenecen al expediente; las tareas e hitos permanecen en su proyecto.'
    >
      <p
        className={
          valid ? 'text-sm text-primary' : 'text-sm text-muted-foreground'
        }
      >
        {valid
          ? 'Plan aprobado y vigente para el alcance y presupuesto actuales.'
          : 'Plan pendiente de aprobación o con cambios que requieren nueva revisión.'}
      </p>
      {issues.length > 0 && (
        <p className='text-xs text-muted-foreground'>{issues.join(' ')}</p>
      )}
      <details>
        <summary className='cursor-pointer text-sm'>
          Preparar o actualizar el plan de trabajo
        </summary>
        <SaveForm
          key={c.version}
          draftKey={`${actor.id}:${c.id}:operation-plan`}
          disabled={!canOperate(actor.role)}
          label='Guardar antecedentes del plan'
          onSave={(f) => {
            const fields = OPERATION_FIELDS.filter(
              ([id]) => text(f, id) !== (c.fields[id]?.value ?? '')
            ).map(([fieldId]) => ({
              fieldId,
              value: text(f, fieldId),
              status: 'partial' as const,
              source: text(f, 'planSource'),
              observation: '',
            }))
            if (!fields.length)
              throw new Error('No hay cambios en los antecedentes del plan.')
            return execute({ type: 'setFields', caseId: c.id, fields })
          }}
        >
          {OPERATION_FIELDS.map(([id, label]) => (
            <Field
              key={id}
              label={label}
              name={id}
              value={c.fields[id]?.value}
              multiline
              required
            />
          ))}
          <p className='text-xs text-muted-foreground'>
            Si un aspecto no aplica, indícalo expresamente con su fundamento.
            Cambiar un dato confirmado conserva ambas versiones y exige resolver
            el conflicto en Registro y revisión.
          </p>
          <Field
            label='Fuente de los antecedentes del plan'
            name='planSource'
            required
          />
        </SaveForm>
      </details>
      <p className='text-sm'>
        Para aprobar: registra en Gobierno una decisión de tipo «Mandato / flujo
        operativo» y resuélvela con el rol autorizado. Los cambios de alcance,
        fechas, responsable, relaciones o presupuesto requieren una nueva
        aprobación.
      </p>
    </Panel>
  )
}
