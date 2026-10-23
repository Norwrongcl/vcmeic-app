import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { CommandRegistry, Target } from '../commands/registry.ts'
import {
  type TransactionContext,
  civilDate,
  id,
  reason,
} from '../contracts/common.ts'
import { ApiError } from '../http/errors.ts'
import { assertAction } from '../access/policy.ts'
import {
  capturedSchema,
  captureField,
  resolveField,
  assertEditableCase,
} from '../capture/capture.ts'
import { addEvidence, reviewEvidence } from '../capture/evidence.ts'
import { qaIssues } from '../capture/qa.ts'
export async function caseTarget(
  tx: TransactionContext,
  command: { caseId: string },
): Promise<Target> {
  const r = await tx.client.query(
    'SELECT protected_object_id AS "objectId",version FROM vcm.cases WHERE id=$1 AND archived_at IS NULL',
    [command.caseId],
  )
  if (!r.rowCount)
    throw new ApiError(404, 'NOT_FOUND', 'Recurso no encontrado.')
  return r.rows[0]
}
export async function bumpCase(tx: TransactionContext, caseId: string) {
  return (
    await tx.client.query(
      'UPDATE vcm.cases SET version=version+1,updated_at=now() WHERE id=$1 RETURNING version',
      [caseId],
    )
  ).rows[0].version as number
}
const createSchema = z.strictObject({
  type: z.literal('createCase'),
  kind: z.enum(['presence', 'activity', 'initiative', 'event', 'campaign']),
  name: z.string().trim().min(1).max(500),
  responsible: z.string().trim().min(1).max(500),
  description: z.string().max(20000).default(''),
  startsAt: civilDate.optional(),
  endsAt: civilDate.optional(),
  portfolioId: id.optional(),
})
export function registerCases(registry: CommandRegistry) {
  registry.register({
    type: 'createCase',
    action: 'captureAntecedent',
    schema: createSchema,
    async target() {
      return undefined
    },
    async run(tx, cmd) {
      if (cmd.startsAt && cmd.endsAt && cmd.startsAt > cmd.endsAt)
        throw new ApiError(
          422,
          'INVALID_DATES',
          'La fecha de término precede al inicio.',
        )
      const caseId = randomUUID(),
        schema = cmd.kind === 'presence' ? 'p51-2026.09-v1' : 'p52-2026.09-v1'
      await tx.client.query(
        'INSERT INTO vcm.cases(id,code,name,kind,portfolio_id,responsible_id,responsible_label) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          caseId,
          'VCM-' + caseId,
          cmd.name,
          cmd.kind,
          cmd.portfolioId ?? null,
          tx.principal.kind === 'human' ? tx.principal.id : null,
          cmd.responsible,
        ],
      )
      await tx.client.query(
        'UPDATE vcm.protected_objects SET owner_id=$1 WHERE id=$2',
        [tx.principal.id, 'case:' + caseId],
      )
      await tx.client.query(
        'INSERT INTO vcm.case_assignments(case_id,principal_id,function) VALUES($1,$2,$3)',
        [
          caseId,
          tx.principal.id,
          tx.principal.kind === 'human' ? 'responsible' : 'interview',
        ],
      )
      await tx.client.query(
        'INSERT INTO vcm.case_fields(case_id,field_key,schema_version) SELECT $1,field_key,schema_version FROM vcm.field_definitions WHERE schema_version=$2 OR schema_version=$3',
        [caseId, schema, 'operation-2026.09-v1'],
      )
      if (cmd.kind === 'presence')
        await tx.client.query(
          'INSERT INTO vcm.presence_records(id,case_id) VALUES($1,$2)',
          [randomUUID(), caseId],
        )
      else
        await tx.client.query(
          'INSERT INTO vcm.activity_records(id,case_id) VALUES($1,$2)',
          [randomUUID(), caseId],
        )
      for (const [fieldId, value] of Object.entries({
        name: cmd.name,
        responsible: cmd.responsible,
        description: cmd.description,
        startsAt: cmd.startsAt,
        endsAt: cmd.endsAt,
      }))
        if (value)
          await captureField(tx, caseId, {
            fieldId,
            value,
            status: 'confirmed',
            source: { name: 'Ingreso inicial' },
            observation: '',
          })
      return {
        objectId: 'case:' + caseId,
        version: 1,
        result: { id: caseId, state: 'open' },
        after: { id: caseId, name: cmd.name },
      }
    },
  })
  const setFieldSchema = capturedSchema
    .extend({ type: z.literal('setField'), caseId: id })
    .strict()
  registry.register({
    type: 'setField',
    action: 'captureAntecedent',
    schema: setFieldSchema,
    target: caseTarget,
    async run(tx, cmd) {
      await assertEditableCase(tx, cmd.caseId)
      await captureField(tx, cmd.caseId, cmd)
      return {
        objectId: 'case:' + cmd.caseId,
        version: await bumpCase(tx, cmd.caseId),
        result: { fieldId: cmd.fieldId },
        after: { fieldId: cmd.fieldId, value: cmd.value },
      }
    },
  })
  registry.register({
    type: 'setFields',
    action: 'captureAntecedent',
    schema: z.strictObject({
      type: z.literal('setFields'),
      caseId: id,
      fields: z
        .array(capturedSchema)
        .min(1)
        .max(60)
        .refine((a) => new Set(a.map((f) => f.fieldId)).size === a.length),
    }),
    target: caseTarget,
    async run(tx, cmd) {
      await assertEditableCase(tx, cmd.caseId)
      for (const f of cmd.fields) await captureField(tx, cmd.caseId, f)
      return {
        objectId: 'case:' + cmd.caseId,
        version: await bumpCase(tx, cmd.caseId),
        result: { count: cmd.fields.length },
        after: { fields: cmd.fields.map((f) => f.fieldId) },
      }
    },
  })
  registry.register({
    type: 'resolveField',
    action: 'resolveConflict',
    schema: z.strictObject({
      type: z.literal('resolveField'),
      caseId: id,
      fieldId: id,
      assertionId: id,
      reason,
    }),
    target: caseTarget,
    async run(tx, cmd) {
      await assertEditableCase(tx, cmd.caseId)
      await resolveField(
        tx,
        cmd.caseId,
        cmd.fieldId,
        cmd.assertionId,
        cmd.reason,
      )
      return {
        objectId: 'case:' + cmd.caseId,
        version: await bumpCase(tx, cmd.caseId),
        result: { fieldId: cmd.fieldId },
        after: { assertionId: cmd.assertionId },
      }
    },
  })
  registry.register({
    type: 'addEvidence',
    action: 'captureAntecedent',
    schema: z.strictObject({
      type: z.literal('addEvidence'),
      caseId: id,
      name: z.string().trim().min(1).max(500),
      url: z
        .url()
        .refine((u) => new URL(u).protocol === 'https:')
        .nullable()
        .optional(),
      processingStatus: z.enum(['pending', 'referenced']).optional(),
      reason: reason.optional(),
    }),
    target: caseTarget,
    async run(tx, cmd) {
      await assertEditableCase(tx, cmd.caseId)
      const evidenceId = await addEvidence(tx, cmd.caseId, cmd)
      return {
        objectId: 'case:' + cmd.caseId,
        version: await bumpCase(tx, cmd.caseId),
        result: { id: evidenceId },
        after: { evidenceId, reviewStatus: 'pending' },
      }
    },
  })
  registry.register({
    type: 'reviewEvidence',
    action: 'validateInstitutional',
    schema: z.strictObject({
      type: z.literal('reviewEvidence'),
      caseId: id,
      evidenceId: id,
      result: z.enum(['verified', 'rejected']),
      reason,
    }),
    target: caseTarget,
    async run(tx, cmd) {
      await assertEditableCase(tx, cmd.caseId)
      await reviewEvidence(tx, cmd.caseId, cmd)
      return {
        objectId: 'case:' + cmd.caseId,
        version: await bumpCase(tx, cmd.caseId),
        result: { evidenceId: cmd.evidenceId },
        after: { evidenceId: cmd.evidenceId, result: cmd.result },
      }
    },
  })
  registry.register({
    type: 'transition',
    action: 'captureAntecedent',
    schema: z.strictObject({
      type: z.literal('transition'),
      caseId: id,
      state: z.enum([
        'open',
        'construction',
        'waiting',
        'review',
        'escalated',
        'validated',
        'closing',
        'qa',
        'rendered',
        'closed',
        'returned',
      ]),
      reason,
    }),
    target: caseTarget,
    async run(tx, cmd) {
      if (!['construction', 'waiting', 'review'].includes(cmd.state))
        await assertAction(tx, 'validateInstitutional', 'case:' + cmd.caseId)
      const from = (
        await tx.client.query('SELECT state FROM vcm.cases WHERE id=$1', [
          cmd.caseId,
        ])
      ).rows[0].state
      const edge = await tx.client.query(
        "SELECT 1 FROM vcm.transition_definitions WHERE object_kind='case' AND rule_version='PO-2026.09-v1' AND from_state=$1 AND to_state=$2",
        [from, cmd.state],
      )
      if (!edge.rowCount)
        throw new ApiError(
          422,
          'INVALID_TRANSITION',
          'La transición no corresponde al estado actual.',
        )
      if (
        ['validated', 'closing', 'qa', 'rendered', 'closed'].includes(cmd.state)
      ) {
        const issues = await qaIssues(
          tx,
          cmd.caseId,
          cmd.state !== 'validated',
          true,
        )
        if (issues.length)
          throw new ApiError(422, 'QA_INCOMPLETE', issues.join(' '))
      }
      await tx.client.query('UPDATE vcm.cases SET state=$1 WHERE id=$2', [
        cmd.state,
        cmd.caseId,
      ])
      for (const table of ['presence_records', 'activity_records'])
        await tx.client.query(
          `UPDATE vcm.${table} SET validation_status=$1 WHERE case_id=$2`,
          [
            cmd.state === 'validated'
              ? 'validated'
              : cmd.state === 'returned'
                ? 'observed'
                : ['closing', 'qa', 'rendered', 'closed'].includes(cmd.state)
                  ? 'validated'
                  : 'pending',
            cmd.caseId,
          ],
        )
      return {
        objectId: 'case:' + cmd.caseId,
        version: await bumpCase(tx, cmd.caseId),
        result: { state: cmd.state },
        before: { state: from },
        after: { state: cmd.state },
      }
    },
  })
  registry.register({
    type: 'updateCase',
    action: 'editOperationalDraft',
    schema: z.strictObject({
      type: z.literal('updateCase'),
      caseId: id,
      priority: z.enum(['low', 'medium', 'high']).optional(),
      confidentiality: z
        .enum(['internal', 'restricted', 'sensitive'])
        .optional(),
      responsibleActorId: id.nullable().optional(),
      portfolioId: id.nullable().optional(),
      reason,
    }),
    target: caseTarget,
    async run(tx, cmd) {
      await assertEditableCase(tx, cmd.caseId)
      if ('responsibleActorId' in cmd) {
        await tx.client.query(
          "UPDATE vcm.case_assignments SET valid_until=now() WHERE case_id=$1 AND function='responsible' AND valid_until IS NULL",
          [cmd.caseId],
        )
      }
      if (cmd.responsibleActorId) {
        const user = await tx.client.query(
          "SELECT 1 FROM vcm.principals WHERE id=$1 AND kind='human' AND active",
          [cmd.responsibleActorId],
        )
        if (!user.rowCount)
          throw new ApiError(
            422,
            'INVALID_RESPONSIBLE',
            'Selecciona un usuario humano activo.',
          )
        await tx.client.query(
          "INSERT INTO vcm.case_assignments(case_id,principal_id,function) VALUES($1,$2,'responsible') ON CONFLICT(case_id,principal_id,function) DO UPDATE SET valid_from=now(),valid_until=NULL",
          [cmd.caseId, cmd.responsibleActorId],
        )
      }
      await tx.client.query(
        'UPDATE vcm.cases SET priority=COALESCE($1,priority),portfolio_id=CASE WHEN $2 THEN $3 ELSE portfolio_id END,responsible_id=CASE WHEN $4 THEN $5 ELSE responsible_id END WHERE id=$6',
        [
          cmd.priority ?? null,
          'portfolioId' in cmd,
          cmd.portfolioId ?? null,
          'responsibleActorId' in cmd,
          cmd.responsibleActorId ?? null,
          cmd.caseId,
        ],
      )
      if (cmd.confidentiality)
        await tx.client.query(
          'UPDATE vcm.protected_objects SET confidentiality=$1 WHERE id=$2',
          [cmd.confidentiality, 'case:' + cmd.caseId],
        )
      return {
        objectId: 'case:' + cmd.caseId,
        version: await bumpCase(tx, cmd.caseId),
        result: { id: cmd.caseId },
        after: { priority: cmd.priority, confidentiality: cmd.confidentiality },
      }
    },
  })
  registry.register({
    type: 'setRelations',
    action: 'editOperationalDraft',
    schema: z.strictObject({
      type: z.literal('setRelations'),
      caseId: id,
      organizationIds: z.array(id).max(100),
      agreementIds: z.array(id).max(100),
      reason,
    }),
    target: caseTarget,
    async run(tx, cmd) {
      await assertEditableCase(tx, cmd.caseId)
      for (const agreement of cmd.agreementIds)
        await assertAction(tx, 'query', 'agreement:' + agreement)
      for (const org of cmd.organizationIds) {
        await assertAction(tx, 'query', 'organization:' + org)
        const r = await tx.client.query(
          'SELECT id FROM vcm.organizations WHERE id=$1 AND archived_at IS NULL',
          [org],
        )
        if (!r.rowCount)
          throw new ApiError(
            422,
            'INVALID_ORGANIZATION',
            'Organización inexistente.',
          )
      }
      await tx.client.query(
        'UPDATE vcm.case_organizations SET active=false WHERE case_id=$1',
        [cmd.caseId],
      )
      await tx.client.query(
        'UPDATE vcm.case_agreements SET active=false WHERE case_id=$1',
        [cmd.caseId],
      )
      for (const org of cmd.organizationIds)
        await tx.client.query(
          "INSERT INTO vcm.case_organizations(case_id,organization_id,role) VALUES($1,$2,'participant') ON CONFLICT(case_id,organization_id,role) DO UPDATE SET active=true",
          [cmd.caseId, org],
        )
      for (const agreement of cmd.agreementIds)
        await tx.client.query(
          'INSERT INTO vcm.case_agreements(case_id,agreement_id) VALUES($1,$2) ON CONFLICT(case_id,agreement_id) DO UPDATE SET active=true',
          [cmd.caseId, agreement],
        )
      return {
        objectId: 'case:' + cmd.caseId,
        version: await bumpCase(tx, cmd.caseId),
        result: { id: cmd.caseId },
        after: {
          organizationIds: cmd.organizationIds,
          agreementIds: cmd.agreementIds,
        },
      }
    },
  })
}
