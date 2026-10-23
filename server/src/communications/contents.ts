import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { CommandRegistry } from '../commands/registry.ts'
import { id, reason } from '../contracts/common.ts'
import { assertAction } from '../access/policy.ts'
import { ApiError } from '../http/errors.ts'
import { protectedTarget, ownObject } from '../operations/helpers.ts'
import { createApproval } from '../operations/mandates.ts'
import {
  latestRevision,
  completeContent,
  contentApproval,
} from './approvals.ts'
export function registerContents(registry: CommandRegistry) {
  registry.register({
    type: 'saveContent',
    action: 'editOperationalDraft',
    schema: z.strictObject({
      type: z.literal('saveContent'),
      id: id.optional(),
      caseId: id,
      campaignId: id.nullable().optional(),
      campaignRevisionId: id.optional(),
      title: z.string().trim().min(1).max(500),
      mode: z.enum(['weekly', 'exception']),
      brief: z.string().max(20000),
      copy: z.string().max(20000),
      channel: z.string().max(200),
      scheduledAt: z.iso.datetime({ offset: true }).nullable().optional(),
      documentIds: z.array(id).max(50),
    }),
    async target(tx, cmd) {
      return cmd.id
        ? protectedTarget(tx, 'contents', 'content', cmd.id)
        : undefined
    },
    async run(tx, cmd, target) {
      await assertAction(tx, 'editOperationalDraft', 'case:' + cmd.caseId)
      let campaignRevisionId: string | null = null
      if (cmd.campaignId) {
        await assertAction(tx, 'query', 'campaign:' + cmd.campaignId)
        const c = (
          await tx.client.query(
            'SELECT case_id FROM vcm.campaigns WHERE id=$1',
            [cmd.campaignId],
          )
        ).rows[0]
        if (c.case_id !== cmd.caseId)
          throw new ApiError(
            422,
            'CAMPAIGN_CASE_MISMATCH',
            'La estrategia pertenece a otro expediente.',
          )
        const rev = await latestRevision(
          tx,
          'campaign_revisions',
          'campaign_id',
          cmd.campaignId,
        )
        campaignRevisionId = cmd.campaignRevisionId ?? rev.id
        if (
          !(
            await tx.client.query(
              'SELECT 1 FROM vcm.campaign_revisions WHERE id=$1 AND campaign_id=$2',
              [campaignRevisionId, cmd.campaignId],
            )
          ).rowCount
        )
          throw new ApiError(
            422,
            'STRATEGY_MISMATCH',
            'Revisión de otra campaña.',
          )
      } else if (cmd.campaignRevisionId)
        throw new ApiError(
          422,
          'STRATEGY_MISMATCH',
          'Indica la campaña correspondiente.',
        )
      for (const doc of cmd.documentIds)
        await assertAction(tx, 'query', 'document:' + doc)
      const cid = cmd.id ?? randomUUID(),
        version = (target?.version ?? 0) + 1,
        revisionId = randomUUID()
      if (target) {
        if (
          (
            await tx.client.query(
              'SELECT case_id FROM vcm.contents WHERE id=$1',
              [cid],
            )
          ).rows[0].case_id !== cmd.caseId
        )
          throw new ApiError(
            422,
            'CONTENT_CASE_MISMATCH',
            'El contenido no cambia de expediente.',
          )
        await tx.client.query(
          'UPDATE vcm.contents SET title=$1,campaign_id=$2,mode=$3,version=version+1 WHERE id=$4',
          [cmd.title, cmd.campaignId ?? null, cmd.mode, cid],
        )
      } else {
        await tx.client.query(
          'INSERT INTO vcm.contents(id,case_id,campaign_id,title,mode) VALUES($1,$2,$3,$4,$5)',
          [cid, cmd.caseId, cmd.campaignId ?? null, cmd.title, cmd.mode],
        )
        await ownObject(tx, 'content', cid)
      }
      await tx.client.query(
        'INSERT INTO vcm.content_revisions(id,content_id,version,campaign_revision_id,brief,copy,channel,scheduled_at,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [
          revisionId,
          cid,
          version,
          campaignRevisionId,
          cmd.brief,
          cmd.copy,
          cmd.channel,
          cmd.scheduledAt ?? null,
          tx.principal.id,
        ],
      )
      for (const doc of new Set(cmd.documentIds))
        await tx.client.query(
          'INSERT INTO vcm.content_assets(content_revision_id,document_id) VALUES($1,$2)',
          [revisionId, doc],
        )
      return {
        objectId: 'content:' + cid,
        version,
        result: { id: cid, revisionId },
        after: { revisionId, copy: cmd.copy, campaignRevisionId },
      }
    },
  })
  registry.register({
    type: 'approveContent',
    action: 'approveStrategyOrContent',
    schema: z.strictObject({
      type: z.literal('approveContent'),
      id,
      revisionId: id,
      reason,
    }),
    async target(tx, cmd) {
      return protectedTarget(tx, 'contents', 'content', cmd.id)
    },
    async run(tx, cmd, target) {
      const { content, revision } = await completeContent(
        tx,
        cmd.id,
        cmd.revisionId,
      )
      if (content.mode !== 'exception')
        throw new ApiError(
          422,
          'PACKAGE_APPROVAL_REQUIRED',
          'Aprueba el contenido semanal dentro de su paquete.',
        )
      const approvalId = await createApproval(
        tx,
        target!.objectId,
        revision.id,
        'content',
        cmd.reason,
      )
      await tx.client.query(
        'UPDATE vcm.contents SET version=version+1 WHERE id=$1',
        [cmd.id],
      )
      return {
        objectId: target!.objectId,
        version: target!.version + 1,
        result: { approvalId },
        after: { revisionId: revision.id, approved: true },
      }
    },
  })
  registry.register({
    type: 'requestPublication',
    action: 'executeMandate',
    schema: z.strictObject({
      type: z.literal('requestPublication'),
      id,
      reason,
    }),
    async target(tx, cmd) {
      return protectedTarget(tx, 'contents', 'content', cmd.id)
    },
    async run(tx, cmd, target) {
      const { revision } = await completeContent(tx, cmd.id)
      const approvalId = await contentApproval(tx, cmd.id, revision.id, true)
      if (!approvalId)
        throw new ApiError(
          422,
          'CONTENT_APPROVAL_REQUIRED',
          'La revisión actual no tiene aprobación vigente.',
        )
      const operationId = randomUUID()
      const r = await tx.client.query(
        "INSERT INTO vcm.publication_operations(id,content_revision_id,approval_id,provider,idempotency_key,status) VALUES($1,$2,$3,'buffer',$4,'prepared') ON CONFLICT(provider,idempotency_key) DO NOTHING RETURNING id",
        [operationId, revision.id, approvalId, 'content:' + revision.id],
      )
      const actualId =
        r.rows[0]?.id ??
        (
          await tx.client.query(
            "SELECT id FROM vcm.publication_operations WHERE provider='buffer' AND idempotency_key=$1",
            ['content:' + revision.id],
          )
        ).rows[0].id
      await tx.client.query(
        'UPDATE vcm.contents SET version=version+1 WHERE id=$1',
        [cmd.id],
      )
      return {
        objectId: target!.objectId,
        version: target!.version + 1,
        result: { operationId: actualId, status: 'integration_pending' },
        after: { operationId: actualId, status: 'prepared' },
      }
    },
  })
}
