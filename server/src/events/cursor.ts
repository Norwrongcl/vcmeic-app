import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'node:crypto'
import type { PrincipalContext } from '../contracts/common.ts'
import { ApiError } from '../http/errors.ts'
export function cursorScope(p: PrincipalContext) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        p.id,
        p.kind,
        p.permissionsVersion,
        [...p.roles].sort(),
        [...p.scopes].sort(),
        p.credentialId ?? p.sessionId,
      ]),
    )
    .digest('hex')
}
export function encodeCursor(key: string, scope: string, cursor: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv)
  cipher.setAAD(Buffer.from(scope))
  const encrypted = Buffer.concat([
    cipher.update(cursor, 'utf8'),
    cipher.final(),
  ])
  return [
    'v1',
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
  ].join('.')
}
export function decodeCursor(key: string, scope: string, encoded: string) {
  try {
    if (encoded.length > 500) throw new Error()
    const [version, iv, payload, tag, ...rest] = encoded.split('.')
    if (version !== 'v1' || rest.length || !iv || !payload || !tag)
      throw new Error()
    const nonce = Buffer.from(iv, 'base64url'),
      auth = Buffer.from(tag, 'base64url')
    if (nonce.length !== 12 || auth.length !== 16) throw new Error()
    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(key, 'hex'),
      nonce,
    )
    decipher.setAAD(Buffer.from(scope))
    decipher.setAuthTag(auth)
    const value = Buffer.concat([
      decipher.update(Buffer.from(payload, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
    if (
      !/^(0|[1-9][0-9]{0,18})$/.test(value) ||
      BigInt(value) > 9223372036854775807n
    )
      throw new Error()
    return value
  } catch {
    throw new ApiError(
      422,
      'INVALID_CURSOR',
      'Cursor de eventos inválido para esta sesión.',
    )
  }
}
