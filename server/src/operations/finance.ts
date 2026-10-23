import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  type TransactionContext,
  id,
  reason,
  money,
  civilDate,
} from '../contracts/common.ts'
import type { CommandRegistry } from '../commands/registry.ts'
import { ApiError } from '../http/errors.ts'
import { assertAction } from '../access/policy.ts'
import {
  projectTarget,
  bumpProject,
  ownObject,
  assertProjectCase,
} from './helpers.ts'
import { requireMandate } from './mandates.ts'
import {
  committedRemainder,
  projectedCost,
} from '../../../packages/domain/src/finance.ts'
export async function currentAuthorization(
  tx: TransactionContext,
  projectId: string,
  authorizationId: string,
) {
  const r = await tx.client.query(
    `SELECT a.* FROM vcm.budget_authorizations a JOIN vcm.approval_records p ON p.id=a.approval_id JOIN vcm.decision_revisions r ON r.id=a.decision_revision_id JOIN vcm.decisions d ON d.id=r.decision_id WHERE a.id=$1 AND a.project_id=$2 AND a.valid_from<=now() AND (a.valid_until IS NULL OR a.valid_until>now()) AND (p.expires_at IS NULL OR p.expires_at>now()) AND NOT EXISTS(SELECT 1 FROM vcm.budget_authorization_revocations x WHERE x.authorization_id=a.id) AND NOT EXISTS(SELECT 1 FROM vcm.approval_revocations x WHERE x.approval_id=p.id) AND NOT EXISTS(SELECT 1 FROM vcm.budget_authorizations newer WHERE newer.authorization_key=a.authorization_key AND newer.version>a.version) AND d.status='approved' AND r.version=(SELECT max(version) FROM vcm.decision_revisions WHERE decision_id=d.id)`,
    [authorizationId, projectId],
  )
  if (!r.rowCount)
    throw new ApiError(
      422,
      'AUTHORIZATION_REQUIRED',
      'La autorización presupuestaria no está vigente para este proyecto.',
    )
  await assertAction(
    tx,
    'query',
    r.rows[0].approval_id
      ? (
          await tx.client.query(
            'SELECT object_id FROM vcm.approval_records WHERE id=$1',
            [r.rows[0].approval_id],
          )
        ).rows[0].object_id
      : undefined,
  )
  return r.rows[0]
}
async function assertWithinBudget(
  tx: TransactionContext,
  projectId: string,
  authorizationId: string,
) {
  const authorization = await currentAuthorization(
    tx,
    projectId,
    authorizationId,
  )
  const r = (
    await tx.client.query(
      `SELECT
 COALESCE((SELECT sum(amount) FROM vcm.commitments WHERE authorization_id=$1 AND status='active'),0)::text committed,
 COALESCE((SELECT sum(e.amount) FROM vcm.expenses e WHERE e.authorization_id=$1 AND e.archived_at IS NULL),0)::text actual,
 COALESCE((SELECT sum(e.amount) FROM vcm.expenses e JOIN vcm.commitment_expenses ce ON ce.expense_id=e.id JOIN vcm.commitments c ON c.id=ce.commitment_id WHERE c.authorization_id=$1 AND c.status='active' AND e.archived_at IS NULL),0)::text paid`,
      [authorizationId],
    )
  ).rows[0]
  if (
    BigInt(r.committed) + BigInt(r.actual) - BigInt(r.paid) >
    BigInt(authorization.amount)
  )
    throw new ApiError(
      422,
      'BUDGET_EXCEEDED',
      'La operación supera el monto autorizado disponible.',
    )
  const over = (
    await tx.client.query(
      'SELECT c.id FROM vcm.commitments c JOIN vcm.commitment_expenses ce ON ce.commitment_id=c.id JOIN vcm.expenses e ON e.id=ce.expense_id WHERE c.project_id=$1 AND e.archived_at IS NULL GROUP BY c.id,c.amount HAVING sum(e.amount)>c.amount',
      [projectId],
    )
  ).rowCount
  if (over)
    throw new ApiError(
      422,
      'COMMITMENT_EXCEEDED',
      'Los gastos vinculados superan el compromiso.',
    )
}
export async function projectFinance(
  tx: TransactionContext,
  projectId: string,
) {
  // A project being visible does not authorize its individual budgets/decisions.
  const budgets = (
    await tx.client.query(
      'SELECT id,planned_amount,protected_object_id FROM vcm.budget_items WHERE project_id=$1 AND protected_object_id IN(SELECT id FROM vcm.protected_objects WHERE archived_at IS NULL)',
      [projectId],
    )
  ).rows
  let planned = 0n,
    unknown = false
  for (const b of budgets) {
    await assertAction(tx, 'query', b.protected_object_id)
    if (b.planned_amount === null) unknown = true
    else planned += BigInt(b.planned_amount)
  }
  const grants = (
    await tx.client.query(
      'SELECT id FROM vcm.budget_authorizations WHERE project_id=$1',
      [projectId],
    )
  ).rows
  let authorized = 0n
  for (const grant of grants) {
    try {
      authorized += BigInt(
        (await currentAuthorization(tx, projectId, grant.id)).amount,
      )
    } catch (e) {
      if (!(e instanceof ApiError && e.code === 'AUTHORIZATION_REQUIRED'))
        throw e
    }
  }
  const linkedCases = (
    await tx.client.query(
      'SELECT DISTINCT case_id FROM vcm.commitments WHERE project_id=$1',
      [projectId],
    )
  ).rows
  for (const c of linkedCases)
    await assertAction(tx, 'query', 'case:' + c.case_id)
  const commitments = (
    await tx.client.query(
      "SELECT id,amount,status='active' active FROM vcm.commitments WHERE project_id=$1",
      [projectId],
    )
  ).rows
  const expenses = (
    await tx.client.query(
      'SELECT e.id,e.amount,ce.commitment_id FROM vcm.expenses e LEFT JOIN vcm.commitment_expenses ce ON ce.expense_id=e.id WHERE e.project_id=$1 AND e.archived_at IS NULL',
      [projectId],
    )
  ).rows
  const remainder = committedRemainder(
      commitments,
      expenses
        .filter((e) => e.commitment_id)
        .map((e) => ({ commitmentId: e.commitment_id, amount: e.amount })),
    ),
    actual = expenses.reduce((s, e) => s + BigInt(e.amount), 0n)
  const forecast = (
    await tx.client.query(
      'SELECT remaining,basis FROM vcm.forecasts WHERE project_id=$1 ORDER BY version DESC LIMIT 1',
      [projectId],
    )
  ).rows[0]
  const basis = JSON.stringify({
    expenses: expenses.map((e) => [e.id, e.amount]).sort(),
    commitments: commitments.map((c) => [c.id, c.amount, c.active]).sort(),
  })
  const fresh = forecast && forecast.basis.fingerprint === basis,
    additional = fresh ? BigInt(forecast.remaining) : null
  return {
    planned: unknown ? null : planned.toString(),
    authorized: authorized.toString(),
    committed: commitments
      .filter((c) => c.active)
      .reduce((s, c) => s + BigInt(c.amount), 0n)
      .toString(),
    actual: actual.toString(),
    unspentCommitments: remainder.toString(),
    forecastAdditional: additional?.toString() ?? null,
    forecastStatus: forecast ? (fresh ? 'current' : 'stale') : 'pending',
    projected: projectedCost(actual, remainder, additional),
    fingerprint: basis,
  }
}
export function registerFinance(registry: CommandRegistry) {
  registry.register({
    type: 'saveBudgetItem',
    action: 'editOperationalDraft',
    schema: z.strictObject({
      type: z.literal('saveBudgetItem'),
      projectId: id,
      id: id.optional(),
      name: z.string().trim().min(1).max(500),
      plannedAmount: money.nullable(),
      reason,
    }),
    target: projectTarget,
    async run(tx, cmd, target) {
      const bid = cmd.id ?? randomUUID()
      if (cmd.id) {
        await assertAction(tx, 'editOperationalDraft', 'budget:' + bid)
        if (
          !(
            await tx.client.query(
              'UPDATE vcm.budget_items SET name=$1,planned_amount=$2,version=version+1 WHERE id=$3 AND project_id=$4 RETURNING id',
              [cmd.name, cmd.plannedAmount, bid, cmd.projectId],
            )
          ).rowCount
        )
          throw new ApiError(
            422,
            'PROJECT_BUDGET_MISMATCH',
            'La partida no pertenece al proyecto.',
          )
      } else {
        await tx.client.query(
          'INSERT INTO vcm.budget_items(id,project_id,name,planned_amount) VALUES($1,$2,$3,$4)',
          [bid, cmd.projectId, cmd.name, cmd.plannedAmount],
        )
        await ownObject(tx, 'budget', bid)
      }
      return {
        objectId: target!.objectId,
        version: await bumpProject(tx, cmd.projectId),
        result: { id: bid },
        after: { budgetItemId: bid, plannedAmount: cmd.plannedAmount },
      }
    },
  })
  registry.register({
    type: 'archiveBudgetItem',
    action: 'archiveDraft',
    schema: z.strictObject({
      type: z.literal('archiveBudgetItem'),
      projectId: id,
      id,
      reason,
    }),
    target: projectTarget,
    async run(tx, cmd, target) {
      await assertAction(tx, 'archiveDraft', 'budget:' + cmd.id)
      if (
        (
          await tx.client.query(
            'SELECT id FROM vcm.expenses WHERE budget_item_id=$1',
            [cmd.id],
          )
        ).rowCount
      )
        throw new ApiError(
          422,
          'HAS_DEPENDANTS',
          'La partida tiene gastos registrados.',
        )
      if (
        !(
          await tx.client.query(
            'SELECT 1 FROM vcm.budget_items WHERE id=$1 AND project_id=$2',
            [cmd.id, cmd.projectId],
          )
        ).rowCount
      )
        throw new ApiError(
          422,
          'PROJECT_BUDGET_MISMATCH',
          'La partida no pertenece al proyecto.',
        )
      await tx.client.query(
        'UPDATE vcm.protected_objects SET archived_at=now() WHERE id=$1',
        ['budget:' + cmd.id],
      )
      return {
        objectId: target!.objectId,
        version: await bumpProject(tx, cmd.projectId),
        result: { id: cmd.id },
        after: { archived: true },
      }
    },
  })
  registry.register({
    type: 'saveCommitment',
    action: 'executeMandate',
    schema: z.strictObject({
      type: z.literal('saveCommitment'),
      projectId: id,
      id: id.optional(),
      caseId: id,
      title: z.string().trim().min(1).max(500),
      amount: money,
      authorizationId: id,
      reference: z.string().max(2000).default(''),
      status: z.enum(['active', 'cancelled']),
      reason,
    }),
    target: projectTarget,
    async run(tx, cmd, target) {
      await requireMandate(tx, cmd.projectId, 'commitment.record')
      await assertProjectCase(tx, cmd.projectId, cmd.caseId)
      await currentAuthorization(tx, cmd.projectId, cmd.authorizationId)
      const cid = cmd.id ?? randomUUID()
      if (cmd.id) {
        const previous = (
          await tx.client.query(
            'SELECT authorization_id,case_id FROM vcm.commitments WHERE id=$1 AND project_id=$2',
            [cid, cmd.projectId],
          )
        ).rows[0]
        if (
          !previous ||
          previous.authorization_id !== cmd.authorizationId ||
          previous.case_id !== cmd.caseId
        )
          throw new ApiError(
            422,
            'COMMITMENT_SCOPE_MISMATCH',
            'No se puede cambiar el ámbito del compromiso.',
          )
        await tx.client.query(
          'UPDATE vcm.commitments SET title=$1,amount=$2,status=$3,reference=$4,reason=$5,version=version+1 WHERE id=$6',
          [cmd.title, cmd.amount, cmd.status, cmd.reference, cmd.reason, cid],
        )
      } else
        await tx.client.query(
          'INSERT INTO vcm.commitments(id,project_id,case_id,authorization_id,title,amount,reference,status,reason,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [
            cid,
            cmd.projectId,
            cmd.caseId,
            cmd.authorizationId,
            cmd.title,
            cmd.amount,
            cmd.reference,
            cmd.status,
            cmd.reason,
            tx.principal.id,
          ],
        )
      await assertWithinBudget(tx, cmd.projectId, cmd.authorizationId)
      return {
        objectId: target!.objectId,
        version: await bumpProject(tx, cmd.projectId),
        result: { id: cid },
        after: { commitmentId: cid, amount: cmd.amount, status: cmd.status },
      }
    },
  })
  registry.register({
    type: 'saveExpense',
    action: 'executeMandate',
    schema: z.strictObject({
      type: z.literal('saveExpense'),
      projectId: id,
      id: id.optional(),
      budgetItemId: id,
      authorizationId: id,
      commitmentId: id.optional(),
      concept: z.string().trim().min(1).max(500),
      amount: money,
      spentOn: civilDate,
      supplierId: id.nullable().optional(),
      supplierLabel: z.string().max(1000).optional(),
      reference: z.string().max(2000).optional(),
      reason,
    }),
    target: projectTarget,
    async run(tx, cmd, target) {
      await requireMandate(tx, cmd.projectId, 'expense.record')
      await currentAuthorization(tx, cmd.projectId, cmd.authorizationId)
      await assertAction(
        tx,
        'editOperationalDraft',
        'budget:' + cmd.budgetItemId,
      )
      if (
        !(
          await tx.client.query(
            'SELECT 1 FROM vcm.budget_items WHERE id=$1 AND project_id=$2',
            [cmd.budgetItemId, cmd.projectId],
          )
        ).rowCount
      )
        throw new ApiError(
          422,
          'PROJECT_BUDGET_MISMATCH',
          'La partida no pertenece al proyecto.',
        )
      if (cmd.supplierId)
        await assertAction(tx, 'query', 'organization:' + cmd.supplierId)
      const eid = cmd.id ?? randomUUID()
      if (cmd.id) {
        const previous = (
          await tx.client.query(
            'SELECT authorization_id FROM vcm.expenses WHERE id=$1 AND project_id=$2 AND archived_at IS NULL',
            [eid, cmd.projectId],
          )
        ).rows[0]
        if (!previous || previous.authorization_id !== cmd.authorizationId)
          throw new ApiError(
            422,
            'EXPENSE_SCOPE_MISMATCH',
            'El gasto no puede cambiar de autorización.',
          )
        await tx.client.query(
          'UPDATE vcm.expenses SET budget_item_id=$1,concept=$2,amount=$3,spent_on=$4,supplier_id=$5,supplier_label=$6,reference=$7,version=version+1 WHERE id=$8',
          [
            cmd.budgetItemId,
            cmd.concept,
            cmd.amount,
            cmd.spentOn,
            cmd.supplierId ?? null,
            cmd.supplierLabel ?? null,
            cmd.reference ?? null,
            eid,
          ],
        )
      } else
        await tx.client.query(
          'INSERT INTO vcm.expenses(id,project_id,budget_item_id,authorization_id,concept,amount,spent_on,supplier_id,supplier_label,reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [
            eid,
            cmd.projectId,
            cmd.budgetItemId,
            cmd.authorizationId,
            cmd.concept,
            cmd.amount,
            cmd.spentOn,
            cmd.supplierId ?? null,
            cmd.supplierLabel ?? null,
            cmd.reference ?? null,
          ],
        )
      if (cmd.commitmentId) {
        const co = await tx.client.query(
          "SELECT authorization_id FROM vcm.commitments WHERE id=$1 AND project_id=$2 AND status='active'",
          [cmd.commitmentId, cmd.projectId],
        )
        if (!co.rowCount || co.rows[0].authorization_id !== cmd.authorizationId)
          throw new ApiError(
            422,
            'COMMITMENT_SCOPE_MISMATCH',
            'Compromiso de otra autorización o proyecto.',
          )
        const link = (
          await tx.client.query(
            'SELECT commitment_id FROM vcm.commitment_expenses WHERE expense_id=$1',
            [eid],
          )
        ).rows[0]
        if (link && link.commitment_id !== cmd.commitmentId)
          throw new ApiError(
            422,
            'EXPENSE_LINK_IMMUTABLE',
            'El vínculo original se conserva; archiva y registra una corrección.',
          )
        await tx.client.query(
          'INSERT INTO vcm.commitment_expenses(project_id,commitment_id,expense_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
          [cmd.projectId, cmd.commitmentId, eid],
        )
      }
      await assertWithinBudget(tx, cmd.projectId, cmd.authorizationId)
      return {
        objectId: target!.objectId,
        version: await bumpProject(tx, cmd.projectId),
        result: { id: eid },
        after: { expenseId: eid, amount: cmd.amount },
      }
    },
  })
  registry.register({
    type: 'archiveExpense',
    action: 'executeMandate',
    schema: z.strictObject({
      type: z.literal('archiveExpense'),
      projectId: id,
      id,
      reason,
    }),
    target: projectTarget,
    async run(tx, cmd, target) {
      await requireMandate(tx, cmd.projectId, 'expense.record')
      const e = (
        await tx.client.query(
          'SELECT budget_item_id FROM vcm.expenses WHERE id=$1 AND project_id=$2',
          [cmd.id, cmd.projectId],
        )
      ).rows[0]
      if (!e) throw new ApiError(404, 'NOT_FOUND', 'Gasto no encontrado.')
      await assertAction(
        tx,
        'editOperationalDraft',
        'budget:' + e.budget_item_id,
      )
      await tx.client.query(
        'UPDATE vcm.expenses SET archived_at=now(),version=version+1 WHERE id=$1',
        [cmd.id],
      )
      return {
        objectId: target!.objectId,
        version: await bumpProject(tx, cmd.projectId),
        result: { id: cmd.id },
        after: { archived: true },
      }
    },
  })
  registry.register({
    type: 'saveForecast',
    action: 'editOperationalDraft',
    schema: z.strictObject({
      type: z.literal('saveForecast'),
      projectId: id,
      remaining: money,
      reason,
    }),
    target: projectTarget,
    async run(tx, cmd, target) {
      const basis = await projectFinance(tx, cmd.projectId)
      await tx.client.query(
        'INSERT INTO vcm.forecasts(id,project_id,remaining,basis,reason,actor_id,version) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          randomUUID(),
          cmd.projectId,
          cmd.remaining,
          JSON.stringify({ fingerprint: basis.fingerprint }),
          cmd.reason,
          tx.principal.id,
          target!.version + 1,
        ],
      )
      return {
        objectId: target!.objectId,
        version: await bumpProject(tx, cmd.projectId),
        result: { remaining: cmd.remaining },
        after: { remaining: cmd.remaining },
      }
    },
  })
  registry.register({
    type: 'revokeAuthorization',
    action: 'approveBudget',
    schema: z.strictObject({
      type: z.literal('revokeAuthorization'),
      projectId: id,
      authorizationId: id,
      reason,
    }),
    target: projectTarget,
    async run(tx, cmd, target) {
      await currentAuthorization(tx, cmd.projectId, cmd.authorizationId)
      await tx.client.query(
        'INSERT INTO vcm.budget_authorization_revocations(authorization_id,revoked_by,reason) VALUES($1,$2,$3)',
        [cmd.authorizationId, tx.principal.id, cmd.reason],
      )
      return {
        objectId: target!.objectId,
        version: await bumpProject(tx, cmd.projectId),
        result: { id: cmd.authorizationId },
        after: { revoked: true },
      }
    },
  })
}
