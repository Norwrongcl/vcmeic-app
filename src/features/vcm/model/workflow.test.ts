import { describe, expect, it } from 'vitest'
import { EMPTY_APP_DATA } from '@/features/core/model/seed'
import { ACTIVITY_FIELDS, PRESENCE_TYPES } from './catalogs'
import { migrateVcmData } from './migration'
import { weeklyPackageSnapshot } from './package-review'
import type { Actor, VcmData } from './types'
import { applyCommand, getQaIssues, getIndicatorValue } from './workflow'

const actor: Actor = {
  id: 'demo-coordination',
  role: 'coordination',
  name: 'Coordinación · demo',
}
const now = '2026-10-21T12:00:00Z'
function fresh(): VcmData {
  return migrateVcmData(EMPTY_APP_DATA)
}
function create(data = fresh()) {
  return applyCommand(
    data,
    {
      type: 'createCase',
      id: 'case-1',
      kind: 'activity',
      name: 'Taller',
      responsible: 'Ana',
      description: 'Taller territorial',
      startsAt: '2026-10-20',
      endsAt: '2026-10-20',
      portfolio: 'Difusión/Posicionamiento',
    },
    actor,
    now
  )
}

describe('expediente y reglas del PO', () => {
  it('defines seven presence types and exactly 49 mirror fields', () => {
    expect(PRESENCE_TYPES).toHaveLength(7)
    expect(ACTIVITY_FIELDS).toHaveLength(49)
    expect(new Set(ACTIVITY_FIELDS.map((f) => f.id)).size).toBe(49)
  })
  it('creates a pending case and records actor and source without automatic approval', () => {
    const data = create()
    expect(data.cases['case-1'].state).toBe('open')
    expect(data.cases['case-1'].fields.name.value).toBe('Taller')
    expect(data.cases['case-1'].fields.name.sourceIds).toHaveLength(1)
    expect(data.audit[0].actor.id).toBe(actor.id)
    expect(getQaIssues(data, 'case-1').length).toBeGreaterThan(0)
    expect(() =>
      applyCommand(
        data,
        {
          type: 'transition',
          caseId: 'case-1',
          state: 'closed',
          reason: 'Cerrar',
        },
        actor,
        now
      )
    ).toThrow()
  })
  it('preserves both source values until explicit conflict resolution', () => {
    let data = create()
    data = applyCommand(
      data,
      {
        type: 'setField',
        caseId: 'case-1',
        fieldId: 'externalPublicActual',
        value: '18',
        status: 'confirmed',
        source: 'Programa',
        observation: '',
      },
      actor,
      now
    )
    data = applyCommand(
      data,
      {
        type: 'setField',
        caseId: 'case-1',
        fieldId: 'externalPublicActual',
        value: '17',
        status: 'confirmed',
        source: 'Lista',
        observation: '',
      },
      actor,
      now
    )
    const field = data.cases['case-1'].fields.externalPublicActual
    expect(field.status).toBe('conflict')
    expect(field.candidates.map((c) => c.value)).toEqual(['18', '17'])
    expect(() =>
      applyCommand(
        data,
        {
          type: 'resolveField',
          caseId: 'case-1',
          fieldId: 'externalPublicActual',
          value: '17',
          reason: '',
        },
        actor,
        now
      )
    ).toThrow()
    data = applyCommand(
      data,
      {
        type: 'resolveField',
        caseId: 'case-1',
        fieldId: 'externalPublicActual',
        value: '17',
        reason: 'Lista final revisada',
      },
      actor,
      now
    )
    expect(data.cases['case-1'].fields.externalPublicActual.value).toBe('17')
    expect(
      data.cases['case-1'].fields.externalPublicActual.candidates
    ).toHaveLength(2)
  })
  it('retains legacy records and does not infer institutional validation', () => {
    const legacy = {
      ...EMPTY_APP_DATA,
      events: {
        e: {
          id: 'e',
          createdAt: now,
          updatedAt: now,
          name: 'Evento',
          description: 'Original',
          startsAt: '2026-10-20',
          endsAt: '2026-10-21',
          status: 'completed' as const,
          location: 'EIC',
          owner: 'Ana',
        },
      },
    }
    const data = migrateVcmData(legacy)
    expect(data.cases.e.projectId).toBe('e')
    expect(data.cases.e.state).toBe('construction')
    expect(data.cases.e.fields.name.value).toBe('Evento')
    expect(data.cases.e.fields.name.status).toBe('partial')
  })
  it('blocks a consultation actor from changing a case', () => {
    expect(() =>
      applyCommand(
        create(),
        {
          type: 'transition',
          caseId: 'case-1',
          state: 'construction',
          reason: 'Revisión',
        },
        { ...actor, role: 'viewer' },
        now
      )
    ).toThrow()
  })
  it('requires approved campaign and invalidates editorial approval after an edit', () => {
    let data = create()
    data = applyCommand(
      data,
      {
        type: 'saveCampaign',
        caseId: 'case-1',
        objective: 'Difundir',
        audience: 'Docentes',
        valueProposition: 'Aprender',
        message: 'Taller',
        cta: 'Inscribirse',
        channels: 'Instagram',
        kpi: 'Inscripciones',
        problem: 'Necesidad',
        positioning: 'Especialización',
        journey: 'Conocer y participar',
        kpiTarget: '10',
        successCriteria: '10 inscripciones verificadas',
        resources: 'Equipo autorizado',
        schedule: 'Octubre',
        restrictions: 'Sin datos personales',
      },
      actor,
      now
    )
    data = applyCommand(
      data,
      {
        type: 'saveContent',
        caseId: 'case-1',
        id: 'post-1',
        title: 'Invitación',
        brief: 'Invitar',
        copy: 'Texto',
        channel: 'Instagram',
        scheduledAt: '2026-10-28',
        assetUrl: 'https://example.org/activo',
        mode: 'weekly',
      },
      actor,
      now
    )
    expect(() =>
      applyCommand(
        data,
        {
          type: 'approveContent',
          caseId: 'case-1',
          id: 'post-1',
          reason: 'Paquete aprobado',
        },
        actor,
        now
      )
    ).toThrow()
    data = applyCommand(
      data,
      {
        type: 'approveCampaign',
        caseId: 'case-1',
        reason: 'Estrategia revisada',
      },
      actor,
      now
    )
    data = applyCommand(
      data,
      {
        type: 'approveContent',
        caseId: 'case-1',
        id: 'post-1',
        reason: 'Paquete aprobado',
      },
      actor,
      now
    )
    expect(data.contents['post-1'].approvedVersion).toBe(1)
    data = applyCommand(
      data,
      {
        type: 'saveContent',
        caseId: 'case-1',
        id: 'post-1',
        title: 'Invitación',
        brief: 'Invitar',
        copy: 'Texto corregido',
        channel: 'Instagram',
        scheduledAt: '2026-10-28',
        assetUrl: 'https://example.org/activo',
        mode: 'weekly',
      },
      actor,
      now
    )
    expect(data.contents['post-1'].approvedVersion).toBeNull()
    expect(data.contents['post-1'].status).toBe('review')
    expect(data.audit.some((a) => a.action === 'approveContent')).toBe(true)
  })
  it('does not count pending records toward an indicator', () => {
    const data = create()
    data.indicatorLinks.test = {
      id: 'test',
      caseId: 'case-1',
      indicatorId: '4.2.5',
      period: 2026,
      value: 1,
      rule: 'Regla comprobada',
      evidenceIds: ['evidence'],
      status: 'validated',
      actor,
      version: 1,
    }
    expect(getIndicatorValue(data, '4.2.5', 2026)).toBe(0)
  })
})

