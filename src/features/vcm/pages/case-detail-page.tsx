import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore } from '@/features/core/model/app-store'
import { EventFinances } from '@/features/events/components/event-finances'
import { CommunicationsPanel } from '../components/communications-panel'
import { EvidencePanel } from '../components/evidence-panel'
import { FinanceSummary } from '../components/finance-summary'
import { GovernancePanel } from '../components/governance-panel'
import { IndicatorsPanel } from '../components/indicators-panel'
import { OperationPlanPanel } from '../components/operation-plan-panel'
import {
  EmptyState,
  Field,
  Panel,
  SaveForm,
  StateBadge,
} from '../components/primitives'
import { ProjectBudgetPanel } from '../components/project-budget-panel'
import { ProjectOperations } from '../components/project-operations'
import { RecordPanel } from '../components/record-panel'
import { VcmShell } from '../components/shell'
import { KIND_LABELS, PORTFOLIOS, PRESENCE_TYPES } from '../model/catalogs'
import { text } from '../model/form-utils'
import type { Dossier } from '../model/types'
import { useVcm } from '../model/use-vcm'
import { canOperate, canRead } from '../model/workflow'

export function CaseDetailPage({
  caseId,
  initialTab = 'summary',
  initialField,
}: {
  caseId: string
  initialTab?: string
  initialField?: string
}) {
  const [tab, setTab] = useState(initialTab)
  const { data, actor, execute } = useVcm()
  const c = data.cases[caseId]
  const tasks = useAppStore((s) => s.tasks)
  const partners = useAppStore((s) => s.partners)
  const agreements = useAppStore((s) => s.agreements)
  if (!c || !canRead(c, actor))
    return (
      <VcmShell
        key={actor.id}
        title='Expediente no disponible'
        description='El identificador no existe o este rol de demostración no tiene acceso.'
      >
        <Button asChild variant='outline'>
          <Link to='/portfolio'>Volver al portafolio</Link>
        </Button>
      </VcmShell>
    )
  const writable = canOperate(actor.role)
  const tabs = [
    ['summary', 'Resumen'],
    ['record', 'Registro y revisión'],
    ['operation', 'Operación'],
    ['evidence', 'Evidencias'],
    ['communications', 'Comunicación'],
    ['governance', 'Gobierno'],
    ['indicators', 'Indicadores'],
    ['history', 'Historial'],
  ]
  return (
    <VcmShell
      key={actor.id}
      title={c.name}
      description={`${c.code} · ${KIND_LABELS[c.kind]} · Ficha 360 · versión ${c.version}`}
      actions={
        <Button asChild variant='outline'>
          <Link to='/portfolio'>Volver al portafolio</Link>
        </Button>
      }
    >
      <div className='flex flex-wrap gap-2'>
        <StateBadge state={c.state} />
        <Badge variant='outline'>
          {c.confidentiality === 'sensitive'
            ? 'Sensible'
            : c.confidentiality === 'restricted'
              ? 'Restringido'
              : 'Interno'}
        </Badge>
        <Badge variant='outline'>
          Validación institucional:{' '}
          {c.institutionalValidation === 'validated'
            ? 'registrada'
            : c.institutionalValidation === 'observed'
              ? 'con observaciones'
              : 'pendiente'}
        </Badge>
      </div>
      <Tabs value={tab} onValueChange={setTab} className='min-w-0'>
        <div className='overflow-x-auto pb-2'>
          <TabsList className='w-max'>
            {tabs.map(([id, label]) => (
              <TabsTrigger value={id} key={id}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value='summary' className='space-y-6'>
          <div className='grid gap-6 lg:grid-cols-2'>
            <Panel title='Contexto del expediente'>
              <p className='text-sm whitespace-pre-wrap'>
                {c.fields.description?.value || 'Descripción pendiente.'}
              </p>
              <dl className='grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm'>
                <dt className='text-muted-foreground'>Responsable</dt>
                <dd>{c.responsible}</dd>
                <dt className='text-muted-foreground'>Portafolio</dt>
                <dd>{c.portfolio || 'Por definir'}</dd>
                <dt className='text-muted-foreground'>Temporalidad</dt>
                <dd>
                  {c.fields.startsAt?.value || 'Pendiente'} →{' '}
                  {c.fields.endsAt?.value || 'Pendiente'}
                </dd>
                <dt className='text-muted-foreground'>Proyecto operativo</dt>
                <dd>{c.projectId ?? 'No requiere ejecución activa'}</dd>
                <dt className='text-muted-foreground'>Origen</dt>
                <dd>
                  {c.legacyId
                    ? 'Migrado · datos originales conservados'
                    : 'Ingreso manual local'}
                </dd>
              </dl>
              <p className='text-xs text-muted-foreground'>
                Hermes podrá aportar y consultar estos datos mediante el futuro
                backend. No hay conexión en esta demostración.
              </p>
            </Panel>
            <Panel
              title='Prioridad, acceso y clasificación'
              description='La confidencialidad determina la vista, no la prioridad. Los permisos son de demostración.'
            >
              <SaveForm
                draftKey={`${actor.id}:${c.id}:classification`}
                key={c.version}
                disabled={!writable}
                onSave={(f) =>
                  execute({
                    type: 'updateCase',
                    caseId: c.id,
                    reason: text(f, 'priorityReason'),
                    responsibleActorId:
                      f.get('responsibleAccess') === 'on'
                        ? 'demo-responsible'
                        : null,
                    priority: text(f, 'priority') as Dossier['priority'],
                    confidentiality: text(
                      f,
                      'confidentiality'
                    ) as Dossier['confidentiality'],
                    presenceType: text(f, 'presenceType'),
                    executionState: c.executionState,
                    portfolio: text(f, 'portfolio'),
                  })
                }
              >
                <div className='grid gap-4 sm:grid-cols-2'>
                  <Field label='Prioridad' name='priority' value={c.priority}>
                    <option value='low'>Baja</option>
                    <option value='medium'>Media</option>
                    <option value='high'>Alta</option>
                  </Field>
                  <Field
                    label='Confidencialidad'
                    name='confidentiality'
                    value={c.confidentiality}
                  >
                    <option value='internal'>Interno</option>
                    <option value='restricted'>Restringido</option>
                    <option value='sensitive'>Sensible</option>
                  </Field>
                </div>
                <Field
                  label='Fundamento de la prioridad (obligatorio si cambia)'
                  name='priorityReason'
                  multiline
                />
                <Field label='Portafolio' name='portfolio' value={c.portfolio}>
                  <option value=''>Pendiente</option>
                  {PORTFOLIOS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </Field>
                {c.kind === 'presence' ? (
                  <Field
                    label='Tipo de presencia'
                    name='presenceType'
                    value={c.presenceType}
                  >
                    <option value=''>Pendiente de clasificación</option>
                    {PRESENCE_TYPES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </Field>
                ) : null}
                <label className='flex items-center gap-2 text-sm'>
                  <input
                    name='responsibleAccess'
                    type='checkbox'
                    defaultChecked={c.responsibleActorId === 'demo-responsible'}
                  />
                  Asignar acceso al rol Responsable de demostración
                </label>
              </SaveForm>
            </Panel>
            <Panel
              title='Organizaciones y convenios'
              description='Referencias a entidades maestras compartidas. No se crean nuevas copias por expediente.'
            >
              <SaveForm
                draftKey={`${actor.id}:${c.id}:relations`}
                key={`relations-${c.version}`}
                disabled={!writable}
                label='Vincular entidades maestras'
                onSave={(f) =>
                  execute({
                    type: 'setRelations',
                    caseId: c.id,
                    organizationIds: f.getAll('organizationIds').map(String),
                    agreementIds: f.getAll('agreementIds').map(String),
                  })
                }
              >
                <fieldset className='grid gap-2'>
                  <legend className='mb-2 text-sm font-medium'>
                    Organizaciones
                  </legend>
                  {Object.values(partners).map((p) => (
                    <label
                      key={p.id}
                      className='flex items-center gap-2 text-sm'
                    >
                      <input
                        type='checkbox'
                        name='organizationIds'
                        value={p.id}
                        defaultChecked={c.organizationIds.includes(p.id)}
                      />
                      {p.name}
                    </label>
                  ))}
                </fieldset>
                <fieldset className='grid gap-2'>
                  <legend className='mb-2 text-sm font-medium'>
                    Convenios
                  </legend>
                  {Object.values(agreements).map((a) => (
                    <label
                      key={a.id}
                      className='flex items-center gap-2 text-sm'
                    >
                      <input
                        type='checkbox'
                        name='agreementIds'
                        value={a.id}
                        defaultChecked={c.agreementIds.includes(a.id)}
                      />
                      {a.name}
                    </label>
                  ))}
                </fieldset>
              </SaveForm>
            </Panel>
          </div>
        </TabsContent>
        <TabsContent value='record'>
          <RecordPanel
            dossier={c}
            initialField={initialField}
            onNavigate={setTab}
          />
        </TabsContent>
        <TabsContent value='operation' className='space-y-6'>
          {c.projectId && <OperationPlanPanel dossier={c} />}
          {c.projectId && <ProjectBudgetPanel dossier={c} />}
          {c.projectId ? (
            <>
              <Panel
                title='Ejecución del proyecto'
                description='Tareas, hitos y finanzas locales para validar el flujo. Notion será la fuente operacional cuando se integre.'
              >
                <SaveForm
                  draftKey={`${actor.id}:${c.id}:execution`}
                  key={c.executionState}
                  disabled={!writable}
                  label='Actualizar ejecución'
                  onSave={(f) =>
                    execute({
                      type: 'updateCase',
                      caseId: c.id,
                      priority: c.priority,
                      confidentiality: c.confidentiality,
                      presenceType: c.presenceType,
                      executionState: text(
                        f,
                        'executionState'
                      ) as Dossier['executionState'],
                      portfolio: c.portfolio,
                    })
                  }
                >
                  <Field
                    label='Estado de ejecución'
                    name='executionState'
                    value={c.executionState}
                  >
                    <option value='draft'>Borrador</option>
                    <option value='planned'>Planificado</option>
                    <option value='in_progress'>En curso</option>
                    <option value='completed'>Completado</option>
                    <option value='cancelled'>Cancelado</option>
                  </Field>
                </SaveForm>
                <p className='text-xs text-muted-foreground'>
                  {
                    Object.values(tasks).filter(
                      (t) => t.eventId === c.projectId
                    ).length
                  }{' '}
                  tareas vinculadas al proyecto. El expediente documental no
                  mantiene un segundo plan.
                </p>
              </Panel>
              {writable ? (
                <>
                  <ProjectOperations dossier={c} />
                  <EventFinances eventId={c.projectId} />
                </>
              ) : (
                <div className='grid gap-6'>
                  <Panel title='Vista de seguimiento'>
                    {Object.values(tasks)
                      .filter((t) => t.eventId === c.projectId)
                      .map((t) => (
                        <p key={t.id} className='text-sm'>
                          {t.title} · {t.assignee} · {t.status}
                        </p>
                      ))}
                  </Panel>
                  <FinanceSummary projectId={c.projectId} />
                </div>
              )}
            </>
          ) : (
            <Panel
              title='Seguimiento del proyecto'
              description='Si este caso requiere ejecución activa, habilita su proyecto manteniendo el mismo expediente maestro.'
            >
              <EmptyState>No hay un plan operacional asociado.</EmptyState>
              <SaveForm
                draftKey={`${actor.id}:${c.id}:attach-project`}
                disabled={!writable}
                label='Activar seguimiento del proyecto'
                onSave={(f) =>
                  execute({
                    type: 'attachProject',
                    caseId: c.id,
                    reason: text(f, 'projectReason'),
                  })
                }
              >
                <Field
                  label='Fundamento del seguimiento activo'
                  name='projectReason'
                  required
                />
              </SaveForm>
            </Panel>
          )}
        </TabsContent>
        <TabsContent value='evidence'>
          <EvidencePanel dossier={c} />
        </TabsContent>
        <TabsContent value='communications'>
          <CommunicationsPanel dossier={c} />
        </TabsContent>
        <TabsContent value='governance'>
          <GovernancePanel dossier={c} />
        </TabsContent>
        <TabsContent value='indicators'>
          <IndicatorsPanel dossier={c} />
        </TabsContent>
        <TabsContent value='history'>
          <Panel
            title='Historial y trazabilidad'
            description='Registro local de actores, cambios, fundamentos y versión de reglas. La auditoría productiva se implementará en backend.'
          >
            {data.audit
              .filter((a) => a.caseId === c.id)
              .slice()
              .reverse()
              .map((a) => (
                <details key={a.id} className='rounded-lg border p-4'>
                  <summary className='cursor-pointer text-sm'>
                    <strong>{a.action}</strong> · {a.actor.name}
                    <span className='block text-xs text-muted-foreground'>
                      {new Date(a.at).toLocaleString('es-CL')} · {a.ruleVersion}
                    </span>
                  </summary>
                  <p className='my-3 text-sm'>
                    {a.reason || 'Actualización registrada.'}
                  </p>
                  <pre className='max-h-64 overflow-auto rounded bg-muted p-3 text-xs'>
                    {JSON.stringify(
                      {
                        before: a.before,
                        after: a.after,
                        correlationId: a.correlationId,
                      },
                      null,
                      2
                    )}
                  </pre>
                </details>
              ))}
          </Panel>
        </TabsContent>
      </Tabs>
    </VcmShell>
  )
}
