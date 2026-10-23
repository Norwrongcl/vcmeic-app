import { it, expect } from 'vitest'
import { fixture, createCase } from './client.ts'
it('queries typed fields, relations and aggregates through an authorized catalog without SQL injection', async () => {
  const f = await fixture()
  try {
    const a = (await f.command(createCase, 0)).body.result.id,
      b = (await f.command({ ...createCase, name: 'Otro' }, 0)).body.result.id
    await f.command(
      {
        type: 'addEvidence',
        caseId: a,
        name: 'Encuesta',
        url: 'https://drive.google.com/file/d/survey/view',
      },
      1,
    )
    const query = {
      entity: 'cases',
      select: ['id', 'name', 'state'],
      where: {
        and: [
          { field: 'kind', op: 'eq', value: 'presence' },
          { field: 'evidence.reviewStatus', op: 'eq', value: 'pending' },
        ],
      },
      relations: [
        { name: 'evidence', select: ['id', 'name', 'reviewStatus'], limit: 5 },
      ],
      orderBy: [{ field: 'id', direction: 'asc' }],
      page: { limit: 10 },
    }
    const result = await f.post('/v1/query', query)
    expect(result.status, result.text).toBe(200)
    expect(result.body.items).toHaveLength(1)
    expect(result.body.items[0].id).toBe(a)
    expect(result.body.items[0].evidence[0].name).toBe('Encuesta')
    const aggregate = await f.post('/v1/query', {
      entity: 'cases',
      select: [],
      aggregate: { count: true },
    })
    expect(aggregate.status, aggregate.text).toBe(200)
    expect(aggregate.body.items).toEqual([{ count: '2' }])
    expect(
      (
        await f.post('/v1/query', {
          entity: 'cases',
          select: ['id'],
          where: {
            field: 'name',
            op: 'eq',
            value: "x'); DROP TABLE vcm.cases; --",
          },
        })
      ).body.items,
    ).toEqual([])
    expect(
      (
        await f.post('/v1/query', {
          entity: 'cases',
          select: ['password_hash'],
        })
      ).status,
    ).toBe(422)
    expect(
      (
        await f.post('/v1/query', {
          entity: 'cases; DROP TABLE cases',
          select: ['id'],
        })
      ).status,
    ).toBe(422)
    expect(
      (
        await f.post('/v1/query', {
          entity: 'cases',
          select: ['id'],
          where: { field: 'id', op: 'sql', value: b },
        })
      ).status,
    ).toBe(422)
    expect((await f.get('/v1/catalog')).text).not.toMatch(
      /password_hash|token_hash|schema_migrations|DATABASE_URL/,
    )
  } finally {
    await f.close()
  }
})
it('filters hidden relations before counts and isolates interview scope, including pagination cursor', async () => {
  const f = await fixture()
  try {
    const service = await f.service(),
      token = 'Bearer ' + service.token
    const own = await f.http
      .post('/v1/cases')
      .set('Authorization', token)
      .send({
        command: createCase,
        expectedVersion: 0,
        idempotencyKey: crypto.randomUUID(),
      })
    expect(own.status).toBe(201)
    for (let n = 0; n < 3; n++)
      await f.command({ ...createCase, name: 'Caso ' + n }, 0)
    const first = await f.post('/v1/query', {
      entity: 'cases',
      select: ['id'],
      page: { limit: 2 },
    })
    expect(first.body.items).toHaveLength(2)
    expect(first.body.nextCursor).toBeTruthy()
    const second = await f.post('/v1/query', {
      entity: 'cases',
      select: ['id'],
      page: { limit: 2, cursor: first.body.nextCursor },
    })
    expect(second.body.items).toHaveLength(2)
    expect(
      new Set([...first.body.items, ...second.body.items].map((x) => x.id))
        .size,
    ).toBe(4)
    const mine = await f.http
      .post('/v1/query')
      .set('Authorization', token)
      .send({ entity: 'cases', select: [], aggregate: { count: true } })
    expect(mine.status, mine.text).toBe(200)
    expect(mine.body.items).toEqual([{ count: '1' }])
    expect(
      (
        await f.http
          .post('/v1/query')
          .set('Authorization', token)
          .send({ entity: 'expenses', select: ['id', 'amount'] })
      ).status,
    ).toBe(403)
    expect(
      (
        await f.http
          .post('/v1/query')
          .set('Authorization', token)
          .send({
            entity: 'cases',
            select: ['id'],
            page: { limit: 2, cursor: first.body.nextCursor },
          })
      ).status,
    ).toBe(422)
    const catalog = (
      await f.http.get('/v1/catalog').set('Authorization', token)
    ).body
    expect(catalog.entities.map((e: { name: string }) => e.name)).not.toContain(
      'expenses',
    )
    const caseId = first.body.items[0].id
    const version = (await f.get('/v1/cases/' + caseId)).body.version
    await f.command(
      {
        type: 'addEvidence',
        caseId,
        name: 'Secreto',
        url: 'https://drive.google.com/file/d/private/view',
      },
      version,
    )
    await f.db.pool.query(
      "UPDATE vcm.protected_objects SET confidentiality='sensitive',owner_id=NULL WHERE id IN(SELECT d.protected_object_id FROM vcm.evidences e JOIN vcm.document_references d ON d.id=e.document_id WHERE e.case_id=$1)",
      [caseId],
    )
    const hidden = await f.post('/v1/query', {
      entity: 'cases',
      select: ['id'],
      where: { field: 'evidence.name', op: 'eq', value: 'Secreto' },
    })
    expect(hidden.body.items).toEqual([])
  } finally {
    await f.close()
  }
})
it('distinguishes null and zero and rejects expensive or malformed expressions', async () => {
  const f = await fixture()
  try {
    const p = (
      await f.post('/v1/projects', {
        command: { type: 'createProject', name: 'P', kind: 'initiative' },
        expectedVersion: 0,
        idempotencyKey: crypto.randomUUID(),
      })
    ).body.result.id
    for (const [i, amount] of [null, '0', '1000'].entries())
      await f.post('/v1/projects/' + p + '/commands', {
        command: {
          type: 'saveBudgetItem',
          projectId: p,
          name: 'Partida ' + i,
          plannedAmount: amount,
          reason: 'Presupuesto',
        },
        expectedVersion: i + 1,
        idempotencyKey: crypto.randomUUID(),
      })
    const unknown = await f.post('/v1/query', {
      entity: 'budgets',
      select: ['id', 'plannedAmount'],
      where: { field: 'plannedAmount', op: 'isNull', value: true },
    })
    expect(unknown.body.items).toHaveLength(1)
    expect(unknown.body.items[0].plannedAmount).toBeNull()
    const zero = await f.post('/v1/query', {
      entity: 'budgets',
      select: ['plannedAmount'],
      where: { field: 'plannedAmount', op: 'eq', value: '0' },
    })
    expect(zero.body.items).toEqual([{ plannedAmount: '0' }])
    const sum = await f.post('/v1/query', {
      entity: 'budgets',
      select: [],
      aggregate: { sum: ['plannedAmount'] },
    })
    expect(sum.body.items).toEqual([{ sum_plannedAmount: '1000' }])
    expect(
      (
        await f.post('/v1/query', {
          entity: 'cases',
          select: ['id'],
          where: {
            and: Array.from({ length: 21 }, () => ({
              field: 'name',
              op: 'eq',
              value: 'X',
            })),
          },
        })
      ).status,
    ).toBe(422)
    expect(
      (
        await f.post('/v1/query', {
          entity: 'cases',
          select: ['id'],
          where: { field: 'name', op: 'in', value: Array(51).fill('X') },
        })
      ).status,
    ).toBe(422)
  } finally {
    await f.close()
  }
})
it('rejects prototype fields and deep filters, and orders CLP amounts numerically', async () => {
  const f = await fixture()
  try {
    expect(
      (await f.post('/v1/query', { entity: 'cases', select: ['toString'] }))
        .status,
    ).toBe(422)
    let where: unknown = { field: 'name', op: 'eq', value: 'X' }
    for (let i = 0; i < 10; i++) where = { and: [where] }
    expect(
      (await f.post('/v1/query', { entity: 'cases', select: ['id'], where }))
        .status,
    ).toBe(422)
    const p = (
      await f.post('/v1/projects', {
        command: { type: 'createProject', name: 'P', kind: 'initiative' },
        expectedVersion: 0,
        idempotencyKey: crypto.randomUUID(),
      })
    ).body.result.id
    for (const [i, amount] of ['20', '1000'].entries())
      await f.post('/v1/projects/' + p + '/commands', {
        command: {
          type: 'saveBudgetItem',
          projectId: p,
          name: 'Partida ' + i,
          plannedAmount: amount,
          reason: 'Presupuesto',
        },
        expectedVersion: i + 1,
        idempotencyKey: crypto.randomUUID(),
      })
    const result = await f.post('/v1/query', {
      entity: 'budgets',
      select: ['plannedAmount'],
      orderBy: [{ field: 'plannedAmount', direction: 'asc' }],
    })
    expect(result.body.items).toEqual([
      { plannedAmount: '20' },
      { plannedAmount: '1000' },
    ])
  } finally {
    await f.close()
  }
})
it('paginates collection routes without silently hiding records after the first page', async () => {
  const f = await fixture()
  try {
    for (let n = 0; n < 3; n++)
      await f.command({ ...createCase, name: 'Paginado ' + n }, 0)
    const page = await f.get('/v1/cases?limit=2')
    expect(page.body.items).toHaveLength(2)
    expect(page.body.nextCursor).toBeTruthy()
    const second = await f.get(
      '/v1/cases?limit=2&cursor=' + encodeURIComponent(page.body.nextCursor),
    )
    expect(second.body.items).toHaveLength(1)
    const ids = [...page.body.items, ...second.body.items].map((x) => x.id)
    expect(new Set(ids).size).toBe(3)
  } finally {
    await f.close()
  }
})
it('exposes controlled portfolio values so created dossiers can be filtered by their actual portfolio', async () => {
  const f = await fixture()
  try {
    const catalog = (await f.get('/v1/catalog')).body
    const alumni = catalog.catalogues.portfolios.find(
      (p: { name: string }) => p.name === 'Alumni',
    )
    expect(alumni).toBeTruthy()
    const r = await f.command({ ...createCase, portfolioId: alumni.id }, 0)
    expect(r.status, r.text).toBe(201)
    const found = await f.post('/v1/query', {
      entity: 'cases',
      select: ['id', 'portfolio'],
      where: { field: 'portfolio', op: 'eq', value: 'Alumni' },
    })
    expect(found.body.items).toEqual([
      { id: r.body.result.id, portfolio: 'Alumni' },
    ])
  } finally {
    await f.close()
  }
})

