import { randomUUID } from 'node:crypto'
import { provisionUser } from '../src/identity/provision.ts'
import type { Role } from '../src/contracts/common.ts'
import { createCase, type fixture } from './client.ts'
export const envelope = (
  command: Record<string, unknown>,
  expectedVersion: number,
) => ({ command, expectedVersion, idempotencyKey: randomUUID() })
export async function asRole(
  f: Awaited<ReturnType<typeof fixture>>,
  role: Role,
) {
  const id = await provisionUser(f.db.pool, {
    name: role,
    email: role + '@example.cl',
    password: 'test-password-123',
    roles: [role],
  })
  const login = await f.http
      .post('/v1/session/login')
      .set('Origin', 'http://localhost:5174')
      .send({ email: role + '@example.cl', password: 'test-password-123' }),
    cookie = login.headers['set-cookie'][0].split(';')[0]
  const token = (await f.http.get('/v1/session/csrf').set('Cookie', cookie))
    .body.token
  return {
    id,
    post: (url: string, body: Record<string, unknown>) =>
      f.http
        .post(url)
        .set('Origin', 'http://localhost:5174')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', token)
        .send(body),
  }
}
export async function operationalProject(
  f: Awaited<ReturnType<typeof fixture>>,
  existingCaseId?: string,
) {
  const caseId =
    existingCaseId ?? (await f.command(createCase, 0)).body.result.id
  const made = await f.post(
    '/v1/projects',
    envelope(
      { type: 'createProject', name: 'Operación', kind: 'initiative' },
      0,
    ),
  )
  if (made.status !== 201) throw new Error(made.text)
  const projectId = made.body.result.id
  const send = (command: Record<string, unknown>, v: number) =>
    f.post(
      '/v1/projects/' + projectId + '/commands',
      envelope({ projectId, ...command }, v),
    )
  for (const [cmd, v] of [
    [{ type: 'linkCase', caseId, reason: 'Vincular' }, 1],
    [
      {
        type: 'saveBudgetItem',
        name: 'Producción',
        plannedAmount: '1000',
        reason: 'Estimar',
      },
      2,
    ],
  ] as const) {
    const r = await send(cmd, v)
    if (r.status !== 200) throw new Error(r.text)
  }
  const revision = await send(
    {
      type: 'saveWorkPlan',
      objective: 'Objetivo',
      resultsPlanned: 'Resultados',
      scopeIncluded: 'Alcance',
      scopeExcluded: 'Exclusiones',
      closingCriteria: 'Criterios',
      expectedEvidence: 'Acta',
      risks: 'Riesgos',
      reason: 'Propuesta',
    },
    3,
  )
  if (revision.status !== 200) throw new Error(revision.text)
  const flow = await f.post(
    '/v1/decisions',
    envelope(
      {
        type: 'proposeDecision',
        caseId,
        kind: 'flow',
        title: 'Aprobar flujo',
        proposal: 'Autorizar plan',
        reason: 'Revisión',
      },
      0,
    ),
  )
  if (flow.status !== 201) throw new Error(flow.text)
  const approved = await f.post(
    '/v1/decisions/' + flow.body.result.id + '/commands',
    envelope(
      {
        type: 'decide',
        id: flow.body.result.id,
        status: 'approved',
        reason: 'Flujo aprobado',
      },
      1,
    ),
  )
  if (approved.status !== 200) throw new Error(approved.text)
  const mandate = await send(
    {
      type: 'approveWorkPlan',
      decisionId: flow.body.result.id,
      revisionId: revision.body.result.revisionId,
      reason: 'Plan revisado',
    },
    4,
  )
  if (mandate.status !== 200) throw new Error(mandate.text)
  const budget = await f.post(
    '/v1/decisions',
    envelope(
      {
        type: 'proposeDecision',
        caseId,
        projectId,
        kind: 'budget',
        title: 'Autorizar presupuesto',
        proposal: 'Monto para operación',
        amount: '1000',
        reason: 'Presupuesto propuesto',
      },
      0,
    ),
  )
  if (budget.status !== 201) throw new Error(budget.text)
  const director = await asRole(f, 'direction')
  const grant = await director.post(
    '/v1/decisions/' + budget.body.result.id + '/commands',
    envelope(
      {
        type: 'decide',
        id: budget.body.result.id,
        status: 'approved',
        reason: 'Monto aprobado',
      },
      1,
    ),
  )
  if (grant.status !== 200) throw new Error(grant.text)
  return {
    projectId,
    caseId,
    send,
    mandateId: mandate.body.result.mandateId,
    authorizationId: grant.body.result.authorizationId,
    budgetItemId: (
      await f.db.pool.query(
        'SELECT id FROM vcm.budget_items WHERE project_id=$1',
        [projectId],
      )
    ).rows[0].id,
  }
}
