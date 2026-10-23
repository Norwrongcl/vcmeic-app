import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { type TransactionContext, id, reason } from '../contracts/common.ts'
import type { CommandRegistry } from '../commands/registry.ts'
import { ApiError } from '../http/errors.ts'
import { assertAction } from '../access/policy.ts'
import { visibilityPredicate } from '../access/visibility.ts'
import { caseTarget, bumpCase } from '../cases/cases.service.ts'
import { qaIssues } from '../capture/qa.ts'
export async function eligibleCase(
  tx: TransactionContext,
  caseId: string,
  lockProjects = false,
) {
  await assertAction(tx, 'query', 'case:' + caseId)
  const c = (
    await tx.client.query(
      'SELECT c.kind,c.state,COALESCE(p.validation_status,a.validation_status) validation_status FROM vcm.cases c LEFT JOIN vcm.presence_records p ON p.case_id=c.id LEFT JOIN vcm.activity_records a ON a.case_id=c.id WHERE c.id=$1',
      [caseId],
    )
  ).rows[0]
  return (
    !!c &&
    ['validated', 'closing', 'qa', 'rendered', 'closed'].includes(c.state) &&
    c.validation_status === 'validated' &&
    (await qaIssues(tx, caseId, true, lockProjects)).length === 0
  )
}
async function evidenceEligible(
  tx: TransactionContext,
  caseId: string,
  evidenceId: string,
) {
  const e = (
    await tx.client.query(
      'SELECT e.document_id,e.version,e.review_status FROM vcm.evidences e WHERE e.id=$1 AND e.case_id=$2',
      [evidenceId, caseId],
    )
  ).rows[0]
  if (!e || e.review_status !== 'verified') return false
  if (e.document_id)
    await assertAction(tx, 'query', 'document:' + e.document_id)
  return !!(
    await tx.client.query(
      "SELECT 1 FROM vcm.evidence_reviews WHERE evidence_id=$1 AND evidence_version=$2 AND result='verified'",
      [evidenceId, e.version],
    )
  ).rowCount
}
async function contributionEligible(
  tx: TransactionContext,
  row: Record<string, unknown>,
  lockProjects = false,
) {
  if (
    row.indicator_id !== '4.2.5' ||
    Number(row.value) !== 1 ||
    !(await eligibleCase(tx, String(row.case_id), lockProjects))
  )
    return false
  const facts = (
    await tx.client.query(
      "SELECT c.kind,EXTRACT(year FROM a.date_value)::int event_year FROM vcm.cases c JOIN vcm.case_fields f ON f.case_id=c.id AND f.field_key='startsAt' JOIN vcm.field_assertions a ON a.id=f.selected_assertion_id WHERE c.id=$1",
      [row.case_id],
    )
  ).rows[0]
  if (facts?.kind !== 'presence' || facts.event_year !== row.period)
    return false
  const evidence = (
    await tx.client.query(
      'SELECT evidence_id,evidence_version FROM vcm.contribution_evidences WHERE contribution_id=$1',
      [row.id],
    )
  ).rows
  if (!evidence.length) return false
  for (const e of evidence) {
    if (!(await evidenceEligible(tx, String(row.case_id), e.evidence_id)))
      return false
    const version = (
      await tx.client.query('SELECT version FROM vcm.evidences WHERE id=$1', [
        e.evidence_id,
      ])
    ).rows[0].version
    if (version !== e.evidence_version) return false
  }
  return true
}
export async function indicatorSummary(tx: TransactionContext, period: number) {
  await assertAction(tx, 'query')
  const rows = (
    await tx.client.query(
      'SELECT i.id,i.name,i.unit,r.availability,r.version,r.criteria,t.target FROM vcm.indicators i JOIN vcm.indicator_rule_versions r ON r.indicator_id=i.id LEFT JOIN vcm.indicator_targets t ON t.indicator_id=i.id AND t.period=$1 ORDER BY i.id',
      [period],
    )
  ).rows
  const pred = visibilityPredicate(tx.principal, 'o', 2)
  const contributions = (
    await tx.client.query(
      "SELECT ic.* FROM vcm.indicator_contributions ic JOIN vcm.cases c ON c.id=ic.case_id JOIN vcm.protected_objects o ON o.id=c.protected_object_id WHERE ic.period=$1 AND ic.status='validated' AND " +
        pred.sql,
      [period, ...pred.values],
    )
  ).rows
  const accepted: Record<string, number> = {}
  for (const contribution of contributions) {
    try {
      if (await contributionEligible(tx, contribution))
        accepted[contribution.indicator_id] =
          (accepted[contribution.indicator_id] ?? 0) +
          Number(contribution.value)
    } catch (e) {
      if (!(e instanceof ApiError && [403, 404].includes(e.status))) throw e
    }
  }
  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      unit: row.unit,
      period,
      target: row.target === null ? null : Number(row.target),
      progress:
        row.availability === 'available' ? (accepted[row.id] ?? 0) : null,
      criteriaStatus: row.availability,
      ruleVersion: row.version,
      criteria: row.criteria,
    })),
    nextCursor: null,
  }
}
export function registerIndicators(registry: CommandRegistry) {
  registry.register({
    type: 'linkIndicator',
    action: 'editOperationalDraft',
    schema: z.strictObject({
      type: z.literal('linkIndicator'),
      caseId: id,
      indicatorId: id,
      value: z.number().int().nonnegative(),
      period: z.number().int().min(1900).max(9999),
      evidenceIds: z
        .array(id)
        .min(1)
        .max(100)
        .refine((a) => new Set(a).size === a.length),
      reason,
    }),
    target: caseTarget,
    async run(tx, cmd, target) {
      const rule = (
        await tx.client.query(
          'SELECT version,availability FROM vcm.indicator_rule_versions WHERE indicator_id=$1 ORDER BY version DESC LIMIT 1',
          [cmd.indicatorId],
        )
      ).rows[0]
      if (
        !rule ||
        rule.availability !== 'available' ||
        cmd.indicatorId !== '4.2.5'
      )
        throw new ApiError(
          422,
          'CRITERIA_PENDING',
          'No están disponibles los criterios necesarios para generar este aporte.',
        )
      const record = (
        await tx.client.query(
          'SELECT id FROM vcm.presence_records WHERE case_id=$1',
          [cmd.caseId],
        )
      ).rows[0]
      if (!record || cmd.value !== 1)
        throw new ApiError(
          422,
          'INVALID_CONTRIBUTION',
          'Este indicador cuenta una presencia por registro y período.',
        )
      if (
        !(
          await tx.client.query(
            'SELECT 1 FROM vcm.indicator_targets WHERE indicator_id=$1 AND period=$2',
            [cmd.indicatorId, cmd.period],
          )
        ).rowCount
      )
        throw new ApiError(
          422,
          'TARGET_PENDING',
          'No está definido el período institucional para este aporte.',
        )
      const evidence = []
      for (const eid of cmd.evidenceIds) {
        const e = (
          await tx.client.query(
            'SELECT version,document_id FROM vcm.evidences WHERE id=$1 AND case_id=$2',
            [eid, cmd.caseId],
          )
        ).rows[0]
        if (!e)
          throw new ApiError(
            422,
            'EVIDENCE_CASE_MISMATCH',
            'La evidencia no pertenece al expediente.',
          )
        if (e.document_id)
          await assertAction(tx, 'query', 'document:' + e.document_id)
        evidence.push({ id: eid, version: e.version })
      }
      const contributionId = randomUUID()
      await tx.client.query(
        'INSERT INTO vcm.indicator_contributions(id,case_id,presence_id,indicator_id,rule_version,period,value,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          contributionId,
          cmd.caseId,
          record.id,
          cmd.indicatorId,
          rule.version,
          cmd.period,
          cmd.value,
          tx.principal.id,
        ],
      )
      for (const e of evidence)
        await tx.client.query(
          'INSERT INTO vcm.contribution_evidences(contribution_id,case_id,evidence_id,evidence_version) VALUES($1,$2,$3,$4)',
          [contributionId, cmd.caseId, e.id, e.version],
        )
      return {
        objectId: target!.objectId,
        version: await bumpCase(tx, cmd.caseId),
        result: { id: contributionId, status: 'pending' },
        after: { contributionId, status: 'pending' },
      }
    },
  })
  registry.register({
    type: 'validateContribution',
    action: 'validateInstitutional',
    schema: z.strictObject({
      type: z.literal('validateContribution'),
      caseId: id,
      indicatorId: id,
      id,
      reason,
    }),
    target: caseTarget,
    async run(tx, cmd, target) {
      const row = (
        await tx.client.query(
          'SELECT * FROM vcm.indicator_contributions WHERE id=$1 AND case_id=$2 AND indicator_id=$3',
          [cmd.id, cmd.caseId, cmd.indicatorId],
        )
      ).rows[0]
      if (!row || !(await contributionEligible(tx, row, true)))
        throw new ApiError(
          422,
          'CONTRIBUTION_INELIGIBLE',
          'Revisa el período, QA y evidencias del registro antes de validar.',
        )
      await tx.client.query(
        "UPDATE vcm.indicator_contributions SET status='validated',validated_by=$1,validated_at=now(),version=version+1 WHERE id=$2",
        [tx.principal.id, cmd.id],
      )
      return {
        objectId: target!.objectId,
        version: await bumpCase(tx, cmd.caseId),
        result: { id: cmd.id, status: 'validated' },
        after: { contributionId: cmd.id, status: 'validated' },
      }
    },
  })
}
