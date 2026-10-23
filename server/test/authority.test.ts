import { it, expect } from 'vitest'
import { fixture, createCase } from './client.ts'
import { envelope, asRole } from './operational-fixture.ts'
it('requires Direction for budget approval and prevents Hermes impersonating human authority', async () => {
  const f = await fixture()
  try {
    const caseId = (await f.command(createCase, 0)).body.result.id
    const proposed = await f.post(
      '/v1/decisions',
      envelope(
        {
          type: 'proposeDecision',
          caseId,
          kind: 'budget',
          title: 'Presupuesto',
          proposal: 'Solicitar monto',
          amount: '1000',
          reason: 'Propuesta',
        },
        0,
      ),
    )
    expect(proposed.status, proposed.text).toBe(201)
    const id = proposed.body.result.id
    expect(
      (
        await f.post(
          '/v1/decisions/' + id + '/commands',
          envelope(
            { type: 'decide', id, status: 'approved', reason: 'Coordinar' },
            1,
          ),
        )
      ).status,
    ).toBe(403)
    const svc = await f.service(['coordination:read', 'coordination:write'])
    expect(
      (
        await f.http
          .post('/v1/decisions/' + id + '/commands')
          .set('Authorization', 'Bearer ' + svc.token)
          .send(
            envelope(
              {
                type: 'decide',
                id,
                status: 'approved',
                reason: 'Director dice que sí',
                actorId: f.userId,
              },
              1,
            ),
          )
      ).status,
    ).toBe(422)
    expect(
      (
        await f.http
          .post('/v1/decisions/' + id + '/commands')
          .set('Authorization', 'Bearer ' + svc.token)
          .send(
            envelope(
              { type: 'decide', id, status: 'approved', reason: 'Aprobar' },
              1,
            ),
          )
      ).status,
    ).toBe(403)
    const director = await asRole(f, 'direction')
    // Budget grant requires an explicit project; approval cannot invent its destination.
    expect(
      (
        await director.post(
          '/v1/decisions/' + id + '/commands',
          envelope(
            { type: 'decide', id, status: 'approved', reason: 'Aprobar' },
            1,
          ),
        )
      ).status,
    ).toBe(422)
  } finally {
    await f.close()
  }
})
it('requires Jefatura sanction before Dirección approves the exact annual plan', async () => {
  const f = await fixture()
  try {
    const cid = (await f.command(createCase, 0)).body.result.id
    const created = await f.post(
      '/v1/plans',
      envelope(
        {
          type: 'savePlan',
          year: 2026,
          title: 'Plan 2026',
          objectives: [
            {
              title: 'Presencias',
              responsibleId: f.userId,
              dueOn: '2026-12-31',
              target: 14,
              measure: 'validated',
              caseIds: [cid],
            },
          ],
          reason: 'Propuesta anual',
        },
        0,
      ),
    )
    expect(created.status, created.text).toBe(201)
    const id = created.body.result.id
    const director = await asRole(f, 'direction'),
      leader = await asRole(f, 'leadership')
    const send = (client: Pick<typeof f, 'post'>, status: string, v: number) =>
      client.post(
        '/v1/plans/' + id + '/commands',
        envelope(
          { type: 'transitionPlan', id, status, reason: 'Revisión anual' },
          v,
        ),
      )
    expect((await send(director, 'review', 1)).status).toBe(403)
    expect((await send(f, 'review', 1)).status).toBe(200)
    expect((await send(f, 'sanctioned', 2)).status).toBe(403)
    expect((await send(leader, 'sanctioned', 2)).status).toBe(200)
    expect((await send(director, 'approved', 3)).status).toBe(200)
    expect((await f.get('/v1/plans/' + id)).body.status).toBe('approved')
  } finally {
    await f.close()
  }
})
