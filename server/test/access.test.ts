import { it, expect } from 'vitest'
import { database } from './database.ts'
import { assertAction } from '../src/access/policy.ts'
import { visibilityPredicate } from '../src/access/visibility.ts'
import type {
  PrincipalContext,
  TransactionContext,
  Role,
} from '../src/contracts/common.ts'
import { provisionUser, provisionService } from '../src/identity/provision.ts'
import { readFile } from 'node:fs/promises'

it('filters all seven roles, each protected relation, and expired grants before reads', async () => {
  const db = await database()
  const c = await db.pool.connect()
  try {
    for (const role of [
      'coordination',
      'leadership',
      'direction',
      'responsible',
      'designer',
      'technician',
      'viewer',
    ] as Role[]) {
      await provisionUser(db.pool, {
        name: role,
        email: role + '@example.cl',
        password: 'test-password-123',
        roles: [role],
      })
    }
    const users = (
      await c.query(
        'SELECT p.id,r.role_code FROM vcm.principals p JOIN vcm.principal_roles r ON r.principal_id=p.id',
      )
    ).rows
    await c.query(
      "INSERT INTO vcm.cases(id,code,name,kind) VALUES('a','A','Case A','presence'),('b','B','Case B','presence');INSERT INTO vcm.document_references(id,name) VALUES('doc','Secret');UPDATE vcm.protected_objects SET confidentiality='sensitive' WHERE id='document:doc'",
    )
    for (const u of users) {
      const p: PrincipalContext = {
        id: u.id,
        kind: 'human',
        roles: [u.role_code],
        scopes: [],
        permissionsVersion: 1,
      }
      const predicate = visibilityPredicate(p, 'o')
      const r = await c.query(
        'SELECT o.id FROM vcm.protected_objects o WHERE ' + predicate.sql,
        predicate.values,
      )
      expect(r.rows.map((v) => v.id).sort()).toEqual(
        u.role_code === 'responsible' ? [] : ['case:a', 'case:b'],
      )
    }
    const responsible = users.find((u) => u.role_code === 'responsible')!
    await c.query(
      "INSERT INTO vcm.case_assignments(case_id,principal_id,function) VALUES('a',$1,'responsible')",
      [responsible.id],
    )
    const principal: PrincipalContext = {
      id: responsible.id,
      kind: 'human',
      roles: ['responsible'],
      scopes: [],
      permissionsVersion: 1,
    }
    const pred = visibilityPredicate(principal, 'o')
    expect(
      (
        await c.query(
          'SELECT o.id FROM vcm.protected_objects o WHERE ' + pred.sql,
          pred.values,
        )
      ).rows.map((r) => r.id),
    ).toEqual(['case:a'])
    const tx: TransactionContext = {
      client: c,
      principal,
      correlationId: 'test',
      now: new Date(),
    }
    await expect(
      assertAction(tx, 'captureAntecedent', 'case:a'),
    ).resolves.toBeUndefined()
    await expect(assertAction(tx, 'query', 'case:b')).rejects.toMatchObject({
      status: 404,
    })
    await expect(
      assertAction(tx, 'query', 'document:doc'),
    ).rejects.toMatchObject({ status: 404 })
    await c.query(
      "INSERT INTO vcm.object_grants(object_id,principal_id,permission,valid_from,valid_until) VALUES('document:doc',$1,'read',now()-interval '2 days',now()-interval '1 day')",
      [principal.id],
    )
    await expect(
      assertAction(tx, 'query', 'document:doc'),
    ).rejects.toMatchObject({ status: 404 })
    await c.query(
      "UPDATE vcm.object_grants SET valid_until=now()+interval '1 day' WHERE principal_id=$1",
      [principal.id],
    )
    await expect(
      assertAction(tx, 'query', 'document:doc'),
    ).resolves.toBeUndefined()
  } finally {
    c.release()
    await db.close()
  }
})
it('checks every catalog action and refuses service human authority and mixed identity claims', async () => {
  const db = await database()
  const c = await db.pool.connect()
  try {
    const catalog = JSON.parse(
      await readFile(
        new URL('../../database/catalog/actions.json', import.meta.url),
        'utf8',
      ),
    ) as { actions: { action: string; roles: Role[]; authority: string }[] }
    for (const role of [
      'coordination',
      'leadership',
      'direction',
      'responsible',
      'designer',
      'technician',
      'viewer',
    ] as Role[]) {
      const id = await provisionUser(db.pool, {
        name: role,
        email: role + '@example.cl',
        password: 'test-password-123',
        roles: [role],
      })
      const tx: TransactionContext = {
        client: c,
        principal: {
          id,
          kind: 'human',
          roles: [role],
          scopes: [],
          permissionsVersion: 1,
        },
        correlationId: 'test',
        now: new Date(),
      }
      for (const action of catalog.actions) {
        if (action.roles.includes(role))
          await expect(assertAction(tx, action.action)).resolves.toBeUndefined()
        else
          await expect(assertAction(tx, action.action)).rejects.toMatchObject({
            status: 403,
          })
      }
    }
    const service = await provisionService(db.pool, {
      name: 'Interview',
      scopes: ['interview:read', 'interview:capture'],
      token: 'x'.repeat(43),
    })
    await c.query(
      "INSERT INTO vcm.cases(id,code,name,kind) VALUES('a','A','A','presence'),('b','B','B','presence')",
    )
    await c.query(
      "INSERT INTO vcm.case_assignments(case_id,principal_id,function) VALUES('a',$1,'interview')",
      [service.principalId],
    )
    const principal: PrincipalContext = {
      id: service.principalId,
      kind: 'service',
      roles: ['direction'],
      scopes: ['interview:read', 'interview:capture'],
      permissionsVersion: 1,
      credentialId: service.credentialId,
    }
    const tx = { client: c, principal, correlationId: 'test', now: new Date() }
    await expect(
      assertAction(tx, 'captureAntecedent', 'case:a'),
    ).resolves.toBeUndefined()
    await expect(assertAction(tx, 'query', 'case:b')).rejects.toMatchObject({
      status: 404,
    })
    for (const action of [
      'approveBudget',
      'validateInstitutional',
      'approveStrategyOrContent',
      'resolveConflict',
      'editOperationalDraft',
      'executeMandate',
    ])
      await expect(assertAction(tx, action, 'case:a')).rejects.toMatchObject({
        status: 403,
      })
    await c.query(
      'UPDATE vcm.service_credentials SET revoked_at=now() WHERE id=$1',
      [service.credentialId],
    )
    await expect(assertAction(tx, 'query', 'case:a')).rejects.toMatchObject({
      status: 401,
    })
  } finally {
    c.release()
    await db.close()
  }
})

it('removes the previous responsible access when the assignment is cleared', async () => {
  const { fixture, createCase } = await import('./client.ts'),
    { asRole, envelope } = await import('./operational-fixture.ts')
  const f = await fixture()
  try {
    const other = await asRole(f, 'responsible'),
      caseId = (await f.command(createCase, 0)).body.result.id
    expect(
      (
        await f.command(
          {
            type: 'updateCase',
            caseId,
            responsibleActorId: other.id,
            reason: 'Asignar',
          },
          1,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await f.command(
          {
            type: 'updateCase',
            caseId,
            responsibleActorId: null,
            reason: 'Retirar',
          },
          2,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await other.post(
          '/v1/cases/' + caseId + '/commands',
          envelope(
            {
              type: 'setField',
              caseId,
              fieldId: 'description',
              value: 'Cambio',
              source: { name: 'Retirado' },
            },
            3,
          ),
        )
      ).status,
    ).toBe(404)
  } finally {
    await f.close()
  }
})
