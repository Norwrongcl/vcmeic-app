import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  type TransactionContext,
  civilDate,
  money,
  id,
} from '../contracts/common.ts'
import { assertAction } from '../access/policy.ts'
import { ApiError } from '../http/errors.ts'
export const referenceSchema = z.strictObject({
  type: z.enum(['evidence', 'organization', 'agreement']),
  id,
})
export const capturedSchema = z.strictObject({
  fieldId: id,
  value: z.union([
    z.string().max(20000),
    z.number().finite().nonnegative(),
    z.array(referenceSchema).max(100),
  ]),
  status: z.enum(['confirmed', 'partial', 'pending']).default('confirmed'),
  source: z.strictObject({
    name: z.string().trim().min(1).max(1000),
    externalReference: z.string().max(2000).optional(),
  }),
  observation: z.string().max(4000).default(''),
})
export type Captured = z.infer<typeof capturedSchema>
export async function assertEditableCase(
  tx: TransactionContext,
  caseId: string,
) {
  const r = await tx.client.query('SELECT state FROM vcm.cases WHERE id=$1', [
    caseId,
  ])
  if (!r.rowCount)
    throw new ApiError(404, 'NOT_FOUND', 'Recurso no encontrado.')
  if (
    ['validated', 'closing', 'qa', 'rendered', 'closed'].includes(
      r.rows[0].state,
    )
  )
    throw new ApiError(
      422,
      'RETURN_REQUIRED',
      'Devuelve el expediente para corregir sus antecedentes y validarlo nuevamente.',
    )
}
export async function addSource(
  tx: TransactionContext,
  caseId: string,
  name: string,
  externalReference?: string,
) {
  const sourceId = randomUUID(),
    channel =
      tx.principal.kind === 'human'
        ? 'web'
        : tx.principal.scopes.includes('interview:capture')
          ? 'whatsapp'
          : 'telegram'
  await tx.client.query(
    'INSERT INTO vcm.sources(id,case_id,name,channel,actor_id,external_reference) VALUES($1,$2,$3,$4,$5,$6)',
    [
      sourceId,
      caseId,
      name,
      channel,
      tx.principal.id,
      externalReference ?? null,
    ],
  )
  return sourceId
}
export function assertionValue(row: Record<string, unknown>): unknown {
  return (
    row.text_value ??
    (row.number_value === null || row.number_value === undefined
      ? undefined
      : Number(row.number_value)) ??
    row.money_value ??
    (row.date_value instanceof Date
      ? row.date_value.toISOString().slice(0, 10)
      : row.date_value) ??
    row.references_value ??
    null
  )
}
export async function captureField(
  tx: TransactionContext,
  caseId: string,
  input: Captured,
  options?: { sourceId?: string },
) {
  const r = await tx.client.query(
    'SELECT f.*,d.value_type,d.classification,d.unit FROM vcm.case_fields f JOIN vcm.field_definitions d ON d.schema_version=f.schema_version AND d.field_key=f.field_key WHERE f.case_id=$1 AND f.field_key=$2',
    [caseId, input.fieldId],
  )
  const field = r.rows[0]
  if (!field)
    throw new ApiError(
      422,
      'UNKNOWN_FIELD',
      'Campo no definido para este expediente.',
    )
  if (field.classification)
    await assertAction(tx, 'validateInstitutional', 'case:' + caseId)
  let column: string,
    value: unknown = input.value
  switch (field.value_type) {
    case 'text':
      value = z.string().trim().min(1).max(20000).parse(value)
      column = 'text_value'
      break
    case 'number':
      value = (
        field.unit === 'count'
          ? z.number().int().nonnegative()
          : z.number().finite().nonnegative()
      ).parse(value)
      column = 'number_value'
      break
    case 'money':
      value = money.parse(value)
      column = 'money_value'
      break
    case 'date':
      value = civilDate.parse(value)
      column = 'date_value'
      break
    case 'references':
      value = z.array(referenceSchema).min(1).max(100).parse(value)
      column = 'references_value'
      break
    default:
      throw new ApiError(422, 'UNKNOWN_TYPE', 'Tipo de campo no soportado.')
  }
  if (input.fieldId === 'presenceType') {
    const allowed = await tx.client.query(
      "SELECT code FROM vcm.catalog_entries WHERE catalog_version_id='presence-2026.09-v1' AND (code=$1 OR label=$1) AND active",
      [value],
    )
    if (!allowed.rowCount)
      throw new ApiError(
        422,
        'INVALID_PRESENCE_TYPE',
        'Selecciona una tipología oficial.',
      )
  }
  if (Array.isArray(value))
    for (const ref of value) {
      if (ref.type === 'agreement')
        await assertAction(tx, 'query', 'agreement:' + ref.id)
      else if (ref.type === 'evidence') {
        const e = await tx.client.query(
          'SELECT document_id FROM vcm.evidences WHERE id=$1 AND case_id=$2',
          [ref.id, caseId],
        )
        if (!e.rowCount)
          throw new ApiError(
            422,
            'INVALID_REFERENCE',
            'Evidencia de otro expediente o inexistente.',
          )
        if (e.rows[0].document_id)
          await assertAction(tx, 'query', 'document:' + e.rows[0].document_id)
      } else {
        await assertAction(tx, 'query', 'organization:' + ref.id)
        const o = await tx.client.query(
          'SELECT id FROM vcm.organizations WHERE id=$1 AND archived_at IS NULL',
          [ref.id],
        )
        if (!o.rowCount)
          throw new ApiError(
            422,
            'INVALID_REFERENCE',
            'Organización inexistente.',
          )
      }
    }
  const sourceId =
      options?.sourceId ??
      (await addSource(
        tx,
        caseId,
        input.source.name,
        input.source.externalReference,
      )),
    assertionId = randomUUID()
  // The column name is selected exclusively by the closed server-side type switch above.
  await tx.client.query(
    `INSERT INTO vcm.field_assertions(id,case_id,field_key,source_id,actor_id,value_type,${column},captured_at) VALUES($1,$2,$3,$4,$5,$6,$7,clock_timestamp())`,
    [
      assertionId,
      caseId,
      input.fieldId,
      sourceId,
      tx.principal.id,
      field.value_type,
      column === 'references_value' ? JSON.stringify(value) : value,
    ],
  )
  if (Array.isArray(value))
    for (const ref of value)
      await tx.client.query(
        'INSERT INTO vcm.field_assertion_references(assertion_id,organization_id,agreement_id,evidence_id) VALUES($1,$2,$3,$4)',
        [
          assertionId,
          ref.type === 'organization' ? ref.id : null,
          ref.type === 'agreement' ? ref.id : null,
          ref.type === 'evidence' ? ref.id : null,
        ],
      )
  let conflict = field.status === 'conflict'
  if (field.selected_assertion_id) {
    const previous = (
      await tx.client.query('SELECT * FROM vcm.field_assertions WHERE id=$1', [
        field.selected_assertion_id,
      ])
    ).rows[0]
    if (JSON.stringify(assertionValue(previous)) !== JSON.stringify(value))
      conflict = true
  }
  const selected =
    field.selected_assertion_id && conflict
      ? field.selected_assertion_id
      : assertionId
  await tx.client.query(
    'UPDATE vcm.case_fields SET status=$1,observation=$2,selected_assertion_id=$3 WHERE case_id=$4 AND field_key=$5',
    [
      conflict ? 'conflict' : input.status,
      input.observation,
      selected,
      caseId,
      input.fieldId,
    ],
  )
  if (!conflict && input.fieldId === 'presenceType')
    await tx.client.query(
      "UPDATE vcm.presence_records SET type_code=(SELECT code FROM vcm.catalog_entries WHERE catalog_version_id='presence-2026.09-v1' AND (code=$1 OR label=$1)),version=version+1 WHERE case_id=$2",
      [value, caseId],
    )
  if (!conflict && input.fieldId === 'name')
    await tx.client.query('UPDATE vcm.cases SET name=$1 WHERE id=$2', [
      value,
      caseId,
    ])
  if (!conflict && input.fieldId === 'responsible')
    await tx.client.query(
      'UPDATE vcm.cases SET responsible_label=$1 WHERE id=$2',
      [value, caseId],
    )
  return assertionId
}
export async function resolveField(
  tx: TransactionContext,
  caseId: string,
  fieldId: string,
  assertionId: string,
  reason: string,
) {
  const selected = await tx.client.query(
    'SELECT * FROM vcm.field_assertions WHERE id=$1 AND case_id=$2 AND field_key=$3',
    [assertionId, caseId, fieldId],
  )
  if (!selected.rowCount)
    throw new ApiError(
      422,
      'INVALID_ASSERTION',
      'La versión seleccionada no pertenece a este campo.',
    )
  const resolutionId = randomUUID()
  await tx.client.query(
    'INSERT INTO vcm.field_resolutions(id,case_id,field_key,selected_assertion_id,actor_id,reason) VALUES($1,$2,$3,$4,$5,$6)',
    [resolutionId, caseId, fieldId, assertionId, tx.principal.id, reason],
  )
  await tx.client.query(
    'INSERT INTO vcm.resolution_assertions(resolution_id,assertion_id) SELECT $1,id FROM vcm.field_assertions WHERE case_id=$2 AND field_key=$3',
    [resolutionId, caseId, fieldId],
  )
  await tx.client.query(
    "UPDATE vcm.case_fields SET selected_assertion_id=$1,status='confirmed',observation=$2 WHERE case_id=$3 AND field_key=$4",
    [assertionId, reason, caseId, fieldId],
  )
  if (fieldId === 'presenceType')
    await tx.client.query(
      "UPDATE vcm.presence_records SET type_code=(SELECT code FROM vcm.catalog_entries WHERE catalog_version_id='presence-2026.09-v1' AND (code=$1 OR label=$1)),version=version+1 WHERE case_id=$2",
      [assertionValue(selected.rows[0]), caseId],
    )
  if (fieldId === 'name')
    await tx.client.query('UPDATE vcm.cases SET name=$1 WHERE id=$2', [
      assertionValue(selected.rows[0]),
      caseId,
    ])
  if (fieldId === 'responsible')
    await tx.client.query(
      'UPDATE vcm.cases SET responsible_label=$1 WHERE id=$2',
      [assertionValue(selected.rows[0]), caseId],
    )
}