it('paginates related rows without silently omitting the eleventh task', async () => {
  const f = await fixture()
  try {
    const id = crypto.randomUUID()
    await f.db.pool.query(
      "INSERT INTO vcm.projects(id,name) VALUES($1,'Relaciones')",
      [id],
    )
    for (let i = 0; i < 11; i++)
      await f.db.pool.query(
        "INSERT INTO vcm.tasks(id,project_id,title) VALUES($1,$2,'Tarea')",
        ['task-' + i.toString().padStart(2, '0'), id],
      )
    const input = {
      entity: 'projects',
      select: ['id'],
      where: { field: 'id', op: 'eq', value: id },
      relations: [{ name: 'tasks', select: ['id'] }],
    }
    const first = await f.post('/v1/query', input)
    expect(first.status, first.text).toBe(200)
    expect(first.body.items[0].tasks).toHaveLength(10)
    const cursor = first.body.items[0].relationPages?.tasks.nextCursor
    expect(cursor).toEqual(expect.any(String))
    const next = await f.post('/v1/query', {
      ...input,
      relations: [{ ...input.relations[0], cursor }],
    })
    expect(next.status, next.text).toBe(200)
    expect(next.body.items[0].tasks).toEqual([{ id: 'task-10' }])
    expect(next.body.items[0].relationPages.tasks.nextCursor).toBeNull()
  } finally {
    await f.close()
  }
})
