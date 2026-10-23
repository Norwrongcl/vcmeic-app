import { createHash } from 'node:crypto'
import type { Pool } from 'pg'
import type { PrincipalContext, CommandResult } from '../contracts/common.ts'
import { envelopeSchema } from '../contracts/commands.ts'
import { type CommandRegistry } from './registry.ts'
import { transaction } from '../persistence/transaction.ts'
import { assertAction } from '../access/policy.ts'
import { recordMutation } from '../events/record-event.ts'
import { ApiError } from '../http/errors.ts'
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    )
  return JSON.stringify(value)
}
export class CommandExecutor {
  constructor(
    readonly pool: Pool,
    readonly registry: CommandRegistry,
  ) {}
  async executeCommand(
    principal: PrincipalContext,
    raw: unknown,
    correlationId: string,
  ): Promise<CommandResult> {
    const envelope = envelopeSchema.parse(raw),
      handler = this.registry.resolve(envelope.command.type),
      command = handler.schema.parse(envelope.command)
    const hash = createHash('sha256')
      .update(canonical({ command, expectedVersion: envelope.expectedVersion }))
      .digest('hex')
    try {
      return await transaction(
        this.pool,
        principal,
        correlationId,
        async (tx) => {
          await assertAction(tx, handler.action)
          await tx.client.query(
            'INSERT INTO vcm.idempotency_requests(principal_id,operation,key,request_hash) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
            [principal.id, handler.type, envelope.idempotencyKey, hash],
          )
          const r = await tx.client.query(
            'SELECT request_hash,response,expires_at<=now() expired FROM vcm.idempotency_requests WHERE principal_id=$1 AND operation=$2 AND key=$3 FOR UPDATE',
            [principal.id, handler.type, envelope.idempotencyKey],
          )
          const saved = r.rows[0]
          if (saved.expired)
            throw new ApiError(
              409,
              'IDEMPOTENCY_EXPIRED',
              'La clave venció; utiliza una clave nueva.',
            )
          if (saved.request_hash !== hash)
            throw new ApiError(
              409,
              'IDEMPOTENCY_CONFLICT',
              'La clave ya corresponde a otro comando.',
            )
          if (saved.response) {
            await assertAction(tx, handler.action, saved.response.objectId)
            return saved.response as CommandResult
          }
          let target = await handler.target(tx, command)
          if (target) {
            await tx.client.query(
              'SELECT id FROM vcm.protected_objects WHERE id=$1 FOR UPDATE',
              [target.objectId],
            )
            target = await handler.target(tx, command)
            if (!target)
              throw new ApiError(404, 'NOT_FOUND', 'Recurso no encontrado.')
            await assertAction(tx, handler.action, target.objectId)
          }
          if ((target?.version ?? 0) !== envelope.expectedVersion)
            throw new ApiError(
              409,
              'VERSION_CONFLICT',
              'El registro cambió. Recarga antes de guardar.',
            )
          const mutation = await handler.run(tx, command, target)
          if (mutation.version !== envelope.expectedVersion + 1)
            throw new Error('Handler returned an invalid aggregate version')
          await recordMutation(
            tx,
            handler.type,
            typeof command.reason === 'string'
              ? command.reason
              : 'Operación ' + handler.type,
            mutation,
          )
          const response: CommandResult = {
            objectId: mutation.objectId,
            version: mutation.version,
            result: mutation.result,
          }
          await tx.client.query(
            'UPDATE vcm.idempotency_requests SET response=$1,status_code=200 WHERE principal_id=$2 AND operation=$3 AND key=$4',
            [
              JSON.stringify(response),
              principal.id,
              handler.type,
              envelope.idempotencyKey,
            ],
          )
          return response
        },
      )
    } catch (e) {
      const code =
        e && typeof e === 'object' && 'code' in e ? String(e.code) : ''
      if (['23503', '23514', '22P02', '22007', '22008', '55000'].includes(code))
        throw new ApiError(
          422,
          'INVARIANT_VIOLATION',
          'La operación no cumple las referencias o reglas del registro.',
        )
      if (['23505', '40001', '40P01', '55P03'].includes(code))
        throw new ApiError(
          409,
          'CONCURRENT_CHANGE',
          'Se detectó un cambio concurrente; recarga y reintenta.',
        )
      throw e
    }
  }
}
