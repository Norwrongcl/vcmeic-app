import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { CommandRegistry } from '../commands/registry.ts'
import { id, reason, civilDate } from '../contracts/common.ts'
import { protectedTarget, ownObject } from './helpers.ts'
import { resources } from './resources.ts'
import { ApiError } from '../http/errors.ts'
import { assertAction } from '../access/policy.ts'
const text = z.string().max(4000).nullable(),
  name = z.string().trim().min(1).max(500)
const shapes = {
  Organization: {
    name,
    organizationType: text.optional(),
    taxId: text.optional(),
    email: z.email().nullable().optional(),
    phone: text.optional(),
    website: z.url().nullable().optional(),
    notes: text.optional(),
  },
  Contact: {
    name,
    email: z.email().nullable().optional(),
    phone: text.optional(),
    principalId: id.nullable().optional(),
  },
  Agreement: {
    name,
    organizationId: id,
    responsibleContactId: id.nullable().optional(),
    agreementType: text.optional(),
    description: text.optional(),
    startsOn: civilDate,
    endsOn: civilDate.nullable().optional(),
    status: z
      .enum(['draft', 'active', 'expired', 'cancelled'])
      .default('draft'),
    notes: text.optional(),
  },
  Resource: {
    name,
    category: z.enum(['space', 'equipment', 'material', 'service']),
    unit: z.string().min(1),
    quantity: z.number().finite().nonnegative().nullable().optional(),
    description: text.optional(),
    notes: text.optional(),
  },
}
export function registerMasters(registry: CommandRegistry) {
  for (const [label, shape] of Object.entries(shapes)) {
    const definition = resources.find((r) =>
      r.create.includes('create' + label),
    )!
    for (const operation of ['create', 'update', 'archive'] as const) {
      const type = operation + label,
        fields = z.strictObject(shape)
      const schema =
        operation === 'create'
          ? fields.extend({ type: z.literal(type) }).strict()
          : operation === 'update'
            ? fields
                .partial()
                .extend({ type: z.literal(type), id, reason })
                .strict()
            : z.strictObject({ type: z.literal(type), id, reason })
      registry.register({
        type,
        action:
          operation === 'archive' ? 'archiveDraft' : 'editOperationalDraft',
        schema: schema as z.ZodType<Record<string, unknown>>,
        async target(tx, cmd) {
          return operation === 'create'
            ? undefined
            : protectedTarget(tx, definition.table, definition.kind, cmd.id)
        },
        async run(tx, cmd, target) {
          const objectId =
            operation === 'create' ? randomUUID() : String(cmd.id)
          const before =
            operation === 'create'
              ? undefined
              : (
                  await tx.client.query(
                    `SELECT * FROM vcm.${definition.table} WHERE id=$1`,
                    [objectId],
                  )
                ).rows[0]
          if (label === 'Agreement') {
            if (
              cmd.organizationId &&
              !(
                await tx.client.query(
                  'SELECT id FROM vcm.organizations WHERE id=$1 AND archived_at IS NULL',
                  [cmd.organizationId],
                )
              ).rowCount
            )
              throw new ApiError(
                422,
                'INVALID_ORGANIZATION',
                'Organización inexistente.',
              )
            if (cmd.responsibleContactId)
              await assertAction(
                tx,
                'query',
                'contact:' + cmd.responsibleContactId,
              )
          }
          if (
            label === 'Contact' &&
            cmd.principalId &&
            !(
              await tx.client.query(
                "SELECT 1 FROM vcm.principals WHERE id=$1 AND kind='human' AND active",
                [cmd.principalId],
              )
            ).rowCount
          )
            throw new ApiError(
              422,
              'INVALID_CONTACT_USER',
              'Usuario de contacto no válido.',
            )
          if (operation === 'archive') {
            const dependencies: Record<string, string> = {
              Organization:
                'SELECT 1 FROM vcm.agreements WHERE organization_id=$1 UNION ALL SELECT 1 FROM vcm.case_organizations WHERE organization_id=$1 AND active',
              Contact:
                'SELECT 1 FROM vcm.task_assignees WHERE contact_id=$1 AND active UNION ALL SELECT 1 FROM vcm.agreements WHERE responsible_contact_id=$1',
              Resource:
                'SELECT 1 FROM vcm.project_resources WHERE resource_id=$1',
              Agreement:
                'SELECT 1 FROM vcm.case_agreements WHERE agreement_id=$1 AND active',
            }
            if (
              (await tx.client.query(dependencies[label], [objectId])).rowCount
            )
              throw new ApiError(
                422,
                'HAS_DEPENDANTS',
                'El registro tiene vínculos vigentes; resuélvelos antes de archivarlo.',
              )
            await tx.client.query(
              'UPDATE vcm.protected_objects SET archived_at=now() WHERE id=$1',
              [target!.objectId],
            )
            await tx.client.query(
              `UPDATE vcm.${definition.table} SET version=version+1 WHERE id=$1`,
              [objectId],
            )
          } else {
            const pairs = Object.entries(definition.fields).filter(
                ([key]) => key in cmd,
              ),
              values = pairs.map(([key]) => cmd[key])
            if (operation === 'create') {
              if (label !== 'Agreement')
                await ownObject(
                  tx,
                  definition.kind,
                  objectId,
                  label === 'Contact' ? 'restricted' : 'internal',
                )
              await tx.client.query(
                `INSERT INTO vcm.${definition.table}(id,${pairs.map(([, col]) => col).join(',')}) VALUES($1,${pairs.map((_, i) => '$' + (i + 2)).join(',')})`,
                [objectId, ...values],
              )
              if (label === 'Agreement')
                await ownObject(tx, definition.kind, objectId)
            } else {
              await tx.client.query(
                `UPDATE vcm.${definition.table} SET ${pairs
                  .map(([, col], i) => col + '=$' + (i + 2))
                  .concat('version=version+1')
                  .join(',')} WHERE id=$1`,
                [objectId, ...values],
              )
            }
          }
          return {
            objectId: definition.kind + ':' + objectId,
            version: (target?.version ?? 0) + 1,
            result: { id: objectId },
            before,
            after: {
              ...Object.fromEntries(
                Object.entries(cmd).filter(([key]) => key in definition.fields),
              ),
              id: objectId,
              operation,
            },
          }
        },
      })
    }
  }
}
