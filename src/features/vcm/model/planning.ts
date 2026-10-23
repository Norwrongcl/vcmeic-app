import type { AppData } from '@/features/core/model/types'
import { RULE_VERSION } from './catalogs'
import { validDate } from './dates'
import { isDecisionPending } from './decisions'
import type { AnnualPlan, PlanningCommand } from './planning-types'
import type { Actor, Command, VcmData } from './types'
import { canRead, eligible } from './workflow'

export const PLAN_STATES = {
  draft: 'Borrador',
  review: 'Revisión de Jefatura',
  sanctioned: 'Sancionado por Jefatura',
  approved: 'Aprobado por Dirección',
}
export function isPlanningCommand(cmd: Command): cmd is PlanningCommand {
  return [
    'savePlan',
    'transitionPlan',
    'saveTriage',
    'saveCommitment',
    'saveForecast',
  ].includes(cmd.type)
}
const government = (actor: Actor) =>
  ['coordination', 'leadership', 'direction'].includes(actor.role)
function money(value: number, zero = false) {
  if (!Number.isSafeInteger(value) || value < (zero ? 0 : 1))
    throw new Error('Introduce un monto entero válido en CLP.')
}
export function applyPlanningCommand(
  app: AppData,
  cmd: PlanningCommand,
  actor: Actor,
  at = new Date().toISOString()
): VcmData {
  const data = structuredClone(app.vcm!)
  if (
    !government(actor) ||
    (actor.role === 'direction' && cmd.type !== 'transitionPlan')
  )
    throw new Error(
      'Acción reservada a Coordinación o Jefatura; Dirección resuelve el plan.'
    )
  if (!cmd.reason.trim())
    throw new Error('Registra el fundamento y la fuente de esta actualización.')
  const caseId = 'caseId' in cmd ? cmd.caseId : ''
  const c = data.cases[caseId]
  if (caseId && (!c || !canRead(c, actor)))
    throw new Error('Expediente no disponible.')
  const before = structuredClone(data)
  if (cmd.type === 'savePlan') {
    if (
      !cmd.title.trim() ||
      !Number.isInteger(cmd.year) ||
      cmd.year < 2000 ||
      cmd.year > 2100 ||
      !cmd.objectives.length
    )
      throw new Error('Completa título, año y al menos un objetivo.')
    if (
      Object.values(data.plans).some(
        (p) => p.id !== cmd.id && p.year === cmd.year
      )
    )
      throw new Error(
        'Ya existe un plan para ese año; modifica la versión existente.'
      )
    if (new Set(cmd.objectives.map((o) => o.id)).size !== cmd.objectives.length)
      throw new Error('Los objetivos deben tener identificadores distintos.')
    for (const o of cmd.objectives) {
      if (
        !o.id.trim() ||
        !o.title.trim() ||
        !o.responsible.trim() ||
        !Number.isSafeInteger(o.target) ||
        o.target < 1 ||
        !['completed', 'validated'].includes(o.measure) ||
        !validDate(o.dueDate) ||
        Number(o.dueDate.slice(0, 4)) !== cmd.year
      )
        throw new Error(
          'Cada objetivo requiere nombre, responsable, meta positiva y fecha del año del plan.'
        )
      if (
        !o.caseIds.length ||
        new Set(o.caseIds).size !== o.caseIds.length ||
        o.caseIds.some(
          (id) => !data.cases[id] || !canRead(data.cases[id], actor)
        )
      )
        throw new Error(
          'Vincula expedientes existentes, visibles y sin duplicados.'
        )
    }
    const old = data.plans[cmd.id]
    data.plans[cmd.id] = {
      id: cmd.id,
      year: cmd.year,
      title: cmd.title.trim(),
      objectives: structuredClone(cmd.objectives),
      status: 'draft',
      version: (old?.version ?? 0) + 1,
      approvedVersion: null,
      reason: cmd.reason,
      actor,
      updatedAt: at,
    }
  } else if (cmd.type === 'transitionPlan') {
    const p = data.plans[cmd.id]
    if (!p) throw new Error('Plan inexistente.')
    const allowed: Record<AnnualPlan['status'], AnnualPlan['status'][]> = {
      draft: ['review'],
      review: ['draft', 'sanctioned'],
      sanctioned: ['draft', 'approved'],
      approved: ['draft'],
    }
    if (!allowed[p.status].includes(cmd.status))
      throw new Error('Transición no permitida para el plan.')
    if (cmd.status === 'sanctioned' && actor.role !== 'leadership')
      throw new Error('Jefatura debe sancionar la propuesta.')
    if (cmd.status === 'approved' && actor.role !== 'direction')
      throw new Error('Dirección debe aprobar las prioridades del plan.')
    if (
      actor.role === 'direction' &&
      !['approved', 'draft'].includes(cmd.status)
    )
      throw new Error('Dirección aprueba o devuelve para ajuste.')
    if (
      p.objectives.some((o) =>
        o.caseIds.some(
          (id) => !data.cases[id] || !canRead(data.cases[id], actor)
        )
      )
    )
      throw new Error('Revisa los expedientes vinculados antes de continuar.')
    p.status = cmd.status
    p.approvedVersion = cmd.status === 'approved' ? p.version : null
    p.actor = actor
    p.reason = cmd.reason
    p.updatedAt = at
  } else if (cmd.type === 'saveTriage') {
    const levels = ['pending', 'low', 'medium', 'high']
    if (!levels.includes(cmd.pertinence) || !levels.includes(cmd.urgency))
      throw new Error('Selecciona pertinencia y urgencia válidas.')
    data.triage[caseId] = {
      caseId,
      pertinence: cmd.pertinence,
      urgency: cmd.urgency,
      reason: cmd.reason,
      version: (data.triage[caseId]?.version ?? 0) + 1,
      actor,
      at,
    }
  } else {
    if (!c.projectId)
      throw new Error('Activa el proyecto antes de registrar finanzas.')
    const projectId = c.projectId
    if (
      Object.values(data.cases).some(
        (d) => d.projectId === projectId && !canRead(d, actor)
      )
    )
      throw new Error('El proyecto comparte expedientes no autorizados.')
    if (cmd.type === 'saveForecast') {
      money(cmd.remaining, true)
      data.forecasts[projectId] = {
        basis: financialBasis(app, projectId),
        projectId,
        remaining: cmd.remaining,
        reason: cmd.reason,
        version: (data.forecasts[projectId]?.version ?? 0) + 1,
        actor,
        at,
      }
    } else {
      money(cmd.amount)
      if (
        !cmd.title.trim() ||
        !cmd.reference.trim() ||
        !['active', 'cancelled'].includes(cmd.status)
      )
        throw new Error(
          'Completa compromiso y referencia de autorización humana.'
        )
      const old = data.commitments[cmd.id]
      if (old && old.projectId !== projectId)
        throw new Error('El compromiso pertenece a otro proyecto.')
      const decision = data.decisions[cmd.decisionId]
      if (
        cmd.status === 'active' &&
        (!decision ||
          decision.kind !== 'budget' ||
          decision.status !== 'approved' ||
          decision.decidedBy?.role !== 'direction' ||
          data.cases[decision.caseId]?.projectId !== projectId)
      )
        throw new Error(
          'Vincula una decisión presupuestaria aprobada por Dirección para este proyecto.'
        )
      if (!decision) throw new Error('Decisión inexistente.')
      if (
        new Set(cmd.expenseIds).size !== cmd.expenseIds.length ||
        cmd.expenseIds.some(
          (id) => !app.expenses[id] || app.expenses[id].eventId !== projectId
        )
      )
        throw new Error(
          'Vincula gastos existentes del mismo proyecto, sin duplicados.'
        )
      if (
        cmd.status === 'active' &&
        Object.values(data.commitments).some(
          (other) =>
            other.id !== cmd.id &&
            other.status === 'active' &&
            cmd.expenseIds.some((id) => other.expenseIds.includes(id))
        )
      )
        throw new Error(
          'Un gasto ya está conciliado con otro compromiso activo.'
        )
      data.commitments[cmd.id] = {
        id: cmd.id,
        caseId,
        projectId,
        title: cmd.title.trim(),
        amount: cmd.amount,
        expenseIds: cmd.expenseIds,
        decisionId: cmd.decisionId,
        decisionVersion: decision.version,
        reference: cmd.reference,
        status: cmd.status,
        reason: cmd.reason,
        version: (old?.version ?? 0) + 1,
        actor,
        at,
      }
    }
  }
  const linked =
    caseId &&
    c?.projectId &&
    ['saveCommitment', 'saveForecast'].includes(cmd.type)
      ? Object.values(data.cases)
          .filter((d) => d.projectId === c.projectId)
          .map((d) => d.id)
      : [caseId]
  const correlationId = crypto.randomUUID()
  for (const id of linked) {
    if (id) {
      data.cases[id].version++
      data.cases[id].updatedAt = at
    }
    const old =
      cmd.type === 'savePlan' || cmd.type === 'transitionPlan'
        ? (before.plans[cmd.id] ?? null)
        : cmd.type === 'saveTriage'
          ? (before.triage[caseId] ?? null)
          : cmd.type === 'saveForecast'
            ? (before.forecasts[c.projectId!] ?? null)
            : (before.commitments[cmd.id] ?? null)
    const next =
      cmd.type === 'savePlan' || cmd.type === 'transitionPlan'
        ? data.plans[cmd.id]
        : cmd.type === 'saveTriage'
          ? data.triage[caseId]
          : cmd.type === 'saveForecast'
            ? data.forecasts[c.projectId!]
            : data.commitments[cmd.id]
    data.audit.push({
      id: crypto.randomUUID(),
      caseId: id,
      at,
      actor,
      action: cmd.type,
      reason: cmd.reason,
      before: old,
      after: structuredClone(next),
      ruleVersion: RULE_VERSION,
      correlationId,
    })
  }
  return data
}

