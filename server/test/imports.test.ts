import { it, expect } from 'vitest'
import { fixture } from './client.ts'
import { issueImportBackupReceipt } from '../src/imports/backup-receipt.ts'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
const actor = { id: 'legacy-actor', name: 'Docente', role: 'direction' }
const field = (
  value: string,
  status = 'confirmed',
  candidates: unknown[] = [],
) => ({ value, status, sourceIds: ['s1'], observation: '', candidates })
function snapshot() {
  const c = (id: string) => ({
    id,
    code: 'EIC-' + id,
    kind: 'activity',
    name: 'Iniciativa ' + id,
    portfolio: '',
    state: 'validated',
    version: 3,
    createdAt: '2026-10-22T10:00:00Z',
    updatedAt: '2026-10-22T11:00:00Z',
    responsible: 'Docente',
    responsibleActorId: 'legacy-actor',
    confidentiality: 'internal',
    priority: 'medium',
    fields: {
      name: field('Iniciativa ' + id),
      studentsPlanned: field('10', 'conflict', [
        { value: '15', sourceId: 's2', capturedAt: '2026-10-22T11:00:00Z' },
      ]),
    },
    projectId: 'project-shared',
    executionState: 'completed',
    organizationIds: [],
    agreementIds: [],
    legacyId: id,
    externalIds: {},
    presenceType: '',
    institutionalValidation: 'validated',
    demo: false,
  })
  return {
    version: 4,
    data: {
      activities: {},
      events: {
        'project-shared': {
          id: 'project-shared',
          name: 'Proyecto',
          description: 'Operación',
          status: 'completed',
          startsAt: '2026-10-22',
          endsAt: '2026-10-22',
          location: 'EIC',
          owner: 'Docente',
          createdAt: '2026-10-22T10:00:00Z',
          updatedAt: '2026-10-22T10:00:00Z',
        },
      },
      tasks: {},
      budgetItems: {},
      expenses: {},
      partners: {},
      contacts: {},
      agreements: {},
      resources: {},
      vcm: {
        cases: { a: c('a'), b: c('b') },
        sources: {
          s1: {
            id: 's1',
            caseId: 'a',
            name: 'Entrevista',
            channel: 'whatsapp',
            capturedAt: '2026-10-22T10:00:00Z',
            actor,
          },
          s2: {
            id: 's2',
            caseId: 'a',
            name: 'Acta',
            channel: 'web',
            capturedAt: '2026-10-22T11:00:00Z',
            actor,
          },
        },
        evidences: {},
        audit: [],
        decisions: {},
        campaigns: {},
        contents: {},
        indicators: {},
        indicatorLinks: {},
        cuts: {},
      },
    },
  }
}
async function receipt(
  f: Awaited<ReturnType<typeof fixture>>,
  batchId: string,
) {
  const dir = await mkdtemp(join(tmpdir(), 'vcm-test-backup-'))
  const content = Buffer.from('PGDMP-synthetic-receipt-fixture'),
    hash = createHash('sha256').update(content).digest('hex')
  await writeFile(join(dir, 'vcm.dump'), content, { mode: 0o600 })
  await writeFile(join(dir, 'SHA256SUMS'), hash + '  vcm.dump\n')
  await writeFile(join(dir, 'COMPLETE'), '')
  try {
    return await issueImportBackupReceipt(f.db.pool, batchId, dir)
  } finally {
    await rm(dir, { recursive: true })
  }
}
it('previews and imports reviewed legacy data without granting authority or losing source conflicts', async () => {
  const f = await fixture()
  try {
    const input = snapshot()
    input.data.vcm.cases.b.fields.studentsPlanned = field('10')
    // Source identities are case-scoped: case B uses a distinct source.
    input.data.vcm.cases.b.fields.name.sourceIds = []
    input.data.vcm.cases.a.confidentiality = 'sensitive'
    input.data.vcm.evidences = {
      privateDoc: {
        id: 'privateDoc',
        caseId: 'a',
        name: 'Privado',
        url: 'https://example.com/private',
        verified: false,
        sourceId: 's1',
        version: 1,
        confidentiality: 'sensitive',
      },
    }
    input.data.vcm.cases.b.fields.studentsPlanned.sourceIds = []
    const preview = await f.post('/v1/imports/preview', { snapshot: input })
    expect(preview.status, preview.text).toBe(201)
    const batch = preview.body
    expect(batch.requiredActors).toContain('legacy-actor')
    const base = {
      previewHash: batch.hash,
      actorMappings: {},
      includeDemo: false,
      backupReceiptId: await receipt(f, batch.id),
      idempotencyKey: crypto.randomUUID(),
    }
    expect(
      (await f.post('/v1/imports/' + batch.id + '/commit', base)).status,
    ).toBe(422)
    const body = {
      ...base,
      actorMappings: { 'legacy-actor': f.userId },
      idempotencyKey: crypto.randomUUID(),
    }
    const imported = await f.post('/v1/imports/' + batch.id + '/commit', body)
    expect(imported.status, imported.text).toBe(200)
    const protectedCase = await f.get('/v1/cases/a')
    expect(protectedCase.body.confidentiality).toBe('sensitive')
    expect(
      (
        await f.db.pool.query(
          "SELECT confidentiality FROM vcm.protected_objects WHERE id='document:legacy-document:privateDoc'",
        )
      ).rows[0].confidentiality,
    ).toBe('sensitive')
    const other = await f.service(['coordination:read'])
    expect(
      (
        await f.http
          .get('/v1/cases/a')
          .set('Authorization', 'Bearer ' + other.token)
      ).status,
    ).toBe(404)
    const repeated = await f.post('/v1/imports/' + batch.id + '/commit', body)
    expect(repeated.body).toEqual(imported.body)
    expect(
      (
        await f.db.pool.query(
          'SELECT id,state,version FROM vcm.cases ORDER BY id',
        )
      ).rows,
    ).toEqual([
      { id: 'a', state: 'construction', version: 3 },
      { id: 'b', state: 'construction', version: 3 },
    ])
    expect(
      (
        await f.db.pool.query(
          "SELECT case_id FROM vcm.project_cases WHERE project_id='project-shared' ORDER BY case_id",
        )
      ).rows,
    ).toEqual([{ case_id: 'a' }, { case_id: 'b' }])
    const fields = (await f.get('/v1/cases/a')).body.fields
    expect(
      fields
        .find((x: { fieldId: string }) => x.fieldId === 'studentsPlanned')
        .assertions.map((a: { value: number }) => a.value),
    ).toEqual([10, 15])
    expect(
      (
        await f.db.pool.query(
          'SELECT role_code FROM vcm.principal_roles WHERE principal_id=$1',
          [f.userId],
        )
      ).rows,
    ).toEqual([{ role_code: 'coordination' }])
    const exported = await f.get('/v1/exports')
    expect(exported.status, exported.text).toBe(200)
    expect(exported.text).not.toMatch(
      /password_hash|token_hash|vcm_session_dev/,
    )
    expect(
      exported.body.records.cases.map((c: { id: string }) => c.id).sort(),
    ).toEqual(['a', 'b'])
    const restored = await fixture()
    try {
      const again = await restored.post('/v1/imports/preview', {
        snapshot: exported.body.sourceSnapshots[0],
      })
      expect(again.status, again.text).toBe(201)
      const r = await restored.post(
        '/v1/imports/' + again.body.id + '/commit',
        {
          previewHash: again.body.hash,
          actorMappings: { 'legacy-actor': restored.userId },
          includeDemo: false,
          backupReceiptId: await receipt(restored, again.body.id),
          idempotencyKey: crypto.randomUUID(),
        },
      )
      expect(r.status, r.text).toBe(200)
      expect(
        (
          await restored.db.pool.query(
            'SELECT project_id,case_id FROM vcm.project_cases ORDER BY case_id',
          )
        ).rows,
      ).toEqual([
        { project_id: 'project-shared', case_id: 'a' },
        { project_id: 'project-shared', case_id: 'b' },
      ])
    } finally {
      await restored.close()
    }
    const another = await f.post('/v1/imports/preview', { snapshot: input })
    expect(
      (
        await f.post('/v1/imports/' + another.body.id + '/commit', {
          ...body,
          previewHash: another.body.hash,
          backupReceiptId: await receipt(f, another.body.id),
          idempotencyKey: crypto.randomUUID(),
        })
      ).status,
    ).toBe(422)
  } finally {
    await f.close()
  }
})
it('blocks invalid dates, missing relationships and unaudited backups and refuses interviewer export', async () => {
  const f = await fixture()
  try {
    const invalid = snapshot()
    invalid.data.events['project-shared'].startsAt = '2026-02-30'
    const preview = await f.post('/v1/imports/preview', { snapshot: invalid })
    expect(preview.status, preview.text).toBe(201)
    expect(
      preview.body.issues.some(
        (i: { code: string }) => i.code === 'INVALID_DATE',
      ),
    ).toBe(true)
    expect(
      (
        await f.post('/v1/imports/' + preview.body.id + '/commit', {
          previewHash: preview.body.hash,
          actorMappings: { 'legacy-actor': f.userId },
          includeDemo: false,
          backupReceiptId: 'invented',
          idempotencyKey: crypto.randomUUID(),
        })
      ).status,
    ).toBe(422)
    const svc = await f.service()
    expect(
      (
        await f.http
          .get('/v1/exports')
          .set('Authorization', 'Bearer ' + svc.token)
      ).status,
    ).toBe(403)
    expect(
      (
        await f.http
          .get('/v1/imports/' + preview.body.id)
          .set('Authorization', 'Bearer ' + svc.token)
      ).status,
    ).toBe(403)
  } finally {
    await f.close()
  }
})
it('requires explicit demo classification for old snapshots without that information', async () => {
  const f = await fixture()
  try {
    const input = snapshot()
    const { vcm: _vcm, ...data } = input.data
    for (const version of [1, 2, 3]) {
      const p = await f.post('/v1/imports/preview', {
        snapshot: { version, data },
      })
      expect(p.status, p.text).toBe(201)
      expect(p.body.requiresDemoClassification).toEqual(['project-shared'])
    }
  } finally {
    await f.close()
  }
})
