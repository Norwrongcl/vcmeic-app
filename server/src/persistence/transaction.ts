import type { Pool } from 'pg'
import type {
  PrincipalContext,
  TransactionContext,
} from '../contracts/common.ts'
export async function transaction<T>(
  pool: Pool,
  principal: PrincipalContext,
  correlationId: string,
  run: (tx: TransactionContext) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      "SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='10s'",
    )
    const result = await run({
      client,
      principal,
      correlationId,
      now: new Date(),
    })
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
