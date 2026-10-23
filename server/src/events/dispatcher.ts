import type { Pool } from 'pg'
export async function dispatchEvents(pool: Pool) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      "SET LOCAL lock_timeout='2s';SET LOCAL statement_timeout='2s'",
    )
    const lock = await client.query(
      'SELECT pg_try_advisory_xact_lock(783195024220::bigint) locked',
    )
    if (lock.rows[0].locked)
      await client.query(
        "INSERT INTO vcm.event_deliveries(outbox_sequence) SELECT e.sequence FROM vcm.outbox_events e WHERE NOT EXISTS(SELECT 1 FROM vcm.event_deliveries d WHERE d.outbox_sequence=e.sequence) AND e.created_at>=now()-interval '7 days' ORDER BY e.sequence LIMIT 1000 ON CONFLICT DO NOTHING",
      )
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
export function startDispatcher(pool: Pool) {
  let pending: Promise<void> | undefined,
    stopped = false
  const timer = setInterval(() => {
    if (stopped || pending) return
    pending = dispatchEvents(pool)
      .catch((e) => {
        process.stderr.write(
          JSON.stringify({
            level: 'error',
            component: 'event-dispatch',
            code:
              e && typeof e === 'object' && 'code' in e
                ? String(e.code)
                : 'UNAVAILABLE',
          }) + '\n',
        )
      })
      .finally(() => {
        pending = undefined
      })
  }, 1000)
  timer.unref()
  return async () => {
    stopped = true
    clearInterval(timer)
    await pending
  }
}
