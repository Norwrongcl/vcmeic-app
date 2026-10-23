import { it, expect } from 'vitest'
import { fixture, createCase } from './client.ts'
it('requires complete QA and reviewed evidence, keeps hidden documents out of a visible case', async () => {
  const f = await fixture()
  try {
    const created = await f.command(createCase, 0),
      id = created.body.result.id
    expect(created.status).toBe(201)
    expect(
      (
        await f.command(
          {
            type: 'addEvidence',
            caseId: id,
            name: 'Acta',
            url: 'https://drive.google.com/file/d/example/view',
          },
          1,
        )
      ).status,
    ).toBe(200)
    const detail = (await f.get('/v1/cases/' + id)).body
    expect(detail.evidence[0].reviewStatus).toBe('pending')
    expect(
      (
        await f.command(
          {
            type: 'reviewEvidence',
            caseId: id,
            evidenceId: detail.evidence[0].id,
            result: 'verified',
            reason: 'Documento revisado',
          },
          2,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await f.command(
          {
            type: 'transition',
            caseId: id,
            state: 'construction',
            reason: 'Completar',
          },
          3,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await f.command(
          {
            type: 'transition',
            caseId: id,
            state: 'review',
            reason: 'Revisar',
          },
          4,
        )
      ).status,
    ).toBe(200)
    const qa = await f.command(
      { type: 'transition', caseId: id, state: 'validated', reason: 'Validar' },
      5,
    )
    expect(qa.status).toBe(422)
    expect(qa.body.code).toBe('QA_INCOMPLETE')
    const evidence = detail.evidence[0]
    await f.db.pool.query(
      "UPDATE vcm.protected_objects SET confidentiality='sensitive',owner_id=NULL WHERE id=(SELECT protected_object_id FROM vcm.document_references WHERE id=$1)",
      [evidence.documentId],
    )
    const filtered = (await f.get('/v1/cases/' + id)).body
    expect(filtered.evidence).toHaveLength(0)
  } finally {
    await f.close()
  }
})
it('keeps presence projection on the selected assertion while classification is in conflict', async () => {
  const f = await fixture()
  try {
    const id = (await f.command(createCase, 0)).body.result.id
    const source = { name: 'Coordinación' }
    expect(
      (
        await f.command(
          {
            type: 'setField',
            caseId: id,
            fieldId: 'presenceType',
            value: '1',
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
            fieldId: 'presenceType',
            value: '2',
            status: 'confirmed',
            source,
          },
          2,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await f.db.pool.query(
          'SELECT type_code FROM vcm.presence_records WHERE case_id=$1',
          [id],
        )
      ).rows[0].type_code,
    ).toBe('1')
    const field = (await f.get('/v1/cases/' + id)).body.fields.find(
      (x: { fieldId: string }) => x.fieldId === 'presenceType',
    )
    expect(
      (
        await f.command(
          {
            type: 'resolveField',
            caseId: id,
            fieldId: 'presenceType',
            assertionId: field.assertions[1].id,
            reason: 'Confirmado',
          },
          3,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await f.db.pool.query(
          'SELECT type_code FROM vcm.presence_records WHERE case_id=$1',
          [id],
        )
      ).rows[0].type_code,
    ).toBe('2')
  } finally {
    await f.close()
  }
})
it('finishes a complete presence through human validation and blocks later unreviewed edits', async () => {
  const f = await fixture()
  try {
    const id = (await f.command(createCase, 0)).body.result.id,
      source = { name: 'Coordinación' }
    let v = 1
    const fields = Object.entries({
      executingUnit: 'EIC',
      reach: 'Nacional',
      externalOrganization: 'Organización externa',
      presenceType: '4',
    }).map(([fieldId, value]) => ({
      fieldId,
      value,
      status: 'confirmed',
      source,
    }))
    expect(
      (await f.command({ type: 'setFields', caseId: id, fields }, v++)).status,
    ).toBe(200)
    const ev = await f.command(
      {
        type: 'addEvidence',
        caseId: id,
        name: 'Certificado',
        url: 'https://drive.google.com/file/d/example/view',
      },
      v++,
    )
    expect(
      (
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
      ).status,
    ).toBe(200)
    for (const state of [
      'construction',
      'review',
      'validated',
      'closing',
      'qa',
      'rendered',
      'closed',
    ]) {
      const r = await f.command(
        {
          type: 'transition',
          caseId: id,
          state,
          reason: 'Antecedentes comprobados',
        },
        v++,
      )
      expect(r.status, r.text).toBe(200)
    }
    expect((await f.get('/v1/cases/' + id)).body.state).toBe('closed')
    expect(
      (
        await f.command(
          {
            type: 'setField',
            caseId: id,
            fieldId: 'description',
            value: 'Cambio',
            status: 'confirmed',
            source,
          },
          v,
        )
      ).status,
    ).toBe(422)
  } finally {
    await f.close()
  }
})
it('changes active relation membership without deleting old links', async () => {
  const f = await fixture()
  try {
    const id = (await f.command(createCase, 0)).body.result.id
    await f.db.pool.query(
      "INSERT INTO vcm.organizations(id,name) VALUES('org','Partner'); INSERT INTO vcm.protected_objects(id,kind) VALUES('organization:org','organization')",
    )
    expect(
      (
        await f.command(
          {
            type: 'setRelations',
            caseId: id,
            organizationIds: ['org'],
            agreementIds: [],
            reason: 'Vincular',
          },
          1,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await f.command(
          {
            type: 'setRelations',
            caseId: id,
            organizationIds: [],
            agreementIds: [],
            reason: 'Corregir',
          },
          2,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await f.db.pool.query(
          'SELECT active FROM vcm.case_organizations WHERE case_id=$1',
          [id],
        )
      ).rows,
    ).toEqual([{ active: false }])
  } finally {
    await f.close()
  }
})
