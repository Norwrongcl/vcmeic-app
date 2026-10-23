import { it, expect } from 'vitest'
import { fixture, createCase } from './client.ts'
import { envelope } from './operational-fixture.ts'
async function validPresence(f: Awaited<ReturnType<typeof fixture>>) {
  const id = (await f.command(createCase, 0)).body.result.id,
    source = { name: 'Coordinación' }
  let v = 1
  await f.command(
    {
      type: 'setFields',
      caseId: id,
      fields: Object.entries({
        executingUnit: 'EIC',
        reach: 'Nacional',
        externalOrganization: 'Organización',
        presenceType: '4',
      }).map(([fieldId, value]) => ({
        fieldId,
        value,
        status: 'confirmed',
        source,
      })),
    },
    v++,
  )
  const ev = await f.command(
    {
      type: 'addEvidence',
      caseId: id,
      name: 'Certificado',
      url: 'https://drive.google.com/file/d/cert/view',
    },
    v++,
  )
  await f.command(
    {
      type: 'reviewEvidence',
      caseId: id,
      evidenceId: ev.body.result.id,
      result: 'verified',
      reason: 'Revisado',
    },
    v++,
  )
  for (const state of ['construction', 'review', 'validated']) {
    const r = await f.command(
      { type: 'transition', caseId: id, state, reason: 'Control completo' },
      v++,
    )
    expect(r.status, r.text).toBe(200)
  }
  return { caseId: id, evidenceId: ev.body.result.id, version: v }
}
it('separates targets from eligible contributions and leaves unknown criteria pending', async () => {
  const f = await fixture()
  try {
    const p = await validPresence(f)
    const link = await f.post(
      '/v1/indicators/4.2.5/commands',
      envelope(
        {
          type: 'linkIndicator',
          indicatorId: '4.2.5',
          caseId: p.caseId,
          value: 1,
          period: 2026,
          evidenceIds: [p.evidenceId],
          reason: 'Proponer aporte',
        },
        p.version,
      ),
    )
    expect(link.status, link.text).toBe(200)
    let indicators = (await f.get('/v1/indicators?period=2026')).body.items
    expect(
      indicators.find((i: { id: string }) => i.id === '4.2.5'),
    ).toMatchObject({ target: 14, progress: 0 })
    const validated = await f.post(
      '/v1/indicators/4.2.5/commands',
      envelope(
        {
          type: 'validateContribution',
          indicatorId: '4.2.5',
          caseId: p.caseId,
          id: link.body.result.id,
          reason: 'Criterios y evidencia comprobados',
        },
        p.version + 1,
      ),
    )
    expect(validated.status, validated.text).toBe(200)
    indicators = (await f.get('/v1/indicators?period=2026')).body.items
    expect(
      indicators.find((i: { id: string }) => i.id === '4.2.5'),
    ).toMatchObject({ target: 14, progress: 1 })
    expect(
      indicators.find((i: { id: string }) => i.id === '4.2.3'),
    ).toMatchObject({ target: 240, progress: null, criteriaStatus: 'pending' })
    expect(
      (
        await f.post(
          '/v1/indicators/4.2.3/commands',
          envelope(
            {
              type: 'linkIndicator',
              indicatorId: '4.2.3',
              caseId: p.caseId,
              value: 20,
              period: 2026,
              evidenceIds: [p.evidenceId],
              reason: 'Inventar regla',
            },
            p.version + 2,
          ),
        )
      ).status,
    ).toBe(422)
    const port = (await f.get('/v1/cases')).body.items,
      control = (await f.get('/v1/control')).body.items,
      reports = (await f.get('/v1/reports')).body.items
    expect(
      [port, control, reports].every((items) =>
        items.some((x: { id: string }) => x.id === p.caseId),
      ),
    ).toBe(true)
    await f.command(
      {
        type: 'transition',
        caseId: p.caseId,
        state: 'returned',
        reason: 'Revisar datos nuevos',
      },
      p.version + 2,
    )
    expect(
      (await f.get('/v1/indicators?period=2026')).body.items.find(
        (i: { id: string }) => i.id === '4.2.5',
      ).progress,
    ).toBe(0)
  } finally {
    await f.close()
  }
})
it('creates immutable cut snapshots and requires resolved observations before institutional closure', async () => {
  const f = await fixture()
  try {
    const p = await validPresence(f)
    const created = await f.post(
      '/v1/cuts',
      envelope(
        {
          type: 'createCut',
          name: 'Corte octubre',
          period: '2026-10',
          caseIds: [p.caseId],
        },
        0,
      ),
    )
    expect(created.status, created.text).toBe(201)
    const cutId = created.body.result.id
    const send = (command: Record<string, unknown>, v: number) =>
      f.post(
        '/v1/cuts/' + cutId + '/commands',
        envelope({ cutId, ...command }, v),
      )
    const obs = await send(
      {
        type: 'addObservation',
        caseId: p.caseId,
        text: 'Aclarar resultado',
        category: 'antecedente',
        responsibleId: f.userId,
        reason: 'Revisión',
      },
      1,
    )
    expect(obs.status, obs.text).toBe(200)
    expect(
      (
        await send(
          {
            type: 'transitionCut',
            status: 'ready',
            response: '',
            reason: 'Preparar',
          },
          2,
        )
      ).status,
    ).toBe(422)
    expect(
      (
        await send(
          {
            type: 'resolveObservation',
            caseId: p.caseId,
            id: obs.body.result.id,
            resolution: 'Antecedentes aclarados',
            reason: 'Corregir',
          },
          2,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await send(
          {
            type: 'transitionCut',
            status: 'ready',
            response: '',
            reason: 'Preparar',
          },
          3,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await send(
          {
            type: 'transitionCut',
            status: 'closed',
            response: 'Respuesta institucional recibida, referencia manual',
            reason: 'Cerrar corte',
          },
          4,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await send(
          {
            type: 'addObservation',
            caseId: p.caseId,
            text: 'Cambio tardío',
            category: 'otro',
            responsibleId: f.userId,
            reason: 'Editar',
          },
          5,
        )
      ).status,
    ).toBe(422)
    const cut = (await f.get('/v1/cuts/' + cutId)).body
    expect(cut.caseIds).toEqual([p.caseId])
    expect(cut.integration).toBe('integration_pending')
    const snapshot = (
      await f.db.pool.query(
        'SELECT payload FROM vcm.case_snapshots WHERE case_id=$1',
        [p.caseId],
      )
    ).rows[0].payload
    expect(snapshot.name).toBe('Seminario de Alumni')
  } finally {
    await f.close()
  }
})
