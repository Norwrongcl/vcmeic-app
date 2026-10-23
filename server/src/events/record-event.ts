import { randomUUID } from 'node:crypto'
import type { TransactionContext } from '../contracts/common.ts'
import type { Mutation } from '../commands/registry.ts'
export async function recordMutation(
  tx: TransactionContext,
  type: string,
  reason: string,
  mutation: Mutation,
) {
  await tx.client.query(
    'INSERT INTO vcm.audit_events(id,object_id,actor_id,acting_service_id,action,reason,before_data,after_data,rule_version,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [
      randomUUID(),
      mutation.objectId,
      tx.principal.id,
      tx.principal.kind === 'service' ? tx.principal.id : null,
      type,
      reason,
      mutation.before === undefined ? null : JSON.stringify(mutation.before),
      mutation.after === undefined ? null : JSON.stringify(mutation.after),
      'PO-2026.09-v1',
      tx.correlationId,
    ],
  )
  await tx.client.query(
    'INSERT INTO vcm.outbox_events(object_id,event_type,payload,correlation_id) VALUES($1,$2,$3,$4)',
    [
      mutation.objectId,
      type,
      JSON.stringify({ version: mutation.version }),
      tx.correlationId,
    ],
  )
}