describe('cierre completo y coherencia', () => {
  it('can close a fully evidenced presence and count it only once', () => {
    let data = applyCommand(
      fresh(),
      {
        type: 'createCase',
        id: 'p',
        kind: 'presence',
        name: 'Exposición',
        responsible: 'Ana',
        description: 'Exposición técnica',
        startsAt: '2026-10-20',
        endsAt: '2026-10-20',
        portfolio: '',
      },
      actor,
      now
    )
    for (const [fieldId, value] of Object.entries({
      name: 'Exposición',
      responsible: 'Ana',
      description: 'Exposición técnica',
      startsAt: '2026-10-20',
      endsAt: '2026-10-20',
      executingUnit: 'EIC',
      reach: 'Regional',
      externalOrganization: 'Colegio',
    }))
      data = applyCommand(
        data,
        {
          type: 'setField',
          caseId: 'p',
          fieldId,
          value,
          status: 'confirmed',
          source: 'Antecedentes revisados',
          observation: '',
        },
        actor,
        now
      )
    data = applyCommand(
      data,
      {
        type: 'updateCase',
        caseId: 'p',
        priority: 'medium',
        confidentiality: 'internal',
        presenceType: PRESENCE_TYPES[3],
        executionState: 'draft',
        portfolio: '',
      },
      actor,
      now
    )
    data = applyCommand(
      data,
      {
        type: 'addEvidence',
        caseId: 'p',
        id: 'e',
        name: 'Programa',
        url: 'https://example.org/programa',
        verified: true,
      },
      actor,
      now
    )
    for (const state of [
      'construction',
      'review',
      'validated',
      'closing',
      'qa',
      'rendered',
      'closed',
    ] as const)
      data = applyCommand(
        data,
        { type: 'transition', caseId: 'p', state, reason: 'Revisión conforme' },
        actor,
        now
      )
    expect(getQaIssues(data, 'p')).toEqual([])
    expect(data.cases.p.institutionalValidation).toBe('pending')
    data = applyCommand(
      data,
      {
        type: 'linkIndicator',
        caseId: 'p',
        id: 'l',
        indicatorId: '4.2.5',
        period: 2026,
        value: 1,
        rule: 'P5.1 validada con evidencia',
        evidenceIds: ['e'],
        validate: true,
      },
      actor,
      now
    )
    expect(getIndicatorValue(data, '4.2.5', 2026)).toBe(1)
    expect(() =>
      applyCommand(
        data,
        {
          type: 'linkIndicator',
          caseId: 'p',
          id: 'l2',
          indicatorId: '4.2.5',
          period: 2026,
          value: 1,
          rule: 'P5.1 validada con evidencia',
          evidenceIds: ['e'],
          validate: true,
        },
        actor,
        now
      )
    ).toThrow()
  })
  it('keeps the approved copy and exact changed version in the audit trail', () => {
    let data = create()
    data = applyCommand(
      data,
      {
        type: 'saveContent',
        caseId: 'case-1',
        id: 'post',
        title: 'Prueba',
        brief: 'Brief',
        copy: 'Anterior',
        channel: 'Instagram',
        scheduledAt: '2026-10-28',
        assetUrl: 'https://example.org/activo',
        mode: 'exception',
      },
      actor,
      now
    )
    data = applyCommand(
      data,
      {
        type: 'saveContent',
        caseId: 'case-1',
        id: 'post',
        title: 'Prueba',
        brief: 'Brief',
        copy: 'Nuevo',
        channel: 'Instagram',
        scheduledAt: '2026-10-28',
        assetUrl: 'https://example.org/activo',
        mode: 'exception',
      },
      actor,
      now
    )
    expect(JSON.stringify(data.audit[data.audit.length - 1].before)).toContain(
      'Anterior'
    )
    expect(JSON.stringify(data.audit[data.audit.length - 1].after)).toContain(
      'Nuevo'
    )
  })
  it('does not approve a weekly package containing a post outside its seven-day range', () => {
    let data = create()
    data = applyCommand(
      data,
      {
        type: 'saveCampaign',
        caseId: 'case-1',
        objective: 'Objetivo',
        audience: 'Público',
        valueProposition: 'Valor',
        message: 'Mensaje',
        cta: 'CTA',
        channels: 'Instagram',
        kpi: 'KPI',
        problem: 'Necesidad',
        positioning: 'Especialización',
        journey: 'Conocer y participar',
        kpiTarget: '10',
        successCriteria: '10 inscripciones verificadas',
        resources: 'Equipo autorizado',
        schedule: 'Octubre',
        restrictions: 'Sin datos sensibles',
      },
      actor,
      now
    )
    data = applyCommand(
      data,
      { type: 'approveCampaign', caseId: 'case-1', reason: 'Conforme' },
      actor,
      now
    )
    data = applyCommand(
      data,
      {
        type: 'saveContent',
        caseId: 'case-1',
        id: 'post',
        title: 'Fuera de rango',
        brief: 'Brief',
        copy: 'Copy',
        channel: 'Instagram',
        scheduledAt: '2026-11-20',
        packageId: '2026-10-20',
        assetUrl: 'https://example.org/a',
        mode: 'weekly',
      },
      actor,
      now
    )
    expect(() =>
      applyCommand(
        data,
        {
          type: 'approvePackage',
          reviewedSnapshot: weeklyPackageSnapshot(data, '2026-10-20'),
          caseId: 'case-1',
          packageId: '2026-10-20',
          reason: 'Conforme',
        },
        actor,
        now
      )
    ).toThrow()
  })
})

