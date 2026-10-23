import { it, expect } from 'vitest'
import { fixture, createCase } from './client.ts'
import { envelope } from './operational-fixture.ts'
it('does not reveal hidden related dossier identifiers in resource details or lists', async () => {
  const f = await fixture()
  try {
    const caseId = (await f.command(createCase, 0)).body.result.id
    const made = await f.post(
      '/v1/decisions',
      envelope(
        {
          type: 'proposeDecision',
          caseId,
          kind: 'priority',
          title: 'Propuesta visible',
          proposal: 'Priorizar',
          reason: 'Revisar',
        },
        0,
      ),
    )
    expect(made.status, made.text).toBe(201)
    await f.db.pool.query(
      "UPDATE vcm.protected_objects SET confidentiality='sensitive',owner_id=NULL WHERE id=$1",
      ['case:' + caseId],
    )
    expect((await f.get('/v1/cases/' + caseId)).status).toBe(404)
    const detail = await f.get('/v1/decisions/' + made.body.result.id)
    expect(detail.status, detail.text).toBe(200)
    expect(detail.body.caseId).toBeNull()
    const list = await f.get('/v1/decisions')
    expect(JSON.stringify(list.body)).not.toContain(caseId)
  } finally {
    await f.close()
  }
})

it('filters hidden organization references and rejects linking an invisible organization', async () => {
  const f = await fixture()
  try {
    const caseId = (await f.command({ ...createCase, kind: 'activity' }, 0))
      .body.result.id
    const org = (
      await f.post(
        '/v1/organizations',
        envelope({ type: 'createOrganization', name: 'Contraparte' }, 0),
      )
    ).body.result.id
    const captured = await f.command(
      {
        type: 'setField',
        caseId,
        fieldId: 'organizationPlanned',
        value: [{ type: 'organization', id: org }],
        source: { name: 'Coordinación' },
      },
      1,
    )
    expect(captured.status, captured.text).toBe(200)
    await f.db.pool.query(
      "UPDATE vcm.protected_objects SET confidentiality='sensitive',owner_id=NULL WHERE id=$1",
      ['organization:' + org],
    )
    const detail = await f.get('/v1/cases/' + caseId)
    expect(detail.status, detail.text).toBe(200)
    expect(JSON.stringify(detail.body)).not.toContain(org)
    const linked = await f.command(
      {
        type: 'setRelations',
        caseId,
        organizationIds: [org],
        agreementIds: [],
        reason: 'Intentar vínculo',
      },
      2,
    )
    expect(linked.status, linked.text).toBe(404)
    const field = await f.command(
      {
        type: 'setField',
        caseId,
        fieldId: 'organizationActual',
        value: [{ type: 'organization', id: org }],
        source: { name: 'Intento' },
      },
      2,
    )
    expect(field.status, field.text).toBe(404)
  } finally {
    await f.close()
  }
})
