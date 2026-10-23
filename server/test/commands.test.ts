import { it, expect } from 'vitest'
import { z } from 'zod'
import { database } from './database.ts'
import { provisionUser } from '../src/identity/provision.ts'
import { CommandRegistry } from '../src/commands/registry.ts'
import { CommandExecutor } from '../src/commands/executor.ts'
import type { PrincipalContext } from '../src/contracts/common.ts'

it('serializes versions, replays identical writes and rolls back business/audit/event together', async () => {
  const db = await database()
  try {
    const id = await provisionUser(db.pool, {
      email: 'u@example.cl',
      name: 'Coordination',
      password: 'test-password-123',
      roles: ['coordination'],
    })
    await db.pool.query(
      "INSERT INTO vcm.cases(id,code,name,kind) VALUES('a','A','Original','presence')",
    )
    const p: PrincipalContext = {
      id,
      kind: 'human',
      roles: ['coordination'],
      scopes: [],
      permissionsVersion: 1,
    }
    const registry = new CommandRegistry()
    registry.register({
      type: 'renameCase',
      action: 'editOperationalDraft',
      schema: z.strictObject({
        type: z.literal('renameCase'),
        caseId: z.string(),
        name: z.string(),
        fail: z.boolean().optional(),
      }),
      async target(tx, cmd) {
        const r = await tx.client.query(
          'SELECT protected_object_id AS "objectId",version FROM vcm.cases WHERE id=$1',
          [cmd.caseId],
        )
        return r.rows[0]
      },
      async run(tx, cmd, target) {
        await tx.client.query(
          'UPDATE vcm.cases SET name=$1,version=version+1 WHERE id=$2',
          [cmd.name, cmd.caseId],
        )
        if (cmd.fail) throw new Error('fixture failure after write')
        return {
          objectId: target!.objectId,
          version: target!.version + 1,
          result: { name: cmd.name },
          after: { name: cmd.name },
        }
      },
    })
    const exec = new CommandExecutor(db.pool, registry)
    const envelope = (name: string, key: string, v: number, fail = false) => ({
      command: { type: 'renameCase', caseId: 'a', name, fail },
      expectedVersion: v,
      idempotencyKey: key,
    })
    const same = envelope('First', 'repeat-key-1', 1)
    const [a, b] = await Promise.all([
      exec.executeCommand(p, same, 'a'),
      exec.executeCommand(p, same, 'b'),
    ])
    expect(a).toEqual(b)
    expect(a.version).toBe(2)
    expect(
      (await db.pool.query('SELECT count(*)::int n FROM vcm.audit_events'))
        .rows[0].n,
    ).toBe(1)
    await expect(
      exec.executeCommand(p, envelope('Different', 'repeat-key-1', 1), 'c'),
    ).rejects.toMatchObject({ status: 409 })
    const race = await Promise.allSettled([
      exec.executeCommand(p, envelope('Two', 'race-key-1', 2), 'd'),
      exec.executeCommand(p, envelope('Three', 'race-key-2', 2), 'e'),
    ])
    expect(race.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(
      race.filter((r) => r.status === 'rejected').map((r) => r.reason.status),
    ).toEqual([409])
    await expect(
      exec.executeCommand(
        p,
        envelope('Rollback', 'rollback-key', 3, true),
        'f',
      ),
    ).rejects.toThrow('fixture failure')
    expect(
      (await db.pool.query('SELECT version FROM vcm.cases WHERE id=$1', ['a']))
        .rows[0].version,
    ).toBe(3)
    expect(
      (await db.pool.query('SELECT count(*)::int n FROM vcm.audit_events'))
        .rows[0].n,
    ).toBe(2)
    expect(
      (await db.pool.query('SELECT count(*)::int n FROM vcm.outbox_events'))
        .rows[0].n,
    ).toBe(2)
    await db.pool.query('UPDATE vcm.principals SET active=false WHERE id=$1', [
      id,
    ])
    await expect(exec.executeCommand(p, same, 'g')).rejects.toMatchObject({
      status: 401,
    })
  } finally {
    await db.close()
  }
})
it('does not share idempotency responses across principals or execute expired keys', async () => {
  const db = await database()
  try {
    const ids = await Promise.all(
      ['a', 'b'].map((s) =>
        provisionUser(db.pool, {
          email: s + '@example.cl',
          name: s,
          password: 'test-password-123',
          roles: ['coordination'],
        }),
      ),
    )
    const registry = new CommandRegistry()
    registry.register({
      type: 'createCase',
      action: 'editOperationalDraft',
      schema: z.strictObject({ type: z.literal('createCase') }),
      async target() {
        return undefined
      },
      async run(tx) {
        const id = tx.principal.id
        await tx.client.query(
          "INSERT INTO vcm.cases(id,code,name,kind) VALUES($1,$1,'New','presence')",
          [id],
        )
        return { objectId: 'case:' + id, version: 1, result: { id } }
      },
    })
    const exec = new CommandExecutor(db.pool, registry),
      envelope = {
        command: { type: 'createCase' },
        expectedVersion: 0,
        idempotencyKey: 'shared-key-1',
      }
    const p = (id: string): PrincipalContext => ({
      id,
      kind: 'human',
      roles: ['coordination'],
      scopes: [],
      permissionsVersion: 1,
    })
    const [a, b] = await Promise.all(
      ids.map((id) => exec.executeCommand(p(id), envelope, id)),
    )
    expect(a.objectId).not.toBe(b.objectId)
    await db.pool.query(
      "UPDATE vcm.idempotency_requests SET created_at=now()-interval '8 days',expires_at=now()-interval '1 day'",
    )
    await expect(
      exec.executeCommand(p(ids[0]), envelope, 'expired'),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_EXPIRED' })
    expect(
      (await db.pool.query('SELECT count(*)::int n FROM vcm.cases')).rows[0].n,
    ).toBe(2)
  } finally {
    await db.close()
  }
})
