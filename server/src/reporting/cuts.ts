import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { type TransactionContext, id, reason } from '../contracts/common.ts'
import type { CommandRegistry } from '../commands/registry.ts'
import { ApiError } from '../http/errors.ts'
import { assertAction } from '../access/policy.ts'
import { protectedTarget, ownObject } from '../operations/helpers.ts'
import { eligibleCase } from './indicators.ts'
import { readCase } from '../cases/cases.read.ts'
async function cutTarget(tx: TransactionContext, cmd: { cutId: string }) {
  return protectedTarget(tx, 'institutional_cuts', 'cut', cmd.cutId)
}
async function currentMembers(tx: TransactionContext, cutId: string) {
  return (
    await tx.client.query(
      'SELECT cc.case_id FROM vcm.cut_cases cc WHERE cc.cut_id=$1 AND cc.cut_version=(SELECT max(version) FROM vcm.cut_revisions WHERE cut_id=$1) ORDER BY cc.case_id',
      [cutId],
    )
  ).rows.map((r) => r.case_id) as string[]
}
async function cutRevision(
  tx: TransactionContext,
  cutId: string,
  version: number,
  caseIds: string[],
  seal: boolean,
) {
  await tx.client.query(
    'INSERT INTO vcm.cut_revisions(cut_id,version) VALUES($1,$2)',
    [cutId, version],
  )
  for (const cid of caseIds) {
    await tx.client.query(
      'SELECT id FROM vcm.protected_objects WHERE id=$1 FOR UPDATE',
      ['case:' + cid],
    )
    const snapshot = await readCase(tx, cid)
    await tx.client.query(
      'INSERT INTO vcm.case_snapshots(case_id,version,payload,actor_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [cid, snapshot.version, JSON.stringify(snapshot), tx.principal.id],
    )
    await tx.client.query(
      'INSERT INTO vcm.cut_cases(cut_id,cut_version,case_id,case_version) VALUES($1,$2,$3,$4)',
      [cutId, version, cid, snapshot.version],
    )
  }
  if (seal)
    await tx.client.query(
      'UPDATE vcm.cut_revisions SET sealed_at=now() WHERE cut_id=$1 AND version=$2',
      [cutId, version],
    )
}
export function registerCuts(registry: CommandRegistry) {
  registry.register({
    type: 'createCut',
    action: 'validateInstitutional',
    schema: z.strictObject({
      type: z.literal('createCut'),
      name: z.string().trim().min(1).max(500),
      period: z.string().trim().min(1).max(100),
      caseIds: z
        .array(id)
        .min(1)
        .max(100)
        .refine((a) => new Set(a).size === a.length),
    }),
    async target() {
      return undefined
    },
    async run(tx, cmd) {
      for (const cid of [...cmd.caseIds].sort()) {
        await tx.client.query(
          'SELECT id FROM vcm.protected_objects WHERE id=$1 FOR UPDATE',
          ['case:' + cid],
        )
        if (!(await eligibleCase(tx, cid, true)))
          throw new ApiError(
            422,
            'CUT_INELIGIBLE',
            'El corte requiere expedientes elegibles con QA completo.',
          )
      }
      const cutId = randomUUID()
      await tx.client.query(
        'INSERT INTO vcm.institutional_cuts(id,name,period) VALUES($1,$2,$3)',
        [cutId, cmd.name, cmd.period],
      )
      await ownObject(tx, 'cut', cutId)
      await cutRevision(tx, cutId, 1, [...cmd.caseIds].sort(), false)
      return {
        objectId: 'cut:' + cutId,
        version: 1,
        result: { id: cutId },
        after: { caseIds: cmd.caseIds, period: cmd.period },
      }
    },
  })
  registry.register({
    type: 'addObservation',
    action: 'validateInstitutional',
    schema: z.strictObject({
      type: z.literal('addObservation'),
      cutId: id,
      caseId: id,
      text: z.string().trim().min(1).max(20000),
      category: z.string().min(1).max(200),
      responsibleId: id,
      reason,
    }),
    target: cutTarget,
    async run(tx, cmd, target) {
      const cut = (
        await tx.client.query(
          'SELECT status FROM vcm.institutional_cuts WHERE id=$1',
          [cmd.cutId],
        )
      ).rows[0]
      if (cut.status === 'closed')
        throw new ApiError(
          422,
          'CUT_CLOSED',
          'El corte cerrado conserva su versión institucional.',
        )
      const members = await currentMembers(tx, cmd.cutId)
      if (!members.includes(cmd.caseId))
        throw new ApiError(
          422,
          'CUT_CASE_MISMATCH',
          'El expediente no pertenece al corte.',
        )
      await assertAction(tx, 'query', 'case:' + cmd.caseId)
      if (
        !(
          await tx.client.query(
            "SELECT 1 FROM vcm.principals WHERE id=$1 AND kind='human' AND active",
            [cmd.responsibleId],
          )
        ).rowCount
      )
        throw new ApiError(422, 'INVALID_RESPONSIBLE', 'Responsable no válido.')
      const observationId = randomUUID()
      await tx.client.query(
        'INSERT INTO vcm.cut_observations(id,cut_id,case_id,category,text,responsible_id) VALUES($1,$2,$3,$4,$5,$6)',
        [
          observationId,
          cmd.cutId,
          cmd.caseId,
          cmd.category,
          cmd.text,
          cmd.responsibleId,
        ],
      )
      await cutRevision(tx, cmd.cutId, target!.version + 1, members, false)
      await tx.client.query(
        "UPDATE vcm.institutional_cuts SET status='review',version=version+1 WHERE id=$1",
        [cmd.cutId],
      )
      return {
        objectId: target!.objectId,
        version: target!.version + 1,
        result: { id: observationId },
        after: { observationId, caseId: cmd.caseId },
      }
    },
  })
  registry.register({
    type: 'resolveObservation',
    action: 'validateInstitutional',
    schema: z.strictObject({
      type: z.literal('resolveObservation'),
      cutId: id,
      caseId: id,
      id,
      resolution: reason,
      reason,
    }),
    target: cutTarget,
    async run(tx, cmd, target) {
      const cut = (
        await tx.client.query(
          'SELECT status FROM vcm.institutional_cuts WHERE id=$1',
          [cmd.cutId],
        )
      ).rows[0]
      if (cut.status === 'closed')
        throw new ApiError(422, 'CUT_CLOSED', 'El corte está cerrado.')
      await assertAction(tx, 'query', 'case:' + cmd.caseId)
      const r = await tx.client.query(
        "UPDATE vcm.cut_observations SET status='resolved',resolution=$1,resolved_at=now(),version=version+1 WHERE id=$2 AND cut_id=$3 AND case_id=$4 RETURNING id",
        [cmd.resolution, cmd.id, cmd.cutId, cmd.caseId],
      )
      if (!r.rowCount)
        throw new ApiError(404, 'NOT_FOUND', 'Observación no encontrada.')
      await cutRevision(
        tx,
        cmd.cutId,
        target!.version + 1,
        await currentMembers(tx, cmd.cutId),
        false,
      )
      await tx.client.query(
        'UPDATE vcm.institutional_cuts SET version=version+1 WHERE id=$1',
        [cmd.cutId],
      )
      return {
        objectId: target!.objectId,
        version: target!.version + 1,
        result: { id: cmd.id },
        after: { resolved: true, resolution: cmd.resolution },
      }
    },
  })
  registry.register({
    type: 'transitionCut',
    action: 'validateInstitutional',
    schema: z.strictObject({
      type: z.literal('transitionCut'),
      cutId: id,
      status: z.enum(['draft', 'review', 'ready', 'closed']),
      response: z.string().max(20000),
      reason,
    }),
    target: cutTarget,
    async run(tx, cmd, target) {
      const cut = (
          await tx.client.query(
            'SELECT status FROM vcm.institutional_cuts WHERE id=$1',
            [cmd.cutId],
          )
        ).rows[0],
        edges: Record<string, string[]> = {
          draft: ['review'],
          review: ['ready'],
          ready: ['review', 'closed'],
          closed: [],
        }
      if (!edges[cut.status].includes(cmd.status))
        throw new ApiError(
          422,
          'INVALID_TRANSITION',
          'Transición de corte no permitida.',
        )
      const members = await currentMembers(tx, cmd.cutId)
      if (['ready', 'closed'].includes(cmd.status)) {
        if (
          (
            await tx.client.query(
              "SELECT 1 FROM vcm.cut_observations WHERE cut_id=$1 AND status='open'",
              [cmd.cutId],
            )
          ).rowCount
        )
          throw new ApiError(
            422,
            'OPEN_OBSERVATIONS',
            'Resuelve las observaciones abiertas.',
          )
        for (const cid of members) {
          await tx.client.query(
            'SELECT id FROM vcm.protected_objects WHERE id=$1 FOR UPDATE',
            ['case:' + cid],
          )
          if (!(await eligibleCase(tx, cid)))
            throw new ApiError(
              422,
              'CUT_INELIGIBLE',
              'Revisa QA de todos los expedientes.',
            )
        }
      }
      if (cmd.status === 'closed' && !cmd.response.trim())
        throw new ApiError(
          422,
          'INSTITUTIONAL_RESPONSE_REQUIRED',
          'Registra la respuesta institucional recibida; la API no la envía automáticamente.',
        )
      await cutRevision(
        tx,
        cmd.cutId,
        target!.version + 1,
        members,
        ['ready', 'closed'].includes(cmd.status),
      )
      await tx.client.query(
        'UPDATE vcm.institutional_cuts SET status=$1,response=$2,version=version+1 WHERE id=$3',
        [cmd.status, cmd.response, cmd.cutId],
      )
      return {
        objectId: target!.objectId,
        version: target!.version + 1,
        result: { status: cmd.status },
        after: { status: cmd.status, response: cmd.response },
      }
    },
  })
}
export { currentMembers }
