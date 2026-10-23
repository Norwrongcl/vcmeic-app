import { operationalDetail } from './operations.detail.ts'
import { pageInput, pageResult } from '../http/pagination.ts'
import { projectFinance } from './finance.ts'
import type { TransactionContext } from '../contracts/common.ts'
import type { ResourceDefinition } from './resources.ts'
import { visibilityPredicate } from '../access/visibility.ts'
import { assertAction } from '../access/policy.ts'
import { ApiError } from '../http/errors.ts'
// Parent visibility never grants access to an independently protected relation.
async function redactReferences(
  tx: TransactionContext,
  row: Record<string, unknown>,
) {
  for (const [field, kind] of Object.entries({
    caseId: 'case',
    campaignId: 'campaign',
    organizationId: 'organization',
    responsibleContactId: 'contact',
  })) {
    if (typeof row[field] !== 'string') continue
    const pred = visibilityPredicate(tx.principal, 'o', 2)
    const visible = await tx.client.query(
      'SELECT 1 FROM vcm.protected_objects o WHERE o.id=$1 AND ' + pred.sql,
      [kind + ':' + row[field], ...pred.values],
    )
    if (!visible.rowCount) row[field] = null
  }
}
export async function readResource(
  tx: TransactionContext,
  resource: ResourceDefinition,
  id?: string,
  query?: unknown,
) {
  await assertAction(tx, 'query', id ? resource.kind + ':' + id : undefined)
  const broad =
    tx.principal.kind === 'human'
      ? tx.principal.roles.some((r) =>
          ['coordination', 'leadership', 'direction'].includes(r),
        )
      : tx.principal.scopes.includes('coordination:read')
  if (resource.path === 'contacts' && !broad && !id)
    throw new ApiError(
      403,
      'PRIVATE_CONTACTS',
      'El directorio requiere permiso de gestión.',
    )
  const fields = Object.entries(resource.fields)
    .filter(([key]) => broad || !resource.privateFields?.includes(key))
    .map(([key, col]) => `t.${col} AS "${key}"`)
  const pred = visibilityPredicate(tx.principal, 'o', id ? 2 : 1),
    page = pageInput(query, tx.principal, resource.path),
    values: unknown[] = [
      ...(id ? [id] : []),
      ...pred.values,
      resource.kind + ':',
    ]
  let where = (id ? 't.id=$1 AND ' : '') + pred.sql
  if (!id && page.after) {
    values.push(page.after)
    where += ' AND t.id>$' + values.length
  }
  const sql = `SELECT t.id,t.version,${fields.join(',')} FROM vcm.${resource.table} t JOIN vcm.protected_objects o ON o.id=$${(id ? 2 : 1) + pred.values.length}||t.id WHERE ${where} ORDER BY t.id LIMIT ${id ? 1 : page.limit + 1}`
  const rows = (await tx.client.query(sql, values)).rows
  for (const row of rows) await redactReferences(tx, row)
  if (!id) return pageResult(rows, page.limit, tx.principal, resource.path)
  const row = rows[0]
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Recurso no encontrado.')
  if (resource.path === 'projects') {
    const cp = visibilityPredicate(tx.principal, 'o', 2)
    row.caseIds = (
      await tx.client.query(
        'SELECT c.id FROM vcm.project_cases pc JOIN vcm.cases c ON c.id=pc.case_id JOIN vcm.protected_objects o ON o.id=c.protected_object_id WHERE pc.project_id=$1 AND ' +
          cp.sql,
        [id, ...cp.values],
      )
    ).rows.map((r) => r.id)
    try {
      row.finance = await projectFinance(tx, id)
    } catch (e) {
      if (e instanceof ApiError && [403, 404].includes(e.status))
        row.finance = { availability: 'restricted' }
      else throw e
    }
    row.tasks = (
      await tx.client.query(
        'SELECT id,title,status,kind,version FROM vcm.tasks WHERE project_id=$1 ORDER BY id',
        [id],
      )
    ).rows
  }
  return operationalDetail(tx, resource.path, id, row)
}