export function sortedPriorities(data: VcmData, actor: Actor) {
  const rank = { high: 0, medium: 1, low: 2, pending: 3 }
  return Object.values(data.cases)
    .filter(
      (c) =>
        canRead(c, actor) &&
        c.state !== 'closed' &&
        c.executionState !== 'cancelled'
    )
    .sort(
      (a, b) =>
        rank[a.priority] - rank[b.priority] ||
        rank[data.triage[a.id]?.pertinence ?? 'pending'] -
          rank[data.triage[b.id]?.pertinence ?? 'pending'] ||
        rank[data.triage[a.id]?.urgency ?? 'pending'] -
          rank[data.triage[b.id]?.urgency ?? 'pending'] ||
        (a.fields.endsAt?.value || '9999').localeCompare(
          b.fields.endsAt?.value || '9999'
        )
    )
}
export function planProgress(app: AppData, actor: Actor, year: number) {
  const data = app.vcm!
  if (!government(actor)) return []
  return Object.values(data.plans)
    .filter(
      (p) =>
        p.year === year &&
        p.objectives.every((o) =>
          o.caseIds.every(
            (id) => data.cases[id] && canRead(data.cases[id], actor)
          )
        )
    )
    .map((p) => ({
      ...p,
      objectives: p.objectives.map((o) => {
        const cases = o.caseIds.map((id) => data.cases[id])
        const completed = cases.filter(
          (c) => c.executionState === 'completed'
        ).length
        const validated = cases.filter((c) => eligible(data, c.id)).length
        const progress = o.measure === 'completed' ? completed : validated
        const projects = new Set(cases.map((c) => c.projectId).filter(Boolean))
        const milestones = Object.values(app.tasks).filter(
          (t) => t.kind === 'milestone' && t.eventId && projects.has(t.eventId)
        )
        return {
          ...o,
          completed,
          validated,
          progress,
          gap: Math.max(0, o.target - progress),
          milestones,
        }
      }),
    }))
}
export function financialBasis(app: AppData, projectId: string) {
  return JSON.stringify({
    expenses: Object.values(app.expenses)
      .filter((e) => e.eventId === projectId)
      .map((e) => [e.id, e.amount, e.budgetItemId])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    commitments: Object.values(app.vcm!.commitments)
      .filter((c) => c.projectId === projectId)
      .map((c) => [c.id, c.version])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  })
}
/** Gross commitments are informative. Only their unpaid portion is added to spending. */
export function projectFinance(app: AppData, projectId: string) {
  const data = app.vcm!
  const cases = Object.values(data.cases).filter(
    (c) => c.projectId === projectId
  )
  const ids = new Set(cases.map((c) => c.id))
  const expenses = Object.values(app.expenses).filter(
    (e) => e.eventId === projectId
  )
  const decisions = Object.values(data.decisions).filter(
    (d) => ids.has(d.caseId) && d.kind === 'budget'
  )
  const approved = decisions
    .filter((d) => d.status === 'approved' && d.decidedBy?.role === 'direction')
    .reduce((n, d) => n + (d.amount ?? 0), 0)
  const commitments = Object.values(data.commitments).filter(
    (c) => c.projectId === projectId && c.status === 'active'
  )
  const issues: string[] = []
  const allocated = new Set<string>()
  let outstanding = 0
  for (const c of commitments) {
    const decision = data.decisions[c.decisionId]
    if (
      !decision ||
      decision.status !== 'approved' ||
      decision.version !== c.decisionVersion
    )
      issues.push(`Revisar autorización de ${c.title}.`)
    let paid = 0
    for (const id of c.expenseIds) {
      const expense = app.expenses[id]
      if (!expense || expense.eventId !== projectId) {
        issues.push(`Reconciliar gasto de ${c.title}.`)
        continue
      }
      if (allocated.has(id)) {
        issues.push('Gasto asignado a más de un compromiso.')
        continue
      }
      allocated.add(id)
      paid += expense.amount
    }
    if (paid > c.amount)
      issues.push(`Los pagos de ${c.title} superan el compromiso.`)
    outstanding += Math.max(0, c.amount - paid)
  }
  const planned = Object.values(app.budgetItems)
    .filter((b) => b.eventId === projectId)
    .reduce((n, b) => n + b.plannedAmount, 0)
  const spent = expenses.reduce((n, e) => n + e.amount, 0)
  const forecast = data.forecasts[projectId]
  const forecastCurrent =
    !!forecast && forecast.basis === financialBasis(app, projectId)
  if (forecast && !forecastCurrent)
    issues.push(
      'Actualiza la estimación de cierre: cambiaron gastos o compromisos.'
    )
  const projected = forecastCurrent
    ? spent + outstanding + forecast.remaining
    : null
  const hasFunding = decisions.some(
    (d) => d.status === 'approved' && d.decidedBy?.role === 'direction'
  )
  const balance = hasFunding ? approved - spent - outstanding : null
  if (balance !== null && balance < 0)
    issues.push(
      'Gastos y compromisos pendientes superan el financiamiento aprobado.'
    )
  return {
    projectId,
    planned,
    spent,
    approved,
    requested: decisions
      .filter((d) => isDecisionPending(d))
      .reduce((n, d) => n + (d.amount ?? 0), 0),
    committed: commitments.reduce((n, c) => n + c.amount, 0),
    outstanding,
    balance,
    projected,
    deviation: projected === null || !hasFunding ? null : projected - approved,
    forecast,
    forecastCurrent,
    issues,
    hasFunding,
    commitments,
  }
}
