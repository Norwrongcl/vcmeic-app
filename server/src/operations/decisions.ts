import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { CommandRegistry } from '../commands/registry.ts'
import { id, reason, money } from '../contracts/common.ts'
import { ApiError } from '../http/errors.ts'
import { assertAction } from '../access/policy.ts'
import { protectedTarget, ownObject, assertProjectCase } from './helpers.ts'
import { createApproval } from './mandates.ts'
import { decisionOptions } from '../../../packages/domain/src/decisions.ts'
const proposal = {
  caseId: id,
  projectId: id.optional(),
  kind: z.enum(['priority', 'budget', 'exception', 'flow']),
  title: z.string().trim().min(1).max(500),
  proposal: z.string().trim().min(1).max(20000),
  alternatives: z.string().max(20000).default(''),
  recommendation: z.string().max(20000).default(''),
  impact: z.string().max(20000).default(''),
  amount: money.nullable().optional(),
  authority: z.enum(['coordination', 'leadership', 'direction']).optional(),
  reason,
}
// Serialize authority changes with operations using the project root lock.
async function lockDecisionProjects(
  tx: import('../contracts/common.ts').TransactionContext,
  decisionId: string,
) {
  await tx.client.query(
    `SELECT id FROM vcm.protected_objects WHERE id IN(
    SELECT 'project:'||project_id FROM vcm.decision_revisions WHERE decision_id=$1 AND project_id IS NOT NULL
    UNION SELECT 'project:'||m.project_id FROM vcm.operation_mandates m JOIN vcm.mandate_actions a ON a.mandate_id=m.id WHERE a.limits->>'decisionId'=$1
  ) ORDER BY id FOR UPDATE`,
    [decisionId],
  )
}
export function registerDecisions(registry: CommandRegistry) {
  for (const type of ['proposeDecision', 'reviseDecision'])
    registry.register({
      type,
      action: 'editOperationalDraft',
      schema: z.strictObject({
        type: z.literal(type),
        ...(type === 'reviseDecision' ? { id } : {}),
        ...proposal,
      }),
      async target(tx, cmd) {
        return type === 'proposeDecision'
          ? undefined
          : protectedTarget(tx, 'decisions', 'decision', cmd.id)
      },
      async run(tx, cmd, target) {
        await assertAction(tx, 'editOperationalDraft', 'case:' + cmd.caseId)
        if (cmd.projectId)
          await assertProjectCase(tx, cmd.projectId, cmd.caseId)
        const decisionId = typeof cmd.id === 'string' ? cmd.id : randomUUID(),
          version = (target?.version ?? 0) + 1,
          authority =
            cmd.kind === 'budget'
              ? 'direction'
              : (cmd.authority ?? 'coordination')
        if (target) {
          await lockDecisionProjects(tx, decisionId)
          const old = (
            await tx.client.query(
              'SELECT case_id FROM vcm.decisions WHERE id=$1',
              [decisionId],
            )
          ).rows[0]
          if (old.case_id !== cmd.caseId)
            throw new ApiError(
              422,
              'DECISION_CASE_MISMATCH',
              'La decisión no cambia de expediente.',
            )
          await tx.client.query(
            "UPDATE vcm.decisions SET kind=$1,title=$2,authority=$3,status='pending',version=version+1 WHERE id=$4",
            [cmd.kind, cmd.title, authority, decisionId],
          )
          await tx.client.query(
            'INSERT INTO vcm.approval_revocations(approval_id,revoked_by,reason) SELECT id,$2,$3 FROM vcm.approval_records WHERE object_id=$1 ON CONFLICT DO NOTHING',
            ['decision:' + decisionId, tx.principal.id, cmd.reason],
          )
        } else {
          await tx.client.query(
            'INSERT INTO vcm.decisions(id,case_id,kind,title,authority) VALUES($1,$2,$3,$4,$5)',
            [decisionId, cmd.caseId, cmd.kind, cmd.title, authority],
          )
          await ownObject(tx, 'decision', decisionId)
        }
        const revisionId = randomUUID()
        await tx.client.query(
          'INSERT INTO vcm.decision_revisions(id,decision_id,version,proposal,alternatives,recommendation,impact,amount,requested_by,project_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [
            revisionId,
            decisionId,
            version,
            cmd.proposal,
            cmd.alternatives,
            cmd.recommendation,
            cmd.impact,
            cmd.amount ?? null,
            tx.principal.id,
            cmd.projectId ?? null,
          ],
        )
        return {
          objectId: 'decision:' + decisionId,
          version,
          result: { id: decisionId, revisionId },
          after: { decisionId, revisionId, authority },
        }
      },
    })
  registry.register({
    type: 'decide',
    action: 'resolveDecision',
    schema: z.strictObject({
      type: z.literal('decide'),
      id,
      status: z.enum([
        'pending',
        'coordination_review',
        'leadership_review',
        'direction_required',
        'approved',
        'rejected',
        'returned',
        'postponed',
        'in_execution',
        'closed',
        'escalated',
      ]),
      reason,
    }),
    async target(tx, cmd) {
      return protectedTarget(tx, 'decisions', 'decision', cmd.id)
    },
    async run(tx, cmd, target) {
      await lockDecisionProjects(tx, cmd.id)
      const d = (
        await tx.client.query('SELECT * FROM vcm.decisions WHERE id=$1', [
          cmd.id,
        ])
      ).rows[0]
      if (
        !tx.principal.roles.some((role) =>
          decisionOptions(
            { kind: d.kind, status: d.status, authority: d.authority },
            role,
          ).includes(cmd.status),
        )
      )
        throw new ApiError(
          403,
          'AUTHORITY_REQUIRED',
          'La decisión requiere la autoridad y etapa correspondientes.',
        )
      await assertAction(tx, 'query', 'case:' + d.case_id)
      const revision = (
        await tx.client.query(
          'SELECT * FROM vcm.decision_revisions WHERE decision_id=$1 ORDER BY version DESC LIMIT 1',
          [cmd.id],
        )
      ).rows[0]
      let authorizationId: string | undefined
      if (cmd.status === 'approved' && d.kind === 'budget') {
        if (!revision.project_id || revision.amount === null)
          throw new ApiError(
            422,
            'BUDGET_DESTINATION_REQUIRED',
            'Define el proyecto y monto en la propuesta antes de aprobar.',
          )
        await assertProjectCase(tx, revision.project_id, d.case_id)
        await tx.client.query(
          'SELECT id FROM vcm.protected_objects WHERE id=$1 FOR UPDATE',
          ['project:' + revision.project_id],
        )
        const approvalId = await createApproval(
          tx,
          target!.objectId,
          revision.id,
          'budget',
          cmd.reason,
        )
        authorizationId = randomUUID()
        await tx.client.query(
          'INSERT INTO vcm.budget_authorizations(id,project_id,decision_revision_id,approval_id,amount) VALUES($1,$2,$3,$4,$5)',
          [
            authorizationId,
            revision.project_id,
            revision.id,
            approvalId,
            revision.amount,
          ],
        )
      }
      if (
        ['approved', 'rejected', 'returned', 'postponed'].includes(cmd.status)
      )
        await tx.client.query(
          "INSERT INTO vcm.decision_outcomes(id,decision_revision_id,decided_by,recorded_by,outcome,reason,channel) VALUES($1,$2,$3,$3,$4,$5,'web')",
          [randomUUID(), revision.id, tx.principal.id, cmd.status, cmd.reason],
        )
      if (['returned', 'rejected', 'postponed'].includes(cmd.status))
        await tx.client.query(
          'INSERT INTO vcm.approval_revocations(approval_id,revoked_by,reason) SELECT id,$2,$3 FROM vcm.approval_records WHERE object_id=$1 ON CONFLICT DO NOTHING',
          [target!.objectId, tx.principal.id, cmd.reason],
        )
      await tx.client.query(
        'UPDATE vcm.decisions SET status=$1,version=version+1,updated_at=now() WHERE id=$2',
        [cmd.status, cmd.id],
      )
      return {
        objectId: target!.objectId,
        version: target!.version + 1,
        result: {
          id: cmd.id,
          status: cmd.status,
          ...(authorizationId ? { authorizationId } : {}),
        },
        before: { status: d.status },
        after: { status: cmd.status, revisionId: revision.id },
      }
    },
  })
}
