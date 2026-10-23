import { z } from 'zod'
import type { CommandRegistry } from './commands/registry.ts'
import type { PrincipalContext } from './contracts/common.ts'
import { actions } from './access/policy.ts'
import { resources } from './operations/resources.ts'
import { communicationResources } from './communications/communications.controller.ts'
import { querySchema } from './query/schema.ts'
const parameterId = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string' },
}
const errors = {
  401: { description: 'Sesión o credencial no vigente' },
  403: { description: 'Acción no permitida' },
  404: { description: 'Recurso inexistente o invisible' },
  409: { description: 'Versión o idempotencia en conflicto' },
  422: { description: 'Datos/reglas no válidos' },
  429: { description: 'Límite de solicitudes' },
  503: { description: 'Servicio no disponible' },
}
const security = [{ cookieSession: [] }, { serviceBearer: [] }]
function schema(value: z.ZodType) {
  return z.toJSONSchema(value, { cycles: 'ref', unrepresentable: 'any' })
}
export function commandCatalog(
  registry: CommandRegistry,
  principal: PrincipalContext,
) {
  return registry
    .entries()
    .filter((h) => {
      const rule = actions[h.action]
      return (
        !!rule &&
        (principal.kind === 'human'
          ? principal.roles.some((r) => rule.roles.includes(r))
          : principal.scopes.some((s) => rule.scopes.includes(s)))
      )
    })
    .map((h) => ({
      name: h.type,
      action: h.action,
      requestSchema: schema(h.schema),
      constraints:
        'Versión esperada e idempotencia; el servidor verifica además pertenencia, QA, autoridad humana, revisión y mandato cuando correspondan.',
    }))
}
export function openApiDocument(registry: CommandRegistry) {
  const paths: Record<string, Record<string, unknown>> = {}
  const op = (
    method: string,
    path: string,
    body?: unknown,
    status = 200,
    extra: Record<string, unknown> = {},
  ) => {
    paths[path] ??= {}
    paths[path][method] = {
      security,
      responses: {
        [status]: { description: 'Operación confirmada por el servidor' },
        ...errors,
      },
      ...(path.includes('{id}') ? { parameters: [parameterId] } : {}),
      ...(body
        ? {
            requestBody: {
              required: true,
              content: { 'application/json': { schema: body } },
            },
          }
        : {}),
      ...extra,
    }
  }
  const envelope = (types: string[]) => ({
    type: 'object',
    additionalProperties: false,
    required: ['command', 'expectedVersion', 'idempotencyKey'],
    properties: {
      command: {
        oneOf: registry
          .entries()
          .filter((h) => types.includes(h.type))
          .map((h) => schema(h.schema)),
      },
      expectedVersion: { type: 'integer', minimum: 0 },
      idempotencyKey: { type: 'string', minLength: 8, maxLength: 200 },
    },
  })
  const reads = [
    '/v1/overview',
    '/v1/control',
    '/v1/reports',
    '/v1/indicators',
    '/v1/catalog',
    '/v1/exports',
    '/v1/openapi.json',
    '/ready',
  ]
  for (const path of reads) op('get', path)
  op('get', '/health', undefined, 200, { security: [] })
  op(
    'post',
    '/v1/session/login',
    schema(
      z.strictObject({
        email: z.email(),
        password: z.string().min(1).max(256),
      }),
    ),
    200,
    {
      security: [],
      description:
        'Origen permitido obligatorio. Sesión revocable; cookie HttpOnly/Secure/SameSite=Lax en producción.',
    },
  )
  for (const path of ['/v1/session/me', '/v1/session/csrf'])
    op('get', path, undefined, 200, { security: [{ cookieSession: [] }] })
  op('post', '/v1/session/logout', undefined, 200, {
    security: [{ cookieSession: [] }],
    parameters: [
      {
        in: 'header',
        name: 'X-CSRF-Token',
        required: true,
        schema: { type: 'string' },
      },
    ],
  })
  const definitions = [
    {
      path: 'cases',
      create: ['createCase'],
      commands: [
        'setField',
        'setFields',
        'resolveField',
        'transition',
        'updateCase',
        'setRelations',
        'addEvidence',
        'reviewEvidence',
        'attachProject',
        'saveTriage',
        'archiveCase',
      ],
    },
    ...resources,
    ...communicationResources,
    {
      path: 'cuts',
      create: ['createCut'],
      commands: ['addObservation', 'resolveObservation', 'transitionCut'],
    },
  ]
  for (const r of definitions) {
    op('get', '/v1/' + r.path)
    op('get', '/v1/' + r.path + '/{id}')
    op('post', '/v1/' + r.path, envelope(r.create), 201)
    op('post', '/v1/' + r.path + '/{id}/commands', envelope(r.commands))
  }
  op(
    'post',
    '/v1/indicators/{id}/commands',
    envelope(['linkIndicator', 'validateContribution']),
  )
  op('post', '/v1/query', schema(querySchema), 200, {
    description:
      'Catálogo cerrado y parámetros tipados. Máximo 100 filas, profundidad 2, 20 condiciones, SQL 2 s. Filtrar antes de contar; SUM omite null y no sustituye avance institucional.',
  })
  op('get', '/v1/events', undefined, 200, {
    parameters: [
      { name: 'Last-Event-ID', in: 'header', schema: { type: 'string' } },
    ],
    responses: {
      200: {
        description:
          'Eventos de invalidación autorizados; cursor opaco, heartbeat 15 s, reconexión y reset-required',
        content: { 'text/event-stream': { schema: { type: 'string' } } },
      },
      ...errors,
    },
  })
  op(
    'post',
    '/v1/imports/preview',
    schema(z.strictObject({ snapshot: z.unknown() })),
    201,
  )
  op('get', '/v1/imports/{id}')
  op(
    'post',
    '/v1/imports/{id}/commit',
    schema(
      z.strictObject({
        previewHash: z.string().length(64),
        actorMappings: z.record(z.string(), z.string()),
        includeDemo: z.boolean(),
        demoClassifications: z.record(z.string(), z.boolean()).optional(),
        backupReceiptId: z.string(),
        idempotencyKey: z.string().min(8).max(200),
      }),
    ),
  )
  return {
    openapi: '3.1.0',
    info: {
      title: 'VcM API',
      version: '1.0.0',
      description:
        'Procesos del PO; plataforma, Hermes y servicios comparten este contrato. Escrituras con cookie requieren Origin y X-CSRF-Token; Bearer de servicio no concede autoridad humana. Integraciones y worker todavía no ejecutan acciones externas.',
    },
    paths,
    components: {
      securitySchemes: {
        cookieSession: {
          type: 'apiKey',
          in: 'cookie',
          name: '__Host-vcm_session',
        },
        serviceBearer: { type: 'http', scheme: 'bearer' },
      },
      schemas: {
        ApiError: {
          type: 'object',
          required: ['code', 'message', 'correlationId'],
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            correlationId: { type: 'string' },
          },
        },
      },
    },
  }
}
