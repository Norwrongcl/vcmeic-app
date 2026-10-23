import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { CommandRegistry } from '../commands/registry.ts'
import { id, reason } from '../contracts/common.ts'
import { assertAction } from '../access/policy.ts'
import { ApiError } from '../http/errors.ts'
import { protectedTarget, ownObject } from '../operations/helpers.ts'
import { createApproval } from '../operations/mandates.ts'
import { latestRevision } from './approvals.ts'
import {
  charterFields,
  charterIssues,
} from '../../../packages/domain/src/campaigns.ts'
const charter = z.strictObject(
  Object.fromEntries(
    charterFields.map((key) => [key, z.string().max(20000).default('')]),
  ),
)
export function registerCampaigns(registry: CommandRegistry) {
  registry.register({
    type: 'saveCampaign',
    action: 'editOperationalDraft',
    schema: z.strictObject({
      type: z.literal('saveCampaign'),
      id: id.optional(),
      caseId: id,
      name: z.string().trim().min(1).max(500),
      charter,
    }),
    async target(tx, cmd) {
      return cmd.id
        ? protectedTarget(tx, 'campaigns', 'campaign', cmd.id)
        : undefined
    },
    async run(tx, cmd, target) {
      await assertAction(tx, 'editOperationalDraft', 'case:' + cmd.caseId)
      const cid = cmd.id ?? randomUUID(),
        version = (target?.version ?? 0) + 1
      if (target) {
        if (
          (
            await tx.client.query(
              'SELECT case_id FROM vcm.campaigns WHERE id=$1',
              [cid],
            )
          ).rows[0].case_id !== cmd.caseId
        )
          throw new ApiError(
            422,
            'CAMPAIGN_CASE_MISMATCH',
            'La campaña no cambia de expediente.',
          )
        await tx.client.query(
          'UPDATE vcm.campaigns SET name=$1,version=version+1 WHERE id=$2',
          [cmd.name, cid],
        )
      } else {
        await tx.client.query(
          'INSERT INTO vcm.campaigns(id,case_id,name,responsible_id) VALUES($1,$2,$3,$4)',
          [cid, cmd.caseId, cmd.name, tx.principal.id],
        )
        await ownObject(tx, 'campaign', cid)
      }
      const revisionId = randomUUID()
      await tx.client.query(
        'INSERT INTO vcm.campaign_revisions(id,campaign_id,version,charter,actor_id) VALUES($1,$2,$3,$4,$5)',
        [
          revisionId,
          cid,
          version,
          JSON.stringify(cmd.charter),
          tx.principal.id,
        ],
      )
      return {
        objectId: 'campaign:' + cid,
        version,
        result: { id: cid, revisionId },
        after: { revisionId, charter: cmd.charter },
      }
    },
  })
  registry.register({
    type: 'approveCampaign',
    action: 'approveStrategyOrContent',
    schema: z.strictObject({
      type: z.literal('approveCampaign'),
      id,
      revisionId: id,
      reason,
    }),
    async target(tx, cmd) {
      return protectedTarget(tx, 'campaigns', 'campaign', cmd.id)
    },
    async run(tx, cmd, target) {
      const rev = await latestRevision(
        tx,
        'campaign_revisions',
        'campaign_id',
        cmd.id,
      )
      if (rev.id !== cmd.revisionId)
        throw new ApiError(409, 'REVISION_CONFLICT', 'La estrategia cambió.')
      if (charterIssues(rev.charter).length)
        throw new ApiError(
          422,
          'CHARTER_INCOMPLETE',
          'Completa el Campaign Charter antes de aprobar.',
        )
      const campaign = (
        await tx.client.query('SELECT case_id FROM vcm.campaigns WHERE id=$1', [
          cmd.id,
        ])
      ).rows[0]
      await assertAction(tx, 'query', 'case:' + campaign.case_id)
      const approvalId = await createApproval(
        tx,
        target!.objectId,
        rev.id,
        'campaign',
        cmd.reason,
      )
      await tx.client.query(
        'UPDATE vcm.campaigns SET version=version+1 WHERE id=$1',
        [cmd.id],
      )
      return {
        objectId: target!.objectId,
        version: target!.version + 1,
        result: { approvalId },
        after: { revisionId: rev.id, approved: true },
      }
    },
  })
}
