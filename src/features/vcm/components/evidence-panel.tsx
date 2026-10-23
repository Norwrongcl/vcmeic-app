import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { text } from '../model/form-utils'
import type { Dossier } from '../model/types'
import { webUrl } from '../model/urls'
import { useVcm } from '../model/use-vcm'
import { canOperate } from '../model/workflow'
import { EmptyState, Field, Panel, SaveForm } from './primitives'

export function EvidencePanel({ dossier: c }: { dossier: Dossier }) {
  const { data, actor, execute } = useVcm()
  const evidences = Object.values(data.evidences).filter(
    (e) => e.caseId === c.id
  )
  return (
    <div className='grid gap-6 lg:grid-cols-2'>
      <Panel
        title='Evidencia del expediente'
        description='Referencias documentales. Los archivos originales permanecerán en Drive cuando se habilite la integración.'
      >
        {evidences.map((e) => (
          <div key={e.id} className='grid gap-2 rounded-lg border p-4'>
            {webUrl(e.url) ? (
              <a
                className='flex items-center gap-2 text-sm font-medium break-all text-primary underline'
                href={webUrl(e.url)!}
                target='_blank'
                rel='noreferrer'
              >
                {e.name}
                <ExternalLink className='size-3 shrink-0' />
              </a>
            ) : (
              <div>
                <p className='text-sm font-medium'>{e.name}</p>
                <p className='text-xs break-all text-muted-foreground'>
                  Referencia heredada conservada: {e.url}
                </p>
              </div>
            )}
            <div>
              <Badge variant={e.verified ? 'default' : 'outline'}>
                {e.verified ? 'Revisada manualmente' : 'Pendiente de revisión'}
              </Badge>
            </div>
            <p className='text-xs text-muted-foreground'>
              Versión {e.version} · {data.sources[e.sourceId]?.name} · hereda la
              confidencialidad del expediente
            </p>
            {canOperate(actor.role) ? (
              <details>
                <summary className='cursor-pointer text-sm font-medium'>
                  Revisar referencia existente
                </summary>
                <div className='mt-3'>
                  <SaveForm
                    draftKey={`${actor.id}:${c.id}:evidence:${e.id}`}
                    key={e.version}
                    label='Guardar revisión de evidencia'
                    onSave={(f) =>
                      execute({
                        type: 'reviewEvidence',
                        caseId: c.id,
                        id: e.id,
                        name: text(f, 'reviewName'),
                        url: text(f, 'reviewUrl'),
                        verified: f.get('reviewVerified') === 'on',
                        reason: text(f, 'reviewReason'),
                      })
                    }
                  >
                    <Field
                      label={`Nombre revisado · ${e.name}`}
                      name='reviewName'
                      value={e.name}
                      required
                    />
                    <Field
                      label={`Referencia revisada · ${e.name}`}
                      name='reviewUrl'
                      value={e.url}
                      required
                    />
                    <Field
                      label={`Fundamento de revisión · ${e.name}`}
                      name='reviewReason'
                      required
                      multiline
                    />
                    <label className='flex items-center gap-2 text-sm'>
                      <input
                        name='reviewVerified'
                        type='checkbox'
                        defaultChecked={e.verified}
                      />
                      He comprobado manualmente la evidencia.
                    </label>
                  </SaveForm>
                </div>
              </details>
            ) : null}
          </div>
        ))}
        {!evidences.length ? (
          <EmptyState>Aún no hay evidencias vinculadas.</EmptyState>
        ) : null}
      </Panel>
      <Panel
        title='Vincular evidencia'
        description='Agregar un enlace no comprueba su contenido. Marca revisión solo después de comprobar manualmente el respaldo.'
      >
        <SaveForm
          draftKey={`${actor.id}:${c.id}:new-evidence`}
          disabled={!canOperate(actor.role)}
          label='Vincular referencia'
          onSave={(f) =>
            execute({
              type: 'addEvidence',
              caseId: c.id,
              id: crypto.randomUUID(),
              name: text(f, 'name'),
              url: text(f, 'url'),
              verified: f.get('verified') === 'on',
            })
          }
        >
          <Field label='Nombre del documento' name='name' required />
          <Field label='Enlace al original' name='url' type='url' required />
          <label className='flex items-start gap-2 text-sm'>
            <input name='verified' type='checkbox' className='mt-1' />
            He revisado manualmente que el documento sustenta este expediente.
          </label>
        </SaveForm>
        <p className='text-xs text-muted-foreground'>
          Sin carga de archivos ni verificación remota en esta etapa.
        </p>
      </Panel>
    </div>
  )
}
