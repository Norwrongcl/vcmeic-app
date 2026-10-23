import { text } from '../model/form-utils'
import type { Triage } from '../model/planning-types'
import type { Dossier } from '../model/types'
import { useVcm } from '../model/use-vcm'
import { canOperate } from '../model/workflow'
import { Field, Panel, SaveForm } from './primitives'

const TRIAGE_LABELS = {
  pending: 'Pendiente',
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
}
export function TriagePanel({ dossier: c }: { dossier: Dossier }) {
  const { data, actor, execute } = useVcm()
  const t = data.triage[c.id]
  return (
    <Panel
      title='Pertinencia y urgencia'
      description='Evaluación humana con fundamento. La confidencialidad regula el acceso; no añade prioridad. No hay puntajes institucionales inferidos.'
    >
      {t && (
        <p className='text-sm text-muted-foreground'>
          {t.reason} · {t.actor.name} · v{t.version}
        </p>
      )}
      <SaveForm
        key={t?.version ?? 0}
        draftKey={`${actor.id}:${c.id}:triage`}
        disabled={!canOperate(actor.role)}
        label='Guardar evaluación de prioridad'
        onSave={(f) =>
          execute({
            type: 'saveTriage',
            caseId: c.id,
            pertinence: text(f, 'pertinence') as Triage['pertinence'],
            urgency: text(f, 'urgency') as Triage['urgency'],
            reason: text(f, 'triageReason'),
          })
        }
      >
        <div className='grid gap-4 sm:grid-cols-2'>
          {(['pertinence', 'urgency'] as const).map((name) => (
            <Field
              key={name}
              label={
                name === 'pertinence'
                  ? 'Pertinencia institucional'
                  : 'Urgencia temporal'
              }
              name={name}
              value={t?.[name] ?? 'pending'}
            >
              {Object.entries(TRIAGE_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Field>
          ))}
        </div>
        <Field
          name='triageReason'
          label='Antecedentes y fundamento de la evaluación'
          required
          multiline
        />
      </SaveForm>
    </Panel>
  )
}
