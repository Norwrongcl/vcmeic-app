import type { TransactionContext } from '../contracts/common.ts'
import { assertAction } from '../access/policy.ts'
import { visibilityPredicate } from '../access/visibility.ts'
import { indicatorSummary } from './indicators.ts'
export async function operationalOverview(
  tx: TransactionContext,
  period: number,
) {
  await assertAction(tx, 'query')
  const pred = visibilityPredicate(tx.principal, 'o')
  const rows = (
    await tx.client.query(
      `SELECT c.id,c.code,c.name,c.kind,c.state,c.priority,c.version,
 (SELECT count(*)::int FROM vcm.case_fields f WHERE f.case_id=c.id AND f.status='conflict') conflicts,
 (SELECT count(*)::int FROM vcm.case_fields f WHERE f.case_id=c.id AND f.status='pending') pending_fields,
 (SELECT a.date_value::text FROM vcm.case_fields f JOIN vcm.field_assertions a ON a.id=f.selected_assertion_id WHERE f.case_id=c.id AND f.field_key='endsAt') due_on
 FROM vcm.cases c JOIN vcm.protected_objects o ON o.id=c.protected_object_id WHERE ${pred.sql} ORDER BY CASE c.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,c.id LIMIT 100`,
      pred.values,
    )
  ).rows
  const decisionPred = visibilityPredicate(tx.principal, 'o')
  const decisions = (
    await tx.client.query(
      "SELECT d.id,d.title,d.status,d.authority FROM vcm.decisions d JOIN vcm.protected_objects o ON o.id=d.protected_object_id WHERE d.status NOT IN('approved','rejected','closed') AND " +
        decisionPred.sql +
        ' ORDER BY d.id LIMIT 100',
      decisionPred.values,
    )
  ).rows
  const projectPred = visibilityPredicate(tx.principal, 'o')
  const agenda = (
    await tx.client.query(
      'SELECT t.id,t.title,t.due_on::text AS "dueOn",t.status,t.project_id AS "projectId" FROM vcm.tasks t JOIN vcm.projects p ON p.id=t.project_id JOIN vcm.protected_objects o ON o.id=p.protected_object_id WHERE t.status NOT IN(\'done\',\'cancelled\') AND ' +
        projectPred.sql +
        ' ORDER BY t.due_on NULLS LAST,t.id LIMIT 100',
      projectPred.values,
    )
  ).rows
  return {
    items: rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      kind: r.kind,
      state: r.state,
      priority: r.priority,
      version: r.version,
      conflicts: r.conflicts,
      pendingFields: r.pending_fields,
      dueOn: r.due_on,
    })),
    priorities: rows
      .filter((r) => r.state !== 'closed')
      .slice(0, 10)
      .map((r) => ({ id: r.id, name: r.name, priority: r.priority })),
    decisions,
    agenda,
    indicators: (await indicatorSummary(tx, period)).items,
    automations: { enabled: false, status: 'pending_integration' },
    nextCursor: null,
  }
}
