import { z } from 'zod'
import type { PoolClient } from 'pg'
export const roles = [
  'coordination',
  'leadership',
  'direction',
  'responsible',
  'designer',
  'technician',
  'viewer',
] as const
export type Role = (typeof roles)[number]
export interface PrincipalContext {
  id: string
  kind: 'human' | 'service'
  roles: Role[]
  scopes: string[]
  permissionsVersion: number
  sessionId?: string
  credentialId?: string
}
export interface TransactionContext {
  client: PoolClient
  principal: PrincipalContext
  correlationId: string
  now: Date
}
export interface CommandResult {
  objectId: string
  version: number
  result: unknown
}
export interface Page<T> {
  items: T[]
  nextCursor: string | null
}
export const id = z.string().min(1).max(200)
export const reason = z.string().trim().min(1).max(4000)
export const money = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,17})$/)
  .refine((v) => BigInt(v) <= 9223372036854775807n)
export const civilDate = z.iso.date()
export const optionalDate = civilDate.nullable().optional()
