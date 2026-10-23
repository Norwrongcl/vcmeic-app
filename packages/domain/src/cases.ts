export interface QaField {
  fieldId: string
  status: string
  value: unknown
}
export interface QaInput {
  kind: string
  fields: QaField[]
  evidenceVerified: boolean
  presenceValid: boolean
  decisionsPending: boolean
  openObservations: boolean
  executionCompleted: boolean
  mandateValid: boolean
  hasProject: boolean
  closing: boolean
}
// Required-field and closure rules extracted from the prototype workflow; no browser/store dependency.
export function evaluateCaseQa(input: QaInput): string[] {
  const required = [
    'name',
    'responsible',
    'startsAt',
    'endsAt',
    'description',
    ...(input.kind === 'presence'
      ? ['executingUnit', 'reach', 'externalOrganization']
      : ['objective', 'format', 'activityType', 'actionLine']),
  ]
  if (input.closing && input.kind !== 'presence')
    required.push('resultsActual', 'externalPublicActual', 'internalActual')
  const present = (value: unknown) =>
    value !== null &&
    value !== undefined &&
    (typeof value !== 'string' || value.trim().length > 0)
  const issues = required
    .filter((key) => {
      const f = input.fields.find((f) => f.fieldId === key)
      return !f || f.status !== 'confirmed' || !present(f.value)
    })
    .map((k) => 'Confirmar ' + k + '.')
  if (input.kind === 'presence' && !input.presenceValid)
    issues.push('Seleccionar una tipología válida de Presencia.')
  if (!input.evidenceVerified)
    issues.push('Falta evidencia revisada por Coordinación.')
  if (input.fields.some((f) => f.status === 'conflict'))
    issues.push('Resolver los conflictos de fuentes.')
  const start = input.fields.find((f) => f.fieldId === 'startsAt')?.value,
    end = input.fields.find((f) => f.fieldId === 'endsAt')?.value
  if (typeof start === 'string' && typeof end === 'string' && start > end)
    issues.push('La fecha de cierre debe ser posterior o igual al inicio.')
  if (input.decisionsPending)
    issues.push('Hay decisiones pendientes o en ejecución.')
  if (input.openObservations)
    issues.push('Resolver las observaciones institucionales abiertas.')
  if (
    input.closing &&
    input.hasProject &&
    (!input.executionCompleted || !input.mandateValid)
  )
    issues.push('Completar el proyecto con un mandato aprobado y vigente.')
  return issues
}
