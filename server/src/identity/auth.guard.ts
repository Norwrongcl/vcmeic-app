import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { ApiError } from '../http/errors.ts'
import { type Identity, type AuthenticatedRequest } from './sessions.ts'
export class AuthGuard implements CanActivate {
  constructor(private identity: Identity) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (req.path === '/health') return true
    if (req.path === '/v1/session/login' && req.method === 'POST') return true
    req.principal = await this.identity.authenticate(req)
    if (req.path.startsWith('/v1/session/') && req.principal.kind !== 'human')
      throw new ApiError(
        403,
        'HUMAN_SESSION_REQUIRED',
        'Esta ruta requiere una sesión humana.',
      )
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.principal.kind === 'human'
    )
      this.identity.assertCsrf(req)
    return true
  }
}
