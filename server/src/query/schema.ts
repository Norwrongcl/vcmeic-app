import { z } from 'zod'
export type Filter =
  | { and: Filter[] }
  | { or: Filter[] }
  | {
      field: string
      op:
        | 'eq'
        | 'ne'
        | 'in'
        | 'lt'
        | 'lte'
        | 'gt'
        | 'gte'
        | 'isNull'
        | 'contains'
      value?: unknown
    }
const scalar = z.union([
  z.string().max(20000),
  z.number().finite(),
  z.boolean(),
  z.null(),
])
export const filterSchema: z.ZodType<Filter> = z.lazy(() =>
  z.union([
    z.strictObject({ and: z.array(filterSchema).min(1).max(20) }),
    z.strictObject({ or: z.array(filterSchema).min(1).max(20) }),
    z.strictObject({
      field: z.string().min(1).max(100),
      op: z.enum([
        'eq',
        'ne',
        'in',
        'lt',
        'lte',
        'gt',
        'gte',
        'isNull',
        'contains',
      ]),
      value: z.union([scalar, z.array(scalar).min(1).max(50)]).optional(),
    }),
  ]),
)
export const querySchema = z.strictObject({
  entity: z.string().min(1).max(80),
  select: z.array(z.string().min(1).max(100)).max(20),
  where: filterSchema.optional(),
  relations: z
    .array(
      z.strictObject({
        name: z.string().min(1).max(80),
        select: z.array(z.string().min(1).max(100)).min(1).max(20),
        where: filterSchema.optional(),
        cursor: z.string().max(8000).optional(),
        limit: z.number().int().min(1).max(20).default(10),
      }),
    )
    .max(3)
    .default([]),
  orderBy: z
    .array(
      z.strictObject({
        field: z.string().min(1).max(100),
        direction: z.enum(['asc', 'desc']),
      }),
    )
    .max(5)
    .default([]),
  page: z
    .strictObject({
      limit: z.number().int().min(1).max(100).default(50),
      cursor: z.string().max(8000).optional(),
    })
    .default({ limit: 50 }),
  aggregate: z
    .strictObject({
      count: z.literal(true).optional(),
      sum: z.array(z.string()).min(1).max(5).optional(),
      groupBy: z.array(z.string()).max(3).optional(),
    })
    .optional(),
})
export type QueryInput = z.infer<typeof querySchema>
