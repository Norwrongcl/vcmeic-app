import { randomUUID, createHash } from 'node:crypto'
import type { TransactionContext } from '../contracts/common.ts'
import { ApiError } from '../http/errors.ts'
import { assertAction } from '../access/policy.ts'
import { ownObject } from '../operations/helpers.ts'
import { normalizeSnapshot, type Normalized } from './normalize.ts'
import { hasDependencyCycle } from '../../../packages/domain/src/planning.ts'
import {
  validDate,
  validRecordDate,
} from '../../../packages/domain/src/dates.ts'
export interface ImportIssue {
  entityType: string
  legacyId: string
  code: string
  detail: string
  blocking: boolean
}
export function actorRequirements(data: Normalized) {
  return [
    ...new Set(
      Object.values(data.vcm.cases).map(
        (c) => c.responsibleActorId ?? 'case:' + c.id,
      ),
    ),
  ]
}
export async function importPreview(tx: TransactionContext, raw: unknown) {
  if (
    tx.principal.kind !== 'human' ||
    !tx.principal.roles.some((r) => ['coordination', 'leadership'].includes(r))
  )
    throw new ApiError(
      403,
      'IMPORT_DENIED',
      'La importación requiere Coordinación o Jefatura.',
    )
  await assertAction(tx, 'editOperationalDraft')
  const normalized = normalizeSnapshot(raw),
    batchId = randomUUID(),
    hash = createHash('sha256')
      .update(JSON.stringify(normalized.raw))
      .digest('hex'),
    issues: ImportIssue[] = []
  const issue = (
    entityType: string,
    legacyId: string,
    code: string,
    detail: string,
    blocking = true,
  ) => issues.push({ entityType, legacyId, code, detail, blocking })
  const date = (v: string, entity: string, id: string) => {
    if (
      v &&
      !validRecordDate(v) &&
      !(
        /^\d{4}-\d{2}-\d{2}T/.test(v) &&
        Number.isFinite(Date.parse(v)) &&
        validDate(v.slice(0, 10))
      )
    )
      issue(
        entity,
        id,
        'INVALID_DATE',
        'Fecha no válida: revisa el valor original.',
      )
  }
  for (const [entity, records] of Object.entries(normalized.data)) {
    if (entity === 'vcm') continue
    for (const [key, r] of Object.entries(records)) {
      if (r.id !== key)
        issue(
          entity,
          key,
          'ID_MISMATCH',
          'La clave y el ID del registro no coinciden.',
        )
      if ('startsAt' in r) date(String(r.startsAt), entity, key)
      if ('endsAt' in r && r.endsAt) date(String(r.endsAt), entity, key)
      if ('date' in r) date(String(r.date), entity, key)
      if ('dueDate' in r) date(String(r.dueDate), entity, key)
    }
  }
  const d = normalized.data
  for (const [key, c] of Object.entries(d.vcm.cases))
    if (key !== c.id)
      issue(
        'cases',
        key,
        'ID_MISMATCH',
        'La clave y el ID del expediente no coinciden.',
      )
  const codes = Object.values(d.vcm.cases).map((c) => c.code)
  if (new Set(codes).size !== codes.length)
    for (const c of Object.values(d.vcm.cases))
      issue(
        'cases',
        c.id,
        'DUPLICATE_CODE',
        'Hay códigos de expediente repetidos.',
      )
  for (const p of Object.values(d.events))
    if (
      hasDependencyCycle(
        Object.values(d.tasks)
          .filter((t) => t.eventId === p.id)
          .map((t) => ({ id: t.id, dependencies: t.dependencyIds ?? [] })),
      )
    )
      issue(
        'events',
        p.id,
        'DEPENDENCY_CYCLE',
        'Las dependencias del proyecto forman un ciclo.',
      )
  for (const c of Object.values(d.contacts))
    if (c.partnerId && !d.partners[c.partnerId])
      issue(
        'contacts',
        c.id,
        'MISSING_ORGANIZATION',
        'Organización del contacto inexistente.',
      )
  for (const b of Object.values(d.budgetItems))
    if (!d.events[b.eventId])
      issue(
        'budgetItems',
        b.id,
        'MISSING_PROJECT',
        'Partida sin proyecto existente.',
      )
  for (const e of Object.values(d.expenses))
    if (
      !d.events[e.eventId] ||
      !d.budgetItems[e.budgetItemId] ||
      d.budgetItems[e.budgetItemId].eventId !== e.eventId
    )
      issue(
        'expenses',
        e.id,
        'BUDGET_PROJECT_MISMATCH',
        'El gasto no tiene partida del mismo proyecto.',
      )
  for (const a of Object.values(d.agreements))
    if (a.responsibleContactId && !d.contacts[a.responsibleContactId])
      issue(
        'agreements',
        a.id,
        'MISSING_CONTACT',
        'Contacto responsable de convenio inexistente.',
      )
  for (const c of Object.values(d.vcm.cases)) {
    if (c.projectId && !d.events[c.projectId])
      issue(
        'cases',
        c.id,
        'MISSING_PROJECT',
        'El proyecto relacionado no existe en el archivo.',
      )
    for (const oid of c.organizationIds)
      if (!d.partners[oid])
        issue(
          'cases',
          c.id,
          'MISSING_ORGANIZATION',
          'Organización vinculada inexistente.',
        )
    for (const aid of c.agreementIds)
      if (!d.agreements[aid])
        issue(
          'cases',
          c.id,
          'MISSING_AGREEMENT',
          'Convenio vinculado inexistente.',
        )
    for (const [key, field] of Object.entries(c.fields)) {
      if (['startsAt', 'endsAt'].includes(key) && field.value)
        date(field.value, 'cases', c.id)
      for (const sid of field.sourceIds)
        if (!d.vcm.sources[sid] || d.vcm.sources[sid].caseId !== c.id)
          issue(
            'cases',
            c.id,
            'SOURCE_CASE_MISMATCH',
            'La fuente no pertenece al expediente: ' + key,
          )
      for (const candidate of field.candidates)
        if (
          !d.vcm.sources[candidate.sourceId] ||
          d.vcm.sources[candidate.sourceId].caseId !== c.id
        )
          issue(
            'cases',
            c.id,
            'SOURCE_CASE_MISMATCH',
            'Una versión de campo refiere otra fuente.',
          )
    }
  }
  for (const task of Object.values(d.tasks)) {
    for (const contact of task.assigneeContactIds ?? [])
      if (!d.contacts[contact])
        issue(
          'tasks',
          task.id,
          'MISSING_CONTACT',
          'Responsable de tarea inexistente.',
        )
    if (!task.eventId || !d.events[task.eventId])
      issue(
        'tasks',
        task.id,
        'MISSING_PROJECT',
        'Tarea sin proyecto existente.',
      )
    for (const dep of task.dependencyIds ?? [])
      if (!d.tasks[dep] || d.tasks[dep].eventId !== task.eventId)
        issue(
          'tasks',
          task.id,
          'DEPENDENCY_MISMATCH',
          'Dependencia de otro proyecto o inexistente.',
        )
  }
  for (const a of Object.values(d.agreements))
    if (!d.partners[a.partnerId])
      issue(
        'agreements',
        a.id,
        'MISSING_ORGANIZATION',
        'Contraparte de convenio inexistente.',
      )
  for (const e of Object.values(d.vcm.evidences))
    if (
      !d.vcm.cases[e.caseId] ||
      !d.vcm.sources[e.sourceId] ||
      d.vcm.sources[e.sourceId].caseId !== e.caseId
    )
      issue(
        'evidences',
        e.id,
        'SOURCE_CASE_MISMATCH',
        'Referencia documental sin expediente/fuente consistente.',
      )
  for (const entity of [
    'plans',
    'decisions',
    'campaigns',
    'contents',
    'commitments',
    'forecasts',
    'cuts',
    'indicatorLinks',
  ] as const)
    for (const value of Object.values(d.vcm[entity]))
      issue(
        entity,
        'id' in value
          ? String(value.id)
          : 'caseId' in value
            ? String(value.caseId)
            : 'projectId' in value
              ? String(value.projectId)
              : entity,
        'LEGACY_REVIEW',
        'Se conserva el original; su aprobación o regla institucional requiere revisión en servidor.',
        false,
      )
  if (Object.keys(d.expenses).length)
    for (const value of Object.values(d.expenses))
      issue(
        'expenses',
        value.id,
        'FINANCIAL_REVIEW',
        'Gasto histórico sin autorización verificable: preservado en staging, no ejecutado.',
        false,
      )
  await tx.client.query(
    "INSERT INTO vcm.import_batches(id,source_version,source_hash,status,actor_id) VALUES($1,$2,$3,'preview',$4)",
    [batchId, normalized.sourceVersion, hash, tx.principal.id],
  )
  await ownObject(tx, 'import', batchId, 'restricted')
  await tx.client.query(
    "INSERT INTO vcm.import_mappings(batch_id,entity_type,legacy_id,payload) VALUES($1,'__snapshot','snapshot',$2)",
    [batchId, JSON.stringify(normalized.raw)],
  )
  for (const [entity, records] of Object.entries(d)) {
    if (entity === 'vcm') continue
    for (const [legacyId, payload] of Object.entries(records))
      await tx.client.query(
        'INSERT INTO vcm.import_mappings(batch_id,entity_type,legacy_id,payload) VALUES($1,$2,$3,$4)',
        [batchId, entity, legacyId, JSON.stringify(payload)],
      )
  }
  for (const [entity, records] of Object.entries(d.vcm)) {
    if (entity === 'audit') continue
    for (const [legacyId, payload] of Object.entries(records))
      await tx.client.query(
        'INSERT INTO vcm.import_mappings(batch_id,entity_type,legacy_id,payload,demo) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
        [
          batchId,
          entity,
          legacyId,
          JSON.stringify(payload),
          entity === 'cases' && !!(payload as { demo?: boolean }).demo,
        ],
      )
  }
  for (const i of issues) {
    if (
      !(
        await tx.client.query(
          'SELECT 1 FROM vcm.import_mappings WHERE batch_id=$1 AND entity_type=$2 AND legacy_id=$3',
          [batchId, i.entityType, i.legacyId],
        )
      ).rowCount
    )
      continue
    await tx.client.query(
      'INSERT INTO vcm.import_issues(id,batch_id,entity_type,legacy_id,code,detail) VALUES($1,$2,$3,$4,$5,$6)',
      [
        randomUUID(),
        batchId,
        i.entityType,
        i.legacyId,
        (i.blocking ? 'BLOCKING:' : 'PENDING:') + i.code,
        i.detail,
      ],
    )
  }
  return {
    id: batchId,
    hash,
    requiredActors: actorRequirements(d),
    requiresDemoClassification: normalized.demoUnknownIds,
    counts: {
      cases: Object.keys(d.vcm.cases).length,
      projects: Object.keys(d.events).length,
      demoCases: Object.values(d.vcm.cases).filter((c) => c.demo).length,
    },
    issues,
  }
}
