import type { TransactionContext } from '../contracts/common.ts'
import { currentMandate } from '../operations/mandates.ts'
import { assertionValue } from './capture.ts'
import { evaluateCaseQa } from '../../../packages/domain/src/cases.ts'
export async function qaIssues(
  tx: TransactionContext,
  caseId: string,
  closing = true,
  lockProjects = false,
) {
  if (lockProjects)
    await tx.client.query(
      "SELECT id FROM vcm.protected_objects WHERE id IN(SELECT 'project:'||project_id FROM vcm.project_cases WHERE case_id=$1) ORDER BY id FOR UPDATE",
      [caseId],
    )
  const c = (
    await tx.client.query('SELECT kind FROM vcm.cases WHERE id=$1', [caseId])
  ).rows[0]
  const fields = await tx.client.query(
    'SELECT f.field_key,f.status,a.* FROM vcm.case_fields f LEFT JOIN vcm.field_assertions a ON a.id=f.selected_assertion_id WHERE f.case_id=$1',
    [caseId],
  )
  const facts = (
    await tx.client.query(
      `SELECT
 EXISTS(SELECT 1 FROM vcm.evidences WHERE case_id=$1 AND review_status='verified') evidence_verified,
 EXISTS(SELECT 1 FROM vcm.presence_records p JOIN vcm.catalog_entries e ON e.code=p.type_code AND e.catalog_version_id=p.type_catalog_id WHERE p.case_id=$1 AND e.active) presence_valid,
 EXISTS(SELECT 1 FROM vcm.decisions d JOIN vcm.protected_objects od ON od.id=d.protected_object_id WHERE d.case_id=$1 AND od.archived_at IS NULL AND d.status NOT IN('approved','rejected','closed')) decisions_pending,
 EXISTS(SELECT 1 FROM vcm.cut_observations WHERE case_id=$1 AND status='open') open_observations,
 EXISTS(SELECT 1 FROM vcm.project_cases WHERE case_id=$1) has_project,
 NOT EXISTS(SELECT 1 FROM vcm.project_cases pc JOIN vcm.projects p ON p.id=pc.project_id WHERE pc.case_id=$1 AND p.execution_state<>'completed') execution_completed`,
      [caseId],
    )
  ).rows[0]
  const projects = (
    await tx.client.query(
      'SELECT project_id FROM vcm.project_cases WHERE case_id=$1',
      [caseId],
    )
  ).rows
  const current = await Promise.all(
    projects.map((p) => currentMandate(tx, p.project_id)),
  )
  facts.mandate_valid = current.every(Boolean)
  return evaluateCaseQa({
    kind: c.kind,
    fields: fields.rows.map((f) => ({
      fieldId: f.field_key,
      status: f.status,
      value: assertionValue(f),
    })),
    closing,
    evidenceVerified: facts.evidence_verified,
    presenceValid: facts.presence_valid,
    decisionsPending: facts.decisions_pending,
    openObservations: facts.open_observations,
    hasProject: facts.has_project,
    executionCompleted: facts.execution_completed,
    mandateValid: facts.mandate_valid,
  })
}
