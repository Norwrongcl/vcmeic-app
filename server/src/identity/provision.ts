import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import { z } from 'zod'
import { roles, type Role } from '../contracts/common.ts'
import { hashPassword, hashToken } from './password.ts'
export async function provisionUser(
  pool: Pool,
  input: { email: string; name: string; password: string; roles: Role[] },
) {
  const dto = z
    .strictObject({
      email: z.email(),
      name: z.string().trim().min(1),
      password: z.string().min(12).max(256),
      roles: z.array(z.enum(roles)).min(1),
    })
    .parse(input)
  const id = randomUUID(),
    hash = await hashPassword(dto.password),
    c = await pool.connect()
  try {
    await c.query('BEGIN')
    await c.query(
      "INSERT INTO vcm.principals(id,kind,name) VALUES($1,'human',$2)",
      [id, dto.name],
    )
    await c.query(
      'INSERT INTO vcm.users(principal_id,email,password_hash) VALUES($1,$2,$3)',
      [id, dto.email, hash],
    )
    for (const role of dto.roles)
      await c.query('INSERT INTO vcm.principal_roles VALUES($1,$2)', [id, role])
    await c.query('COMMIT')
    return id
  } catch (e) {
    await c.query('ROLLBACK')
    throw e
  } finally {
    c.release()
  }
}
export async function provisionService(
  pool: Pool,
  input: { name: string; scopes: string[]; token: string },
) {
  const allowed = [
    'interview:read',
    'interview:capture',
    'coordination:read',
    'coordination:write',
    'coordination:execute',
  ] as const
  const dto = z
    .strictObject({
      name: z.string().min(1),
      scopes: z.array(z.enum(allowed)).min(1),
      token: z.string().min(40).max(128),
    })
    .parse(input)
  if (
    dto.scopes.some((s) => s.startsWith('interview:')) &&
    dto.scopes.some((s) => s.startsWith('coordination:'))
  )
    throw new Error('Mixed profile scopes forbidden')
  const principalId = randomUUID(),
    credentialId = randomUUID(),
    c = await pool.connect()
  try {
    await c.query('BEGIN')
    await c.query(
      "INSERT INTO vcm.principals(id,kind,name) VALUES($1,'service',$2)",
      [principalId, dto.name],
    )
    await c.query(
      'INSERT INTO vcm.service_credentials(id,principal_id,token_hash,scopes) VALUES($1,$2,$3,$4)',
      [credentialId, principalId, hashToken(dto.token), dto.scopes],
    )
    await c.query('COMMIT')
    return { principalId, credentialId }
  } catch (e) {
    await c.query('ROLLBACK')
    throw e
  } finally {
    c.release()
  }
}
export async function revokeService(pool: Pool, id: string) {
  await pool.query(
    'UPDATE vcm.service_credentials SET revoked_at=now() WHERE id=$1',
    [id],
  )
}
