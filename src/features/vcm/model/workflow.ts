import { campaignIssues, campaignIsApproved } from './campaign-rules'
import {
  fieldsFor,
  PRESENCE_TYPES,
  RULE_VERSION,
  TRANSITIONS,
} from './catalogs'
import { validRecordDate } from './dates'
import {
  decisionAuthority,
  decisionOptions,
  isDecisionPending,
} from './decisions'
import { blankField } from './migration'
import {
  hasApprovedOperationScope,
  operationPlanIssues,
  operationScope,
} from './operation-mandate'
import { weeklyPackageSnapshot } from './package-review'
import type {
  Actor,
  Command,
  Dossier,
  Role,
  VcmData,
  IndicatorLink,
} from './types'

export function canRead(dossier: Dossier, actor: Actor) {
  if (['coordination', 'leadership'].includes(actor.role)) return true
  if (actor.role === 'responsible')
    return dossier.responsibleActorId === actor.id
  if (dossier.confidentiality === 'sensitive') return actor.role === 'direction'
  if (dossier.confidentiality === 'restricted')
    return actor.role === 'direction'
  return true
}
export function canOperate(role: Role) {
  return role === 'coordination' || role === 'leadership'
}
export function getQaIssues(
  data: VcmData,
  id: string,
  closing = true
): string[] {
  const c = data.cases[id]
  if (!c) return ['Expediente inexistente.']
  const required = [
    'name',
    'responsible',
    'startsAt',
    'endsAt',
    'description',
    ...(c.kind === 'presence'
      ? ['executingUnit', 'reach', 'externalOrganization']
      : ['objective', 'format', 'activityType', 'actionLine']),
  ]
  if (closing && c.kind !== 'presence')
    required.push('resultsActual', 'externalPublicActual', 'internalActual')
  const labels = Object.fromEntries(
    fieldsFor(c.kind).map((f) => [f.id, f.label])
  )
  const issues = required
    .filter(
      (k) => !c.fields[k]?.value.trim() || c.fields[k]?.status !== 'confirmed'
    )
    .map((k) => `Confirmar ${labels[k] ?? k}.`)
  if (c.kind === 'presence' && !PRESENCE_TYPES.includes(c.presenceType))
    issues.push('Seleccionar una tipología válida de Presencia.')
  if (!Object.values(data.evidences).some((e) => e.caseId === id && e.verified))
    issues.push('Falta evidencia revisada por Coordinación.')
  if (Object.values(c.fields).some((f) => f.status === 'conflict'))
    issues.push('Resolver los conflictos de fuentes.')
  const start = c.fields.startsAt?.value,
    end = c.fields.endsAt?.value
  if ((start && !validRecordDate(start)) || (end && !validRecordDate(end)))
    issues.push('Registra fechas válidas antes de validar o cerrar.')
  if (start && end && start > end)
    issues.push('La fecha de cierre debe ser posterior o igual al inicio.')
  if (closing && c.projectId && c.executionState !== 'completed')
    issues.push(
      'El proyecto operativo debe estar completado antes del cierre documental.'
    )
  if (closing && c.projectId && !hasApprovedOperationScope(data, id))
    issues.push(
      'El plan de trabajo del proyecto requiere un mandato aprobado y vigente.'
    )
  if (
    closing &&
    Object.values(data.decisions).some(
      (d) => d.caseId === id && d.status === 'in_execution'
    )
  )
    issues.push('Completa las decisiones en ejecución antes del cierre.')
  if (
    Object.values(data.decisions).some(
      (d) => d.caseId === id && isDecisionPending(d)
    )
  )
    issues.push('Hay decisiones pendientes o escaladas.')
  if (
    Object.values(data.cuts).some((cut) =>
      cut.observations.some((o) => o.caseId === id && o.status === 'open')
    )
  )
    issues.push('Resolver las observaciones institucionales abiertas.')
  return issues
}
export function eligible(data: VcmData, id: string) {
  const c = data.cases[id]
  return Boolean(
    c &&
    ['validated', 'closing', 'qa', 'rendered', 'closed'].includes(c.state) &&
    getQaIssues(data, id).length === 0
  )
}
export function isIndicatorLinkEligible(data: VcmData, link: IndicatorLink) {
  const indicator = data.indicators[link.indicatorId]
  const c = data.cases[link.caseId]
  return Boolean(
    indicator &&
    indicator.id === '4.2.5' &&
    indicator.period === link.period &&
    c?.kind === 'presence' &&
    link.value === 1 &&
    Number(c.fields.startsAt?.value.slice(0, 4)) === link.period &&
    link.status === 'validated' &&
    eligible(data, link.caseId) &&
    link.evidenceIds.length &&
    link.evidenceIds.every(
      (id) =>
        data.evidences[id]?.caseId === link.caseId &&
        data.evidences[id]?.verified
    )
  )
}
export function getIndicatorValue(
  data: VcmData,
  indicatorId: string,
  period: number
) {
  return Object.values(data.indicatorLinks)
    .filter(
      (l) =>
        l.indicatorId === indicatorId &&
        l.period === period &&
        isIndicatorLinkEligible(data, l)
    )
    .reduce((sum, l) => sum + l.value, 0)
}
function auditDelta(
  before: unknown,
  after: unknown
): { before: unknown; after: unknown } {
  if (
    before &&
    after &&
    typeof before === 'object' &&
    typeof after === 'object' &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  ) {
    const old = before as Record<string, unknown>,
      next = after as Record<string, unknown>,
      oldChanges: Record<string, unknown> = {},
      nextChanges: Record<string, unknown> = {}
    for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
      if (JSON.stringify(old[key]) === JSON.stringify(next[key])) continue
      const change = auditDelta(old[key] ?? null, next[key] ?? null)
      oldChanges[key] = change.before
      nextChanges[key] = change.after
    }
    return { before: oldChanges, after: nextChanges }
  }
  return { before, after }
}
function auditState(data: VcmData, caseId: string) {
  return {
    case: data.cases[caseId] ?? null,
    campaign: data.campaigns[caseId] ?? null,
    contents: Object.values(data.contents).filter((v) => v.caseId === caseId),
    evidences: Object.values(data.evidences).filter((v) => v.caseId === caseId),
    decisions: Object.values(data.decisions).filter((v) => v.caseId === caseId),
    indicatorLinks: Object.values(data.indicatorLinks).filter(
      (v) => v.caseId === caseId
    ),
    cuts: Object.values(data.cuts).filter((v) => v.caseIds.includes(caseId)),
  }
}
export function applyCommand(
  original: VcmData,
  cmd: Command,
  actor: Actor,
  at = new Date().toISOString()
): VcmData {
  if (cmd.type === 'setFields') {
    if (
      !cmd.fields.length ||
      cmd.fields.length > 60 ||
      new Set(cmd.fields.map((f) => f.fieldId)).size !== cmd.fields.length
    )
      throw new Error('Selecciona datos distintos para guardar el grupo.')
    return cmd.fields.reduce(
      (updated, field) =>
        applyCommand(
          updated,
          { type: 'setField', caseId: cmd.caseId, ...field },
          actor,
          at
        ),
      original
    )
  }
  const data: VcmData = structuredClone(original)
  const caseId =
    'caseId' in cmd ? cmd.caseId : cmd.type === 'createCase' ? cmd.id : ''
  let c = data.cases[caseId]
  if (c && !canRead(c, actor))
    throw new Error('Este rol de demostración no tiene acceso al expediente.')
  const editorial =
    ['saveContent'].includes(cmd.type) && actor.role === 'designer'
  const financeDecision =
    cmd.type === 'decide' &&
    actor.role === 'direction' &&
    data.decisions[cmd.id] &&
    decisionAuthority(data.decisions[cmd.id]) === 'direction'
  const contribution =
    cmd.type === 'setField' &&
    actor.role === 'responsible' &&
    c?.responsibleActorId === actor.id
  if (
    !canOperate(actor.role) &&
    !editorial &&
    !financeDecision &&
    !contribution
  )
    throw new Error('Acción no permitida para este rol de demostración.')
  if ('caseId' in cmd && !c) throw new Error('Expediente inexistente.')
  const affectedCases =
    cmd.type === 'approvePackage'
      ? [
          ...new Set(
            Object.values(data.contents)
              .filter(
                (p) => p.mode === 'weekly' && p.packageId === cmd.packageId
              )
              .map((p) => p.caseId)
          ),
        ]
      : [caseId]
  const packageBefore = Object.fromEntries(
    affectedCases.map((id) => [id, structuredClone(auditState(data, id))])
  )
  const before = caseId
    ? structuredClone(auditState(data, caseId))
    : structuredClone(data.cuts)
  const reason = 'reason' in cmd ? (cmd.reason ?? '') : ''
  const invalidate = () => {
    if (
      c &&
      ['validated', 'closing', 'qa', 'rendered', 'closed'].includes(c.state)
    )
      c.state = 'returned'
    if (c) {
      c.institutionalValidation = 'pending'
      for (const link of Object.values(data.indicatorLinks))
        if (link.caseId === c.id) link.status = 'pending'
    }
  }
  const source = (name: string) => {
    const id = crypto.randomUUID()
    data.sources[id] = {
      id,
      caseId,
      name,
      channel: 'web',
      capturedAt: at,
      actor,
    }
    return id
  }
  const requireReason = () => {
    if (!reason.trim()) throw new Error('Escribe el fundamento de la decisión.')
  }
  switch (cmd.type) {
    case 'createCase': {
      if (data.cases[cmd.id]) throw new Error('El identificador ya existe.')
      if (
        !cmd.name.trim() ||
        !cmd.responsible.trim() ||
        !cmd.description.trim()
      )
        throw new Error('Completa nombre, responsable y descripción.')
      if (
        (cmd.startsAt && !validRecordDate(cmd.startsAt)) ||
        (cmd.endsAt && !validRecordDate(cmd.endsAt))
      )
        throw new Error('Registra fechas válidas.')
      if (cmd.startsAt && cmd.endsAt && cmd.startsAt > cmd.endsAt)
        throw new Error('Revisa el orden de las fechas.')
      const sourceId = source('Ingreso manual · datos declarados')
      const fields: Dossier['fields'] = {}
      for (const definition of fieldsFor(cmd.kind))
        fields[definition.id] = blankField()
      for (const [key, value] of Object.entries({
        internalId: cmd.id,
        registrar: actor.name,
        name: cmd.name,
        responsible: cmd.responsible,
        description: cmd.description,
        startsAt: cmd.startsAt,
        endsAt: cmd.endsAt,
      }))
        fields[key] = {
          ...blankField(),
          value,
          status: value ? 'partial' : 'pending',
          sourceIds: [sourceId],
        }
      c = {
        id: cmd.id,
        code: `EIC-${cmd.id.slice(0, 8).toUpperCase()}`,
        kind: cmd.kind,
        name: cmd.name.trim(),
        responsible: cmd.responsible.trim(),
        responsibleActorId: null,
        portfolio: cmd.portfolio,
        state: 'open',
        version: 1,
        createdAt: at,
        updatedAt: at,
        confidentiality: 'internal',
        priority: 'medium',
        fields,
        projectId: ['initiative', 'event'].includes(cmd.kind) ? cmd.id : null,
        executionState: 'draft',
        organizationIds: [],
        agreementIds: [],
        legacyId: null,
        externalIds: {},
        presenceType: '',
        institutionalValidation: 'pending',
        demo: true,
      }
      data.cases[c.id] = c
      break
    }
    case 'setField': {
      if (!fieldsFor(c.kind).some((f) => f.id === cmd.fieldId))
        throw new Error('Campo fuera del contrato del expediente.')
      if (['internalId', 'registrar'].includes(cmd.fieldId))
        throw new Error('Los metadatos de control no se editan.')
      const def = fieldsFor(c.kind).find((f) => f.id === cmd.fieldId)
      if (contribution && def?.classification)
        throw new Error(
          'La clasificación institucional corresponde a Coordinación.'
        )
      if (contribution && cmd.status === 'confirmed')
        throw new Error(
          'El aporte del responsable debe revisarse antes de confirmarlo.'
        )
      if (!cmd.source.trim()) throw new Error('Indica la fuente del dato.')
      if (cmd.status === 'conflict')
        throw new Error(
          'Los conflictos se generan al conservar dos valores incompatibles.'
        )
      if (cmd.status === 'confirmed' && !cmd.value.trim())
        throw new Error('Un dato confirmado necesita un valor.')
      if (
        def?.numeric &&
        cmd.value.trim() &&
        (!Number.isFinite(Number(cmd.value)) ||
          Number(cmd.value) < 0 ||
          !Number.isInteger(Number(cmd.value)))
      )
        throw new Error('Introduce un número entero no negativo.')
      if (
        ['startsAt', 'endsAt'].includes(cmd.fieldId) &&
        cmd.value &&
        !validRecordDate(cmd.value)
      )
        throw new Error('Usa una fecha ISO válida: AAAA-MM-DD.')
      const old = c.fields[cmd.fieldId] ?? blankField()
      const sourceId = source(cmd.source)
      const candidates = [...old.candidates]
      if (
        old.value &&
        old.sourceIds[0] &&
        !candidates.some(
          (v) => v.value === old.value && v.sourceId === old.sourceIds[0]
        )
      )
        candidates.push({
          value: old.value,
          sourceId: old.sourceIds[0],
          capturedAt: data.sources[old.sourceIds[0]]?.capturedAt ?? at,
        })
      candidates.push({ value: cmd.value, sourceId, capturedAt: at })
      const conflict =
        old.status === 'conflict' ||
        (old.status === 'confirmed' && old.value !== cmd.value)
      c.fields[cmd.fieldId] = {
        value: conflict ? old.value : cmd.value,
        status: conflict ? 'conflict' : cmd.status,
        sourceIds: [...new Set([...old.sourceIds, sourceId])],
        observation: cmd.observation,
        candidates,
      }
      if (!conflict && cmd.fieldId === 'name') c.name = cmd.value
      if (!conflict && cmd.fieldId === 'responsible') c.responsible = cmd.value
      if (cmd.fieldId === 'presenceType') {
        if (!PRESENCE_TYPES.includes(cmd.value))
          throw new Error('Selecciona una tipología oficial.')
        if (!conflict) c.presenceType = cmd.value
      }
      invalidate()
      break
    }
    case 'resolveField': {
      requireReason()
      const field = c.fields[cmd.fieldId]
      if (!field || field.status !== 'conflict')
        throw new Error('El campo no tiene un conflicto abierto.')
      if (!field.candidates.some((v) => v.value === cmd.value))
        throw new Error(
          'Selecciona uno de los valores conservados; registra una nueva fuente si hace falta.'
        )
      field.value = cmd.value
      field.status = 'confirmed'
      field.observation = cmd.reason
      if (cmd.fieldId === 'name') c.name = cmd.value
      if (cmd.fieldId === 'responsible') c.responsible = cmd.value
      if (cmd.fieldId === 'presenceType') c.presenceType = cmd.value
      invalidate()
      break
    }
    case 'transition': {
      requireReason()
      if (!TRANSITIONS[c.state].includes(cmd.state))
        throw new Error('Transición no permitida desde el estado actual.')
      if (c.state === 'escalated' && actor.role !== 'leadership')
        throw new Error('Jefatura debe resolver el escalamiento.')
      if (['validated', 'qa', 'rendered', 'closed'].includes(cmd.state)) {
        const issues = getQaIssues(data, c.id, cmd.state !== 'validated')
        if (issues.length) throw new Error(issues.join(' '))
      }
      if (cmd.state === 'returned') invalidate()
      c.state = cmd.state
      break
    }
    case 'attachProject': {
      requireReason()
      if (c.projectId)
        throw new Error('El expediente ya tiene un proyecto operativo.')
      c.projectId = c.id
      c.executionState = 'draft'
      invalidate()
      break
    }
    case 'updateCase': {
      if (cmd.priority !== c.priority) requireReason()
      if (cmd.presenceType && !PRESENCE_TYPES.includes(cmd.presenceType))
        throw new Error('Tipología inválida.')
      if (cmd.executionState !== c.executionState && !c.projectId)
        throw new Error('Este expediente no tiene proyecto operativo.')
      if (
        cmd.executionState !== c.executionState ||
        cmd.presenceType !== c.presenceType
      )
        invalidate()
      if (cmd.presenceType !== c.presenceType) {
        const sourceId = source('Clasificación P5.1 revisada por Coordinación')
        c.fields.presenceType = {
          ...blankField(),
          value: cmd.presenceType,
          status: cmd.presenceType ? 'confirmed' : 'pending',
          sourceIds: [sourceId],
        }
      }
      if (cmd.confidentiality !== c.confidentiality)
        for (const e of Object.values(data.evidences))
          if (e.caseId === c.id) e.confidentiality = cmd.confidentiality
      if (cmd.responsibleActorId !== undefined)
        c.responsibleActorId = cmd.responsibleActorId
      Object.assign(c, {
        priority: cmd.priority,
        confidentiality: cmd.confidentiality,
        presenceType: cmd.presenceType,
        executionState: cmd.executionState,
        portfolio: cmd.portfolio,
      })
      break
    }
    case 'setRelations': {
      c.organizationIds = [...new Set(cmd.organizationIds)]
      c.agreementIds = [...new Set(cmd.agreementIds)]
      invalidate()
      break
    }
    case 'addEvidence': {
      const url = new URL(cmd.url)
      if (!['https:', 'http:'].includes(url.protocol) || !cmd.name.trim())
        throw new Error('Indica nombre y enlace HTTP/HTTPS válidos.')
      if (data.evidences[cmd.id]) throw new Error('La evidencia ya existe.')
      const sourceId = source(cmd.name)
      data.evidences[cmd.id] = {
        id: cmd.id,
        caseId,
        name: cmd.name,
        url: url.toString(),
        verified: cmd.verified,
        sourceId,
        version: 1,
        confidentiality: c.confidentiality,
      }
      const refs = Object.values(data.evidences).filter(
        (e) => e.caseId === caseId
      )
      c.fields.evidence = {
        ...blankField(),
        value: refs.map((e) => e.url).join('; '),
        status: refs.every((e) => e.verified) ? 'confirmed' : 'partial',
        sourceIds: refs.map((e) => e.sourceId),
      }
      invalidate()
      break
    }
    case 'reviewEvidence': {
      requireReason()
      const evidence = data.evidences[cmd.id]
      if (!evidence || evidence.caseId !== caseId)
        throw new Error('Evidencia inexistente.')
      if (!cmd.name.trim()) throw new Error('El documento necesita un nombre.')
      if (cmd.url !== evidence.url) {
        const url = new URL(cmd.url)
        if (!['http:', 'https:'].includes(url.protocol))
          throw new Error(
            'Usa un enlace HTTP/HTTPS para reemplazar la referencia.'
          )
        evidence.url = url.toString()
      }
      evidence.name = cmd.name
      evidence.verified = cmd.verified
      evidence.version++
      evidence.sourceId = source(`Revisión manual: ${cmd.reason}`)
      const refs = Object.values(data.evidences).filter(
        (e) => e.caseId === caseId
      )
      c.fields.evidence = {
        ...blankField(),
        value: refs.map((e) => e.url).join('; '),
        status: refs.every((e) => e.verified) ? 'confirmed' : 'partial',
        sourceIds: refs.map((e) => e.sourceId),
      }
      invalidate()
      break
    }
    case 'proposeDecision': {
      if (!cmd.title.trim() || !cmd.reason.trim())
        throw new Error('Completa asunto y fundamento.')
      if (
        cmd.amount !== null &&
        (!Number.isFinite(cmd.amount) || cmd.amount < 0)
      )
        throw new Error('Monto inválido.')
      if (data.decisions[cmd.id]) throw new Error('La decisión ya existe.')
      data.decisions[cmd.id] = {
        id: cmd.id,
        caseId,
        title: cmd.title,
        kind: cmd.kind,
        amount: cmd.amount,
        approvedScope: null,
        budgetBasis: null,
        authority:
          cmd.kind === 'budget'
            ? 'direction'
            : (cmd.authority ?? 'coordination'),
        alternatives: cmd.alternatives ?? '',
        impact: cmd.impact ?? '',
        reason: cmd.reason,
        status: 'pending',
        requestedBy: actor,
        decidedBy: null,
        version: 1,
        at,
      }
      break
    }
    case 'decide': {
      requireReason()
      const d = data.decisions[cmd.id]
      if (!d || d.caseId !== caseId) throw new Error('Decisión inexistente.')
      if (!decisionOptions(d, actor.role).includes(cmd.status))
        throw new Error(
          'La transición requiere la autoridad correspondiente o un estado de origen válido.'
        )
      if (
        d.kind === 'budget' &&
        cmd.status === 'approved' &&
        (!Number.isSafeInteger(d.amount) || !d.amount || d.amount < 0)
      )
        throw new Error(
          'El presupuesto requiere un monto entero positivo antes de aprobarlo.'
        )
      if (d.kind === 'flow' && c.projectId && cmd.status === 'approved') {
        const issues = operationPlanIssues(data, caseId)
        if (issues.length)
          throw new Error('Plan de trabajo incompleto. ' + issues.join(' '))
        d.approvedScope = operationScope(data, c.projectId!)
      }
      if (
        ['escalated', 'leadership_review'].includes(cmd.status) &&
        d.authority !== 'direction'
      )
        d.authority = 'leadership'
      if (cmd.status === 'direction_required') d.authority = 'direction'
      d.status = cmd.status
      d.decidedBy = actor
      d.reason = cmd.reason
      d.version++
      break
    }
    case 'saveCampaign': {
      const previous = data.campaigns[caseId]
      const { type: _, ...values } = cmd
      void _
      data.campaigns[caseId] = {
        problem: '',
        insight: '',
        positioning: '',
        journey: '',
        kpiTarget: '',
        successCriteria: '',
        resources: '',
        ...values,
        id: caseId,
        version: (previous?.version ?? 0) + 1,
        approvedVersion: null,
      }
      for (const content of Object.values(data.contents))
        if (content.caseId === caseId) {
          content.approvedVersion = null
          content.approvedCampaignVersion = null
          content.status = 'review'
        }
      break
    }
    case 'approveCampaign': {
      requireReason()
      const campaign = data.campaigns[caseId]
      if (!campaign) throw new Error('Primero prepara la estrategia.')
      if (campaignIssues(campaign).length)
        throw new Error(
          'Completa el plan de campaña antes de aprobar: ' +
            campaignIssues(campaign).join(', ')
        )
      if (
        Object.values(data.decisions).some(
          (d) => d.caseId === caseId && isDecisionPending(d)
        )
      )
        throw new Error(
          'Resuelve las decisiones pendientes antes de aprobar la campaña.'
        )
      campaign.approvedVersion = campaign.version
      break
    }
    case 'saveContent': {
      const previous = data.contents[cmd.id]
      if (previous && previous.caseId !== caseId)
        throw new Error('El contenido pertenece a otro expediente.')
      if (!cmd.title.trim()) throw new Error('Escribe un título.')
      if (cmd.assetUrl && !/^https?:\/\//.test(cmd.assetUrl))
        throw new Error('Usa un enlace HTTP/HTTPS para el activo.')
      const { type: _, ...values } = cmd
      void _
      data.contents[cmd.id] = {
        ...values,
        packageId:
          cmd.mode === 'weekly'
            ? (cmd.packageId ?? cmd.scheduledAt.slice(0, 10))
            : null,
        version: (previous?.version ?? 0) + 1,
        approvedVersion: null,
        approvedCampaignVersion: null,
        status: 'review',
        integration: 'disconnected',
      }
      break
    }
    case 'approveContent':
    case 'approvePackage': {
      if (
        cmd.type === 'approvePackage' &&
        (!cmd.reviewedSnapshot ||
          cmd.reviewedSnapshot !== weeklyPackageSnapshot(data, cmd.packageId))
      )
        throw new Error(
          'El paquete cambió o no se ha revisado completo. Abre nuevamente la revisión antes de aprobar.'
        )
      requireReason()
      const campaign = data.campaigns[caseId]
      if (!campaignIsApproved(campaign))
        throw new Error('Se requiere estrategia o mandato editorial aprobado.')
      const contents =
        cmd.type === 'approveContent'
          ? [data.contents[cmd.id]]
          : Object.values(data.contents).filter(
              (v) => v.packageId === cmd.packageId && v.mode === 'weekly'
            )
      if (!contents.length || contents.some((v) => !v))
        throw new Error('No hay contenidos en este paquete.')
      if (
        contents.some(
          (v) => !data.cases[v.caseId] || !canRead(data.cases[v.caseId], actor)
        )
      )
        throw new Error('El paquete incluye un expediente sin acceso.')
      for (const content of contents) {
        if (
          Object.values(data.decisions).some(
            (d) => d.caseId === content.caseId && isDecisionPending(d)
          )
        )
          throw new Error(
            'Resuelve las decisiones pendientes antes de aprobar el contenido.'
          )
        const strategy = data.campaigns[content.caseId]
        if (!campaignIsApproved(strategy))
          throw new Error(
            'Todos los expedientes del paquete necesitan su estrategia aprobada.'
          )
        if (content.mode === 'weekly') {
          const start = new Date(content.packageId ?? '')
          const scheduled = new Date(content.scheduledAt)
          const difference = (scheduled.getTime() - start.getTime()) / 86400000
          if (!Number.isFinite(difference) || difference < 0 || difference >= 7)
            throw new Error(
              'La fecha propuesta debe estar dentro de los siete días del paquete aprobado.'
            )
        }
        if (
          !content.copy.trim() ||
          !content.brief.trim() ||
          !content.channel.trim() ||
          !content.scheduledAt ||
          !content.assetUrl
        )
          throw new Error(
            'Completa copy, brief, canal, fecha y activo antes de aprobar.'
          )
        content.status = 'approved'
        content.approvedVersion = content.version
        content.approvedCampaignVersion = data.campaigns[content.caseId].version
      }
      break
    }
    case 'linkIndicator': {
      const indicator = data.indicators[cmd.indicatorId]
      if (!indicator) throw new Error('Indicador inexistente.')
      if (indicator.period !== cmd.period)
        throw new Error(
          'No hay regla configurada para este período del indicador.'
        )
      if (
        !Number.isFinite(cmd.value) ||
        cmd.value <= 0 ||
        !Number.isInteger(cmd.period)
      )
        throw new Error('Aporte o período inválido.')
      if (
        !cmd.rule.trim() ||
        !cmd.evidenceIds.length ||
        cmd.evidenceIds.some(
          (id) =>
            data.evidences[id]?.caseId !== caseId ||
            !data.evidences[id]?.verified
        )
      )
        throw new Error('Vincula regla y evidencias revisadas del expediente.')
      if (cmd.validate && (indicator.id !== '4.2.5' || !eligible(data, caseId)))
        throw new Error(
          'Falta regla institucional disponible o expediente elegible.'
        )
      if (
        cmd.validate &&
        cmd.indicatorId === '4.2.5' &&
        (c.kind !== 'presence' || cmd.value !== 1)
      )
        throw new Error('4.2.5 admite una presencia validada por expediente.')
      if (cmd.period !== Number((c.fields.startsAt?.value ?? '').slice(0, 4)))
        throw new Error('El período debe corresponder a la fecha del registro.')
      const existing = data.indicatorLinks[cmd.id]
      if (existing && existing.caseId !== caseId)
        throw new Error('La relación pertenece a otro expediente.')
      if (
        Object.values(data.indicatorLinks).some(
          (l) =>
            l.id !== cmd.id &&
            l.caseId === caseId &&
            l.indicatorId === cmd.indicatorId &&
            l.period === cmd.period
        )
      )
        throw new Error(
          'La relación de este expediente, indicador y período ya existe.'
        )
      data.indicatorLinks[cmd.id] = {
        id: cmd.id,
        caseId,
        indicatorId: cmd.indicatorId,
        period: cmd.period,
        value: cmd.value,
        rule: cmd.rule,
        evidenceIds: cmd.evidenceIds,
        status: cmd.validate ? 'validated' : 'pending',
        actor,
        version: (existing?.version ?? 0) + 1,
      }
      break
    }
    case 'createCut': {
      if (!cmd.name.trim() || !cmd.period.trim() || !cmd.caseIds.length)
        throw new Error('Define nombre, período y registros del corte.')
      if (
        cmd.caseIds.some(
          (id) =>
            !data.cases[id] ||
            !canRead(data.cases[id], actor) ||
            !eligible(data, id)
        )
      )
        throw new Error('Solo registros elegibles pueden ingresar al corte.')
      data.cuts[cmd.id] = {
        id: cmd.id,
        name: cmd.name,
        period: cmd.period,
        caseIds: [...new Set(cmd.caseIds)],
        status: 'draft',
        version: 1,
        observations: [],
        response: '',
      }
      break
    }
    case 'addObservation': {
      const cut = data.cuts[cmd.cutId]
      if (!cut || !cut.caseIds.includes(caseId))
        throw new Error('El expediente no pertenece al corte.')
      if (!cmd.text.trim() || !cmd.responsible.trim())
        throw new Error('Completa observación y responsable.')
      cut.observations.push({
        id: cmd.id,
        caseId,
        text: cmd.text,
        category: cmd.category,
        responsible: cmd.responsible,
        status: 'open',
        resolution: '',
      })
      cut.status = 'review'
      cut.version++
      invalidate()
      c.institutionalValidation = 'observed'
      break
    }
    case 'resolveObservation': {
      const cut = data.cuts[cmd.cutId]
      const observation = cut?.observations.find(
        (o) => o.id === cmd.id && o.caseId === caseId
      )
      if (!observation || !cmd.resolution.trim())
        throw new Error('Registra el fundamento y la evidencia de resolución.')
      observation.status = 'resolved'
      observation.resolution = cmd.resolution
      cut.version++
      break
    }
    case 'transitionCut': {
      const cut = data.cuts[cmd.cutId]
      if (!cut) throw new Error('Corte inexistente.')
      const transitions: Record<string, string[]> = {
        draft: ['review'],
        review: ['ready'],
        ready: ['review', 'closed'],
        closed: [],
      }
      if (!transitions[cut.status].includes(cmd.status))
        throw new Error('Transición de corte no permitida.')
      if (
        ['ready', 'closed'].includes(cmd.status) &&
        (cut.observations.some((o) => o.status === 'open') ||
          cut.caseIds.some((id) => !eligible(data, id)))
      )
        throw new Error('Resuelve observaciones y QA de todos los registros.')
      if (cmd.status === 'closed' && !cmd.response.trim())
        throw new Error(
          'Registra la respuesta institucional recibida; no se enviará automáticamente.'
        )
      cut.status = cmd.status
      cut.response = cmd.response
      cut.version++
      if (cmd.status === 'closed')
        for (const id of cut.caseIds)
          data.cases[id].institutionalValidation = 'validated'
      break
    }
    default:
      throw new Error('Comando no permitido en el expediente.')
  }
  if (c && cmd.type !== 'createCase') {
    c.version++
    c.updatedAt = at
  }
  const correlationId = crypto.randomUUID()
  for (const affected of affectedCases.filter((id) => id && id !== caseId)) {
    data.cases[affected].version++
    data.cases[affected].updatedAt = at
    data.audit.push({
      id: crypto.randomUUID(),
      caseId: affected,
      at,
      actor,
      action: cmd.type,
      reason,
      ...auditDelta(
        packageBefore[affected],
        structuredClone(auditState(data, affected))
      ),
      ruleVersion: RULE_VERSION,
      correlationId,
    })
  }
  data.audit.push({
    id: crypto.randomUUID(),
    caseId,
    at,
    actor,
    action: cmd.type,
    reason,
    ...auditDelta(
      before,
      caseId
        ? structuredClone(auditState(data, caseId))
        : structuredClone(data.cuts)
    ),
    ruleVersion: RULE_VERSION,
    correlationId,
  })
  return data
}
