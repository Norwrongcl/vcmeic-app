import type { PrincipalContext } from '../contracts/common.ts'
export interface SqlFragment {
  sql: string
  values: unknown[]
}
export function visibilityPredicate(
  principal: PrincipalContext,
  alias: string,
  start = 1,
  includeArchived = false,
): SqlFragment {
  if (!/^[a-z][a-z0-9_]*$/.test(alias))
    throw new Error('Invalid internal alias')
  const pid = '$' + start,
    broad = '$' + (start + 1),
    interview = '$' + (start + 2)
  const broadRead =
    principal.kind === 'human'
      ? !principal.roles.includes('responsible') && principal.roles.length > 0
      : principal.scopes.includes('coordination:read')
  const isInterview =
    principal.kind === 'service' && principal.scopes.includes('interview:read')
  // Each protected object is evaluated separately; a visible case never exposes its hidden budget/document.
  const assigned = `EXISTS(SELECT 1 FROM vcm.cases vc JOIN vcm.case_assignments ca ON ca.case_id=vc.id WHERE vc.protected_object_id=${alias}.id AND ca.principal_id=${pid} AND ca.valid_from<=now() AND (ca.valid_until IS NULL OR ca.valid_until>now()))`
  const interviewAssigned = `(${assigned} OR EXISTS(SELECT 1 FROM vcm.document_references vd JOIN vcm.evidences ve ON ve.document_id=vd.id JOIN vcm.case_assignments ca ON ca.case_id=ve.case_id WHERE vd.protected_object_id=${alias}.id AND ca.principal_id=${pid} AND ca.valid_from<=now() AND (ca.valid_until IS NULL OR ca.valid_until>now())))`
  const grant = `EXISTS(SELECT 1 FROM vcm.object_grants vg WHERE vg.object_id=${alias}.id AND vg.principal_id=${pid} AND vg.valid_from<=now() AND (vg.valid_until IS NULL OR vg.valid_until>now()))`
  return {
    sql: `(${includeArchived ? 'TRUE' : alias + '.archived_at IS NULL'} AND (CASE WHEN ${interview}::boolean THEN (${interviewAssigned} AND (${alias}.confidentiality='internal' OR ${grant})) ELSE (${alias}.owner_id=${pid} OR ${grant} OR (${alias}.confidentiality='internal' AND (${broad}::boolean OR ${assigned}))) END))`,
    values: [principal.id, broadRead, isInterview],
  }
}
