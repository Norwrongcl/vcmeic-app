import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  type TransactionContext,
  money,
  civilDate,
} from '../contracts/common.ts'
import { visibilityPredicate } from '../access/visibility.ts'
import { ApiError } from '../http/errors.ts'
import { getEntity, type Entity, type Field, type Relation } from './catalog.ts'
import { querySchema, type Filter, type QueryInput } from './schema.ts'
class Compiler {
  values: unknown[] = []
  aliases = 0
  predicates = 0
  constructor(readonly tx: TransactionContext) {}
  param(value: unknown) {
    this.values.push(value)
    return '$' + this.values.length
  }
  alias() {
    return 'q' + ++this.aliases
  }
  expression(entity: Entity, field: string, alias: string) {
    const f = entity.fields[field]
    if (!Object.hasOwn(entity.fields, field))
      throw new ApiError(422, 'UNKNOWN_FIELD', 'Campo no consultable: ' + field)
    const raw = f.expr ? f.expr(alias) : alias + '.' + f.column
    return {
      sql: f.type === 'date' || f.type === 'money' ? `(${raw})::text` : raw,
      field: f,
    }
  }
  guard(entity: Entity, alias: string) {
    return (
      entity
        .protected(alias)
        .map((check) => {
          const a = this.alias(),
            predicate = visibilityPredicate(
              this.tx.principal,
              a,
              this.values.length + 1,
            )
          this.values.push(...predicate.values)
          const sql = `EXISTS(SELECT 1 FROM vcm.protected_objects ${a} WHERE ${a}.id=${check.expr} AND ${predicate.sql})`
          return check.nullable ? `(${check.expr} IS NULL OR ${sql})` : sql
        })
        .concat(entity.filter ? [entity.filter(alias)] : [])
        .join(' AND ') || 'TRUE'
    )
  }
  link(relation: Relation, parent: string, child: string) {
    if (!relation.through)
      return `${child}.${relation.childKey}=${parent}.${relation.parentKey}`
    const link = this.alias(),
      through = relation.through
    return `EXISTS(SELECT 1 FROM vcm.${through.table} ${link} WHERE ${link}.${through.parentKey}=${parent}.${relation.parentKey} AND ${link}.${through.childKey}=${child}.${relation.childKey})`
  }
  typed(f: Field, value: unknown) {
    if (value === null || value === undefined)
      throw new ApiError(
        422,
        'NULL_OPERATOR_REQUIRED',
        'Utiliza isNull para consultar información desconocida.',
      )
    switch (f.type) {
      case 'money':
        return money.parse(value)
      case 'date':
        return civilDate.parse(value)
      case 'number':
        return z.number().finite().parse(value)
      case 'boolean':
        return z.boolean().parse(value)
      case 'text':
        return z.string().max(20000).parse(value)
    }
  }
  filter(entity: Entity, alias: string, input: Filter, depth = 0): string {
    if (depth > 2 || this.predicates > 20)
      throw new ApiError(
        422,
        'QUERY_TOO_COMPLEX',
        'Reduce la profundidad o cantidad de condiciones.',
      )
    if ('and' in input)
      return (
        '(' +
        input.and
          .map((f) => this.filter(entity, alias, f, depth + 1))
          .join(' AND ') +
        ')'
      )
    if ('or' in input)
      return (
        '(' +
        input.or
          .map((f) => this.filter(entity, alias, f, depth + 1))
          .join(' OR ') +
        ')'
      )
    const parts = input.field.split('.')
    if (parts.length > 1) {
      if (parts.length !== 2 || !Object.hasOwn(entity.relations, parts[0]))
        throw new ApiError(422, 'UNKNOWN_RELATION', 'Relación no consultable.')
      const relation = entity.relations[parts[0]],
        child = getEntity(this.tx.principal, relation.entity),
        a = this.alias()
      return `EXISTS(SELECT 1 FROM vcm.${child.table} ${a} WHERE ${this.link(relation, alias, a)} AND ${this.guard(child, a)} AND ${this.filter(child, a, { ...input, field: parts[1] }, depth + 1)})`
    }
    if (++this.predicates > 20)
      throw new ApiError(
        422,
        'QUERY_TOO_COMPLEX',
        'Reduce la cantidad de condiciones.',
      )
    const { sql, field } = this.expression(entity, input.field, alias)
    if (input.op === 'isNull') {
      const isNull = z.boolean().parse(input.value)
      return sql + (isNull ? ' IS NULL' : ' IS NOT NULL')
    }
    if (input.op === 'in') {
      if (
        !Array.isArray(input.value) ||
        input.value.length < 1 ||
        input.value.length > 50
      )
        throw new ApiError(
          422,
          'INVALID_IN',
          'in requiere entre 1 y 50 valores.',
        )
      return (
        sql +
        ' IN (' +
        input.value.map((v) => this.param(this.typed(field, v))).join(',') +
        ')'
      )
    }
    if (input.op === 'contains') {
      if (field.type !== 'text')
        throw new ApiError(422, 'INVALID_OPERATOR', 'contains requiere texto.')
      return `strpos(lower(${sql}),lower(${this.param(this.typed(field, input.value))}))>0`
    }
    const op = { eq: '=', ne: '<>', lt: '<', lte: '<=', gt: '>', gte: '>=' }[
      input.op
    ]
    // Comparison uses the native SQL type for numerics/dates; projection alone converts money/date to strings.
    const raw = field.expr ? field.expr(alias) : alias + '.' + field.column
    return raw + ' ' + op + ' ' + this.param(this.typed(field, input.value))
  }
}
function fingerprint(input: QueryInput) {
  return createHash('sha256')
    .update(JSON.stringify({ ...input, page: { limit: input.page.limit } }))
    .digest('hex')
}
const cursorSchema = z.strictObject({
  entity: z.string(),
  principal: z.string(),
  fingerprint: z.string(),
  values: z
    .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .max(6),
})
export async function semanticQuery(tx: TransactionContext, raw: unknown) {
  assertFilterBudget(raw)
  const input = querySchema.parse(raw),
    entity = getEntity(tx.principal, input.entity),
    compiler = new Compiler(tx),
    alias = 't',
    deadline = Date.now() + 2000
  if (
    input.page.limit * (1 + input.relations.reduce((n, r) => n + r.limit, 0)) >
    1000
  )
    throw new ApiError(
      422,
      'QUERY_TOO_COMPLEX',
      'Reduce la cantidad de filas y relaciones.',
    )
  if (!input.aggregate && !input.select.length)
    throw new ApiError(
      422,
      'SELECTION_REQUIRED',
      'Selecciona al menos un campo.',
    )
  if (
    new Set(input.select).size !== input.select.length ||
    new Set(input.relations.map((r) => r.name)).size !== input.relations.length
  )
    throw new ApiError(
      422,
      'DUPLICATE_SELECTION',
      'Evita selecciones duplicadas.',
    )
  for (const name of input.select) compiler.expression(entity, name, alias)
  for (const relation of input.relations)
    if (
      !Object.hasOwn(entity.relations, relation.name) ||
      input.select.includes(relation.name)
    )
      throw new ApiError(422, 'UNKNOWN_RELATION', 'Relación no consultable.')
  await tx.client.query("SET LOCAL statement_timeout='2s'")
  let where = compiler.guard(entity, alias)
  if (input.where)
    where += ' AND ' + compiler.filter(entity, alias, input.where)
  if (input.aggregate) {
    if (input.relations.length || input.orderBy.length || input.page.cursor)
      throw new ApiError(
        422,
        'UNSUPPORTED_AGGREGATE_OPTION',
        'La agregación no admite relaciones, cursor ni orden personalizado.',
      )
    const group = input.aggregate.groupBy ?? []
    if (input.select.length && input.select.some((f) => !group.includes(f)))
      throw new ApiError(
        422,
        'AGGREGATE_SELECTION',
        'Selecciona únicamente campos agrupados.',
      )
    const expressions = group.map((name) => ({
        name,
        ...compiler.expression(entity, name, alias),
      })),
      select = expressions.map((f) => f.sql + ' AS "' + f.name + '"')
    if (input.aggregate.count) select.push('count(*)::text AS count')
    for (const field of input.aggregate.sum ?? []) {
      const e = compiler.expression(entity, field, alias)
      if (!['money', 'number'].includes(e.field.type))
        throw new ApiError(
          422,
          'INVALID_SUM',
          'sum requiere un campo numérico.',
        )
      select.push(
        `sum(${e.field.expr ? e.field.expr(alias) : alias + '.' + e.field.column})::text AS "sum_${field}"`,
      )
    }
    if (!input.aggregate.count && !input.aggregate.sum?.length)
      throw new ApiError(422, 'AGGREGATE_REQUIRED', 'Selecciona count o sum.')
    const result = await tx.client.query(
      `SELECT ${select.join(',')} FROM vcm.${entity.table} ${alias} WHERE ${where}${expressions.length ? ' GROUP BY ' + expressions.map((e) => e.sql).join(',') + ' ORDER BY ' + expressions.map((e) => e.sql).join(',') : ''} LIMIT ${input.page.limit + 1}`,
      compiler.values,
    )
    if (result.rows.length > input.page.limit)
      throw new ApiError(
        422,
        'TOO_MANY_GROUPS',
        'Reduce los grupos de la consulta.',
      )
    return {
      items: result.rows,
      nextCursor: null,
      metadata: {
        aggregation: 'authorized-records',
        nulls: 'excluded-from-sum',
      },
    }
  }
  const orders = [...input.orderBy]
  if (!orders.some((o) => o.field === 'id'))
    orders.push({ field: 'id', direction: 'asc' })
  const orderFields = orders.map((o) => {
    const expr = compiler.expression(entity, o.field, alias)
    return {
      ...o,
      ...expr,
      sql:
        expr.field.type === 'money'
          ? expr.field.expr
            ? expr.field.expr(alias)
            : alias + '.' + expr.field.column
          : expr.sql,
    }
  })
  if (input.page.cursor) {
    let cursor: z.infer<typeof cursorSchema>
    try {
      cursor = cursorSchema.parse(
        JSON.parse(
          Buffer.from(input.page.cursor, 'base64url').toString('utf8'),
        ),
      )
    } catch {
      throw new ApiError(422, 'INVALID_CURSOR', 'Cursor inválido.')
    }
    if (
      cursor.entity !== input.entity ||
      cursor.principal !== tx.principal.id ||
      cursor.fingerprint !== fingerprint(input) ||
      cursor.values.length !== orders.length
    )
      throw new ApiError(
        422,
        'INVALID_CURSOR',
        'El cursor pertenece a otra consulta o identidad.',
      )
    const clauses = orderFields.map((order, index) => {
      const equal = orderFields
          .slice(0, index)
          .map(
            (prev, j) =>
              prev.sql +
              ' IS NOT DISTINCT FROM ' +
              compiler.param(cursor.values[j]),
          )
          .join(' AND '),
        value = cursor.values[index]
      const comparison =
        value === null
          ? 'FALSE'
          : `(${order.sql} ${order.direction === 'asc' ? '>' : '<'} ${compiler.param(value)} OR ${order.sql} IS NULL)`
      return '(' + (equal ? equal + ' AND ' : '') + comparison + ')'
    })
    where += ' AND (' + clauses.join(' OR ') + ')'
  }
  const fields = input.select.map(
    (name) =>
      compiler.expression(entity, name, alias).sql + ' AS "' + name + '"',
  )
  orderFields.forEach((o, i) => fields.push(o.sql + ' AS "_cursor' + i + '"'))
  if (input.relations.length && !input.select.includes('id'))
    fields.push(alias + '.id AS "_parentId"')
  const result = await tx.client.query(
    `SELECT ${fields.join(',')} FROM vcm.${entity.table} ${alias} WHERE ${where} ORDER BY ${orderFields.map((o) => o.sql + ' ' + o.direction + ' NULLS LAST').join(',')} LIMIT ${input.page.limit + 1}`,
    compiler.values,
  )
  const more = result.rows.length > input.page.limit,
    rows = result.rows.slice(0, input.page.limit),
    last = rows.at(-1)
  const nextCursor =
    more && last
      ? Buffer.from(
          JSON.stringify({
            entity: input.entity,
            principal: tx.principal.id,
            fingerprint: fingerprint(input),
            values: orders.map((_, i) => last['_cursor' + i]),
          }),
        ).toString('base64url')
      : null
  for (const row of rows) {
    for (const relationInput of input.relations) {
      if (Date.now() > deadline)
        throw new ApiError(
          422,
          'QUERY_TOO_COMPLEX',
          'Reduce las relaciones de la consulta.',
        )
      const relation = entity.relations[relationInput.name],
        child = getEntity(tx.principal, relation.entity),
        nested = new Compiler(tx),
        a = 'n',
        parentId = row.id ?? row._parentId
      let childWhere = nested.guard(child, a)
      if (relation.through) {
        const th = relation.through
        childWhere += ` AND EXISTS(SELECT 1 FROM vcm.${th.table} link WHERE link.${th.parentKey}=${nested.param(parentId)} AND link.${th.childKey}=${a}.${relation.childKey})`
      } else
        childWhere +=
          ' AND ' + a + '.' + relation.childKey + '=' + nested.param(parentId)
      if (relationInput.where)
        childWhere += ' AND ' + nested.filter(child, a, relationInput.where, 1)
      const scope = createHash('sha256')
        .update(
          JSON.stringify({
            entity: input.entity,
            parentId,
            relation: { ...relationInput, cursor: undefined },
            principal: tx.principal,
          }),
        )
        .digest('hex')
      if (relationInput.cursor) {
        let decoded: { scope?: unknown; after?: unknown }
        try {
          decoded = JSON.parse(
            Buffer.from(relationInput.cursor, 'base64url').toString(),
          )
        } catch {
          throw new ApiError(
            422,
            'INVALID_CURSOR',
            'Cursor de relación inválido.',
          )
        }
        if (decoded.scope !== scope || typeof decoded.after !== 'string')
          throw new ApiError(
            422,
            'INVALID_CURSOR',
            'El cursor no corresponde a esta relación o identidad.',
          )
        childWhere += ' AND ' + a + '.id>' + nested.param(decoded.after)
      }
      const projection = relationInput.select.map(
        (f) => nested.expression(child, f, a).sql + ' AS "' + f + '"',
      )
      const related = (
        await tx.client.query(
          `SELECT ${projection.join(',')},${a}.id AS "_relationId" FROM vcm.${child.table} ${a} WHERE ${childWhere} ORDER BY ${a}.id LIMIT ${relationInput.limit + 1}`,
          nested.values,
        )
      ).rows
      const more = related.length > relationInput.limit
      const items = related.slice(0, relationInput.limit)
      const cursor = more
        ? Buffer.from(
            JSON.stringify({ scope, after: items.at(-1)!._relationId }),
          ).toString('base64url')
        : null
      for (const item of items) delete item._relationId
      row[relationInput.name] = items
      row.relationPages ??= {}
      row.relationPages[relationInput.name] = { nextCursor: cursor }
    }
    for (const key of Object.keys(row))
      if (key.startsWith('_cursor') || key === '_parentId') delete row[key]
  }
  if (Buffer.byteLength(JSON.stringify(rows)) > 2 * 1024 * 1024)
    throw new ApiError(
      422,
      'QUERY_RESPONSE_TOO_LARGE',
      'Reduce las filas o campos seleccionados.',
    )
  return { items: rows, nextCursor }
}

