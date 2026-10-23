import { it, expect } from 'vitest'
import { fixture, createCase } from './client.ts'
import { randomUUID } from 'node:crypto'
const envelope = (
  command: Record<string, unknown>,
  expectedVersion: number,
) => ({ command, expectedVersion, idempotencyKey: randomUUID() })
it('maintains one project for multiple dossiers and rejects task dependency cycles', async () => {
  const f = await fixture()
  try {
    const a = (await f.command(createCase, 0)).body.result.id,
      b = (await f.command(createCase, 0)).body.result.id
    const made = await f.post(
      '/v1/projects',
      envelope(
        { type: 'createProject', name: 'Proyecto común', kind: 'event' },
        0,
      ),
    )
    expect(made.status, made.text).toBe(201)
    const id = made.body.result.id
    const send = (command: Record<string, unknown>, v: number) =>
      f.post(
        '/v1/projects/' + id + '/commands',
        envelope({ projectId: id, ...command }, v),
      )
    expect(
      (await send({ type: 'linkCase', caseId: a, reason: 'Vincular' }, 1))
        .status,
    ).toBe(200)
    expect(
      (await send({ type: 'linkCase', caseId: b, reason: 'Vincular' }, 2))
        .status,
    ).toBe(200)
    const task1 = await send(
      {
        type: 'saveTask',
        title: 'Primera',
        status: 'todo',
        dependencies: [],
        reason: 'Preparar',
      },
      3,
    )
    expect(task1.status, task1.text).toBe(200)
    const task2 = await send(
      {
        type: 'saveTask',
        title: 'Segunda',
        status: 'todo',
        dependencies: [task1.body.result.id],
        reason: 'Preparar',
      },
      4,
    )
    expect(task2.status, task2.text).toBe(200)
    const cycle = await send(
      {
        type: 'saveTask',
        id: task1.body.result.id,
        title: 'Primera',
        status: 'todo',
        dependencies: [task2.body.result.id],
        reason: 'Cambiar',
      },
      5,
    )
    expect(cycle.status).toBe(422)
    expect(cycle.body.code).toBe('DEPENDENCY_CYCLE')
    expect(
      (
        await send(
          {
            type: 'setExecutionState',
            state: 'in_progress',
            reason: 'Comenzar',
          },
          5,
        )
      ).status,
    ).toBe(422)
    const detail = await f.get('/v1/projects/' + id)
    expect(detail.status).toBe(200)
    expect(detail.body.caseIds.sort()).toEqual([a, b].sort())
    expect(detail.body.tasks).toHaveLength(2)
  } finally {
    await f.close()
  }
})
it('versions masters, rejects spoofed approval flags and archives without deleting', async () => {
  const f = await fixture()
  try {
    const made = await f.post(
      '/v1/organizations',
      envelope({ type: 'createOrganization', name: 'Contraparte' }, 0),
    )
    expect(made.status, made.text).toBe(201)
    const id = made.body.result.id
    expect(
      (
        await f.post(
          '/v1/organizations/' + id + '/commands',
          envelope(
            {
              type: 'updateOrganization',
              id,
              name: 'Nuevo nombre',
              reason: 'Corregir',
            },
            1,
          ),
        )
      ).status,
    ).toBe(200)
    expect((await f.get('/v1/organizations/' + id)).body.name).toBe(
      'Nuevo nombre',
    )
    expect(
      (
        await f.post(
          '/v1/organizations/' + id + '/commands',
          envelope(
            {
              type: 'updateOrganization',
              id,
              name: 'Otra',
              approved: true,
              reason: 'Cambiar',
            },
            2,
          ),
        )
      ).status,
    ).toBe(422)
    expect(
      (
        await f.post(
          '/v1/organizations/' + id + '/commands',
          envelope({ type: 'archiveOrganization', id, reason: 'Duplicado' }, 2),
        )
      ).status,
    ).toBe(200)
    expect((await f.get('/v1/organizations/' + id)).status).toBe(404)
    expect(
      (
        await f.db.pool.query(
          'SELECT name FROM vcm.organizations WHERE id=$1',
          [id],
        )
      ).rowCount,
    ).toBe(1)
  } finally {
    await f.close()
  }
})
it('retains master edit values in the audit record', async () => {
  const f = await fixture()
  try {
    const made = await f.post(
        '/v1/organizations',
        envelope({ type: 'createOrganization', name: 'Original' }, 0),
      ),
      id = made.body.result.id
    await f.post(
      '/v1/organizations/' + id + '/commands',
      envelope(
        {
          type: 'updateOrganization',
          id,
          name: 'Corregido',
          reason: 'Nombre actualizado',
        },
        1,
      ),
    )
    const audit = (
      await f.db.pool.query(
        "SELECT before_data,after_data FROM vcm.audit_events WHERE object_id=$1 AND action='updateOrganization'",
        ['organization:' + id],
      )
    ).rows[0]
    expect(audit.before_data.name).toBe('Original')
    expect(audit.after_data.name).toBe('Corregido')
  } finally {
    await f.close()
  }
})
it('stores organization classification independently from the command discriminator', async () => {
  const f = await fixture()
  try {
    const r = await f.post(
      '/v1/organizations',
      envelope(
        {
          type: 'createOrganization',
          name: 'Municipalidad',
          organizationType: 'Pública',
        },
        0,
      ),
    )
    expect(r.status, r.text).toBe(201)
    expect(
      (await f.get('/v1/organizations/' + r.body.result.id)).body
        .organizationType,
    ).toBe('Pública')
  } finally {
    await f.close()
  }
})
it('archives unapproved cases and refuses to hide a project that still has active dossiers', async () => {
  const f = await fixture()
  try {
    const caseId = (await f.command(createCase, 0)).body.result.id
    const p = (
      await f.post(
        '/v1/projects',
        envelope(
          { type: 'createProject', name: 'Borrador', kind: 'initiative' },
          0,
        ),
      )
    ).body.result.id
    await f.post(
      '/v1/projects/' + p + '/commands',
      envelope(
        { type: 'linkCase', projectId: p, caseId, reason: 'Vincular' },
        1,
      ),
    )
    expect(
      (
        await f.post(
          '/v1/projects/' + p + '/commands',
          envelope(
            {
              type: 'archiveProject',
              projectId: p,
              reason: 'Retirar borrador',
            },
            2,
          ),
        )
      ).status,
    ).toBe(422)
    expect(
      (
        await f.command(
          { type: 'archiveCase', caseId, reason: 'Duplicado sin aprobación' },
          1,
        )
      ).status,
    ).toBe(200)
    expect((await f.get('/v1/cases/' + caseId)).status).toBe(404)
    expect(
      (
        await f.post(
          '/v1/projects/' + p + '/commands',
          envelope(
            {
              type: 'archiveProject',
              projectId: p,
              reason: 'Retirar borrador',
            },
            2,
          ),
        )
      ).status,
    ).toBe(200)
  } finally {
    await f.close()
  }
})

