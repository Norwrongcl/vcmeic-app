import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CHARTER_FIELDS,
  campaignIsApproved,
  campaignIssues,
  contentIsApproved,
} from '../model/campaign-rules'
import { text } from '../model/form-utils'
import type { Content, Dossier } from '../model/types'
import { useVcm } from '../model/use-vcm'
import { canOperate } from '../model/workflow'
import { EmptyState, Field, Panel, SaveForm } from './primitives'
import { WeeklyPackageReview } from './weekly-package-review'

const charterFields = CHARTER_FIELDS
export function CommunicationsPanel({ dossier: c }: { dossier: Dossier }) {
  const { data, actor, execute } = useVcm()
  const campaign = data.campaigns[c.id]
  const contents = Object.values(data.contents).filter((p) => p.caseId === c.id)
  const [editing, setEditing] = useState<string | null>(null)
  const content = editing ? data.contents[editing] : undefined
  const writable = canOperate(actor.role)
  const editable = writable || actor.role === 'designer'
  return (
    <div className='grid gap-6'>
      <Panel
        title='Estrategia de campaña'
        description='Plan de campaña vinculado al expediente. Editar la estrategia invalida su aprobación y la de los contenidos asociados.'
      >
        <div className='flex flex-wrap gap-2'>
          <Badge
            variant='outline'
            className='max-w-full break-all whitespace-normal'
          >
            Código de campaña: {campaign?.id ?? 'Pendiente de crear'}
          </Badge>
          <Badge
            variant={campaignIsApproved(campaign) ? 'default' : 'secondary'}
          >
            {campaign
              ? campaignIsApproved(campaign)
                ? `Estrategia v${campaign.version} aprobada`
                : `Estrategia v${campaign.version} en revisión`
              : 'Sin estrategia aprobada'}
          </Badge>
        </div>
        {campaign && campaignIssues(campaign).length > 0 && (
          <p className='text-xs text-muted-foreground'>
            Completar para la revisión: {campaignIssues(campaign).join(', ')}.
          </p>
        )}
        <SaveForm
          draftKey={`${actor.id}:${c.id}:strategy`}
          key={campaign?.version ?? 0}
          disabled={!writable}
          label='Guardar estrategia para revisión'
          onSave={(f) =>
            execute({
              type: 'saveCampaign',
              caseId: c.id,
              ...(Object.fromEntries(
                Object.keys(charterFields).map((k) => [k, text(f, k)])
              ) as Omit<
                NonNullable<typeof campaign>,
                'id' | 'caseId' | 'version' | 'approvedVersion'
              >),
            })
          }
        >
          <div className='grid gap-4 md:grid-cols-2'>
            {Object.entries(charterFields).map(([key, label]) => (
              <Field
                key={key}
                name={key}
                label={label}
                value={campaign?.[key as keyof typeof charterFields] ?? ''}
                multiline
                required={key !== 'insight'}
              />
            ))}
          </div>
        </SaveForm>
        {campaign && !campaignIsApproved(campaign) ? (
          <SaveForm
            disabled={!writable}
            label='Aprobar estrategia / mandato'
            onSave={(f) =>
              execute({
                type: 'approveCampaign',
                caseId: c.id,
                reason: text(f, 'reason'),
              })
            }
          >
            <Field
              label='Fundamento de aprobación estratégica'
              name='reason'
              required
            />
          </SaveForm>
        ) : null}
      </Panel>
      <div className='grid gap-6 xl:grid-cols-2'>
        <Panel
          title='Calendario de contenidos'
          description='La aprobación conserva la versión exacta. Buffer está desconectado: no se programa ni publica.'
        >
          {contents
            .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
            .map((p) => (
              <div key={p.id} className='grid gap-3 rounded-lg border p-4'>
                <div className='flex flex-wrap justify-between gap-2'>
                  <strong>{p.title}</strong>
                  <Badge
                    variant={contentIsApproved(data, p) ? 'default' : 'outline'}
                  >
                    {contentIsApproved(data, p)
                      ? `Aprobado v${p.approvedVersion}`
                      : 'Requiere revisión'}
                  </Badge>
                </div>
                <p className='text-xs text-muted-foreground'>
                  {p.channel} · {p.scheduledAt} ·{' '}
                  {p.mode === 'weekly'
                    ? `Paquete: ${p.packageId}`
                    : 'Excepción intradía'}
                </p>
                <p className='text-sm whitespace-pre-wrap'>{p.copy}</p>
                <p className='text-xs text-muted-foreground'>
                  Publicación pendiente de integración.
                </p>
                {editable ? (
                  <Button variant='outline' onClick={() => setEditing(p.id)}>
                    Editar {p.title}
                  </Button>
                ) : null}
                {!contentIsApproved(data, p) ? (
                  p.mode === 'weekly' ? (
                    <WeeklyPackageReview
                      packageId={p.packageId ?? ''}
                      caseId={c.id}
                    />
                  ) : (
                    <SaveForm
                      disabled={!writable}
                      label='Aprobar excepción puntual'
                      onSave={(f) =>
                        execute({
                          type: 'approveContent',
                          caseId: c.id,
                          id: p.id,
                          reason: text(f, 'approvalReason'),
                        })
                      }
                    >
                      <Field
                        label={`Fundamento de aprobación · ${p.title}`}
                        name='approvalReason'
                        required
                      />
                    </SaveForm>
                  )
                ) : null}
              </div>
            ))}
          {!contents.length ? (
            <EmptyState>No hay contenidos asociados.</EmptyState>
          ) : null}
        </Panel>
        <Panel
          title={content ? 'Editar contenido' : 'Preparar contenido'}
          description='Brief, copy, canal y activo de una misma pieza. El paquete semanal cubre siete días a partir de su fecha inicial.'
        >
          {editing ? (
            <Button variant='ghost' onClick={() => setEditing(null)}>
              Cancelar edición y preparar otro
            </Button>
          ) : null}
          <SaveForm
            draftKey={`${actor.id}:${c.id}:content:${editing ?? 'new'}`}
            key={`${editing ?? 'new'}-${content?.version ?? 0}`}
            disabled={!editable}
            label={content ? 'Guardar nueva versión' : 'Guardar borrador local'}
            onSave={async (f) => {
              const ok = await execute({
                type: 'saveContent',
                caseId: c.id,
                id: editing ?? crypto.randomUUID(),
                title: text(f, 'title'),
                brief: text(f, 'brief'),
                copy: text(f, 'copy'),
                channel: text(f, 'channel'),
                scheduledAt: text(f, 'scheduledAt'),
                assetUrl: text(f, 'assetUrl'),
                mode: text(f, 'mode') as Content['mode'],
                packageId: text(f, 'packageId') || null,
              })
              if (ok) setEditing(null)
              return ok
            }}
          >
            <Field
              label='Título de la pieza'
              name='title'
              value={content?.title}
              required
            />
            <Field
              label='Brief de producción'
              name='brief'
              value={content?.brief}
              multiline
            />
            <Field label='Copy' name='copy' value={content?.copy} multiline />
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field label='Canal' name='channel' value={content?.channel}>
                <option>Instagram</option>
                <option>LinkedIn</option>
                <option>Otro</option>
              </Field>
              <Field
                label='Fecha propuesta'
                name='scheduledAt'
                type='date'
                value={content?.scheduledAt}
              />
              <Field
                label='Aprobación requerida'
                name='mode'
                value={content?.mode ?? 'weekly'}
              >
                <option value='weekly'>Paquete semanal</option>
                <option value='exception'>Excepción intradía</option>
              </Field>
              <Field
                label='Inicio del paquete semanal'
                name='packageId'
                type='date'
                value={content?.packageId ?? ''}
              />
            </div>
            <Field
              label='Enlace al activo final'
              name='assetUrl'
              type='url'
              value={content?.assetUrl}
            />
          </SaveForm>
        </Panel>
      </div>
    </div>
  )
}
