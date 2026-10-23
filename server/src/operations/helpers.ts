import type { TransactionContext } from '../contracts/common.ts'
import type { Target } from '../commands/registry.ts'
import { ApiError } from '../http/errors.ts'
import { assertAction } from '../access/policy.ts'
export async function protectedTarget(
  tx: TransactionContext,
  table: string,
  kind: string,
  id: unknown,
): Promise<Target> {
  const r = await tx.client.query(
    `SELECT t.version,o.id AS "objectId" FROM vcm.${table} t JOIN vcm.protected_objects o ON o.id=$2||t.id WHERE t.id=$1 AND o.archived_at IS NULL`,
    [id, kind + ':'],
  )
  if (!r.rowCount)
    throw new ApiError(404, 'NOT_FOUND', 'Recurso no encontrado.')
  return r.rows[0]
}
export async function projectTarget(
  tx: TransactionContext,
  command: { projectId: string },
) {
  return protectedTarget(tx, 'projects', 'project', command.projectId)
}
export async function bumpProject(tx: TransactionContext, projectId: string) {
  return (
    await tx.client.query(
      'UPDATE vcm.projects SET version=version+1,updated_at=now() WHERE id=$1 RETURNING version',
      [projectId],
    )
  ).rows[0].version as number
}
export async function assertProjectCase(
  tx: TransactionContext,
  projectId: string,
  caseId: string,
) {
  await assertAction(tx, 'query', 'case:' + caseId)
  if (
    !(
      await tx.client.query(
        'SELECT 1 FROM vcm.project_cases WHERE project_id=$1 AND case_id=$2',
        [projectId, caseId],
      )
    ).rowCount
  )
    throw new ApiError(
      422,
      'PROJECT_CASE_MISMATCH',
      'El expediente no pertenece al proyecto.',
    )
}
export async function ownObject(
  tx: TransactionContext,
  kind: string,
  id: string,
  confidentiality = 'internal',
) {
  await tx.client.query(
    'INSERT INTO vcm.protected_objects(id,kind,owner_id,confidentiality) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET owner_id=$3,confidentiality=$4',
    [kind + ':' + id, kind, tx.principal.id, confidentiality],
  )
}