it('approves a weekly package across cases atomically and rejects a partial approval', () => {
  let data = fresh()
  for (const id of ['first', 'second']) {
    data = applyCommand(
      data,
      {
        type: 'createCase',
        id,
        kind: 'campaign',
        name: id,
        responsible: 'Ana',
        description: 'Caso de campaña',
        startsAt: '2026-10-20',
        endsAt: '2026-10-21',
        portfolio: '',
      },
      actor,
      now
    )
    data = applyCommand(
      data,
      {
        type: 'saveCampaign',
        caseId: id,
        objective: 'Objetivo',
        audience: 'Audiencia',
        valueProposition: 'Valor',
        message: 'Mensaje',
        cta: 'CTA',
        channels: 'Instagram',
        kpi: 'KPI',
        problem: 'Necesidad',
        positioning: 'Especialización',
        journey: 'Conocer y participar',
        kpiTarget: '10',
        successCriteria: '10 inscripciones verificadas',
        resources: 'Equipo autorizado',
        schedule: 'Octubre',
        restrictions: 'No aplica',
      },
      actor,
      now
    )
    if (id === 'first')
      data = applyCommand(
        data,
        { type: 'approveCampaign', caseId: id, reason: 'Conforme' },
        actor,
        now
      )
    data = applyCommand(
      data,
      {
        type: 'saveContent',
        caseId: id,
        id: `post-${id}`,
        title: id,
        brief: 'Brief',
        copy: 'Copy',
        channel: 'Instagram',
        scheduledAt: '2026-10-21',
        packageId: '2026-10-20',
        assetUrl: 'https://example.org/a',
        mode: 'weekly',
      },
      actor,
      now
    )
  }
  expect(() =>
    applyCommand(
      data,
      {
        type: 'approvePackage',
        reviewedSnapshot: weeklyPackageSnapshot(data, '2026-10-20'),
        caseId: 'first',
        packageId: '2026-10-20',
        reason: 'Revisión semanal',
      },
      actor,
      now
    )
  ).toThrow()
  expect(data.contents['post-first'].approvedVersion).toBeNull()
  data = applyCommand(
    data,
    { type: 'approveCampaign', caseId: 'second', reason: 'Conforme' },
    actor,
    now
  )
  data = applyCommand(
    data,
    {
      type: 'approvePackage',
      reviewedSnapshot: weeklyPackageSnapshot(data, '2026-10-20'),
      caseId: 'first',
      packageId: '2026-10-20',
      reason: 'Revisión semanal',
    },
    actor,
    now
  )
  expect(data.contents['post-first'].approvedVersion).toBe(1)
  expect(data.contents['post-second'].approvedVersion).toBe(1)
})

