import { randomUUID } from 'node:crypto'
import type { TransactionContext } from '../contracts/common.ts'
import { ApiError } from '../http/errors.ts'
import { assertAction } from '../access/policy.ts'
import { addSource } from './capture.ts'
export async function addEvidence(
  tx: TransactionContext,
  caseId: string,
  input: {
    name: string
    url?: string | null
    reason?: string
    processingStatus?: string
  },
) {
  const documentId = randomUUID(),
    evidenceId = randomUUID(),
    sourceId = await addSource(
      tx,
      caseId,
      input.reason ?? 'Referencia documental',
    )
  await tx.client.query(
    'INSERT INTO vcm.document_references(id,name,url) VALUES($1,$2,$3)',
    [documentId, input.name, input.url ?? null],
  )
  await tx.client.query(
    'UPDATE vcm.protected_objects SET owner_id=$1 WHERE id=$2',
    [tx.principal.id, 'document:' + documentId],
  )
  await tx.client.query(
    'INSERT INTO vcm.evidences(id,case_id,document_id,source_id,name) VALUES($1,$2,$3,$4,$5)',
    [evidenceId, caseId, documentId, sourceId, input.name],
  )
  return evidenceId
}
export async function reviewEvidence(
  tx: TransactionContext,
  caseId: string,
  input: {
    evidenceId: string
    result: 'verified' | 'rejected'
    reason: string
  },
) {
  const r = await tx.client.query(
    'SELECT * FROM vcm.evidences WHERE id=$1 AND case_id=$2 FOR UPDATE',
    [input.evidenceId, caseId],
  )
  const evidence = r.rows[0]
  if (!evidence)
    throw new ApiError(404, 'NOT_FOUND', 'Evidencia no encontrada.')
  if (evidence.document_id) {
    await assertAction(tx, 'query', 'document:' + evidence.document_id)
    const doc = (
      await tx.client.query(
        'SELECT url FROM vcm.document_references WHERE id=$1',
        [evidence.document_id],
      )
    ).rows[0]
    if (input.result === 'verified' && !doc.url)
      throw new ApiError(
        422,
        'EVIDENCE_PENDING',
        'El adjunto pendiente requiere una referencia verificable antes de aprobarlo.',
      )
  }
  await tx.client.query(
    'INSERT INTO vcm.evidence_reviews(id,evidence_id,evidence_version,reviewer_id,result,reason) VALUES($1,$2,$3,$4,$5,$6)',
    [
      randomUUID(),
      input.evidenceId,
      evidence.version,
      tx.principal.id,
      input.result,
      input.reason,
    ],
  )
  await tx.client.query(
    'UPDATE vcm.evidences SET review_status=$1 WHERE id=$2',
    [input.result, input.evidenceId],
  )
}
