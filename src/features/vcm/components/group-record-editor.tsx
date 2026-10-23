import { FIELD_STATUS_LABELS } from '../model/catalogs'
import { text } from '../model/form-utils'
import { blankField } from '../model/migration'
import type { Dossier, FieldDefinition, FieldStatus } from '../model/types'
import { useVcm } from '../model/use-vcm'
import { canOperate } from '../model/workflow'
import { Field, SaveForm } from './primitives'

export function GroupRecordEditor({
  dossier: c,
  definitions,
  group,
}: {
  dossier: Dossier
  definitions: FieldDefinition[]
  group: string
}) {
  const { actor, execute } = useVcm()
  const fields = definitions.filter(
    (f) =>
      f.group === group &&
      !['internalId', 'registrar'].includes(f.id) &&
      c.fields[f.id]?.status !== 'conflict' &&
      (!f.classification || canOperate(actor.role))
  )
  const displayValue = (def: FieldDefinition, value: string) =>
    ['startsAt', 'endsAt'].includes(def.id) && /^\d{4}-\d{2}-\d{2}/.test(value)
      ? value.slice(0, 10)
      : value
  const proposedStatus = (status: FieldStatus) =>
    actor.role === 'responsible' && status === 'confirmed' ? 'partial' : status
  return (
    <>
      <p className='text-xs text-muted-foreground'>
        Completa varios datos y guarda el grupo una vez. La fuente común se
        asociará a cada dato modificado. Los conflictos se resuelven en la
        edición individual. Los datos que no modifiques conservarán su valor y
        validación; los cambios del responsable quedarán pendientes de revisión.
      </p>
      <SaveForm
        draftKey={`${actor.id}:${c.id}:group:${group}`}
        disabled={
          !fields.length ||
          (!canOperate(actor.role) && actor.role !== 'responsible')
        }
        label='Guardar cambios del grupo'
        onSave={(f) => {
          const changes = fields.flatMap((def) => {
            const old = c.fields[def.id] ?? blankField()
            const entered = text(f, `value:${def.id}`)
            const value =
              entered === displayValue(def, old.value) ? old.value : entered
            const status = text(f, `status:${def.id}`) as FieldStatus
            return value !== old.value || status !== proposedStatus(old.status)
              ? [
                  {
                    fieldId: def.id,
                    value,
                    status,
                    source: text(f, 'groupSource'),
                    observation: old.observation,
                  },
                ]
              : []
          })
          if (!changes.length)
            throw new Error(
              'No hay cambios en este grupo. Completa o revisa un dato antes de guardar.'
            )
          return execute({ type: 'setFields', caseId: c.id, fields: changes })
        }}
      >
        {fields.map((def) => {
          const old = c.fields[def.id] ?? blankField()
          return (
            <div
              className='grid gap-3 rounded border p-3 sm:grid-cols-[minmax(0,1fr)_12rem]'
              key={def.id}
            >
              <Field
                label={def.label}
                name={`value:${def.id}`}
                value={displayValue(def, old.value)}
                type={
                  def.numeric
                    ? 'number'
                    : ['startsAt', 'endsAt'].includes(def.id) &&
                        (!old.value || /^\d{4}-\d{2}-\d{2}/.test(old.value))
                      ? 'date'
                      : 'text'
                }
                multiline={
                  !def.numeric && !['startsAt', 'endsAt'].includes(def.id)
                }
              />
              <Field
                label={`Estado propuesto al modificar · ${def.label}`}
                name={`status:${def.id}`}
                value={proposedStatus(old.status)}
              >
                {Object.entries(FIELD_STATUS_LABELS)
                  .filter(
                    ([id]) =>
                      id !== 'conflict' &&
                      (actor.role !== 'responsible' || id !== 'confirmed')
                  )
                  .map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
              </Field>
            </div>
          )
        })}
        <Field
          label='Fuente común de los datos modificados'
          name='groupSource'
          required
        />
      </SaveForm>
    </>
  )
}
