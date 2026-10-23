import { it, expect } from 'vitest'
import { fixture, createCase } from './client.ts'
import { envelope } from './operational-fixture.ts'
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
it('requires complete strategic review and invalidates approval after editing a package member', async () => {
  const f = await fixture()
  try {
    const caseId = (await f.command({ ...createCase, kind: 'campaign' }, 0))
      .body.result.id
    const campaign = await f.post(
      '/v1/campaigns',
      envelope(
        { type: 'saveCampaign', caseId, name: 'Campaña', charter: {} },
        0,
      ),
    )
    expect(campaign.status, campaign.text).toBe(201)
    const campaignId = campaign.body.result.id
    expect(
      (
        await f.post(
          '/v1/campaigns/' + campaignId + '/commands',
          envelope(
            {
              type: 'approveCampaign',
              id: campaignId,
              revisionId: campaign.body.result.revisionId,
              reason: 'Revisar',
            },
            1,
          ),
        )
      ).status,
    ).toBe(422)
    const updated = await f.post(
      '/v1/campaigns/' + campaignId + '/commands',
      envelope(
        {
          type: 'saveCampaign',
          id: campaignId,
          caseId,
          name: 'Campaña',
          charter,
        },
        1,
      ),
    )
    expect(updated.status, updated.text).toBe(200)
    expect(
      (
        await f.post(
          '/v1/campaigns/' + campaignId + '/commands',
          envelope(
            {
              type: 'approveCampaign',
              id: campaignId,
              revisionId: updated.body.result.revisionId,
              reason: 'Estrategia revisada',
            },
            2,
          ),
        )
      ).status,
    ).toBe(200)
    await f.command(
      {
        type: 'addEvidence',
        caseId,
        name: 'Activo',
        url: 'https://drive.google.com/file/d/asset/view',
      },
      1,
    )
    const documentId = (await f.get('/v1/cases/' + caseId)).body.evidence[0]
      .documentId
    const contentInput = {
      type: 'saveContent',
      caseId,
      campaignId,
      title: 'Convocatoria',
      brief: 'Invitar a Alumni',
      copy: 'Participa este mes',
      channel: 'instagram',
      scheduledAt: '2026-10-25T12:00:00Z',
      documentIds: [documentId],
      mode: 'weekly',
    }
    const content = await f.post('/v1/contents', envelope(contentInput, 0))
    expect(content.status, content.text).toBe(201)
    const contentId = content.body.result.id
    const pkg = await f.post(
      '/v1/editorial-packages',
      envelope(
        {
          type: 'savePackage',
          name: 'Semana 43',
          startsOn: '2026-10-19',
          items: [{ contentId, revisionId: content.body.result.revisionId }],
        },
        0,
      ),
    )
    expect(pkg.status, pkg.text).toBe(201)
    expect(
      (
        await f.post(
          '/v1/editorial-packages/' + pkg.body.result.id + '/commands',
          envelope(
            {
              type: 'approvePackage',
              id: pkg.body.result.id,
              revisionId: pkg.body.result.revisionId,
              reason: 'Paquete revisado',
            },
            1,
          ),
        )
      ).status,
    ).toBe(200)
    expect((await f.get('/v1/contents/' + contentId)).body.approved).toBe(true)
    const prepared = await f.post(
      '/v1/contents/' + contentId + '/commands',
      envelope(
        {
          type: 'requestPublication',
          id: contentId,
          reason: 'Solicitar programación',
        },
        1,
      ),
    )
    expect(prepared.status, prepared.text).toBe(200)
    expect(prepared.body.result.status).toBe('integration_pending')
    expect(
      (
        await f.db.pool.query(
          'SELECT status,external_id FROM vcm.publication_operations',
        )
      ).rows,
    ).toEqual([{ status: 'prepared', external_id: null }])
    expect(
      (
        await f.post(
          '/v1/contents/' + contentId + '/commands',
          envelope(
            { ...contentInput, id: contentId, copy: 'Copy corregido' },
            2,
          ),
        )
      ).status,
    ).toBe(200)
    expect((await f.get('/v1/contents/' + contentId)).body.approved).toBe(false)
    const publication = await f.post(
      '/v1/contents/' + contentId + '/commands',
      envelope(
        { type: 'requestPublication', id: contentId, reason: 'Publicar' },
        3,
      ),
    )
    expect(publication.status).toBe(422)
    expect(
      (
        await f.db.pool.query(
          'SELECT count(*)::int n FROM vcm.publication_operations',
        )
      ).rows[0].n,
    ).toBe(1)
  } finally {
    await f.close()
  }
})
it('keeps external effects pending and services cannot self-approve strategy', async () => {
  const f = await fixture()
  try {
    const caseId = (await f.command({ ...createCase, kind: 'campaign' }, 0))
      .body.result.id
    const campaign = await f.post(
        '/v1/campaigns',
        envelope({ type: 'saveCampaign', caseId, name: 'Campaña', charter }, 0),
      ),
      id = campaign.body.result.id
    const service = await f.service([
      'coordination:read',
      'coordination:write',
      'coordination:execute',
    ])
    expect(
      (
        await f.http
          .post('/v1/campaigns/' + id + '/commands')
          .set('Authorization', 'Bearer ' + service.token)
          .send(
            envelope(
              {
                type: 'approveCampaign',
                id,
                revisionId: campaign.body.result.revisionId,
                reason: 'Hermes aprueba',
              },
              1,
            ),
          )
      ).status,
    ).toBe(403)
    expect((await f.get('/v1/campaigns/' + id)).body.integration).toBe(
      'integration_pending',
    )
  } finally {
    await f.close()
  }
})
