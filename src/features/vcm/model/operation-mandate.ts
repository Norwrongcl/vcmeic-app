import type { AppData } from '@/features/core/model/types'
import { validRecordDate } from './dates'
import type { VcmData } from './types'

export const OPERATION_FIELDS = [
  ['objective', 'Propósito del proyecto'],
  ['resultsPlanned', 'Resultado y entregables esperados'],
  ['scopeIncluded', 'Alcance incluido'],
  ['scopeExcluded', 'Alcance excluido'],
  ['closingCriteria', 'Criterios de cierre operativo'],
  ['expectedEvidence', 'Evidencias esperadas'],
  ['risks', 'Riesgos y restricciones'],
] as const
export function operationScope(data: VcmData, projectId: string) {
  return JSON.stringify(
    Object.values(data.cases)
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        responsible: c.responsible,
        organizations: [...c.organizationIds].sort(),
        agreements: [...c.agreementIds].sort(),
        fields: Object.fromEntries(
          [
            'description',
            'startsAt',
            'endsAt',
            ...OPERATION_FIELDS.map((f) => f[0]),
          ].map((id) => [id, c.fields[id]?.value ?? ''])
        ),
      }))
  )
}
export function budgetScope(app: AppData, projectId: string) {
  return JSON.stringify(
    Object.values(app.budgetItems)
      .filter((b) => b.eventId === projectId)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((b) => [b.id, b.name, b.plannedAmount])
  )
}
export function operationPlanIssues(data: VcmData, caseId: string) {
  const c = data.cases[caseId]
  if (!c?.projectId) return ['Activa el proyecto operativo.']
  const dateIssues = ['startsAt', 'endsAt'].some(
    (id) => !validRecordDate(c.fields[id]?.value ?? '')
  )
    ? ['Completa fechas válidas del proyecto.']
    : []
  if (c.fields.startsAt?.value > c.fields.endsAt?.value)
    dateIssues.push('Revisa el orden de las fechas del proyecto.')
  if (['startsAt', 'endsAt'].some((id) => c.fields[id]?.status === 'conflict'))
    dateIssues.push('Resuelve los conflictos de fechas del proyecto.')
  return [
    ...dateIssues,
    ...OPERATION_FIELDS.filter(
      ([id]) =>
        !c.fields[id]?.value.trim() || c.fields[id]?.status === 'conflict'
    ).map(([, label]) => `Completa o resuelve ${label}.`),
  ]
}
export function hasApprovedOperationScope(data: VcmData, caseId: string) {
  const c = data.cases[caseId]
  return (
    !!c?.projectId &&
    Object.values(data.decisions).some(
      (d) =>
        d.kind === 'flow' &&
        ['approved', 'in_execution', 'closed'].includes(d.status) &&
        data.cases[d.caseId]?.projectId === c.projectId &&
        d.approvedScope === operationScope(data, c.projectId!) &&
        !operationPlanIssues(data, caseId).length
    )
  )
}
export function hasOperationalMandate(app: AppData, caseId: string) {
  const data = app.vcm!,
    c = data.cases[caseId]
  return (
    hasApprovedOperationScope(data, caseId) &&
    Object.values(data.decisions).some(
      (d) =>
        d.kind === 'flow' &&
        ['approved', 'in_execution', 'closed'].includes(d.status) &&
        data.cases[d.caseId]?.projectId === c.projectId &&
        d.approvedScope === operationScope(data, c.projectId!) &&
        d.budgetBasis === budgetScope(app, c.projectId!)
    )
  )
}
