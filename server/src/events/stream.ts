import type { Pool } from 'pg'
import type { Response } from 'express'
import type { TransactionContext } from '../contracts/common.ts'
import { transaction } from '../persistence/transaction.ts'
import { visibilityPredicate } from '../access/visibility.ts'
import { assertAction } from '../access/policy.ts'
import {
  type Identity,
  type AuthenticatedRequest,
} from '../identity/sessions.ts'
import { cursorScope, encodeCursor, decodeCursor } from './cursor.ts'
import { ApiError } from '../http/errors.ts'
export async function readEventPage(
  tx: TransactionContext,
  cursor: string,
  initial = false,
) {
  await assertAction(tx, 'query')
  const bounds = (
    await tx.client.query(
      "SELECT COALESCE(max(cursor),0)::text ceiling,COALESCE(min(cursor) FILTER(WHERE created_at>=now()-interval '7 days'),0)::text floor FROM vcm.event_deliveries",
    )
  ).rows[0]
  if (BigInt(cursor) > BigInt(bounds.ceiling))
    throw new ApiError(
      422,
      'CURSOR_AHEAD',
      'El cursor no corresponde a este historial.',
    )
  if (
    !initial &&
    (bounds.floor === '0'
      ? BigInt(cursor) < BigInt(bounds.ceiling)
      : BigInt(bounds.floor) > BigInt(cursor) + 1n)
  )
    return { reset: true, cursor: bounds.ceiling, events: [] }
  const pred = visibilityPredicate(tx.principal, 'o', 3, true)
  const events = (
    await tx.client.query(
      `SELECT d.cursor::text cursor,e.object_id AS "objectId",e.event_type AS type,e.payload->>'version' version FROM vcm.event_deliveries d JOIN vcm.outbox_events e ON e.sequence=d.outbox_sequence JOIN vcm.protected_objects o ON o.id=e.object_id WHERE d.cursor>$1::bigint AND d.cursor<=$2::bigint AND d.created_at>=now()-interval '7 days' AND ${pred.sql} AND (o.archived_at IS NULL OR e.event_type LIKE 'archive%') ORDER BY d.cursor LIMIT 100`,
      [cursor, bounds.ceiling, ...pred.values],
    )
  ).rows
  return {
    reset: false,
    cursor: events.length === 100 ? events.at(-1)!.cursor : bounds.ceiling,
    events,
  }
}
const streams = new Map<string, number>()
export function openEventStream(
  pool: Pool,
  identity: Identity,
  key: string,
  req: AuthenticatedRequest,
  res: Response,
) {
  const principal = req.principal!,
    scope = cursorScope(principal),
    last = req.headers['last-event-id']
  if (Array.isArray(last))
    throw new ApiError(422, 'INVALID_CURSOR', 'Cursor inválido.')
  let initialRequest = !last
  let cursor = last ? decodeCursor(key, scope, last) : '0'
  if ((streams.get(principal.id) ?? 0) >= 5)
    throw new ApiError(
      429,
      'STREAM_LIMIT',
      'Demasiadas conexiones abiertas para esta identidad.',
    )
  streams.set(principal.id, (streams.get(principal.id) ?? 0) + 1)
  let stopped = false,
    pending = false,
    lastHeartbeat = 0
  const stop = () => {
    if (stopped) return
    stopped = true
    clearInterval(timer)
    streams.set(principal.id, Math.max(0, (streams.get(principal.id) ?? 1) - 1))
    if (!streams.get(principal.id)) streams.delete(principal.id)
    if (!res.writableEnded) res.end()
  }
  const send = (type: string, data: unknown, eventCursor?: string) => {
    if (stopped || res.destroyed) return
    if (eventCursor)
      res.write('id: ' + encodeCursor(key, scope, eventCursor) + '\n')
    res.write('event: ' + type + '\ndata: ' + JSON.stringify(data) + '\n\n')
  }
  const pump = async () => {
    if (stopped || pending) return
    pending = true
    try {
      const current = await identity.authenticate(req)
      if (cursorScope(current) !== scope) {
        send('reset-required', { reason: 'permissions-changed' })
        stop()
        return
      }
      const page = await transaction(pool, current, 'events', (tx) =>
        readEventPage(tx, cursor, initialRequest),
      )
      initialRequest = false
      if (stopped) return
      if (page.reset) {
        send('reset-required', { reason: 'cursor-expired' })
        stop()
        return
      }
      for (const event of page.events)
        send(
          'change',
          {
            type: event.type,
            objectId: event.objectId,
            version: Number(event.version),
          },
          event.cursor,
        )
      cursor = page.cursor
      if (Date.now() - lastHeartbeat >= 15000) {
        send('heartbeat', {}, cursor)
        lastHeartbeat = Date.now()
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        stop()
        return
      }
      send(
        e instanceof ApiError && e.code === 'INVALID_CURSOR'
          ? 'reset-required'
          : 'stream-error',
        { code: e instanceof ApiError ? e.code : 'UNAVAILABLE' },
      )
      stop()
    } finally {
      pending = false
    }
  }
  const timer = setInterval(() => {
    void pump()
  }, 1000)
  timer.unref()
  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders()
  res.write('retry: 1000\nevent: ready\ndata: {}\n\n')
  res.on('close', stop)
  void pump()
}
