import { it, expect } from 'vitest'
import { fixture, createCase } from './client.ts'

it('creates a traceable unvalidated dossier and preserves contradictory assertions until explicit resolution', async () => {
  const f = await fixture()
  try {
    const created = await f.command({ ...createCase, kind: 'activity' }, 0)
    expect(created.status).toBe(201)
    const id = created.body.result.id
    let detail = (await f.get('/v1/cases/' + id)).body
    expect(detail.state).toBe('open')
    expect(detail.record.validationStatus).toBe('pending')
    expect(
      detail.fields.filter(
        (x: { schemaVersion: string }) => x.schemaVersion === 'p52-2026.09-v1',
      ),
    ).toHaveLength(49)
    const source = { name: 'Docente' }
    expect(
      (
        await f.command(
          {
            type: 'setField',
            caseId: id,
            fieldId: 'studentsPlanned',
            value: 10,
            status: 'confirmed',
            source,
          },
          1,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await f.command(
          {
            type: 'setField',
            caseId: id,
            fieldId: 'studentsPlanned',
            value: 15,
            status: 'confirmed',
            source: { name: 'Acta' },
          },
          2,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await f.command(
          {
            type: 'setField',
            caseId: id,
            fieldId: 'studentsActual',
            value: 0,
            status: 'confirmed',
            source,
          },
          3,
        )
      ).status,
    ).toBe(200)
    detail = (await f.get('/v1/cases/' + id)).body
    const field = detail.fields.find(
      (x: { fieldId: string }) => x.fieldId === 'studentsPlanned',
    )
    expect(field.status).toBe('conflict')
    expect(field.assertions.map((x: { value: number }) => x.value)).toEqual([
      10, 15,
    ])
    expect(field.value).toBe(10)
    expect(
      detail.fields.find(
        (x: { fieldId: string }) => x.fieldId === 'studentsActual',
      ).value,
    ).toBe(0)
    expect(
      (
        await f.command(
          {
            type: 'resolveField',
            caseId: id,
            fieldId: 'studentsPlanned',
            assertionId: field.assertions[1].id,
            reason: 'Acta confirmada',
          },
          4,
        )
      ).status,
    ).toBe(200)
    detail = (await f.get('/v1/cases/' + id)).body
    expect(
      detail.fields.find(
        (x: { fieldId: string }) => x.fieldId === 'studentsPlanned',
      ).value,
    ).toBe(15)
    expect(
      detail.fields.find(
        (x: { fieldId: string }) => x.fieldId === 'studentsPlanned',
      ).assertions,
    ).toHaveLength(2)
    expect(
      (
        await f.command(
          { type: 'transition', caseId: id, state: 'closed', reason: 'Cerrar' },
          5,
        )
      ).status,
    ).toBe(422)
    expect(
      (
        await f.command(
          {
            type: 'setField',
            caseId: id,
            fieldId: 'startsAt',
            value: '2026-02-30',
            status: 'confirmed',
            source,
          },
          5,
        )
      ).status,
    ).toBe(422)
  } finally {
    await f.close()
  }
})
it('isolates interview capture and rejects validation, classification, unrelated cases and spoofed actor', async () => {
  const f = await fixture()
  try {
    const service = await f.service(),
      auth = 'Bearer ' + service.token
    const created = await f.http
      .post('/v1/cases')
      .set('Authorization', auth)
      .send({
        command: createCase,
        expectedVersion: 0,
        idempotencyKey: 'interview-create-1',
      })
    expect(created.status).toBe(201)
    const id = created.body.result.id
    expect(
      (await f.http.get('/v1/cases/' + id).set('Authorization', auth)).status,
    ).toBe(200)
    const other = (await f.command(createCase, 0)).body.result.id
    expect(
      (await f.http.get('/v1/cases/' + other).set('Authorization', auth))
        .status,
    ).toBe(404)
    const send = (command: Record<string, unknown>, v: number) =>
      f.http
        .post('/v1/cases/' + id + '/commands')
        .set('Authorization', auth)
        .send({
          command: { caseId: id, ...command },
          expectedVersion: v,
          idempotencyKey: crypto.randomUUID(),
        })
    expect(
      (
        await send(
          {
            type: 'setField',
            fieldId: 'executingUnit',
            value: 'EIC',
            status: 'confirmed',
            source: { name: 'Entrevista' },
          },
          1,
        )
      ).status,
    ).toBe(403)
    expect(
      (
        await send(
          { type: 'transition', state: 'validated', reason: 'Aprobar' },
          1,
        )
      ).status,
    ).toBe(403)
    expect(
      (
        await send(
          {
            type: 'setField',
            fieldId: 'description',
            value: 'Updated',
            status: 'confirmed',
            source: { name: 'Entrevista' },
            actor: { role: 'direction' },
          },
          1,
        )
      ).status,
    ).toBe(422)
    expect(
      (
        await send(
          {
            type: 'addEvidence',
            name: 'Adjunto pendiente',
            url: null,
            processingStatus: 'pending',
            reason: 'No fue posible procesarlo',
          },
          1,
        )
      ).status,
    ).toBe(200)
    const detail = (
      await f.http.get('/v1/cases/' + id).set('Authorization', auth)
    ).body
    expect(detail.evidence[0].reviewStatus).toBe('pending')
    expect(detail.evidence[0].url).toBeNull()
    expect(
      (
        await send(
          {
            type: 'reviewEvidence',
            evidenceId: detail.evidence[0].id,
            result: 'verified',
            reason: 'Listo',
          },
          2,
        )
      ).status,
    ).toBe(403)
  } finally {
    await f.close()
  }
})
