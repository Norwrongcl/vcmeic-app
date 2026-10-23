import type { TransactionContext } from '../contracts/common.ts'
import type { ResourceDefinition } from '../operations/resources.ts'
import { resourceController } from '../operations/operations.controller.ts'
import { readResource } from '../operations/operations.read.ts'
import {
  latestRevision,
  activeApproval,
  contentApproval,
  approvedCampaign,
} from './approvals.ts'
import { visibilityPredicate } from '../access/visibility.ts'
import { ApiError } from '../http/errors.ts'
export const communicationResources: ResourceDefinition[] = [
  {
    path: 'campaigns',
    table: 'campaigns',
    kind: 'campaign',
    idKey: 'id',
    create: ['saveCampaign'],
    commands: ['saveCampaign', 'approveCampaign'],
    fields: { name: 'name', caseId: 'case_id' },
  },
  {
    path: 'contents',
    table: 'contents',
    kind: 'content',
    idKey: 'id',
    create: ['saveContent'],
    commands: ['saveContent', 'approveContent', 'requestPublication'],
    fields: {
      title: 'title',
      caseId: 'case_id',
      campaignId: 'campaign_id',
      mode: 'mode',
    },
  },
  {
    path: 'editorial-packages',
    table: 'editorial_packages',
    kind: 'package',
    idKey: 'id',
    create: ['savePackage'],
    commands: ['savePackage', 'approvePackage'],
    fields: { name: 'name', startsOn: 'period_starts_on' },
  },
]
async function communicationRead(
  tx: TransactionContext,
  resource: ResourceDefinition,
  id?: string,
  query?: unknown,
) {
  const base = await readResource(tx, resource, id, query)
  if (!id) return base
  const result = base as Record<string, unknown>,
    table =
      resource.path === 'campaigns'
        ? 'campaign_revisions'
        : resource.path === 'contents'
          ? 'content_revisions'
          : 'package_revisions',
    column =
      resource.path === 'campaigns'
        ? 'campaign_id'
        : resource.path === 'contents'
          ? 'content_id'
          : 'package_id'
  const revision = await latestRevision(tx, table, column, id)
  if (resource.path === 'contents' && !result.campaignId)
    revision.campaign_revision_id = null
  result.revision = revision
  result.integration = 'integration_pending'
  if (resource.path === 'contents') {
    const pred = visibilityPredicate(tx.principal, 'o', 2)
    result.assets = (
      await tx.client.query(
        'SELECT d.id,d.name,d.url FROM vcm.content_assets ca JOIN vcm.document_references d ON d.id=ca.document_id JOIN vcm.protected_objects o ON o.id=d.protected_object_id WHERE ca.content_revision_id=$1 AND ' +
          pred.sql,
        [revision.id, ...pred.values],
      )
    ).rows
    let strategy = false
    try {
      if (typeof result.campaignId === 'string') {
        await approvedCampaign(
          tx,
          result.campaignId,
          revision.campaign_revision_id,
        )
        strategy = true
      }
    } catch (e) {
      if (!(e instanceof ApiError && [403, 404, 422].includes(e.status)))
        throw e
    }
    result.approved = strategy && !!(await contentApproval(tx, id, revision.id))
  } else result.approved = !!(await activeApproval(tx, revision.id))
  if (resource.path === 'editorial-packages') {
    const pred = visibilityPredicate(tx.principal, 'o', 2)
    result.items = (
      await tx.client.query(
        'SELECT i.content_id AS "contentId",i.content_revision_id AS "revisionId" FROM vcm.package_items i JOIN vcm.contents c ON c.id=i.content_id JOIN vcm.protected_objects o ON o.id=c.protected_object_id WHERE i.package_revision_id=$1 AND ' +
          pred.sql,
        [revision.id, ...pred.values],
      )
    ).rows
  }
  return result
}
export const communicationControllers = communicationResources.map((r) =>
  resourceController(r, communicationRead),
)
