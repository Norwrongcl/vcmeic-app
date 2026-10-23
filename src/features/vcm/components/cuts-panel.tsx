import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/features/core/model/app-store'
import { text } from '../model/form-utils'
import { reportCuts } from '../model/report-export'
import type { InstitutionalCut } from '../model/types'
import { useVcm } from '../model/use-vcm'
import { canOperate, canRead, eligible } from '../model/workflow'
import { EmptyState, Field, Panel, SaveForm } from './primitives'

export function CutsPanel({ period }: { period?: number }) {
  const app = useAppStore((s) => s)
  const { data, actor, execute } = useVcm()
  const cases = Object.values(data.cases).filter((c) => canRead(c, actor))
  const eligibleCases = cases.filter((c) => eligible(data, c.id))
  const writable = canOperate(actor.role)
  const cuts =
    period === undefined
      ? Object.values(data.cuts).filter((cut) =>
          cut.caseIds.every(
            (id) => data.cases[id] && canRead(data.cases[id], actor)
          )
        )
      : reportCuts(app, actor, period)
  return (
    <div className='grid gap-6'>
      <Panel
        title='Preparar corte institucional'
        description={
          period === undefined
            ? 'La demo prepara el paquete local. El envío y la respuesta institucional no se simulan.'
            : `Cortes de ${period} y cortes sin año identificable, pendientes de conciliación. No se infiere su período.`
        }
      >
        <SaveForm
          draftKey={`${actor.id}:new-cut`}
          disabled={!writable || !eligibleCases.length}
          label='Crear corte local'
          onSave={(f) =>
            execute({
              type: 'createCut',
              id: crypto.randomUUID(),
              name: text(f, 'name'),
              period: text(f, 'period'),
              caseIds: f.getAll('caseIds').map(String),
            })
          }
        >
          <div className='grid gap-4 sm:grid-cols-2'>
            <Field label='Nombre del corte' name='name' required />
            <Field
              label='Período del corte'
              name='period'
              value={period === undefined ? '' : String(period)}
              required
            />
          </div>
          <fieldset className='grid gap-2'>
            <legend className='mb-2 text-sm font-medium'>
              Expedientes elegibles
            </legend>
            {eligibleCases.map((c) => (
              <label key={c.id} className='flex items-center gap-2 text-sm'>
                <input type='checkbox' name='caseIds' value={c.id} />
                {c.name}
              </label>
            ))}
            {!eligibleCases.length ? (
              <p className='text-sm text-muted-foreground'>
                No hay registros que superen las condiciones de cierre y
                validación.
              </p>
            ) : null}
          </fieldset>
        </SaveForm>
      </Panel>
      {cuts.map((cut) => (
        <Panel
          key={cut.id}
          title={cut.name}
          description={`${cut.period} · versión ${cut.version}`}
        >
          <Badge variant='outline'>
            {
              {
                draft: 'Borrador',
                review: 'En revisión',
                ready: 'Paquete preparado',
                closed: 'Respuesta registrada · cerrado',
              }[cut.status]
            }
          </Badge>
          <div className='grid gap-2'>
            {cut.caseIds.map((id) => (
              <Link
                className='text-sm text-primary underline'
                key={id}
                to='/portfolio/$caseId'
                params={{ caseId: id }}
              >
                {data.cases[id].name}
              </Link>
            ))}
          </div>
          {cut.response ? (
            <p className='rounded border p-3 text-sm'>
              Respuesta institucional: {cut.response}
            </p>
          ) : null}
          {cut.status !== 'closed' ? (
            <SaveForm
              draftKey={`${actor.id}:cut:${cut.id}:transition`}
              key={`${cut.version}-transition`}
              disabled={!writable}
              label='Actualizar corte'
              onSave={(f) =>
                execute({
                  type: 'transitionCut',
                  cutId: cut.id,
                  status: text(f, 'cutStatus') as InstitutionalCut['status'],
                  response: text(f, 'response'),
                })
              }
            >
              <Field label='Estado del corte' name='cutStatus'>
                {cut.status === 'draft' ? (
                  <option value='review'>Iniciar revisión</option>
                ) : cut.status === 'review' ? (
                  <option value='ready'>Preparar paquete</option>
                ) : (
                  <>
                    <option value='closed'>Registrar respuesta y cerrar</option>
                    <option value='review'>Volver a revisión</option>
                  </>
                )}
              </Field>
              <Field
                label='Respuesta de Casa Central y referencia documental'
                name='response'
                value={cut.response}
                multiline
              />
            </SaveForm>
          ) : null}
          <details>
            <summary className='cursor-pointer text-sm font-medium'>
              Observaciones y correcciones ({cut.observations.length})
            </summary>
            <div className='mt-4 grid gap-4'>
              {cut.observations.map((o) => (
                <div className='grid gap-2 rounded border p-4' key={o.id}>
                  <p className='text-sm'>{o.text}</p>
                  <p className='text-xs text-muted-foreground'>
                    {o.category} · {o.responsible} ·{' '}
                    {o.status === 'resolved' ? 'Resuelta' : 'Abierta'}
                  </p>
                  {o.resolution ? (
                    <p className='text-sm'>{o.resolution}</p>
                  ) : (
                    <SaveForm
                      draftKey={`${actor.id}:cut:${cut.id}:observation:${o.id}`}
                      disabled={!writable}
                      label='Registrar resolución'
                      onSave={(f) =>
                        execute({
                          type: 'resolveObservation',
                          caseId: o.caseId,
                          cutId: cut.id,
                          id: o.id,
                          resolution: text(f, 'resolution'),
                        })
                      }
                    >
                      <Field
                        label='Resolución y evidencia'
                        name='resolution'
                        required
                        multiline
                      />
                    </SaveForm>
                  )}
                </div>
              ))}
              <SaveForm
                draftKey={`${actor.id}:cut:${cut.id}:new-observation`}
                disabled={!writable}
                label='Registrar observación recibida'
                onSave={(f) =>
                  execute({
                    type: 'addObservation',
                    cutId: cut.id,
                    id: crypto.randomUUID(),
                    caseId: text(f, 'caseId'),
                    text: text(f, 'observation'),
                    category: text(f, 'category'),
                    responsible: text(f, 'responsible'),
                  })
                }
              >
                <Field label='Expediente observado' name='caseId'>
                  {cut.caseIds.map((id) => (
                    <option key={id} value={id}>
                      {data.cases[id].name}
                    </option>
                  ))}
                </Field>
                <Field
                  label='Texto original de la observación'
                  name='observation'
                  required
                  multiline
                />
                <Field label='Categoría' name='category'>
                  {[
                    'ERROR DE DATO',
                    'FALTA DE EVIDENCIA',
                    'INTERPRETACIÓN NORMATIVA',
                    'CATÁLOGO',
                    'DUPLICIDAD',
                    'METODOLOGÍA',
                    'REQUERIMIENTO NUEVO',
                    'OTRO',
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </Field>
                <Field
                  label='Responsable de resolver'
                  name='responsible'
                  required
                />
              </SaveForm>
            </div>
          </details>
        </Panel>
      ))}
      {!cuts.length ? (
        <EmptyState>No hay cortes institucionales preparados.</EmptyState>
      ) : null}
    </div>
  )
}
