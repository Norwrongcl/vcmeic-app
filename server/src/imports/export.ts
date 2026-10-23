import type { TransactionContext } from '../contracts/common.ts'
import { assertAction } from '../access/policy.ts'
import { visibilityPredicate } from '../access/visibility.ts'
import { ApiError } from '../http/errors.ts'
import { entities, entityAllowed } from '../query/catalog.ts'
import { semanticQuery } from '../query/compiler.ts'
import { readCase } from '../cases/cases.read.ts'
import { redactSecrets } from './normalize.ts'
export async function scopedExport(tx: TransactionContext) {
  if (tx.principal.kind !== 'human')
    throw new ApiError(
      403,
      'EXPORT_DENIED',
      'La exportación requiere una sesión humana.',
    )
  await assertAction(tx, 'query')
  const records: Record<string, Record<string, unknown>[]> = {}
  let total = 0
  for (const [name, e] of Object.entries(entities)) {
    if (!entityAllowed(tx.principal, name)) continue
    records[name] = []
    let cursor: string | undefined
    do {
      const page = await semanticQuery(tx, {
        entity: name,
        select: Object.keys(e.fields),
        page: { limit: 100, ...(cursor ? { cursor } : {}) },
      })
      records[name].push(...page.items)
      total += page.items.length
      if (total > 10000)
        throw new ApiError(
          422,
          'EXPORT_TOO_LARGE',
          'Solicita un respaldo privado para un volumen mayor.',
        )
      cursor = page.nextCursor ?? undefined
    } while (cursor)
  }
  records.cases = await Promise.all(
    records.cases.map(async (row) => await readCase(tx, String(row.id))),
  )
  const caseIds = records.cases.map((c) => c.id),
    projectIds = records.projects.map((p) => p.id)
  records.projectCases = (
    await tx.client.query(
      'SELECT project_id AS "projectId",case_id AS "caseId" FROM vcm.project_cases WHERE project_id=ANY($1::text[]) AND case_id=ANY($2::text[]) ORDER BY project_id,case_id',
      [projectIds, caseIds],
    )
  ).rows
  const pred = visibilityPredicate(tx.principal, 'o')
  const hidden = (
    await tx.client.query(
      'SELECT 1 FROM vcm.protected_objects o WHERE o.archived_at IS NULL AND NOT ' +
        pred.sql +
        ' LIMIT 1',
      pred.values,
    )
  ).rowCount
  let sourceSnapshots: unknown[] = []
  if (
    !hidden &&
    tx.principal.roles.some((r) => ['coordination', 'leadership'].includes(r))
  ) {
    sourceSnapshots = (
      await tx.client.query(
        "SELECT m.payload FROM vcm.import_mappings m JOIN vcm.import_batches b ON b.id=m.batch_id WHERE m.entity_type='__snapshot' AND b.status='completed' AND b.actor_id=$1 ORDER BY b.created_at",
        [tx.principal.id],
      )
    ).rows.map((r) => redactSecrets(r.payload))
  }
  const result = {
    format: 'vcm-api-export',
    version: 1,
    capturedAt: tx.now.toISOString(),
    records,
    sourceSnapshots,
    scope: 'current-authorized-records',
    recovery:
      'Exact database recovery uses private PostgreSQL backup. Source snapshots preserve unverified legacy history; importing them requires explicit review and resets institutional approval.',
  }
  if (Buffer.byteLength(JSON.stringify(result)) > 10 * 1024 * 1024)
    throw new ApiError(
      422,
      'EXPORT_TOO_LARGE',
      'Solicita un respaldo privado para un volumen mayor.',
    )
  return result
}
