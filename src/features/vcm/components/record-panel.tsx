import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ACTIVITY_FIELDS,
  FIELD_STATUS_LABELS,
  fieldsFor,
  STATE_LABELS,
  TRANSITIONS,
} from '../model/catalogs'
import { text } from '../model/form-utils'
import { blankField } from '../model/migration'
import { downloadText, mirrorCsv } from '../model/mirror'
import type { CaseState, Dossier, FieldStatus } from '../model/types'
import { useVcm } from '../model/use-vcm'
import { canOperate, getQaIssues } from '../model/workflow'
import { GroupRecordEditor } from './group-record-editor'
import { EmptyState, Field, Panel, SaveForm } from './primitives'

export function RecordPanel({
  dossier: c,
  initialField,
  onNavigate,
}: {
  dossier: Dossier
  initialField?: string
  onNavigate?: (tab: string) => void
}) {
  const { data, actor, execute } = useVcm()
  const definitions = fieldsFor(c.kind)
  const groups = [...new Set(definitions.map((f) => f.group))].filter(
    (g) => g !== 'Control'
  )
  const [group, setGroup] = useState(
    definitions.find((f) => f.id === initialField)?.group ?? groups[0]
  )
  const [selected, setSelected] = useState(
    initialField && definitions.some((f) => f.id === initialField)
      ? initialField
      : 'name'
  )
  const [mode, setMode] = useState('single')
  function goToField(id: string) {
    const def = definitions.find((f) => f.id === id)
    if (!def) return
    setGroup(def.group)
    setSelected(id)
    setMode('single')
    requestAnimationFrame(() =>
      document
        .querySelector<
          HTMLInputElement | HTMLTextAreaElement
        >('form [name="value"]')
        ?.focus()
    )
  }
  const definition =
    definitions.find((f) => f.id === selected) ?? definitions[0]
  const field = c.fields[definition.id] ?? blankField()
  const available = definitions.filter(
    (f) => f.group === group && !['internalId', 'registrar'].includes(f.id)
  )
  const changeGroup = (value: string) => {
    setGroup(value)
    setSelected(
      definitions.find(
        (f) => f.group === value && !['internalId', 'registrar'].includes(f.id)
      )?.id ?? 'name'
    )
  }
  const readOnly = !canOperate(actor.role) && actor.role !== 'responsible'
  const issues = getQaIssues(data, c.id)
  return (
    <div className='grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]'>
      <Panel
        title={
          c.kind === 'presence'
            ? 'Registro de presencia'
            : 'Registro de actividad · 49 campos'
        }
        description='Valor, fuente, estado y observación por dato. La información factual y la clasificación institucional se revisan por separado.'
      >
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            size='sm'
            variant={mode === 'single' ? 'default' : 'outline'}
            onClick={() => setMode('single')}
          >
            Editar un dato
          </Button>
          <Button
            type='button'
            size='sm'
            variant={mode === 'group' ? 'default' : 'outline'}
            onClick={() => setMode('group')}
          >
            Editar grupo completo
          </Button>
          <Button
            type='button'
            size='sm'
            variant='ghost'
            onClick={() => {
              const next = definitions.find(
                (f) =>
                  f.group !== 'Control' &&
                  c.fields[f.id]?.status !== 'confirmed' &&
                  (!f.classification || canOperate(actor.role)) &&
                  f.id !== selected
              )
              if (next) goToField(next.id)
            }}
          >
            Ir a otro dato pendiente
          </Button>
        </div>
        <p className='text-xs text-muted-foreground'>
          {
            definitions.filter(
              (f) =>
                f.group !== 'Control' && c.fields[f.id]?.status === 'confirmed'
            ).length
          }{' '}
          de {definitions.filter((f) => f.group !== 'Control').length} datos
          confirmados. Los datos planificados y reales se revisan en sus
          respectivos grupos.
        </p>
        <div className='grid gap-3 sm:grid-cols-2'>
          <label className='grid gap-2 text-sm'>
            Grupo
            <select
              aria-label='Grupo'
              className='rounded border bg-background p-2'
              value={group}
              onChange={(e) => changeGroup(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          {mode === 'single' && (
            <label className='grid gap-2 text-sm'>
              Campo
              <select
                aria-label='Campo del registro'
                className='min-w-0 rounded border bg-background p-2'
                value={definition.id}
                onChange={(e) => setSelected(e.target.value)}
              >
                {available.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {mode === 'group' ? (
          <GroupRecordEditor
            key={`${group}:${c.version}`}
            dossier={c}
            definitions={definitions}
            group={group}
          />
        ) : (
          <>
            <div className='flex flex-wrap gap-2 text-xs'>
              <Badge
                variant={
                  field.status === 'conflict' ? 'destructive' : 'outline'
                }
              >
                {FIELD_STATUS_LABELS[field.status]}
              </Badge>
              {definition.classification ? (
                <Badge variant='secondary'>
                  Revisión institucional de Coordinación
                </Badge>
              ) : null}
            </div>
            {definition.classification && !canOperate(actor.role) && (
              <p className='text-xs text-muted-foreground'>
                Esta clasificación requiere revisión de Coordinación. Puedes
                aportar antecedentes en los otros grupos.
              </p>
            )}
            <SaveForm
              draftKey={`${actor.id}:${c.id}:field:${definition.id}`}
              key={`${c.version}-${definition.id}`}
              disabled={
                readOnly ||
                (definition.classification && !canOperate(actor.role)) ||
                ['internalId', 'registrar'].includes(definition.id)
              }
              onSave={(f) => {
                if (
                  actor.role === 'responsible' &&
                  field.status === 'confirmed' &&
                  text(f, 'value') === field.value &&
                  text(f, 'status') === 'partial'
                )
                  throw new Error(
                    'Este dato ya está confirmado y no cambió. Edita su valor si necesitas aportar una corrección; conservará ambas fuentes para revisión.'
                  )
                return execute({
                  type: 'setField',
                  caseId: c.id,
                  fieldId: definition.id,
                  value: text(f, 'value'),
                  status: text(f, 'status') as FieldStatus,
                  source: text(f, 'source'),
                  observation: text(f, 'observation'),
                })
              }}
            >
              <Field
                label={definition.label}
                name='value'
                value={field.value}
                multiline={
                  !definition.numeric &&
                  !['startsAt', 'endsAt'].includes(definition.id)
                }
                type={definition.numeric ? 'number' : 'text'}
              />
              <div className='grid gap-4 sm:grid-cols-2'>
                <Field
                  label='Estado propuesto'
                  name='status'
                  value={
                    field.status === 'conflict' ||
                    (actor.role === 'responsible' &&
                      field.status === 'confirmed')
                      ? 'partial'
                      : field.status
                  }
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
                <Field
                  label='Fuente del dato'
                  name='source'
                  required
                  defaultValue='Revisión manual de antecedentes'
                />
              </div>
              <Field
                label='Observación'
                name='observation'
                value={field.observation}
                multiline
              />
            </SaveForm>
            {field.status === 'conflict' ? (
              <Panel
                title='Fuentes en conflicto'
                description='Se conservan ambas versiones. El nuevo valor no sustituye silenciosamente al anterior.'
              >
                {field.candidates.map((v, i) => (
                  <p key={i} className='rounded border p-3 text-sm'>
                    <strong>{v.value || '(vacío)'}</strong>
                    <span className='block text-xs text-muted-foreground'>
                      {data.sources[v.sourceId]?.name ?? v.sourceId}
                    </span>
                  </p>
                ))}
                <SaveForm
                  draftKey={`${actor.id}:${c.id}:resolve:${definition.id}`}
                  disabled={!canOperate(actor.role)}
                  label='Resolver con fundamento'
                  onSave={(f) =>
                    execute({
                      type: 'resolveField',
                      caseId: c.id,
                      fieldId: definition.id,
                      value: text(f, 'resolvedValue'),
                      reason: text(f, 'reason'),
                    })
                  }
                >
                  <Field label='Valor conservado' name='resolvedValue'>
                    {[...new Set(field.candidates.map((v) => v.value))].map(
                      (v) => (
                        <option key={v} value={v}>
                          {v || '(vacío)'}
                        </option>
                      )
                    )}
                  </Field>
                  <Field
                    label='Fundamento de resolución'
                    name='reason'
                    required
                    multiline
                  />
                </SaveForm>
              </Panel>
            ) : null}
          </>
        )}
        <details>
          <summary className='cursor-pointer text-sm font-medium'>
            Ver matriz completa y procedencia
          </summary>
          <div className='mt-4 overflow-auto'>
            <table className='w-full text-left text-xs'>
              <thead>
                <tr>
                  <th className='p-2'>Campo</th>
                  <th className='p-2'>Valor</th>
                  <th className='p-2'>Estado / fuente</th>
                </tr>
              </thead>
              <tbody>
                {definitions.map((def) => {
                  const f = c.fields[def.id] ?? blankField()
                  return (
                    <tr key={def.id} className='border-t'>
                      <td className='p-2'>{def.label}</td>
                      <td className='max-w-48 p-2 break-words'>
                        {f.value || '—'}
                      </td>
                      <td className='p-2'>
                        {FIELD_STATUS_LABELS[f.status]}
                        <span className='block text-muted-foreground'>
                          {f.sourceIds
                            .map((id) => data.sources[id]?.name)
                            .filter(Boolean)
                            .join('; ')}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </details>
        {c.kind !== 'presence' ? (
          <p className='text-xs text-muted-foreground'>
            Los {ACTIVITY_FIELDS.length} campos espejo se complementan con
            resultados, ubicación y plan de trabajo, sin alterar el formato
            institucional.
          </p>
        ) : null}
      </Panel>
      <div className='grid content-start gap-6'>
        <Panel
          title='Qué falta y cómo continuar'
          description='Empieza por los antecedentes y la evidencia; Coordinación revisa la clasificación y validación. Los resultados reales se completan al finalizar la ejecución.'
        >
          {issues.length ? (
            <ul className='grid list-disc gap-2 ps-4 text-sm text-muted-foreground'>
              {issues.map((issue) => {
                const def = definitions.find(
                  (f) => issue === `Confirmar ${f.label}.`
                )
                const target = issue.includes('evidencia')
                  ? 'evidence'
                  : issue.includes('proyecto')
                    ? 'operation'
                    : issue.includes('decisiones')
                      ? 'governance'
                      : issue.includes('tipología')
                        ? 'summary'
                        : null
                return (
                  <li key={issue}>
                    {issue}{' '}
                    {def ? (
                      <Button
                        type='button'
                        variant='link'
                        className='h-auto max-w-full min-w-0 justify-start text-left break-words whitespace-normal'
                        size='sm'
                        onClick={() => goToField(def.id)}
                      >
                        Revisar {def.label}
                      </Button>
                    ) : target ? (
                      <Button
                        type='button'
                        variant='link'
                        className='h-auto max-w-full min-w-0 justify-start text-left break-words whitespace-normal'
                        size='sm'
                        onClick={() => onNavigate?.(target)}
                      >
                        Abrir{' '}
                        {target === 'evidence'
                          ? 'evidencias'
                          : target === 'operation'
                            ? 'operación'
                            : target === 'summary'
                              ? 'clasificación'
                              : 'decisiones'}
                      </Button>
                    ) : issue.includes('conflictos') ? (
                      <span className='block'>
                        {definitions
                          .filter((f) => c.fields[f.id]?.status === 'conflict')
                          .map((f) => (
                            <Button
                              key={f.id}
                              type='button'
                              variant='link'
                              className='h-auto max-w-full min-w-0 justify-start text-left break-words whitespace-normal'
                              size='sm'
                              onClick={() => goToField(f.id)}
                            >
                              Resolver {f.label}
                            </Button>
                          ))}
                      </span>
                    ) : issue.includes('fecha de cierre') ? (
                      <Button
                        type='button'
                        variant='link'
                        className='h-auto max-w-full min-w-0 justify-start text-left break-words whitespace-normal'
                        size='sm'
                        onClick={() => goToField('endsAt')}
                      >
                        Corregir fechas
                      </Button>
                    ) : (
                      <Link
                        className='block text-xs text-primary underline'
                        to='/control'
                        search={{ view: 'cuts' }}
                      >
                        Resolver observaciones en el corte institucional
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className='text-sm font-medium text-emerald-700 dark:text-emerald-300'>
              Completitud, evidencia y coherencia verificadas para el cierre
              local.
            </p>
          )}
        </Panel>
        <Panel
          title='Revisión y avance del expediente'
          description='Validación EIC y validación posterior de Casa Central son procesos distintos.'
        >
          {TRANSITIONS[c.state].length ? (
            <SaveForm
              draftKey={`${actor.id}:${c.id}:transition:${c.state}`}
              key={c.state}
              disabled={!canOperate(actor.role)}
              label='Actualizar estado del expediente'
              onSave={(f) =>
                execute({
                  type: 'transition',
                  caseId: c.id,
                  state: text(f, 'state') as CaseState,
                  reason: text(f, 'reason'),
                })
              }
            >
              <Field label='Siguiente estado' name='state'>
                {TRANSITIONS[c.state].map((s) => (
                  <option key={s} value={s}>
                    {STATE_LABELS[s]}
                  </option>
                ))}
              </Field>
              <Field label='Fundamento' name='reason' required multiline />
            </SaveForm>
          ) : (
            <EmptyState>No hay transiciones disponibles.</EmptyState>
          )}
          <Button
            variant='outline'
            onClick={() =>
              downloadText(mirrorCsv(c), `vcm-espejo-${c.code}.csv`)
            }
          >
            Exportar planilla espejo CSV
          </Button>
          <Button variant='outline' onClick={() => window.print()}>
            Imprimir resumen para revisión
          </Button>
        </Panel>
      </div>
    </div>
  )
}