it('saves and reassigns task contacts without SQL failures', async () => {
  const f = await fixture()
  try {
    const c = await f.post(
      '/v1/contacts',
      envelope({ type: 'createContact', name: 'Responsable' }, 0),
    )
    expect(c.status, c.text).toBe(201)
    const p = await f.post(
      '/v1/projects',
      envelope({ type: 'createProject', name: 'Plan', kind: 'initiative' }, 0),
    )
    expect(p.status, p.text).toBe(201)
    const projectId = p.body.result.id
    const save = (command: Record<string, unknown>, v: number) =>
      f.post(
        '/v1/projects/' + projectId + '/commands',
        envelope(
          {
            projectId,
            type: 'saveTask',
            title: 'Preparar',
            status: 'todo',
            dependencies: [],
            reason: 'Asignar',
            assigneeIds: [c.body.result.id],
            ...command,
          },
          v,
        ),
      )
    const made = await save({}, 1)
    expect(made.status, made.text).toBe(200)
    expect((await save({ id: made.body.result.id }, 2)).status).toBe(200)
    expect(
      (
        await f.db.pool.query(
          'SELECT contact_id FROM vcm.task_assignees WHERE task_id=$1 AND active',
          [made.body.result.id],
        )
      ).rows,
    ).toEqual([{ contact_id: c.body.result.id }])
  } finally {
    await f.close()
  }
})