it('activates MP2 on an existing activity without duplicating the dossier', () => {
  const data = applyCommand(
    create(),
    {
      type: 'attachProject',
      caseId: 'case-1',
      reason: 'Requiere seguimiento activo',
    },
    actor,
    now
  )
  expect(Object.keys(data.cases)).toEqual(['case-1'])
  expect(data.cases['case-1'].projectId).toBe('case-1')
  expect(data.cases['case-1'].executionState).toBe('draft')
})

it('reviews an existing evidence without duplicating its ID and preserves its previous URL', () => {
  let data = create()
  data = applyCommand(
    data,
    {
      type: 'addEvidence',
      caseId: 'case-1',
      id: 'e',
      name: 'Programa',
      url: 'https://example.org/old',
      verified: false,
    },
    actor,
    now
  )
  data = applyCommand(
    data,
    {
      type: 'reviewEvidence',
      caseId: 'case-1',
      id: 'e',
      name: 'Programa revisado',
      url: 'https://example.org/final',
      verified: true,
      reason: 'Se comprobó el programa final',
    },
    actor,
    now
  )
  expect(Object.keys(data.evidences)).toEqual(['e'])
  expect(data.evidences.e.version).toBe(2)
  expect(data.evidences.e.verified).toBe(true)
  expect(JSON.stringify(data.audit)).toContain('https://example.org/old')
})
it('does not let the responsible role classify a presence', () => {
  const data = applyCommand(
    fresh(),
    {
      type: 'createCase',
      id: 'p',
      kind: 'presence',
      name: 'Prueba',
      responsible: 'Ana',
      description: 'Prueba',
      startsAt: '2026-10-20',
      endsAt: '2026-10-20',
      portfolio: '',
    },
    actor,
    now
  )
  data.cases.p.responsibleActorId = 'demo-responsible'
  expect(() =>
    applyCommand(
      data,
      {
        type: 'setField',
        caseId: 'p',
        fieldId: 'presenceType',
        value: PRESENCE_TYPES[3],
        status: 'partial',
        source: 'Responsable',
        observation: '',
      },
      { id: 'demo-responsible', name: 'Ana', role: 'responsible' },
      now
    )
  ).toThrow()
})

