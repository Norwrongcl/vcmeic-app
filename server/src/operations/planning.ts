import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { CommandRegistry } from '../commands/registry.ts'
import { id, reason, civilDate } from '../contracts/common.ts'
import { ApiError } from '../http/errors.ts'
import { assertAction } from '../access/policy.ts'
import { protectedTarget, ownObject } from './helpers.ts'
import { caseTarget, bumpCase } from '../cases/cases.service.ts'
import { createApproval } from './mandates.ts'
const objective = z.strictObject({
  title: z.string().trim().min(1).max(500),
  responsibleId: id,
  responsibleLabel: z.string().max(500).optional(),
  dueOn: civilDate,
  target: z.number().int().positive(),
  measure: z.enum(['completed', 'validated']),
  caseIds: z
    .array(id)
    .min(1)
    .max(100)
    .refine((a) => new Set(a).size === a.length),
  resources: z.string().max(4000).default(''),
  dependencies: z.string().max(4000).default(''),
})
export function registerPlanning(registry: CommandRegistry) {
  registry.register({
    type: 'savePlan',
    action: 'editOperationalDraft',
    schema: z.strictObject({
      type: z.literal('savePlan'),
      id: id.optional(),
      year: z.number().int().min(2000).max(2100),
      title: z.string().trim().min(1).max(500),
      objectives: z.array(objective).min(1).max(100),
      reason,
    }),
    async target(tx, cmd) {
      return cmd.id
        ? protectedTarget(tx, 'annual_plans', 'annual_plan', cmd.id)
        : undefined
    },
    async run(tx, cmd, target) {
      await tx.client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('annual-plan:'||$1,0))",
        [String(cmd.year)],
      )
      const existing = await tx.client.query(
        'SELECT id FROM vcm.annual_plans WHERE year=$1 AND ($2::text IS NULL OR id<>$2)',
        [cmd.year, cmd.id ?? null],
      )
      if (existing.rowCount)
        throw new ApiError(
          422,
          'PLAN_YEAR_EXISTS',
          'Modifica el plan existente de ese año.',
        )
      for (const o of cmd.objectives) {
        if (Number(o.dueOn.slice(0, 4)) !== cmd.year)
          throw new ApiError(
            422,
            'OBJECTIVE_YEAR_MISMATCH',
            'El plazo del objetivo corresponde al año del plan.',
          )
        for (const cid of o.caseIds)
          await assertAction(tx, 'query', 'case:' + cid)
        if (
          !(
            await tx.client.query(
              "SELECT 1 FROM vcm.principals WHERE id=$1 AND kind='human' AND active",
              [o.responsibleId],
            )
          ).rowCount
        )
          throw new ApiError(
            422,
            'INVALID_RESPONSIBLE',
            'Responsable de objetivo no válido.',
          )
      }
      const pid = cmd.id ?? randomUUID(),
        revisionId = randomUUID(),
        version = (target?.version ?? 0) + 1
      if (target)
        await tx.client.query(
          "UPDATE vcm.annual_plans SET title=$1,year=$2,status='draft',version=version+1 WHERE id=$3",
          [cmd.title, cmd.year, pid],
        )
      else {
        await tx.client.query(
          'INSERT INTO vcm.annual_plans(id,year,title) VALUES($1,$2,$3)',
          [pid, cmd.year, cmd.title],
        )
        await ownObject(tx, 'annual_plan', pid)
      }
      await tx.client.query(
        'INSERT INTO vcm.plan_revisions(id,plan_id,version,reason,actor_id) VALUES($1,$2,$3,$4,$5)',
        [revisionId, pid, version, cmd.reason, tx.principal.id],
      )
      for (const o of cmd.objectives) {
        const oid = randomUUID()
        await tx.client.query(
          'INSERT INTO vcm.plan_objectives(id,plan_revision_id,title,responsible_id,responsible_label,due_on,target,measure,resources,dependencies) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [
            oid,
            revisionId,
            o.title,
            o.responsibleId,
            o.responsibleLabel ?? null,
            o.dueOn,
            o.target,
            o.measure,
            o.resources,
            o.dependencies,
          ],
        )
        for (const cid of o.caseIds)
          await tx.client.query(
            'INSERT INTO vcm.objective_cases(objective_id,case_id) VALUES($1,$2)',
            [oid, cid],
          )
      }
      return {
        objectId: 'annual_plan:' + pid,
        version,
        result: { id: pid, revisionId },
        after: { year: cmd.year, revisionId },
      }
    },
  })
  registry.register({
    type: 'transitionPlan',
    action: 'reviewAnnualPlan',
    schema: z.strictObject({
      type: z.literal('transitionPlan'),
      id,
      status: z.enum(['draft', 'review', 'sanctioned', 'approved']),
      reason,
    }),
    async target(tx, cmd) {
      return protectedTarget(tx, 'annual_plans', 'annual_plan', cmd.id)
    },
    async run(tx, cmd, target) {
      const plan = (
        await tx.client.query(
          'SELECT status FROM vcm.annual_plans WHERE id=$1',
          [cmd.id],
        )
      ).rows[0]
      const allowed: Record<string, string[]> = {
        draft: ['review'],
        review: ['draft', 'sanctioned'],
        sanctioned: ['draft', 'approved'],
        approved: ['draft'],
      }
      if (!allowed[plan.status].includes(cmd.status))
        throw new ApiError(
          422,
          'INVALID_TRANSITION',
          'Transición de plan no permitida.',
        )
      if (
        tx.principal.roles.includes('direction') &&
        !tx.principal.roles.some((r) =>
          ['coordination', 'leadership'].includes(r),
        ) &&
        !['approved', 'draft'].includes(cmd.status)
      )
        throw new ApiError(
          403,
          'AUTHORITY_REQUIRED',
          'Dirección aprueba o devuelve el plan.',
        )
      if (
        (cmd.status === 'sanctioned' &&
          !tx.principal.roles.includes('leadership')) ||
        (cmd.status === 'approved' && !tx.principal.roles.includes('direction'))
      )
        throw new ApiError(
          403,
          'AUTHORITY_REQUIRED',
          'Jefatura sanciona y Dirección aprueba el plan.',
        )
      const revision = (
        await tx.client.query(
          'SELECT id FROM vcm.plan_revisions WHERE plan_id=$1 ORDER BY version DESC LIMIT 1',
          [cmd.id],
        )
      ).rows[0]
      const cases = (
        await tx.client.query(
          'SELECT oc.case_id FROM vcm.objective_cases oc JOIN vcm.plan_objectives o ON o.id=oc.objective_id WHERE o.plan_revision_id=$1',
          [revision.id],
        )
      ).rows
      for (const c of cases)
        await assertAction(tx, 'query', 'case:' + c.case_id)
      if (cmd.status === 'approved')
        await createApproval(
          tx,
          target!.objectId,
          revision.id,
          'annual_plan',
          cmd.reason,
        )
      if (cmd.status === 'draft')
        await tx.client.query(
          'INSERT INTO vcm.approval_revocations(approval_id,revoked_by,reason) SELECT id,$2,$3 FROM vcm.approval_records WHERE object_id=$1 ON CONFLICT DO NOTHING',
          [target!.objectId, tx.principal.id, cmd.reason],
        )
      await tx.client.query(
        'UPDATE vcm.annual_plans SET status=$1,version=version+1 WHERE id=$2',
        [cmd.status, cmd.id],
      )
      return {
        objectId: target!.objectId,
        version: target!.version + 1,
        result: { status: cmd.status },
        before: { status: plan.status },
        after: { status: cmd.status },
      }
    },
  })
  registry.register({
    type: 'saveTriage',
    action: 'editOperationalDraft',
    schema: z.strictObject({
      type: z.literal('saveTriage'),
      caseId: id,
      pertinence: z.enum(['pending', 'low', 'medium', 'high']),
      urgency: z.enum(['pending', 'low', 'medium', 'high']),
      resolvedPriority: z.enum(['low', 'medium', 'high']).optional(),
      recommendation: z.string().max(4000).optional(),
      reason,
    }),
    target: caseTarget,
    async run(tx, cmd, target) {
      await tx.client.query(
        'INSERT INTO vcm.triage_assessments(id,case_id,pertinence,urgency,resolved_priority,recommendation,reason,actor_id,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [
          randomUUID(),
          cmd.caseId,
          cmd.pertinence,
          cmd.urgency,
          cmd.resolvedPriority ?? null,
          cmd.recommendation ?? null,
          cmd.reason,
          tx.principal.id,
          target!.version + 1,
        ],
      )
      if (cmd.resolvedPriority)
        await tx.client.query('UPDATE vcm.cases SET priority=$1 WHERE id=$2', [
          cmd.resolvedPriority,
          cmd.caseId,
        ])
      return {
        objectId: target!.objectId,
        version: await bumpCase(tx, cmd.caseId),
        result: { caseId: cmd.caseId },
        after: { pertinence: cmd.pertinence, urgency: cmd.urgency },
      }
    },
  })
}
