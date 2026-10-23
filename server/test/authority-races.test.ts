import type { Pool, PoolClient } from 'pg'
import { it, expect } from 'vitest'
import { fixture, createCase } from './client.ts'
import { operationalProject, envelope } from './operational-fixture.ts'
import { POOL } from '../src/persistence/tokens.ts'
function pauseBefore(
  f: Awaited<ReturnType<typeof fixture>>,
  match: (sql: string) => boolean,
) {
  let release = () => {},
    entered = () => {}
  const reached = new Promise<void>((r) => (entered = r)),
    gate = new Promise<void>((r) => (release = r)),
    seen = new WeakSet<PoolClient>()
  f.app.get<Pool>(POOL).on('acquire', (client) => {
    if (seen.has(client)) return
    seen.add(client)
    client.query = new Proxy(client.query, {
      apply(target, thisArg, args) {
        if (typeof args[0] === 'string' && match(args[0])) {
          entered()
          return gate.then(() => Reflect.apply(target, thisArg, args))
        }
        return Reflect.apply(target, thisArg, args)
      },
    })
  })
  return { reached, release }
}
async function waitForLock(
  f: Awaited<ReturnType<typeof fixture>>,
  settled: () => boolean,
) {
  const deadline = Date.now() + 2000
  while (Date.now() < deadline && !settled()) {
    const waiting = await f.db.pool.query(
      "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT id FROM vcm.protected_objects%'",
    )
    if (waiting.rowCount) return
    await new Promise((r) => setTimeout(r, 5))
  }
  expect(
    settled(),
    'concurrent authority update must wait for the shared root lock',
  ).toBe(false)
  throw new Error('No expected root lock wait observed')
}
const charter = {
  problem: 'Baja difusión',
  objective: 'Informar',
  audience: 'Alumni',
  insight: '',
  valueProposition: 'Vinculación',
  positioning: 'EIC',
  message: 'Participa',
  cta: 'Inscríbete',
  journey: 'Convocatoria y asistencia',
  channels: 'Instagram',
  kpi: 'Inscripciones',
  kpiTarget: '20',
  successCriteria: 'Validación de Coordinación',
  resources: 'Recursos internos',
  schedule: 'Octubre',
  restrictions: 'No publicar sin aprobación',
}
it('serializes publication with replacement of its approving package', async () => {
  const f = await fixture()
  let release = () => {}
  try {
    const c = await f.command({ ...createCase, kind: 'campaign' }, 0)
    const caseId = c.body.result.id
    const camp = await f.post(
      '/v1/campaigns',
      envelope({ type: 'saveCampaign', caseId, name: 'Campaign', charter }, 0),
    )
    const campaignId = camp.body.result.id
    const approved = await f.post(
      '/v1/campaigns/' + campaignId + '/commands',
      envelope(
        {
          type: 'approveCampaign',
          id: campaignId,
          revisionId: camp.body.result.revisionId,
          reason: 'Review',
        },
        1,
      ),
    )
    expect(approved.status, approved.text).toBe(200)
    await f.command(
      {
        type: 'addEvidence',
        caseId,
        name: 'Asset',
        url: 'https://example.com/asset',
      },
      1,
    )
    const documentId = (await f.get('/v1/cases/' + caseId)).body.evidence[0]
      .documentId
    const input = {
      type: 'saveContent',
      caseId,
      campaignId,
      title: 'A',
      brief: 'Brief',
      copy: 'Copy',
      channel: 'instagram',
      scheduledAt: '2026-10-25T12:00:00Z',
      documentIds: [documentId],
      mode: 'weekly',
    }
    const a = await f.post('/v1/contents', envelope(input, 0))
    const b = await f.post(
      '/v1/contents',
      envelope({ ...input, title: 'B' }, 0),
    )
    const pkg = await f.post(
      '/v1/editorial-packages',
      envelope(
        {
          type: 'savePackage',
          name: 'Week',
          startsOn: '2026-10-19',
          items: [
            {
              contentId: a.body.result.id,
              revisionId: a.body.result.revisionId,
            },
          ],
        },
        0,
      ),
    )
    const packageId = pkg.body.result.id
    const appr = await f.post(
      '/v1/editorial-packages/' + packageId + '/commands',
      envelope(
        {
          type: 'approvePackage',
          id: packageId,
          revisionId: pkg.body.result.revisionId,
          reason: 'Review',
        },
        1,
      ),
    )
    expect(appr.status, appr.text).toBe(200)
    const barrier = pauseBefore(f, (sql) =>
      sql.startsWith('INSERT INTO vcm.publication_operations'),
    )
    release = barrier.release
    const reached = barrier.reached
    const pending = f
      .post(
        '/v1/contents/' + a.body.result.id + '/commands',
        envelope(
          {
            type: 'requestPublication',
            id: a.body.result.id,
            reason: 'Schedule',
          },
          1,
        ),
      )
      .then((r) => r)
    await reached
    let changed = false
    const change = f
      .post(
        '/v1/editorial-packages/' + packageId + '/commands',
        envelope(
          {
            type: 'savePackage',
            id: packageId,
            name: 'Revised week',
            startsOn: '2026-10-19',
            items: [
              {
                contentId: b.body.result.id,
                revisionId: b.body.result.revisionId,
              },
            ],
          },
          2,
        ),
      )
      .then((r) => {
        changed = true
        return r
      })
    await waitForLock(f, () => changed)
    expect(changed).toBe(false)
    release()
    const result = await pending
    expect(result.status, result.text).toBe(200)
    expect((await change).status).toBe(200)
    const later = await f.post(
      '/v1/contents/' + a.body.result.id + '/commands',
      envelope(
        {
          type: 'requestPublication',
          id: a.body.result.id,
          reason: 'Reintentar',
        },
        2,
      ),
    )
    expect(later.status, later.text).toBe(422)
  } finally {
    release()
    await f.close()
  }
})

