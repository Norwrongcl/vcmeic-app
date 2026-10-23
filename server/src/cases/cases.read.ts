import type { TransactionContext } from '../contracts/common.ts'
import { assertAction } from '../access/policy.ts'
import { visibilityPredicate } from '../access/visibility.ts'
import { assertionValue } from '../capture/capture.ts'
export async function readCase(tx: TransactionContext, caseId: string) {
  const row = (
    await tx.client.query(
      'SELECT c.*,o.confidentiality FROM vcm.cases c JOIN vcm.protected_objects o ON o.id=c.protected_object_id WHERE c.id=$1',
      [caseId],
    )
  ).rows[0]
  await assertAction(tx, 'query', row?.protected_object_id ?? 'case:' + caseId)
  const fields = (
    await tx.client.query(
      'SELECT f.field_key,f.schema_version,f.status,f.observation,f.selected_assertion_id FROM vcm.case_fields f WHERE f.case_id=$1 ORDER BY f.field_key',
      [caseId],
    )
  ).rows
  const assertions = (
    await tx.client.query(
      'SELECT a.*,s.name source_name,s.channel,s.external_reference FROM vcm.field_assertions a JOIN vcm.sources s ON s.id=a.source_id WHERE a.case_id=$1 ORDER BY a.captured_at,a.id',
      [caseId],
    )
  ).rows
  const pred = visibilityPredicate(tx.principal, 'o', 2)
  const evidence = (
    await tx.client.query(
      'SELECT e.id,e.name,e.review_status AS "reviewStatus",e.document_id AS "documentId",d.url,e.version FROM vcm.evidences e JOIN vcm.document_references d ON d.id=e.document_id JOIN vcm.protected_objects o ON o.id=d.protected_object_id WHERE e.case_id=$1 AND ' +
        pred.sql +
        ' ORDER BY e.id',
      [caseId, ...pred.values],
    )
  ).rows
  const visibleEvidence = new Set(evidence.map((e) => e.id))
  const agreementPred = visibilityPredicate(tx.principal, 'o', 2)
  const agreements = (
    await tx.client.query(
      'SELECT a.id,a.name FROM vcm.case_agreements ca JOIN vcm.agreements a ON a.id=ca.agreement_id JOIN vcm.protected_objects o ON o.id=a.protected_object_id WHERE ca.case_id=$1 AND ca.active AND ' +
        agreementPred.sql,
      [caseId, ...agreementPred.values],
    )
  ).rows
  const visibleAgreements = new Set(agreements.map((a) => a.id))
  const orgIds = assertions
    .flatMap((a) =>
      Array.isArray(a.references_value) ? a.references_value : [],
    )
    .filter((r) => r.type === 'organization')
    .map((r) => r.id)
  const orgPred = visibilityPredicate(tx.principal, 'o', 2)
  const visibleOrganizations = new Set(
    (
      await tx.client.query(
        "SELECT org.id FROM vcm.organizations org JOIN vcm.protected_objects o ON o.id='organization:'||org.id WHERE org.id=ANY($1::text[]) AND " +
          orgPred.sql,
        [orgIds, ...orgPred.values],
      )
    ).rows.map((r) => r.id),
  )
  const sanitize = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((r) =>
          r.type === 'evidence'
            ? visibleEvidence.has(r.id)
            : r.type === 'agreement'
              ? visibleAgreements.has(r.id)
              : r.type === 'organization' && visibleOrganizations.has(r.id),
        )
      : value
  const record = (
    await tx.client.query(
      'SELECT validation_status FROM vcm.presence_records WHERE case_id=$1 UNION ALL SELECT validation_status FROM vcm.activity_records WHERE case_id=$1',
      [caseId],
    )
  ).rows[0]
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    kind: row.kind,
    state: row.state,
    priority: row.priority,
    version: row.version,
    confidentiality: row.confidentiality,
    record: { validationStatus: record?.validation_status ?? 'pending' },
    fields: fields
      .filter(
        (f) =>
          f.field_key !== 'taxId' ||
          (tx.principal.kind === 'human' &&
            tx.principal.roles.some((r) =>
              ['coordination', 'leadership', 'direction'].includes(r),
            )),
      )
      .map((f) => ({
        fieldId: f.field_key,
        schemaVersion: f.schema_version,
        status: f.status,
        observation: f.observation,
        value: sanitize(
          assertionValue(
            assertions.find((a) => a.id === f.selected_assertion_id) ?? {},
          ),
        ),
        assertions: assertions
          .filter((a) => a.field_key === f.field_key)
          .map((a) => ({
            id: a.id,
            value: sanitize(assertionValue(a)),
            source: {
              id: a.source_id,
              name: a.source_name,
              channel: a.channel,
              externalReference: a.external_reference,
            },
            capturedAt: a.captured_at,
          })),
      })),
    evidence,
    agreements,
  }
}
