import { it, expect } from 'vitest'
import { database } from './database.ts'
import { dispatchEvents } from '../src/events/dispatcher.ts'
import { fixture, createCase } from './client.ts'
import { encodeCursor, decodeCursor } from '../src/events/cursor.ts'
it('assigns delivery cursor in commit order and does not skip a slow lower outbox sequence', async () => {
  const db = await database(),
    slow = await db.pool.connect(),
    fast = await db.pool.connect()
  try {
    await db.pool.query(
      "INSERT INTO vcm.protected_objects(id,kind) VALUES('a','case'),('b','case')",
    )
    await slow.query('BEGIN')
    const a = (
      await slow.query(
        "INSERT INTO vcm.outbox_events(object_id,event_type,payload,correlation_id) VALUES('a','slow','{\"version\":1}','a') RETURNING sequence",
      )
    ).rows[0].sequence
    const b = (
      await fast.query(
        "INSERT INTO vcm.outbox_events(object_id,event_type,payload,correlation_id) VALUES('b','fast','{\"version\":1}','b') RETURNING sequence",
      )
    ).rows[0].sequence
    expect(BigInt(a) < BigInt(b)).toBe(true)
    await dispatchEvents(db.pool)
    expect(
      (
        await db.pool.query(
          'SELECT outbox_sequence FROM vcm.event_deliveries ORDER BY cursor',
        )
      ).rows.map((r) => r.outbox_sequence),
    ).toEqual([b])
    await slow.query('COMMIT')
    await dispatchEvents(db.pool)
    expect(
      (
        await db.pool.query(
          'SELECT outbox_sequence FROM vcm.event_deliveries ORDER BY cursor',
        )
      ).rows.map((r) => r.outbox_sequence),
    ).toEqual([b, a])
    await slow.query('BEGIN')
    await slow.query(
      "INSERT INTO vcm.outbox_events(object_id,event_type,payload,correlation_id) VALUES('a','rolled-back','{}','rollback')",
    )
    await slow.query('ROLLBACK')
    await Promise.all([dispatchEvents(db.pool), dispatchEvents(db.pool)])
    expect(
      (await db.pool.query('SELECT count(*)::int n FROM vcm.event_deliveries'))
        .rows[0].n,
    ).toBe(2)
  } finally {
    slow.release()
    fast.release()
    await db.close()
  }
})
it('protects cursor scope and rejects tampering instead of exposing global event counts', () => {
  const key = 'a'.repeat(64),
    scope = 'human-1'
  const cursor = encodeCursor(key, scope, '142')
  expect(cursor).not.toContain('142')
  expect(decodeCursor(key, scope, cursor)).toBe('142')
  expect(() => decodeCursor(key, 'human-2', cursor)).toThrow()
  expect(() => decodeCursor(key, scope, cursor.slice(0, -3) + 'xxx')).toThrow()
})
it('streams authorized invalidations, supports reconnect and closes revoked credentials', async () => {
  const f = await fixture()
  const abort = new AbortController()
  try {
    const svc = await f.service(),
      authorization = 'Bearer ' + svc.token
    const own = await f.http
      .post('/v1/cases')
      .set('Authorization', authorization)
      .send({
        command: createCase,
        expectedVersion: 0,
        idempotencyKey: crypto.randomUUID(),
      })
    const hidden = (await f.command({ ...createCase, name: 'Otro caso' }, 0))
      .body.result.id
    await f.app.listen(0, '127.0.0.1')
    const address = f.app.getHttpServer().address()
    const response = await fetch(
      'http://127.0.0.1:' + address.port + '/v1/events',
      { headers: { Authorization: authorization }, signal: abort.signal },
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    const reader = response.body!.getReader()
    let output = ''
    for (let n = 0; n < 10 && !output.includes(own.body.objectId); n++) {
      const part = await reader.read()
      if (part.done) break
      output += new TextDecoder().decode(part.value)
    }
    expect(output).toContain(own.body.objectId)
    expect(output).not.toContain(hidden)
    const cursor = /id: (.+)/.exec(output)![1]
    await reader.cancel()
    abort.abort()
    const reconnectAbort = new AbortController()
    try {
      const response2 = await fetch(
        'http://127.0.0.1:' + address.port + '/v1/events',
        {
          headers: { Authorization: authorization, 'Last-Event-ID': cursor },
          signal: reconnectAbort.signal,
        },
      )
      expect(response2.status).toBe(200)
      await f.db.pool.query(
        'UPDATE vcm.service_credentials SET revoked_at=now() WHERE id=$1',
        [svc.credentialId],
      )
      const r = response2.body!.getReader()
      let ended = false
      for (let n = 0; n < 5; n++) {
        const p = await r.read()
        if (p.done) {
          ended = true
          break
        }
      }
      expect(ended).toBe(true)
    } finally {
      reconnectAbort.abort()
    }
    expect(
      (
        await f.db.pool.query(
          "SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND state='idle in transaction'",
        )
      ).rows[0].n,
    ).toBe(0)
  } finally {
    abort.abort()
    await f.close()
  }
}, 30000)
it('delivers an authorized archive invalidation so cached records can disappear', async () => {
  const f = await fixture()
  try {
    const made = await f.post('/v1/organizations', {
        command: { type: 'createOrganization', name: 'Temporal' },
        expectedVersion: 0,
        idempotencyKey: crypto.randomUUID(),
      }),
      id = made.body.result.id
    await f.post('/v1/organizations/' + id + '/commands', {
      command: { type: 'archiveOrganization', id, reason: 'Duplicado' },
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
    })
    await dispatchEvents(f.db.pool)
    const { transaction } = await import('../src/persistence/transaction.ts'),
      { readEventPage } = await import('../src/events/stream.ts')
    const page = await transaction(
      f.db.pool,
      (await f.get('/v1/session/me')).body,
      'test',
      (tx) => readEventPage(tx, '0', true),
    )
    expect(page.events.some((e) => e.type === 'archiveOrganization')).toBe(true)
  } finally {
    await f.close()
  }
})
