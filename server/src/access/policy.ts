import type {
  TransactionContext,
  PrincipalContext,
  Role,
} from '../contracts/common.ts'
import { ApiError } from '../http/errors.ts'
import { visibilityPredicate } from './visibility.ts'
export const actions: Record<
  string,
  { roles: Role[]; scopes: string[]; permission: 'read' | 'write' | 'review' }
> = {
  reviewAnnualPlan: {
    roles: ['coordination', 'leadership', 'direction'],
    scopes: [],
    permission: 'review',
  },
  resolveDecision: {
    roles: ['coordination', 'leadership', 'direction'],
    scopes: [],
    permission: 'review',
  },
  query: {
    roles: [
      'coordination',
      'leadership',
      'direction',
      'responsible',
      'designer',
      'technician',
      'viewer',
    ],
    scopes: ['coordination:read', 'interview:read'],
    permission: 'read',
  },
  captureAntecedent: {
    roles: ['coordination', 'leadership', 'responsible'],
    scopes: ['coordination:write', 'interview:capture'],
    permission: 'write',
  },
  editOperationalDraft: {
    roles: ['coordination', 'leadership'],
    scopes: ['coordination:write'],
    permission: 'write',
  },
  resolveConflict: {
    roles: ['coordination', 'leadership'],
    scopes: [],
    permission: 'review',
  },
  approveStrategyOrContent: {
    roles: ['coordination', 'leadership'],
    scopes: [],
    permission: 'review',
  },
  approveBudget: { roles: ['direction'], scopes: [], permission: 'review' },
  validateInstitutional: {
    roles: ['coordination', 'leadership'],
    scopes: [],
    permission: 'review',
  },
  executeMandate: {
    roles: ['coordination', 'leadership'],
    scopes: ['coordination:execute'],
    permission: 'write',
  },
  archiveDraft: {
    roles: ['coordination', 'leadership'],
    scopes: ['coordination:write'],
    permission: 'write',
  },
}
export async function currentPrincipal(
  tx: TransactionContext,
): Promise<PrincipalContext> {
  const p = tx.principal
  const r = await tx.client.query(
    'SELECT kind,permissions_version,active FROM vcm.principals WHERE id=$1',
    [p.id],
  )
  const row = r.rows[0]
  if (!row?.active || row.kind !== p.kind)
    throw new ApiError(
      401,
      'UNAUTHENTICATED',
      'La identidad ya no está activa.',
    )
  if (p.kind === 'service') {
    const s = await tx.client.query(
      'SELECT scopes FROM vcm.service_credentials WHERE id=$1 AND principal_id=$2 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now())',
      [p.credentialId, p.id],
    )
    if (!s.rows[0])
      throw new ApiError(
        401,
        'UNAUTHENTICATED',
        'La credencial ya no está vigente.',
      )
    return {
      ...p,
      roles: [],
      scopes: s.rows[0].scopes,
      permissionsVersion: row.permissions_version,
    }
  }
  if (p.sessionId) {
    const s = await tx.client.query(
      'SELECT 1 FROM vcm.sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND idle_expires_at>now() AND max_expires_at>now()',
      [p.sessionId, p.id],
    )
    if (!s.rowCount)
      throw new ApiError(
        401,
        'UNAUTHENTICATED',
        'La sesión ya no está vigente.',
      )
  }
  const roles = await tx.client.query(
    'SELECT role_code FROM vcm.principal_roles WHERE principal_id=$1',
    [p.id],
  )
  return {
    ...p,
    roles: roles.rows.map((r) => r.role_code),
    scopes: [],
    permissionsVersion: row.permissions_version,
  }
}
export async function assertAction(
  tx: TransactionContext,
  action: string,
  objectId?: string,
): Promise<void> {
  const rule = actions[action]
  if (!rule) throw new ApiError(403, 'ACTION_DENIED', 'Acción no autorizada.')
  const p = await currentPrincipal(tx)
  tx.principal = p
  if (
    !(p.kind === 'human'
      ? p.roles.some((r) => rule.roles.includes(r))
      : p.scopes.some((s) => rule.scopes.includes(s)))
  )
    throw new ApiError(
      403,
      'ACTION_DENIED',
      'Tu identidad no tiene permiso para esta acción.',
    )
  if (!objectId) return
  const pred = visibilityPredicate(p, 'o', 2)
  const result = await tx.client.query(
    'SELECT o.id,o.confidentiality,o.owner_id FROM vcm.protected_objects o WHERE o.id=$1 AND ' +
      pred.sql,
    [objectId, ...pred.values],
  )
  const obj = result.rows[0]
  if (!obj) throw new ApiError(404, 'NOT_FOUND', 'Recurso no encontrado.')
  if (rule.permission === 'read') return
  const grant = await tx.client.query(
    'SELECT 1 FROM vcm.object_grants WHERE object_id=$1 AND principal_id=$2 AND permission=ANY($3::text[]) AND valid_from<=now() AND (valid_until IS NULL OR valid_until>now())',
    [
      objectId,
      p.id,
      rule.permission === 'write' ? ['write', 'review'] : ['review'],
    ],
  )
  const staff =
    p.kind === 'human'
      ? p.roles.some((r) =>
          ['coordination', 'leadership', 'direction'].includes(r),
        )
      : p.scopes.some((s) => s.startsWith('coordination:'))
  if (
    obj.owner_id === p.id ||
    grant.rowCount ||
    (obj.confidentiality === 'internal' && staff)
  )
    return
  if (action === 'captureAntecedent') {
    const assigned = await tx.client.query(
      'SELECT 1 FROM vcm.cases c JOIN vcm.case_assignments a ON a.case_id=c.id WHERE c.protected_object_id=$1 AND a.principal_id=$2 AND a.valid_from<=now() AND (a.valid_until IS NULL OR a.valid_until>now())',
      [objectId, p.id],
    )
    if (assigned.rowCount) return
  }
  throw new ApiError(
    403,
    'OBJECT_ACTION_DENIED',
    'No tienes permiso para modificar este objeto.',
  )
}
