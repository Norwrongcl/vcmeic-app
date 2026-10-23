import type { Decision, Role } from './types'

export const DECISION_LABELS = {
  pending: 'Propuesta',
  coordination_review: 'En revisión de Coordinación',
  leadership_review: 'En revisión de Jefatura',
  direction_required: 'Requiere Dirección',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  returned: 'Devuelta para ajuste',
  postponed: 'Postergada',
  in_execution: 'En ejecución',
  closed: 'Cerrada',
  escalated: 'Escalada a Jefatura',
}
export function decisionAuthority(
  d: Pick<Decision, 'kind' | 'status' | 'authority'>
): 'coordination' | 'leadership' | 'direction' {
  if (
    d.kind === 'budget' ||
    d.status === 'direction_required' ||
    d.authority === 'direction'
  )
    return 'direction'
  if (
    d.status === 'escalated' ||
    d.status === 'leadership_review' ||
    d.authority === 'leadership'
  )
    return 'leadership'
  return 'coordination'
}
export function isDecisionPending(d: Pick<Decision, 'status'>) {
  return [
    'pending',
    'coordination_review',
    'leadership_review',
    'direction_required',
    'escalated',
    'returned',
    'postponed',
  ].includes(d.status)
}
export function decisionOptions(
  d: Pick<Decision, 'kind' | 'status' | 'authority'>,
  role: Role
): Decision['status'][] {
  if (!['coordination', 'leadership', 'direction'].includes(role)) return []
  const authority = decisionAuthority(d)
  if (role === 'direction' && authority !== 'direction') return []
  if (['rejected', 'returned', 'postponed'].includes(d.status))
    return role === 'direction' ? [] : ['pending']
  if (d.status === 'closed') return []
  if (d.status === 'approved')
    return d.kind === 'budget'
      ? ['returned']
      : role === 'direction'
        ? ['returned']
        : ['in_execution', 'closed', 'returned']
  if (d.status === 'in_execution')
    return role === 'direction' ? [] : ['closed', 'returned', 'escalated']
  const canResolve =
    role === authority ||
    (authority === 'coordination' && role === 'leadership')
  const options: Decision['status'][] = []
  if (canResolve) options.push('approved', 'rejected', 'returned', 'postponed')
  else if (
    role === 'coordination' &&
    ['escalated', 'leadership_review', 'direction_required'].includes(d.status)
  )
    return []
  else options.push('returned')
  if (role !== 'direction') {
    if (d.status !== 'coordination_review' && authority === 'coordination')
      options.push('coordination_review')
    if (!['escalated', 'leadership_review'].includes(d.status))
      options.push('escalated', 'leadership_review')
    if (
      d.status !== 'direction_required' &&
      (role === 'leadership' || authority === 'direction')
    )
      options.push('direction_required')
  }
  return [...new Set(options)]
}