it('serializes QA closure with project mandate revocation', async () => {
  const f = await fixture()
  let release = () => {}
  try {
    const p = await operationalProject(f)
    const caseId = p.caseId
    const fields = await f.command(
      {
        type: 'setFields',
        caseId,
        fields: Object.entries({
          executingUnit: 'EIC',
          reach: 'Nacional',
          externalOrganization: 'Org',
          presenceType: '4',
        }).map(([fieldId, value]) => ({
          fieldId,
          value,
          source: { name: 'Coordination' },
        })),
      },
      1,
    )
    expect(fields.status, fields.text).toBe(200)
    const e = await f.command(
      {
        type: 'addEvidence',
        caseId,
        name: 'Acta',
        url: 'https://example.com/acta',
      },
      2,
    )
    expect(e.status, e.text).toBe(200)
    const rev = await f.command(
      {
        type: 'reviewEvidence',
        caseId,
        evidenceId: e.body.result.id,
        result: 'verified',
        reason: 'Review',
      },
      3,
    )
    expect(rev.status, rev.text).toBe(200)
    await f.db.pool.query("UPDATE vcm.cases SET state='rendered' WHERE id=$1", [
      caseId,
    ])
    await f.db.pool.query(
      "UPDATE vcm.projects SET execution_state='completed' WHERE id=$1",
      [p.projectId],
    )
    const barrier = pauseBefore(
      f,
      (sql) => sql === 'UPDATE vcm.cases SET state=$1 WHERE id=$2',
    )
    release = barrier.release
    const reached = barrier.reached
    const pending = f
      .command(
        { type: 'transition', caseId, state: 'closed', reason: 'Close' },
        4,
      )
      .then((r) => r)
    await reached
    let revoked = false
    const revoke = p
      .send(
        { type: 'revokeMandate', mandateId: p.mandateId, reason: 'Revoke' },
        5,
      )
      .then((r) => {
        revoked = true
        return r
      })
    await waitForLock(f, () => revoked)
    expect(revoked).toBe(false)
    release()
    const result = await pending
    expect(result.status, result.text).toBe(200)
    expect((await revoke).status).toBe(200)
    expect(
      (await f.get('/v1/reports')).body.indicators.find(
        (x: { id: string }) => x.id === '4.2.5',
      ).progress,
    ).toBe(0)
  } finally {
    release()
    await f.close()
  }
})
