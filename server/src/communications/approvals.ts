import type { TransactionContext } from '../contracts/common.ts'
import { ApiError } from '../http/errors.ts'
import { assertAction } from '../access/policy.ts'
import { charterIssues } from '../../../packages/domain/src/campaigns.ts'
export async function latestRevision(
  tx: TransactionContext,
  table: string,
  column: string,
  id: string,
) {
  const r = await tx.client.query(
    `SELECT * FROM vcm.${table} WHERE ${column}=$1 ORDER BY version DESC LIMIT 1`,
    [id],
  )
  if (!r.rowCount)
    throw new ApiError(
      422,
      'REVISION_REQUIRED',
      'No hay una revisión disponible.',
    )
  return r.rows[0]
}
export async function activeApproval(
  tx: TransactionContext,
  revisionId: string,
) {
  return (
    await tx.client.query(
      'SELECT a.id FROM vcm.approval_records a WHERE revision_id=$1 AND (expires_at IS NULL OR expires_at>now()) AND NOT EXISTS(SELECT 1 FROM vcm.approval_revocations r WHERE r.approval_id=a.id) ORDER BY approved_at DESC LIMIT 1',
      [revisionId],
    )
  ).rows[0]?.id as string | undefined
}
export async function approvedCampaign(
  tx: TransactionContext,
  campaignId: string,
  revisionId?: string,
) {
  await assertAction(tx, 'query', 'campaign:' + campaignId)
  const revision = await latestRevision(
    tx,
    'campaign_revisions',
    'campaign_id',
    campaignId,
  )
  if (
    (revisionId && revision.id !== revisionId) ||
    charterIssues(revision.charter).length ||
    !(await activeApproval(tx, revision.id))
  )
    throw new ApiError(
      422,
      'STRATEGY_APPROVAL_REQUIRED',
      'La estrategia vigente requiere aprobación.',
    )
  return revision
}
export async function completeContent(
  tx: TransactionContext,
  contentId: string,
  revisionId?: string,
) {
  await assertAction(tx, 'query', 'content:' + contentId)
  const content = (
      await tx.client.query('SELECT * FROM vcm.contents WHERE id=$1', [
        contentId,
      ])
    ).rows[0],
    revision = await latestRevision(
      tx,
      'content_revisions',
      'content_id',
      contentId,
    )
  if (revisionId && revision.id !== revisionId)
    throw new ApiError(
      422,
      'STALE_CONTENT_REVISION',
      'El contenido cambió después de preparar la revisión.',
    )
  if (!content.campaign_id)
    throw new ApiError(
      422,
      'STRATEGY_REQUIRED',
      'Vincula una estrategia revisada antes de aprobar el contenido.',
    )
  await tx.client.query(
    'SELECT id FROM vcm.protected_objects WHERE id=$1 FOR UPDATE',
    ['campaign:' + content.campaign_id],
  )
  await approvedCampaign(tx, content.campaign_id, revision.campaign_revision_id)
  await assertAction(tx, 'query', 'case:' + content.case_id)
  if (
    (
      await tx.client.query(
        "SELECT 1 FROM vcm.decisions d JOIN vcm.protected_objects o ON o.id=d.protected_object_id WHERE d.case_id=$1 AND o.archived_at IS NULL AND d.status NOT IN('approved','rejected','closed')",
        [content.case_id],
      )
    ).rowCount
  )
    throw new ApiError(
      422,
      'PENDING_DECISIONS',
      'Resuelve las decisiones del expediente antes de aprobar contenido.',
    )
  const assets = (
    await tx.client.query(
      'SELECT d.id,d.url,d.external_id FROM vcm.content_assets a JOIN vcm.document_references d ON d.id=a.document_id WHERE a.content_revision_id=$1',
      [revision.id],
    )
  ).rows
  if (
    !revision.brief.trim() ||
    !revision.copy.trim() ||
    !revision.channel.trim() ||
    !revision.scheduled_at ||
    !assets.length
  )
    throw new ApiError(
      422,
      'CONTENT_INCOMPLETE',
      'Completa brief, copy, canal, fecha y activos antes de aprobar.',
    )
  for (const asset of assets) {
    await assertAction(tx, 'query', 'document:' + asset.id)
    if (!asset.url && !asset.external_id)
      throw new ApiError(
        422,
        'ASSET_PENDING',
        'Un activo todavía no tiene una referencia verificable.',
      )
  }
  return { content, revision }
}
export async function contentApproval(
  tx: TransactionContext,
  contentId: string,
  revisionId: string,
  lockPackage = false,
) {
  const direct = await activeApproval(tx, revisionId)
  if (direct) return direct
  const candidates = (
    await tx.client.query(
      `SELECT r.package_id FROM vcm.package_items i JOIN vcm.package_revisions r ON r.id=i.package_revision_id WHERE i.content_id=$1 AND i.content_revision_id=$2 ORDER BY r.package_id`,
      [contentId, revisionId],
    )
  ).rows
  if (lockPackage)
    for (const candidate of candidates)
      await tx.client.query(
        'SELECT id FROM vcm.protected_objects WHERE id=$1 FOR UPDATE',
        ['package:' + candidate.package_id],
      )
  // Re-read after taking the same root lock as savePackage.
  const rows = (
    await tx.client.query(
      `SELECT a.id FROM vcm.package_items i JOIN vcm.package_revisions r ON r.id=i.package_revision_id JOIN vcm.approval_records a ON a.revision_id=r.id AND a.kind='package' WHERE i.content_id=$1 AND i.content_revision_id=$2 AND r.version=(SELECT max(r2.version) FROM vcm.package_revisions r2 WHERE r2.package_id=r.package_id) AND (a.expires_at IS NULL OR a.expires_at>now()) AND NOT EXISTS(SELECT 1 FROM vcm.approval_revocations x WHERE x.approval_id=a.id)`,
      [contentId, revisionId],
    )
  ).rows
  return rows[0]?.id as string | undefined
}