function assertFilterBudget(raw: unknown) {
  if (!raw || typeof raw !== 'object') return
  const obj = raw as Record<string, unknown>,
    stack: { value: unknown; depth: number }[] = [
      { value: obj.where, depth: 0 },
    ]
  if (Array.isArray(obj.relations))
    for (const r of obj.relations)
      if (r && typeof r === 'object')
        stack.push({ value: (r as Record<string, unknown>).where, depth: 1 })
  let count = 0,
    steps = 0
  while (stack.length) {
    if (++steps > 100)
      throw new ApiError(422, 'QUERY_TOO_COMPLEX', 'Reduce las condiciones.')
    const { value, depth } = stack.pop()!
    if (value === undefined) continue
    if (depth > 2)
      throw new ApiError(
        422,
        'QUERY_TOO_COMPLEX',
        'Profundidad máxima excedida.',
      )
    if (value && typeof value === 'object') {
      const filter = value as Record<string, unknown>
      if (typeof filter.field === 'string' && ++count > 20)
        throw new ApiError(422, 'QUERY_TOO_COMPLEX', 'Máximo 20 condiciones.')
      for (const key of ['and', 'or'])
        if (Array.isArray(filter[key]))
          for (const child of filter[key])
            stack.push({ value: child, depth: depth + 1 })
    }
  }
}
