import { randomUUID, createHash } from 'node:crypto'
import { z } from 'zod'
import { type TransactionContext, id, reason } from '../contracts/common.ts'
import type { CommandRegistry } from '../commands/registry.ts'
import { ApiError } from '../http/errors.ts'
import { assertAction } from '../access/policy.ts'
import { projectTarget, bumpProject } from './helpers.ts'
export async function budgetBasis(tx: TransactionContext, projectId: string) {
  const rows = (
    await tx.client.query(
      'SELECT b.id,b.version,b.planned_amount FROM vcm.budget_items b JOIN vcm.protected_objects o ON o.id=b.protected_object_id WHERE b.project_id=$1 AND o.archived_at IS NULL ORDER BY b.id',
      [projectId],
    )
  ).rows
  return {
    hash: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    unknown: rows.some((r) => r.planned_amount === null),
  }
}
// Shared by execution and QA: approval must still match its exact flow revision.
export async function currentMandate(
  tx: TransactionContext,
  projectId: string,
  action = 'execution.change',
) {
  const rows = (
    await tx.client.query(
      `SELECT m.id,ma.limits FROM vcm.operation_mandates m
       JOIN vcm.approval_records a ON a.id=m.approval_id
       JOIN vcm.mandate_actions ma ON ma.mandate_id=m.id
       JOIN vcm.work_plan_revisions w ON w.id=m.plan_revision_id
       JOIN vcm.decisions d ON d.id::text=ma.limits->>'decisionId'
       JOIN vcm.protected_objects o ON o.id=d.protected_object_id
       JOIN vcm.decision_revisions dr ON dr.id::text=ma.limits->>'decisionRevisionId' AND dr.decision_id=d.id
       WHERE m.project_id=$1 AND ma.action_class=$2 AND m.revoked_at IS NULL
       AND m.valid_from<=now() AND (m.valid_until IS NULL OR m.valid_until>now())
       AND (a.expires_at IS NULL OR a.expires_at>now())
       AND NOT EXISTS(SELECT 1 FROM vcm.approval_revocations ar WHERE ar.approval_id=a.id)
       AND w.version=(SELECT max(w2.version) FROM vcm.work_plan_revisions w2 WHERE w2.project_id=$1)
       AND d.kind='flow' AND d.status IN('approved','in_execution','closed') AND o.archived_at IS NULL
       AND dr.version=(SELECT max(version) FROM vcm.decision_revisions WHERE decision_id=d.id)
       AND EXISTS(SELECT 1 FROM vcm.decision_outcomes outcome WHERE outcome.decision_revision_id=dr.id AND outcome.outcome='approved')`,
      [projectId, action],
    )
  ).rows
  const basis = await budgetBasis(tx, projectId)
  return rows.find((m) => m.limits.budgetBasis === basis.hash && !basis.unknown)
    ?.id as string | undefined
}
export async function requireMandate(
  tx: TransactionContext,
  projectId: string,
  action: string,
) {
  await tx.client.query(
    'SELECT id FROM vcm.protected_objects WHERE id=$1 FOR UPDATE',
    ['project:' + projectId],
  )
  const mandate = await currentMandate(tx, projectId, action)
  if (!mandate)
    throw new ApiError(
      422,
      'MANDATE_REQUIRED',
      'Requiere un flujo y plan aprobados vigentes y una base presupuestaria sin cambios.',
    )
  return mandate
}
export async function createApproval(
  tx: TransactionContext,
  objectId: string,
  revisionId: string,
  kind: string,
  reason: string,
) {
  const approvalId = randomUUID()
  await tx.client.query(
    'INSERT INTO vcm.approval_records(id,object_id,revision_id,kind,approved_by,reason) VALUES($1,$2,$3,$4,$5,$6)',
    [approvalId, objectId, revisionId, kind, tx.principal.id, reason],
  )
  return approvalId
}
export function registerMandates(registry: CommandRegistry) {
  registry.register({
    type: 'saveWorkPlan',
    action: 'editOperationalDraft',
    schema: z.strictObject({
      type: z.literal('saveWorkPlan'),
      projectId: id,
      objective: z.string().max(20000),
      resultsPlanned: z.string().max(20000),
      scopeIncluded: z.string().max(20000),
      scopeExcluded: z.string().max(20000),
      closingCriteria: z.string().max(20000),
      expectedEvidence: z.string().max(20000),
      risks: z.string().max(20000),
      reason,
    }),
    target: projectTarget,
    async run(tx, cmd, target) {
      const revisionId = randomUUID(),
        version = target!.version + 1
      await tx.client.query(
        'INSERT INTO vcm.work_plan_revisions(id,project_id,version,objective,results_planned,scope_included,scope_excluded,closing_criteria,expected_evidence,risks,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [
          revisionId,
          cmd.projectId,
          version,
          cmd.objective,
          cmd.resultsPlanned,
          cmd.scopeIncluded,
          cmd.scopeExcluded,
          cmd.closingCriteria,
          cmd.expectedEvidence,
          cmd.risks,
          tx.principal.id,
        ],
      )
      await tx.client.query(
        'UPDATE vcm.operation_mandates SET revoked_at=now() WHERE project_id=$1 AND revoked_at IS NULL',
        [cmd.projectId],
      )
      return {
        objectId: target!.objectId,
        version: await bumpProject(tx, cmd.projectId),
        result: { revisionId },
        after: { revisionId },
      }
    },
  })
  registry.register({
    type: 'approveWorkPlan',
    action: 'approveStrategyOrContent',
    schema: z.strictObject({
      type: z.literal('approveWorkPlan'),
      projectId: id,
      decisionId: id,
      revisionId: id,
      validUntil: z.iso.datetime().nullable().optional(),
      reason,
    }),
    target: projectTarget,
    async run(tx, cmd, target) {
      await assertAction(tx, 'query', 'decision:' + cmd.decisionId)
      await tx.client.query(
        'SELECT id FROM vcm.protected_objects WHERE id=$1 FOR UPDATE',
        ['decision:' + cmd.decisionId],
      )
      const d = await tx.client.query(
        "SELECT (SELECT id FROM vcm.decision_revisions WHERE decision_id=d.id ORDER BY version DESC LIMIT 1) revision_id FROM vcm.decisions d JOIN vcm.project_cases pc ON pc.case_id=d.case_id WHERE d.id=$1 AND d.kind='flow' AND d.status='approved' AND pc.project_id=$2 AND EXISTS(SELECT 1 FROM vcm.decision_outcomes o JOIN vcm.decision_revisions r ON r.id=o.decision_revision_id WHERE r.decision_id=d.id AND r.version=(SELECT max(r2.version) FROM vcm.decision_revisions r2 WHERE r2.decision_id=d.id) AND o.outcome='approved')",
        [cmd.decisionId, cmd.projectId],
      )
      if (!d.rowCount)
        throw new ApiError(
          422,
          'FLOW_DECISION_REQUIRED',
          'Requiere una decisión humana de flujo aprobada para este proyecto.',
        )
      const w = (
        await tx.client.query(
          'SELECT * FROM vcm.work_plan_revisions WHERE id=$1 AND project_id=$2 AND version=(SELECT max(version) FROM vcm.work_plan_revisions WHERE project_id=$2)',
          [cmd.revisionId, cmd.projectId],
        )
      ).rows[0]
      if (
        !w ||
        [
          'objective',
          'results_planned',
          'scope_included',
          'scope_excluded',
          'closing_criteria',
          'expected_evidence',
          'risks',
        ].some((k) => !w[k]?.trim())
      )
        throw new ApiError(
          422,
          'WORK_PLAN_INCOMPLETE',
          'Completa y revisa el alcance del plan de trabajo.',
        )
      const basis = await budgetBasis(tx, cmd.projectId)
      if (basis.unknown)
        throw new ApiError(
          422,
          'UNKNOWN_BUDGET',
          'Completa los importes previstos antes de aprobar.',
        )
      const approvalId = await createApproval(
          tx,
          target!.objectId,
          cmd.revisionId,
          'flow',
          cmd.reason,
        ),
        mandateId = randomUUID()
      await tx.client.query(
        'INSERT INTO vcm.operation_mandates(id,project_id,plan_revision_id,approval_id,valid_until) VALUES($1,$2,$3,$4,$5)',
        [
          mandateId,
          cmd.projectId,
          cmd.revisionId,
          approvalId,
          cmd.validUntil ?? null,
        ],
      )
      for (const action of [
        'execution.change',
        'task.update',
        'expense.record',
        'commitment.record',
      ])
        await tx.client.query(
          'INSERT INTO vcm.mandate_actions(mandate_id,action_class,limits) VALUES($1,$2,$3)',
          [
            mandateId,
            action,
            JSON.stringify({
              budgetBasis: basis.hash,
              decisionId: cmd.decisionId,
              decisionRevisionId: d.rows[0].revision_id,
            }),
          ],
        )
      return {
        objectId: target!.objectId,
        version: await bumpProject(tx, cmd.projectId),
        result: { mandateId, approvalId },
        after: { mandateId, revisionId: cmd.revisionId },
      }
    },
  })
  registry.register({
    type: 'revokeMandate',
    action: 'approveStrategyOrContent',
    schema: z.strictObject({
      type: z.literal('revokeMandate'),
      projectId: id,
      mandateId: id,
      reason,
    }),
    target: projectTarget,
    async run(tx, cmd, target) {
      const r = await tx.client.query(
        'UPDATE vcm.operation_mandates SET revoked_at=now() WHERE id=$1 AND project_id=$2 RETURNING approval_id',
        [cmd.mandateId, cmd.projectId],
      )
      if (!r.rowCount)
        throw new ApiError(404, 'NOT_FOUND', 'Mandato no encontrado.')
      await tx.client.query(
        'INSERT INTO vcm.approval_revocations(approval_id,revoked_by,reason) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [r.rows[0].approval_id, tx.principal.id, cmd.reason],
      )
      return {
        objectId: target!.objectId,
        version: await bumpProject(tx, cmd.projectId),
        result: { id: cmd.mandateId },
        after: { revoked: true },
      }
    },
  })
}
