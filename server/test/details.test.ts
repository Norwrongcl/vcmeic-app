import { it, expect } from 'vitest'
import { fixture } from './client.ts'
import { operationalProject, envelope } from './operational-fixture.ts'
it('recovers the reviewed proposal and executable project references for another authorized client', async () => {
  const f = await fixture()
  try {
    const p = await operationalProject(f)
    const decision = (
      await f.db.pool.query(
        "SELECT id FROM vcm.decisions WHERE case_id=$1 AND kind='budget'",
        [p.caseId],
      )
    ).rows[0]
    // A new login has no prior create-command responses.
    const login = await f.http
      .post('/v1/session/login')
      .set('Origin', 'http://localhost:5174')
      .send({ email: 'direction@example.cl', password: 'test-password-123' })
    const cookie = login.headers['set-cookie'][0].split(';')[0]
    const d = await f.http
      .get('/v1/decisions/' + decision.id)
      .set('Cookie', cookie)
    expect(d.status, d.text).toBe(200)
    expect(d.body.revision.proposal).toBe('Monto para operación')
    expect(d.body.revision.amount).toBe('1000')
    const project = await f.get('/v1/projects/' + p.projectId)
    expect(project.body.workPlanRevision.objective).toBe('Objetivo')
    expect(project.body.mandates[0].id).toBe(p.mandateId)
    expect(project.body.budgetAuthorizations[0].id).toBe(p.authorizationId)
    const plan = await f.post(
      '/v1/plans',
      envelope(
        {
          type: 'savePlan',
          year: 2026,
          title: 'Plan',
          objectives: [
            {
              title: 'Objetivo anual',
              responsibleId: f.userId,
              dueOn: '2026-12-31',
              target: 1,
              measure: 'validated',
              caseIds: [p.caseId],
            },
          ],
          reason: 'Revisar',
        },
        0,
      ),
    )
    expect(plan.status, plan.text).toBe(201)
    const detail = await f.get('/v1/plans/' + plan.body.result.id)
    expect(detail.body.revision.objectives[0].caseIds).toEqual([p.caseId])
    await f.db.pool.query(
      "UPDATE vcm.protected_objects SET confidentiality='sensitive',owner_id=NULL WHERE id=$1",
      ['case:' + p.caseId],
    )
    expect(
      (await f.get('/v1/plans/' + plan.body.result.id)).body.revision
        .objectives[0].caseIds,
    ).toEqual([])
  } finally {
    await f.close()
  }
})
