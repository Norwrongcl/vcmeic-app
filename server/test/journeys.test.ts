import { it, expect } from 'vitest'
import request from 'supertest'
import { fixture, createCase } from './client.ts'
import { operationalProject, envelope } from './operational-fixture.ts'
import { createApp } from '../src/app.module.ts'
import { CONFIG } from '../src/persistence/tokens.ts'
import type { INestApplication } from '@nestjs/common'
it('takes an interviewed presence through authorized execution, QA, indicator and cut, then survives API restart', async () => {
  const f = await fixture()
  let restarted: INestApplication | undefined,
    closed = false
  try {
    const svc = await f.service(),
      authorization = 'Bearer ' + svc.token
    const create = await f.http
      .post('/v1/cases')
      .set('Authorization', authorization)
      .send(envelope(createCase, 0))
    expect(create.status, create.text).toBe(201)
    const caseId = create.body.result.id
    expect(
      (
        await f.http
          .post('/v1/cases/' + caseId + '/commands')
          .set('Authorization', authorization)
          .send(
            envelope(
              {
                type: 'setField',
                caseId,
                fieldId: 'description',
                value: 'Actividad con Alumni',
                status: 'confirmed',
                source: { name: 'Docente' },
              },
              1,
            ),
          )
      ).status,
    ).toBe(200)
    const description = (await f.get('/v1/cases/' + caseId)).body.fields.find(
      (x: { fieldId: string }) => x.fieldId === 'description',
    )
    expect(description.status).toBe('conflict')
    expect(
      (
        await f.command(
          {
            type: 'resolveField',
            caseId,
            fieldId: 'description',
            assertionId: description.assertions[1].id,
            reason: 'Docente confirmó el alcance',
          },
          2,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await f.command(
          {
            type: 'setFields',
            caseId,
            fields: Object.entries({
              executingUnit: 'EIC',
              reach: 'Nacional',
              externalOrganization: 'Organización',
              presenceType: '4',
            }).map(([fieldId, value]) => ({
              fieldId,
              value,
              status: 'confirmed',
              source: { name: 'Coordinación' },
            })),
          },
          3,
        )
      ).status,
    ).toBe(200)
    const evidence = await f.command(
      {
        type: 'addEvidence',
        caseId,
        name: 'Acta',
        url: 'https://drive.google.com/file/d/acta/view',
      },
      4,
    )
    expect(
      (
        await f.command(
          {
            type: 'reviewEvidence',
            caseId,
            evidenceId: evidence.body.result.id,
            result: 'verified',
            reason: 'Acta revisada',
          },
          5,
        )
      ).status,
    ).toBe(200)
    const p = await operationalProject(f, caseId)
    for (const [state, v] of [
      ['planned', 5],
      ['in_progress', 6],
    ] as const) {
      const r = await p.send(
        { type: 'setExecutionState', state, reason: 'Ejecutar el mandato' },
        v,
      )
      expect(r.status, r.text).toBe(200)
    }
    expect(
      (
        await p.send(
          {
            type: 'saveExpense',
            budgetItemId: p.budgetItemId,
            authorizationId: p.authorizationId,
            concept: 'Materiales',
            amount: '100',
            spentOn: '2026-10-22',
            reason: 'Comprobante revisado',
          },
          7,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await p.send(
          {
            type: 'setExecutionState',
            state: 'completed',
            reason: 'Resultados completados',
          },
          8,
        )
      ).status,
    ).toBe(200)
    let v = 6
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
          caseId,
          state,
          reason: 'QA y autorización comprobados',
        },
        v++,
      )
      expect(r.status, r.text).toBe(200)
    }
    const contribution = await f.post(
      '/v1/indicators/4.2.5/commands',
      envelope(
        {
          type: 'linkIndicator',
          indicatorId: '4.2.5',
          caseId,
          value: 1,
          period: 2026,
          evidenceIds: [evidence.body.result.id],
          reason: 'Proponer aporte',
        },
        v++,
      ),
    )
    expect(contribution.status, contribution.text).toBe(200)
    expect(
      (
        await f.post(
          '/v1/indicators/4.2.5/commands',
          envelope(
            {
              type: 'validateContribution',
              indicatorId: '4.2.5',
              caseId,
              id: contribution.body.result.id,
              reason: 'Criterios comprobados',
            },
            v++,
          ),
        )
      ).status,
    ).toBe(200)
    const cut = await f.post(
      '/v1/cuts',
      envelope(
        {
          type: 'createCut',
          name: 'Corte verificado',
          period: '2026',
          caseIds: [caseId],
        },
        0,
      ),
    )
    expect(cut.status, cut.text).toBe(201)
    for (const [i, status] of ['review', 'ready', 'closed'].entries()) {
      const r = await f.post(
        '/v1/cuts/' + cut.body.result.id + '/commands',
        envelope(
          {
            type: 'transitionCut',
            cutId: cut.body.result.id,
            status,
            response:
              status === 'closed' ? 'Constancia institucional de ensayo' : '',
            reason: 'Control institucional',
          },
          i + 1,
        ),
      )
      expect(r.status, r.text).toBe(200)
    }
    expect(
      (await f.get('/v1/reports')).body.indicators.find(
        (x: { id: string }) => x.id === '4.2.5',
      ).progress,
    ).toBe(1)
    const config = f.app.get(CONFIG)
    await f.app.close()
    closed = true
    restarted = await createApp(config)
    const persisted = await request(restarted.getHttpServer())
      .get('/v1/cases/' + caseId)
      .set('Authorization', authorization)
    expect(persisted.status).toBe(200)
    expect(persisted.body.state).toBe('closed')
  } finally {
    if (restarted) await restarted.close()
    if (!closed) await f.app.close()
    await f.db.close()
  }
})
it('documents actual commands, session protection, semantic query and realtime contracts', async () => {
  const f = await fixture()
  try {
    const response = await f.get('/v1/openapi.json')
    expect(response.status, response.text).toBe(200)
    expect(response.body.openapi).toBe('3.1.0')
    for (const path of [
      '/v1/cases',
      '/v1/projects/{id}/commands',
      '/v1/query',
      '/v1/events',
      '/v1/imports/{id}/commit',
    ])
      expect(response.body.paths[path]).toBeTruthy()
    expect(response.body.components.securitySchemes).toHaveProperty(
      'cookieSession',
    )
    expect(response.body.components.securitySchemes).toHaveProperty(
      'serviceBearer',
    )
    expect(JSON.stringify(response.body)).not.toMatch(
      /password_hash|token_hash|DATABASE_URL/,
    )
    const catalog = await f.get('/v1/catalog')
    expect(
      catalog.body.commands.some(
        (c: { name: string }) => c.name === 'setField',
      ),
    ).toBe(true)
    const svc = await f.service()
    const serviceCatalog = await f.http
      .get('/v1/catalog')
      .set('Authorization', 'Bearer ' + svc.token)
    expect(
      serviceCatalog.body.commands.map((c: { name: string }) => c.name),
    ).not.toContain('approveCampaign')
  } finally {
    await f.close()
  }
})
