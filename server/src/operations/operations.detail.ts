import type { TransactionContext } from '../contracts/common.ts'
import { visibilityPredicate } from '../access/visibility.ts'

async function visible(tx: TransactionContext, objectId: string) {
  const p = visibilityPredicate(tx.principal, 'o', 2)
  return !!(
    await tx.client.query(
      'SELECT 1 FROM vcm.protected_objects o WHERE o.id=$1 AND ' + p.sql,
      [objectId, ...p.values],
    )
  ).rowCount
}
// Detail projections contain business records only; identity secrets never enter these queries.
export async function operationalDetail(
  tx: TransactionContext,
  path: string,
  id: string,
  row: Record<string, unknown>,
) {
  if (path === 'plans') {
    const revision =
      (
        await tx.client.query(
          'SELECT id,version,reason,actor_id AS "actorId" FROM vcm.plan_revisions WHERE plan_id=$1 ORDER BY version DESC LIMIT 1',
          [id],
        )
      ).rows[0] ?? null
    if (revision) {
      revision.objectives = (
        await tx.client.query(
          'SELECT id,title,responsible_id AS "responsibleId",responsible_label AS "responsibleLabel",due_on AS "dueOn",target,measure,resources,dependencies FROM vcm.plan_objectives WHERE plan_revision_id=$1 ORDER BY id',
          [revision.id],
        )
      ).rows
      for (const objective of revision.objectives) {
        const p = visibilityPredicate(tx.principal, 'o', 2)
        objective.caseIds = (
          await tx.client.query(
            'SELECT c.id FROM vcm.objective_cases oc JOIN vcm.cases c ON c.id=oc.case_id JOIN vcm.protected_objects o ON o.id=c.protected_object_id WHERE oc.objective_id=$1 AND ' +
              p.sql,
            [objective.id, ...p.values],
          )
        ).rows.map((x) => x.id)
      }
    }
    row.revision = revision
  }
  if (path === 'decisions') {
    const revision =
      (
        await tx.client.query(
          'SELECT id,version,proposal,alternatives,recommendation,impact,amount::text,project_id AS "projectId",requested_by AS "requestedBy",created_at AS "createdAt" FROM vcm.decision_revisions WHERE decision_id=$1 ORDER BY version DESC LIMIT 1',
          [id],
        )
      ).rows[0] ?? null
    if (
      revision?.projectId &&
      !(await visible(tx, 'project:' + revision.projectId))
    )
      revision.projectId = null
    row.revision = revision
    row.outcomes = (
      await tx.client.query(
        'SELECT o.id,o.decision_revision_id AS "revisionId",o.outcome,o.reason,o.decided_by AS "decidedBy",o.decided_at AS "decidedAt" FROM vcm.decision_outcomes o JOIN vcm.decision_revisions r ON r.id=o.decision_revision_id WHERE r.decision_id=$1 ORDER BY o.decided_at,o.id',
        [id],
      )
    ).rows
  }
  if (path === 'projects') {
    row.workPlanRevision =
      (
        await tx.client.query(
          'SELECT id,version,objective,results_planned AS "resultsPlanned",scope_included AS "scopeIncluded",scope_excluded AS "scopeExcluded",closing_criteria AS "closingCriteria",expected_evidence AS "expectedEvidence",risks,actor_id AS "actorId" FROM vcm.work_plan_revisions WHERE project_id=$1 ORDER BY version DESC LIMIT 1',
          [id],
        )
      ).rows[0] ?? null
    const mandates = (
      await tx.client.query(
        'SELECT id,plan_revision_id AS "planRevisionId",approval_id AS "approvalId",valid_from AS "validFrom",valid_until AS "validUntil",revoked_at AS "revokedAt" FROM vcm.operation_mandates WHERE project_id=$1 ORDER BY valid_from,id',
        [id],
      )
    ).rows
    row.mandates = []
    for (const mandate of mandates) {
      mandate.actions = (
        await tx.client.query(
          'SELECT action_class AS "actionClass",limits FROM vcm.mandate_actions WHERE mandate_id=$1 ORDER BY action_class',
          [mandate.id],
        )
      ).rows
      let allowed = true
      for (const action of mandate.actions)
        if (
          typeof action.limits.decisionId === 'string' &&
          !(await visible(tx, 'decision:' + action.limits.decisionId))
        )
          allowed = false
      if (allowed) (row.mandates as unknown[]).push(mandate)
    }
    const p = visibilityPredicate(tx.principal, 'o', 2)
    row.budgetAuthorizations = (
      await tx.client.query(
        `SELECT a.id,a.decision_revision_id AS "decisionRevisionId",a.approval_id AS "approvalId",a.amount::text,a.valid_from AS "validFrom",a.valid_until AS "validUntil",d.id AS "decisionId",EXISTS(SELECT 1 FROM vcm.budget_authorization_revocations r WHERE r.authorization_id=a.id) OR EXISTS(SELECT 1 FROM vcm.approval_revocations r WHERE r.approval_id=a.approval_id) AS revoked FROM vcm.budget_authorizations a JOIN vcm.decision_revisions dr ON dr.id=a.decision_revision_id JOIN vcm.decisions d ON d.id=dr.decision_id JOIN vcm.protected_objects o ON o.id=d.protected_object_id WHERE a.project_id=$1 AND ${p.sql} ORDER BY a.valid_from,a.id`,
        [id, ...p.values],
      )
    ).rows
    for (const task of row.tasks as Record<string, unknown>[]) {
      const p = visibilityPredicate(tx.principal, 'o', 2)
      task.assigneeIds = (
        await tx.client.query(
          "SELECT ta.contact_id FROM vcm.task_assignees ta JOIN vcm.contacts c ON c.id=ta.contact_id JOIN vcm.protected_objects o ON o.id='contact:'||c.id WHERE ta.task_id=$1 AND ta.active AND " +
            p.sql,
          [task.id, ...p.values],
        )
      ).rows.map((x) => x.contact_id)
      task.dependencies = (
        await tx.client.query(
          'SELECT depends_on_id FROM vcm.task_dependencies WHERE task_id=$1 AND active ORDER BY depends_on_id',
          [task.id],
        )
      ).rows.map((x) => x.depends_on_id)
    }
  }
  return row
}