it('rejects approval if the reviewed weekly package has changed or has not been reviewed', () => {
  const data = create()
  data.campaigns['case-1'] = {
    id: 'case-1',
    caseId: 'case-1',
    objective: 'O',
    audience: 'A',
    valueProposition: 'V',
    message: 'M',
    cta: 'C',
    channels: 'LinkedIn',
    kpi: 'K',
    problem: 'Necesidad',
    positioning: 'Especialización',
    journey: 'Conocer y participar',
    kpiTarget: '10',
    successCriteria: '10 inscripciones verificadas',
    resources: 'Equipo autorizado',
    schedule: 'Octubre',
    restrictions: 'R',
    version: 1,
    approvedVersion: 1,
  }
  data.contents.p = {
    id: 'p',
    caseId: 'case-1',
    title: 'Pieza',
    brief: 'Brief',
    copy: 'Copy',
    channel: 'LinkedIn',
    scheduledAt: '2026-10-21',
    assetUrl: 'https://example.org/a',
    mode: 'weekly',
    packageId: '2026-10-20',
    version: 1,
    approvedVersion: null,
    approvedCampaignVersion: null,
    status: 'draft',
    integration: 'disconnected',
  }
  const command = {
    type: 'approvePackage' as const,
    caseId: 'case-1',
    packageId: '2026-10-20',
    reason: 'Conforme',
    reviewedSnapshot: 'unseen',
  }
  expect(() => applyCommand(data, command, actor, now)).toThrow(/cambió|revis/i)
  expect(data.contents.p.status).toBe('draft')
})

it('validates a group edit atomically and retains provenance for every changed field', () => {
  const data = create()
  const fields = [
    {
      fieldId: 'objective',
      value: 'Compartir conocimiento',
      status: 'partial' as const,
      source: 'Programa de la actividad',
      observation: '',
    },
    {
      fieldId: 'externalPublicActual',
      value: '-1',
      status: 'partial' as const,
      source: 'Programa de la actividad',
      observation: '',
    },
  ]
  expect(() =>
    applyCommand(
      data,
      { type: 'setFields', caseId: 'case-1', fields },
      actor,
      now
    )
  ).toThrow()
  expect(data.cases['case-1'].fields.objective?.value ?? '').toBe('')
  fields[1].value = '12'
  const updated = applyCommand(
    data,
    { type: 'setFields', caseId: 'case-1', fields },
    actor,
    now
  )
  expect(updated.cases['case-1'].fields.objective.value).toBe(
    'Compartir conocimiento'
  )
  expect(updated.cases['case-1'].fields.externalPublicActual.value).toBe('12')
  expect(updated.cases['case-1'].fields.objective.sourceIds).toHaveLength(1)
})
