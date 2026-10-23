import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { CommandRegistry } from '../commands/registry.ts'
import { id, reason, civilDate } from '../contracts/common.ts'
import { assertAction } from '../access/policy.ts'
import { ApiError } from '../http/errors.ts'
import { protectedTarget, ownObject } from '../operations/helpers.ts'
import { createApproval } from '../operations/mandates.ts'
import { latestRevision, completeContent } from './approvals.ts'
import { withinEditorialWeek } from '../../../packages/domain/src/campaigns.ts'
export function registerPackages(registry: CommandRegistry) {
  registry.register({
    type: 'savePackage',
    action: 'editOperationalDraft',
    schema: z.strictObject({
      type: z.literal('savePackage'),
      id: id.optional(),
      name: z.string().trim().min(1).max(500),
      startsOn: civilDate,
      items: z
        .array(z.strictObject({ contentId: id, revisionId: id }))
        .min(1)
        .max(100)
        .refine((a) => new Set(a.map((x) => x.contentId)).size === a.length),
    }),
    async target(tx, cmd) {
      return cmd.id
        ? protectedTarget(tx, 'editorial_packages', 'package', cmd.id)
        : undefined
    },
    async run(tx, cmd, target) {
      for (const item of [...cmd.items].sort((a, b) =>
        a.contentId.localeCompare(b.contentId),
      )) {
        await assertAction(tx, 'query', 'content:' + item.contentId)
        await tx.client.query(
          'SELECT id FROM vcm.protected_objects WHERE id=$1 FOR UPDATE',
          ['content:' + item.contentId],
        )
        const rev = await latestRevision(
          tx,
          'content_revisions',
          'content_id',
          item.contentId,
        )
        if (rev.id !== item.revisionId)
          throw new ApiError(
            422,
            'STALE_CONTENT_REVISION',
            'Selecciona la revisión actual del contenido.',
          )
      }
      const pid = cmd.id ?? randomUUID(),
        version = (target?.version ?? 0) + 1,
        revisionId = randomUUID()
      if (target)
        await tx.client.query(
          'UPDATE vcm.editorial_packages SET name=$1,period_starts_on=$2,version=version+1 WHERE id=$3',
          [cmd.name, cmd.startsOn, pid],
        )
      else {
        await tx.client.query(
          'INSERT INTO vcm.editorial_packages(id,name,period_starts_on) VALUES($1,$2,$3)',
          [pid, cmd.name, cmd.startsOn],
        )
        await ownObject(tx, 'package', pid)
      }
      await tx.client.query(
        'INSERT INTO vcm.package_revisions(id,package_id,version,actor_id) VALUES($1,$2,$3,$4)',
        [revisionId, pid, version, tx.principal.id],
      )
      for (const item of cmd.items)
        await tx.client.query(
          'INSERT INTO vcm.package_items(package_revision_id,content_id,content_revision_id) VALUES($1,$2,$3)',
          [revisionId, item.contentId, item.revisionId],
        )
      return {
        objectId: 'package:' + pid,
        version,
        result: { id: pid, revisionId },
        after: { revisionId, items: cmd.items },
      }
    },
  })
  registry.register({
    type: 'approvePackage',
    action: 'approveStrategyOrContent',
    schema: z.strictObject({
      type: z.literal('approvePackage'),
      id,
      revisionId: id,
      reason,
    }),
    async target(tx, cmd) {
      return protectedTarget(tx, 'editorial_packages', 'package', cmd.id)
    },
    async run(tx, cmd, target) {
      const rev = await latestRevision(
        tx,
        'package_revisions',
        'package_id',
        cmd.id,
      )
      if (rev.id !== cmd.revisionId)
        throw new ApiError(409, 'REVISION_CONFLICT', 'El paquete cambió.')
      const pkg = (
          await tx.client.query(
            'SELECT period_starts_on::text starts FROM vcm.editorial_packages WHERE id=$1',
            [cmd.id],
          )
        ).rows[0],
        items = (
          await tx.client.query(
            'SELECT * FROM vcm.package_items WHERE package_revision_id=$1 ORDER BY content_id',
            [rev.id],
          )
        ).rows
      if (!items.length)
        throw new ApiError(
          422,
          'PACKAGE_EMPTY',
          'El paquete no contiene revisiones para aprobar.',
        )
      for (const item of items) {
        await tx.client.query(
          'SELECT id FROM vcm.protected_objects WHERE id=$1 FOR UPDATE',
          ['content:' + item.content_id],
        )
        const { content, revision } = await completeContent(
          tx,
          item.content_id,
          item.content_revision_id,
        )
        if (
          content.mode !== 'weekly' ||
          !withinEditorialWeek(
            pkg.starts,
            new Date(revision.scheduled_at).toISOString(),
          )
        )
          throw new ApiError(
            422,
            'PACKAGE_DATE_MISMATCH',
            'Cada contenido debe ser semanal y estar programado dentro de los siete días del paquete.',
          )
      }
      const approvalId = await createApproval(
        tx,
        target!.objectId,
        rev.id,
        'package',
        cmd.reason,
      )
      await tx.client.query(
        'UPDATE vcm.editorial_packages SET version=version+1 WHERE id=$1',
        [cmd.id],
      )
      return {
        objectId: target!.objectId,
        version: target!.version + 1,
        result: { approvalId },
        after: { revisionId: rev.id, approved: true },
      }
    },
  })
}
