import { z } from 'zod'
import type { PrincipalContext } from '../contracts/common.ts'
import { cursorScope } from '../events/cursor.ts'
import { ApiError } from './errors.ts'
const querySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(2000).optional(),
})
export function pageInput(raw: unknown, p: PrincipalContext, resource: string) {
  const input = querySchema.parse(raw ?? {})
  let after: string | undefined
  if (input.cursor) {
    try {
      const c = z
        .strictObject({
          v: z.literal(1),
          scope: z.string(),
          resource: z.literal(resource),
          after: z.string().min(1).max(200),
        })
        .parse(
          JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')),
        )
      if (c.scope !== cursorScope(p)) throw new Error()
      after = c.after
    } catch {
      throw new ApiError(
        422,
        'INVALID_CURSOR',
        'Cursor de otra consulta o identidad.',
      )
    }
  }
  return { limit: input.limit, after }
}
export function pageResult<T extends { id: string }>(
  rows: T[],
  limit: number,
  p: PrincipalContext,
  resource: string,
) {
  const items = rows.slice(0, limit),
    last = items.at(-1)
  return {
    items,
    nextCursor:
      rows.length > limit && last
        ? Buffer.from(
            JSON.stringify({
              v: 1,
              scope: cursorScope(p),
              resource,
              after: last.id,
            }),
          ).toString('base64url')
        : null,
  }
}
