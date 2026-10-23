import type { AppData } from '@/features/core/model/types'
import { isDecisionPending } from './decisions'
import { planProgress, projectFinance } from './planning'
import type { Actor } from './types'
import { canRead, eligible, getIndicatorValue, getQaIssues } from './workflow'

/** PO 27.3.1–3 / K.9–12: derived views, never a second source of records. */
export function buildDashboard(
  app: AppData,
  actor: Actor,
  now = new Date(),
  selectedYear?: number
) {
  const data = app.vcm!
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const year = selectedYear ?? Number(today.slice(0, 4))
  const cases = Object.values(data.cases).filter(
    (c) =>
      canRead(c, actor) &&
      (selectedYear === undefined ||
        Number(c.fields.startsAt?.value.slice(0, 4)) === selectedYear)
  )
  const ids = new Set(cases.map((c) => c.id))
  const projects = new Set(
    cases.map((c) => c.projectId).filter((id): id is string => !!id)
  )
  const pendingTasks = Object.values(app.tasks).filter(
    (t) =>
      t.eventId &&
      projects.has(t.eventId) &&
      !['done', 'cancelled'].includes(t.status)
  )
  const decisions = Object.values(data.decisions).filter((d) =>
    ids.has(d.caseId)
  )
  const budgets = [...projects]
    .filter(
      (id) =>
        !Object.values(data.cases).some(
          (c) => c.projectId === id && !canRead(c, actor)
        )
    )
    .map((id) => projectFinance(app, id))
  const financial = decisions.filter(
    (d) => d.kind === 'budget' && d.amount !== null
  )
  const finance = {
    planned: budgets.reduce((n, b) => n + b.planned, 0),
    spent: budgets.reduce((n, b) => n + b.spent, 0),
    requested: financial
      .filter((d) => isDecisionPending(d))
      .reduce((n, d) => n + (d.amount ?? 0), 0),
    approved: financial
      .filter(
        (d) => d.status === 'approved' && d.decidedBy?.role === 'direction'
      )
      .reduce((n, d) => n + (d.amount ?? 0), 0),
    hasBudget: budgets.some((b) => b.planned > 0 || b.spent > 0),
    hasDecisions: financial.length > 0,
    overBudget: budgets.filter((b) => b.spent > b.planned).length,
    committed: budgets.reduce((n, b) => n + b.committed, 0),
    outstanding: budgets.reduce((n, b) => n + b.outstanding, 0),
    balance:
      budgets.length && budgets.every((b) => b.balance !== null)
        ? budgets.reduce((n, b) => n + b.balance!, 0)
        : null,
    projected:
      budgets.length && budgets.every((b) => b.projected !== null)
        ? budgets.reduce((n, b) => n + b.projected!, 0)
        : null,
    deviation:
      budgets.length && budgets.every((b) => b.deviation !== null)
        ? budgets.reduce((n, b) => n + b.deviation!, 0)
        : null,
    issues: budgets.flatMap((b) => b.issues),
    projects: budgets,
    missingForecasts: budgets.filter((b) => !b.forecastCurrent).length,
    unassignedDecisions: financial.filter(
      (d) => !data.cases[d.caseId]?.projectId
    ).length,
  }
  const active = cases.filter(
    (c) => c.state !== 'closed' && c.executionState !== 'cancelled'
  )
  const upcoming = active
    .filter((c) => c.fields.startsAt?.value.slice(0, 10) >= today)
    .sort((a, b) =>
      a.fields.startsAt.value.localeCompare(b.fields.startsAt.value)
    )
  const overdue = active.filter(
    (c) => c.fields.endsAt?.value && c.fields.endsAt.value.slice(0, 10) < today
  )
  const visibleData = {
    ...data,
    cases: Object.fromEntries(cases.map((c) => [c.id, c])),
  }
  const indicators = Object.values(data.indicators)
    .filter((i) => i.period === year)
    .map((i) => {
      const value = getIndicatorValue(visibleData, i.id, i.period)
      return {
        ...i,
        value,
        gap: i.target === null ? null : Math.max(0, i.target - value),
      }
    })
  const agreementIds = new Set(cases.flatMap((c) => c.agreementIds))
  // Master entities have no confidentiality field yet: restricted roles see only related ones.
  const government = ['coordination', 'leadership', 'direction'].includes(
    actor.role
  )
  const agreements = Object.values(app.agreements)
    .filter((a) => government || agreementIds.has(a.id))
    .map((a) => ({
      ...a,
      status: a.cancelled
        ? 'Cancelado'
        : a.startsAt > today
          ? 'Próximo'
          : a.endsAt && a.endsAt < today
            ? 'Vencido'
            : 'Vigente',
    }))
    .sort((a, b) => (a.endsAt ?? '9999').localeCompare(b.endsAt ?? '9999'))
  const portfolios = [
    ...new Set(cases.map((c) => c.portfolio || 'Sin asignar')),
  ].map((name) => {
    const records = cases.filter((c) => (c.portfolio || 'Sin asignar') === name)
    return {
      name,
      total: records.length,
      completed: records.filter((c) => c.executionState === 'completed').length,
      validated: records.filter((c) => eligible(data, c.id)).length,
    }
  })
  return {
    plans: planProgress(app, actor, year),
    today,
    year,
    cases,
    finance,
    upcoming,
    overdue,
    indicators,
    agreements,
    portfolios,
    pendingTasks,
    pendingDecisions: decisions.filter((d) => isDecisionPending(d)),
    campaigns: Object.values(data.campaigns).filter((c) => ids.has(c.caseId)),
    contents: Object.values(data.contents).filter((c) => ids.has(c.caseId)),
    observations: Object.values(data.cuts)
      .flatMap((c) => c.observations)
      .filter((o) => ids.has(o.caseId) && o.status === 'open'),
    conflicts: cases.filter((c) =>
      Object.values(c.fields).some((f) => f.status === 'conflict')
    ),
    quality: cases
      .map((c) => ({ dossier: c, issues: getQaIssues(data, c.id) }))
      .filter((c) => c.issues.length),
  }
}
