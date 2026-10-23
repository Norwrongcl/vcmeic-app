import { randomBytes, randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import type { Request } from 'express'
import { z } from 'zod'
import type { ServerConfig } from '../config.ts'
import type { PrincipalContext } from '../contracts/common.ts'
import { ApiError } from '../http/errors.ts'
import {
  hashToken,
  verifyPassword,
  hashPassword,
  equalTokens,
} from './password.ts'
export type AuthenticatedRequest = Request & { principal?: PrincipalContext }
const unauthorized = () =>
  new ApiError(
    401,
    'UNAUTHENTICATED',
    'Credenciales inválidas o sesión vencida.',
  )
export class Identity {
  readonly cookieName: string
  private dummy: Promise<string>
  constructor(
    readonly pool: Pool,
    readonly config: ServerConfig,
  ) {
    this.cookieName = config.production
      ? '__Host-vcm_session'
      : 'vcm_session_dev'
    this.dummy = hashPassword(randomBytes(32).toString('hex'))
  }
  assertOrigin(req: Request) {
    if (
      !req.headers.origin ||
      !this.config.webOrigins.includes(req.headers.origin)
    )
      throw new ApiError(403, 'ORIGIN_DENIED', 'Origen no autorizado.')
  }
  async login(req: Request) {
    this.assertOrigin(req)
    if (req.headers.authorization)
      throw new ApiError(
        403,
        'HUMAN_SESSION_REQUIRED',
        'Esta ruta requiere credenciales humanas.',
      )
    const dto = z
      .strictObject({
        email: z.email().max(254),
        password: z.string().min(1).max(256),
      })
      .parse(req.body)
    const email = dto.email.trim().toLowerCase()
    const keys = [
      'ip:' + hashToken(req.ip ?? req.socket.remoteAddress ?? 'unknown'),
      'account:' + hashToken(email),
    ].sort()
    const c = await this.pool.connect()
    let exceeded = false
    try {
      await c.query('BEGIN')
      for (const key of keys) {
        const r = await c.query(
          "INSERT INTO vcm.login_limits(key,attempts) VALUES($1,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_limits.window_started_at < now()-interval '15 minutes' THEN 1 ELSE login_limits.attempts+1 END, window_started_at=CASE WHEN login_limits.window_started_at < now()-interval '15 minutes' THEN now() ELSE login_limits.window_started_at END RETURNING attempts",
          [key],
        )
        if (r.rows[0].attempts > 5) exceeded = true
      }
      await c.query('COMMIT')
    } catch (e) {
      await c.query('ROLLBACK')
      throw e
    } finally {
      c.release()
    }
    if (exceeded)
      throw new ApiError(
        429,
        'LOGIN_LIMIT',
        'Demasiados intentos. Intenta más tarde.',
      )
    const r = await this.pool.query(
      'SELECT u.principal_id,u.password_hash,p.active FROM vcm.users u JOIN vcm.principals p ON p.id=u.principal_id WHERE u.email=$1',
      [email],
    )
    const row = r.rows[0]
    const valid = await verifyPassword(
      dto.password,
      row?.password_hash ?? (await this.dummy),
    )
    if (!valid || !row?.active) throw unauthorized()
    const token = randomBytes(32).toString('base64url'),
      sessionId = randomUUID()
    await this.pool.query(
      "INSERT INTO vcm.sessions(id,user_id,token_hash,idle_expires_at,max_expires_at) VALUES($1,$2,$3,now()+interval '30 minutes',now()+interval '12 hours')",
      [sessionId, row.principal_id, hashToken(token)],
    )
    return token
  }
  async authenticate(req: Request): Promise<PrincipalContext> {
    const authorization = req.headers.authorization
    if (authorization) {
      if (req.cookies?.[this.cookieName]) throw unauthorized()
      const m = /^Bearer ([A-Za-z0-9_-]{40,128})$/.exec(authorization)
      if (!m) throw unauthorized()
      const r = await this.pool.query(
        'SELECT p.id,p.kind,p.permissions_version,s.id credential_id,s.scopes FROM vcm.service_credentials s JOIN vcm.principals p ON p.id=s.principal_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>now()) AND p.active',
        [hashToken(m[1])],
      )
      const row = r.rows[0]
      if (!row) throw unauthorized()
      return {
        id: row.id,
        kind: 'service',
        roles: [],
        scopes: row.scopes,
        permissionsVersion: row.permissions_version,
        credentialId: row.credential_id,
      }
    }
    const raw = req.cookies?.[this.cookieName]
    if (typeof raw !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(raw))
      throw unauthorized()
    const r = await this.pool.query(
      "UPDATE vcm.sessions s SET last_seen_at=now(),idle_expires_at=LEAST(max_expires_at,now()+interval '30 minutes') FROM vcm.principals p WHERE s.user_id=p.id AND p.active AND s.token_hash=$1 AND s.revoked_at IS NULL AND s.idle_expires_at>now() AND s.max_expires_at>now() RETURNING p.id,p.permissions_version,s.id session_id",
      [hashToken(raw)],
    )
    const row = r.rows[0]
    if (!row) throw unauthorized()
    const roles = await this.pool.query(
      'SELECT role_code FROM vcm.principal_roles WHERE principal_id=$1 ORDER BY role_code',
      [row.id],
    )
    return {
      id: row.id,
      kind: 'human',
      roles: roles.rows.map((r) => r.role_code),
      scopes: [],
      permissionsVersion: row.permissions_version,
      sessionId: row.session_id,
    }
  }
  csrf(req: Request) {
    const raw = req.cookies?.[this.cookieName]
    if (typeof raw !== 'string') throw unauthorized()
    return hashToken(raw + ':csrf')
  }
  assertCsrf(req: Request) {
    this.assertOrigin(req)
    if (
      typeof req.headers['x-csrf-token'] !== 'string' ||
      !equalTokens(req.headers['x-csrf-token'], this.csrf(req))
    )
      throw new ApiError(403, 'CSRF_DENIED', 'Token de solicitud inválido.')
  }
  async logout(principal: PrincipalContext) {
    await this.pool.query(
      'UPDATE vcm.sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2',
      [principal.sessionId, principal.id],
    )
  }
}
