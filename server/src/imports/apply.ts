import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { CommandRegistry } from '../commands/registry.ts'
import { type TransactionContext, id, money } from '../contracts/common.ts'
import { ApiError } from '../http/errors.ts'
import { assertAction } from '../access/policy.ts'
import { ownObject } from '../operations/helpers.ts'
import { normalizeSnapshot, type Normalized } from './normalize.ts'
import { schemaFingerprint } from './backup-receipt.ts'
import { recordMutation } from '../events/record-event.ts'
import { captureField } from '../capture/capture.ts'
const asDate = (v: string | null | undefined) => (v ? v.slice(0, 10) : null)
async function pending(
  tx: TransactionContext,
  batchId: string,
  entity: string,
  legacyId: string,
  detail: string,
) {
  if (
    (
      await tx.client.query(
        'SELECT 1 FROM vcm.import_mappings WHERE batch_id=$1 AND entity_type=$2 AND legacy_id=$3',
        [batchId, entity, legacyId],
      )
    ).rowCount
  )
    await tx.client.query(
      "INSERT INTO vcm.import_issues(id,batch_id,entity_type,legacy_id,code,detail) VALUES($1,$2,$3,$4,'PENDING:FIELD_REVIEW',$5)",
      [randomUUID(), batchId, entity, legacyId, detail],
    )
}
async function activated(
  tx: TransactionContext,
  batchId: string,
  entity: string,
  legacyId: string,
  internalId: string,
) {
  const kinds: Record<string, string> = {
    partners: 'organization',
    contacts: 'contact',
    agreements: 'agreement',
    resources: 'resource',
    events: 'project',
    cases: 'case',
    budgetItems: 'budget',
  }
  if (kinds[entity]) {
    const version =
      entity === 'cases'
        ? (
            await tx.client.query('SELECT version FROM vcm.cases WHERE id=$1', [
              internalId,
            ])
          ).rows[0].version
        : 1
    await recordMutation(
      tx,
      'importRecord',
      'Importación revisada; autoridad antigua no incorporada.',
      {
        objectId: kinds[entity] + ':' + internalId,
        version,
        result: { id: internalId },
        after: { importBatchId: batchId, review: 'pending' },
      },
    )
  }
  await tx.client.query(
    'UPDATE vcm.import_mappings SET internal_id=$1 WHERE batch_id=$2 AND entity_type=$3 AND legacy_id=$4',
    [internalId, batchId, entity, legacyId],
  )
}
async function applyCore(
  tx: TransactionContext,
  batchId: string,
  d: Normalized,
  actors: Record<string, string>,
  includeDemo: boolean,
) {
  for (const org of Object.values(d.partners)) {
    await ownObject(tx, 'organization', org.id)
    await tx.client.query(
      'INSERT INTO vcm.organizations(id,name,type,tax_id,email,phone,website,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        org.id,
        org.name,
        org.type,
        org.taxId,
        org.email,
        org.phone,
        org.website,
        org.notes,
      ],
    )
    await activated(tx, batchId, 'partners', org.id, org.id)
  }
  for (const contact of Object.values(d.contacts)) {
    await ownObject(tx, 'contact', contact.id, 'restricted')
    await tx.client.query(
      'INSERT INTO vcm.contacts(id,name,email,phone) VALUES($1,$2,$3,$4)',
      [contact.id, contact.name, contact.email, contact.phone],
    )
    if (contact.partnerId && d.partners[contact.partnerId])
      await tx.client.query(
        'INSERT INTO vcm.organization_contacts(organization_id,contact_id,role) VALUES($1,$2,$3)',
        [contact.partnerId, contact.id, contact.role],
      )
    await activated(tx, batchId, 'contacts', contact.id, contact.id)
  }
  for (const a of Object.values(d.agreements)) {
    await tx.client.query(
      'INSERT INTO vcm.agreements(id,organization_id,responsible_contact_id,name,type,description,starts_on,ends_on,status,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [
        a.id,
        a.partnerId,
        a.responsibleContactId,
        a.name,
        a.type,
        a.description,
        asDate(a.startsAt),
        asDate(a.endsAt),
        a.cancelled ? 'cancelled' : 'draft',
        a.notes,
      ],
    )
    await ownObject(tx, 'agreement', a.id)
    await activated(tx, batchId, 'agreements', a.id, a.id)
  }
  for (const r of Object.values(d.resources)) {
    await ownObject(tx, 'resource', r.id)
    await tx.client.query(
      "INSERT INTO vcm.resources(id,name,category,unit,quantity,description,notes) VALUES($1,$2,$3,'pendiente de definir',$4,$5,$6)",
      [r.id, r.name, r.category, r.quantity, r.description, r.notes],
    )
    await activated(tx, batchId, 'resources', r.id, r.id)
  }
  const cases = Object.values(d.vcm.cases).filter(
      (c) => includeDemo || !c.demo,
    ),
    caseIds = new Set(cases.map((c) => c.id)),
    includedProjects = new Set(
      cases.map((c) => c.projectId).filter((v): v is string => !!v),
    )
  // Unlinked legacy operations are preserved too; explicitly excluded demo-only projects remain staging.
  for (const p of Object.values(d.events)) {
    const linked = Object.values(d.vcm.cases).filter(
      (c) => c.projectId === p.id,
    )
    if (!includeDemo && linked.length && !includedProjects.has(p.id)) continue
    await tx.client.query(
      "INSERT INTO vcm.projects(id,name,kind,starts_on,ends_on,location) VALUES($1,$2,'event',$3,$4,$5)",
      [p.id, p.name, asDate(p.startsAt), asDate(p.endsAt), p.location],
    )
    await ownObject(tx, 'project', p.id)
    includedProjects.add(p.id)
    await activated(tx, batchId, 'events', p.id, p.id)
  }
  for (const c of cases) {
    const responsible = actors[c.responsibleActorId ?? 'case:' + c.id]
    await tx.client.query(
      "INSERT INTO vcm.cases(id,code,name,kind,responsible_id,responsible_label,state,priority,version,demo) VALUES($1,$2,$3,$4,$5,$6,'construction',$7,$8,$9)",
      [
        c.id,
        c.code,
        c.name,
        c.kind,
        responsible,
        c.responsible,
        c.priority,
        c.version,
        c.demo,
      ],
    )
    await ownObject(tx, 'case', c.id, c.confidentiality)
    await tx.client.query(
      "INSERT INTO vcm.case_assignments(case_id,principal_id,function) VALUES($1,$2,'responsible')",
      [c.id, responsible],
    )
    for (const permission of ['read', 'write'])
      await tx.client.query(
        'INSERT INTO vcm.object_grants(object_id,principal_id,permission) VALUES($1,$2,$3)',
        ['case:' + c.id, responsible, permission],
      )
    await tx.client.query(
      "INSERT INTO vcm.case_fields(case_id,field_key,schema_version) SELECT $1,field_key,schema_version FROM vcm.field_definitions WHERE schema_version=$2 OR schema_version='operation-2026.09-v1'",
      [c.id, c.kind === 'presence' ? 'p51-2026.09-v1' : 'p52-2026.09-v1'],
    )
    await tx.client.query(
      c.kind === 'presence'
        ? 'INSERT INTO vcm.presence_records(id,case_id) VALUES($1,$2)'
        : 'INSERT INTO vcm.activity_records(id,case_id) VALUES($1,$2)',
      [c.id, c.id],
    )
    if (c.projectId)
      await tx.client.query(
        'INSERT INTO vcm.project_cases(project_id,case_id) VALUES($1,$2)',
        [c.projectId, c.id],
      )
    for (const oid of c.organizationIds)
      await tx.client.query(
        "INSERT INTO vcm.case_organizations(case_id,organization_id,role) VALUES($1,$2,'participant')",
        [c.id, oid],
      )
    for (const aid of c.agreementIds)
      await tx.client.query(
        'INSERT INTO vcm.case_agreements(case_id,agreement_id) VALUES($1,$2)',
        [c.id, aid],
      )
    await activated(tx, batchId, 'cases', c.id, c.id)
  }
  for (const s of Object.values(d.vcm.sources).filter((s) =>
    caseIds.has(s.caseId),
  )) {
    await tx.client.query(
      "INSERT INTO vcm.sources(id,case_id,name,channel,actor_id,external_reference) VALUES($1,$2,$3,'legacy',$4,$5)",
      [
        s.id,
        s.caseId,
        s.name + ' · autor anterior no verificado',
        tx.principal.id,
        'legacy capturedAt: ' + s.capturedAt,
      ],
    )
    await activated(tx, batchId, 'sources', s.id, s.id)
  }
  for (const e of Object.values(d.vcm.evidences).filter((e) =>
    caseIds.has(e.caseId),
  )) {
    const docId = 'legacy-document:' + e.id
    await tx.client.query(
      'INSERT INTO vcm.document_references(id,name,url) VALUES($1,$2,$3)',
      [docId, e.name, e.url || null],
    )
    await ownObject(tx, 'document', docId, e.confidentiality)
    await tx.client.query(
      'INSERT INTO vcm.evidences(id,case_id,document_id,source_id,name,version) VALUES($1,$2,$3,$4,$5,$6)',
      [e.id, e.caseId, docId, e.sourceId, e.name, e.version],
    )
    await activated(tx, batchId, 'evidences', e.id, e.id)
  }
  for (const c of cases) {
    const fallback = batchId + ':source:' + c.id
    await tx.client.query(
      "INSERT INTO vcm.sources(id,case_id,name,channel,actor_id) VALUES($1,$2,'Snapshot local · requiere revisión','legacy',$3)",
      [fallback, c.id, tx.principal.id],
    )
    for (const [key, field] of Object.entries(c.fields)) {
      const definition = (
        await tx.client.query(
          'SELECT d.value_type,d.unit FROM vcm.case_fields f JOIN vcm.field_definitions d ON d.field_key=f.field_key AND d.schema_version=f.schema_version WHERE f.case_id=$1 AND f.field_key=$2',
          [c.id, key],
        )
      ).rows[0]
      if (!definition) {
        await pending(
          tx,
          batchId,
          'cases',
          c.id,
          'Campo antiguo sin correspondencia: ' + key,
        )
        continue
      }
      const values = [
        { value: field.value, sourceId: field.sourceIds[0] ?? fallback },
        ...field.candidates,
      ]
      for (const candidate of values) {
        if (!candidate.value.trim()) continue
        let value:
          | string
          | number
          | { type: 'evidence' | 'agreement' | 'organization'; id: string }[] =
          candidate.value
        try {
          if (definition.value_type === 'number') {
            if (!/^\d+(\.\d+)?$/.test(candidate.value)) throw new Error()
            value = Number(candidate.value)
            if (
              !Number.isFinite(value) ||
              (definition.unit === 'count' && !Number.isSafeInteger(value))
            )
              throw new Error()
          } else if (definition.value_type === 'money')
            value = money.parse(candidate.value)
          else if (definition.value_type === 'date') {
            value = asDate(candidate.value)!
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error()
          } else if (definition.value_type === 'references') {
            value = z
              .array(
                z.strictObject({
                  type: z.enum(['evidence', 'organization', 'agreement']),
                  id,
                }),
              )
              .parse(JSON.parse(candidate.value))
          }
        } catch {
          await pending(
            tx,
            batchId,
            'cases',
            c.id,
            'Revisar formato/referencias de ' + key + '; original preservado.',
          )
          await tx.client.query(
            'UPDATE vcm.case_fields SET observation=$1 WHERE case_id=$2 AND field_key=$3',
            ['Original pendiente de mapear: ' + candidate.value, c.id, key],
          )
          continue
        }
        await captureField(
          tx,
          c.id,
          {
            fieldId: key,
            value,
            status: 'partial',
            source: { name: 'Snapshot revisado' },
            observation:
              field.observation || 'Antecedente importado; requiere revisión.',
          },
          { sourceId: candidate.sourceId },
        )
      }
      if (field.status === 'conflict')
        await tx.client.query(
          "UPDATE vcm.case_fields SET status='conflict' WHERE case_id=$1 AND field_key=$2",
          [c.id, key],
        )
    }
    if (c.presenceType && !c.fields.presenceType)
      await captureField(
        tx,
        c.id,
        {
          fieldId: 'presenceType',
          value: c.presenceType,
          status: 'partial',
          source: { name: 'Tipología antigua' },
          observation: 'Clasificación pendiente de revisión.',
        },
        { sourceId: fallback },
      )
  }
  for (const task of Object.values(d.tasks).filter(
    (t) => t.eventId && includedProjects.has(t.eventId),
  )) {
    await tx.client.query(
      "INSERT INTO vcm.tasks(id,project_id,title,kind,description,status,priority,phase,due_on,blocked,assignee_label) VALUES($1,$2,$3,$4,$5,'todo',$6,$7,$8,$9,$10)",
      [
        task.id,
        task.eventId,
        task.title,
        task.kind ?? 'task',
        task.description,
        task.priority,
        task.phase ?? null,
        asDate(task.dueDate),
        task.blocked ?? false,
        task.assignee,
      ],
    )
    for (const contactId of task.assigneeContactIds ?? [])
      await tx.client.query(
        'INSERT INTO vcm.task_assignees(task_id,contact_id) VALUES($1,$2)',
        [task.id, contactId],
      )
    await activated(tx, batchId, 'tasks', task.id, task.id)
  }
  for (const task of Object.values(d.tasks).filter(
    (t) => t.eventId && includedProjects.has(t.eventId),
  ))
    for (const dep of task.dependencyIds ?? [])
      await tx.client.query(
        'INSERT INTO vcm.task_dependencies(project_id,task_id,depends_on_id) VALUES($1,$2,$3)',
        [task.eventId, task.id, dep],
      )
  for (const b of Object.values(d.budgetItems).filter((b) =>
    includedProjects.has(b.eventId),
  )) {
    await tx.client.query(
      'INSERT INTO vcm.budget_items(id,project_id,name,planned_amount) VALUES($1,$2,$3,$4)',
      [b.id, b.eventId, b.name, String(b.plannedAmount)],
    )
    await ownObject(tx, 'budget', b.id)
    await activated(tx, batchId, 'budgetItems', b.id, b.id)
  }
  return {
    cases: cases.length,
    projects: includedProjects.size,
    pendingDomains: [
      'plans',
      'decisions',
      'campaigns',
      'contents',
      'expenses',
      'commitments',
      'forecasts',
      'cuts',
      'indicatorLinks',
    ],
  }
}
export function registerImports(registry: CommandRegistry) {
  registry.register({
    type: 'commitImport',
    action: 'editOperationalDraft',
    schema: z.strictObject({
      type: z.literal('commitImport'),
      batchId: id,
      previewHash: z.string().length(64),
      actorMappings: z.record(z.string(), id),
      includeDemo: z.boolean(),
      demoClassifications: z.record(z.string(), z.boolean()).default({}),
      backupReceiptId: id,
    }),
    async target(tx, cmd) {
      await assertAction(tx, 'editOperationalDraft', 'import:' + cmd.batchId)
      const batch = (
        await tx.client.query(
          'SELECT status FROM vcm.import_batches WHERE id=$1',
          [cmd.batchId],
        )
      ).rows[0]
      if (!batch) throw new ApiError(404, 'NOT_FOUND', 'Lote no encontrado.')
      return {
        objectId: 'import:' + cmd.batchId,
        version: batch.status === 'completed' ? 2 : 1,
      }
    },
    async run(tx, cmd, target) {
      if (tx.principal.kind !== 'human')
        throw new ApiError(
          403,
          'IMPORT_DENIED',
          'Solo una persona autorizada puede confirmar la importación.',
        )
      await tx.client.query(
        'SELECT pg_advisory_xact_lock(783195024221::bigint)',
      )
      const batch = (
        await tx.client.query(
          'SELECT source_hash FROM vcm.import_batches WHERE id=$1',
          [cmd.batchId],
        )
      ).rows[0]
      if (batch.source_hash !== cmd.previewHash)
        throw new ApiError(
          422,
          'PREVIEW_HASH_MISMATCH',
          'Revisa de nuevo el archivo antes de confirmar.',
        )
      if (
        (
          await tx.client.query(
            "SELECT 1 FROM vcm.import_issues WHERE batch_id=$1 AND code LIKE 'BLOCKING:%'",
            [cmd.batchId],
          )
        ).rowCount
      )
        throw new ApiError(
          422,
          'IMPORT_ISSUES',
          'Corrige los problemas del archivo antes de importar.',
        )
      const receipt = (
        await tx.client.query(
          "SELECT * FROM vcm.import_backup_receipts WHERE id=$1 AND batch_id=$2 AND snapshot_hash=$3 AND database_name=current_database() AND consumed_at IS NULL AND created_at>now()-interval '1 hour'",
          [cmd.backupReceiptId, cmd.batchId, cmd.previewHash],
        )
      ).rows[0]
      if (
        !receipt ||
        receipt.schema_fingerprint !== (await schemaFingerprint(tx.client))
      )
        throw new ApiError(
          422,
          'BACKUP_REQUIRED',
          'Un operador debe verificar y acreditar el respaldo previo de esta base y lote.',
        )
      const occupied = (
        await tx.client.query(
          'SELECT EXISTS(SELECT 1 FROM vcm.cases UNION ALL SELECT 1 FROM vcm.projects UNION ALL SELECT 1 FROM vcm.organizations UNION ALL SELECT 1 FROM vcm.contacts UNION ALL SELECT 1 FROM vcm.agreements UNION ALL SELECT 1 FROM vcm.resources UNION ALL SELECT 1 FROM vcm.annual_plans) occupied',
        )
      ).rows[0].occupied
      if (occupied)
        throw new ApiError(
          422,
          'INITIAL_IMPORT_ONLY',
          'Esta importación requiere una base de negocio vacía. No reemplaza datos existentes.',
        )
      const raw = (
          await tx.client.query(
            "SELECT payload FROM vcm.import_mappings WHERE batch_id=$1 AND entity_type='__snapshot'",
            [cmd.batchId],
          )
        ).rows[0].payload,
        normalized = normalizeSnapshot(raw),
        d = normalized.data
      for (const id of normalized.demoUnknownIds) {
        if (!Object.hasOwn(cmd.demoClassifications, id))
          throw new ApiError(
            422,
            'DEMO_CLASSIFICATION_REQUIRED',
            'Clasifica explícitamente cada caso antiguo como real o demostrativo.',
          )
        d.vcm.cases[id].demo = cmd.demoClassifications[id]
      }
      for (const c of Object.values(d.vcm.cases).filter(
        (c) => cmd.includeDemo || !c.demo,
      )) {
        const key = c.responsibleActorId ?? 'case:' + c.id,
          mapped = cmd.actorMappings[key]
        if (
          !mapped ||
          !(
            await tx.client.query(
              'SELECT 1 FROM vcm.users u JOIN vcm.principals p ON p.id=u.principal_id WHERE p.id=$1 AND p.active',
              [mapped],
            )
          ).rowCount
        )
          throw new ApiError(
            422,
            'ACTOR_MAPPING_REQUIRED',
            'Vincula cada responsable incluido con un usuario humano activo; no se asignan roles desde el archivo.',
          )
      }
      const result = await applyCore(
        tx,
        cmd.batchId,
        d,
        cmd.actorMappings,
        cmd.includeDemo,
      )
      await tx.client.query(
        "UPDATE vcm.import_batches SET status='completed' WHERE id=$1",
        [cmd.batchId],
      )
      await tx.client.query(
        'UPDATE vcm.import_backup_receipts SET consumed_at=now() WHERE id=$1',
        [cmd.backupReceiptId],
      )
      return {
        objectId: target!.objectId,
        version: 2,
        result: { ...result, status: 'completed_with_review' },
        after: { ...result, legacyAuthorityAccepted: false },
      }
    },
  })
}
