import 'reflect-metadata'
import { Module, type INestApplication } from '@nestjs/common'
import { NestFactory, APP_GUARD } from '@nestjs/core'
import { Identity } from './identity/sessions.ts'
import { AuthGuard } from './identity/auth.guard.ts'
import { SessionController } from './identity/session.controller.ts'
import { OpenApiController } from './http/openapi.controller.ts'
import { ImportsController } from './imports/imports.controller.ts'
import { EventsController } from './events/events.controller.ts'
import { startDispatcher } from './events/dispatcher.ts'
import { QueryController } from './query/query.controller.ts'
import {
  ReportingController,
  CutController,
} from './reporting/reporting.controller.ts'
import { communicationControllers } from './communications/communications.controller.ts'
import { operationControllers } from './operations/operations.controller.ts'
import { CasesController, EXECUTOR } from './cases/cases.controller.ts'
import { createDomainRegistry } from './commands/domain-registry.ts'
import { CommandExecutor } from './commands/executor.ts'
import { resolve } from 'node:path'
import { POOL, CONFIG, IDENTITY } from './persistence/tokens.ts'
import express from 'express'
import cookieParser from 'cookie-parser'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import pg from 'pg'
import { configSchema, type ServerConfig } from './config.ts'
import { HealthController } from './http/health.controller.ts'
import { ErrorFilter, errorBody } from './http/errors.ts'
export async function verifySchema(pool: pg.Pool) {
  const directory = resolve(process.cwd(), '../database/migrations')
  const files = (await readdir(directory))
    .filter((v) => /^\d{4}_.+\.sql$/.test(v))
    .sort()
  const result = await pool.query<{ version: string; checksum: string }>(
    'SELECT version, checksum FROM vcm_meta.schema_migrations ORDER BY version',
  )
  if (result.rowCount !== files.length) throw new Error('Schema incompatible')
  for (let i = 0; i < files.length; i++) {
    const expected = createHash('sha256')
      .update(await readFile(directory + '/' + files[i]))
      .digest('hex')
    if (
      result.rows[i].version !== files[i] ||
      result.rows[i].checksum !== expected
    )
      throw new Error('Schema incompatible')
  }
}
export async function createApp(
  input: ServerConfig,
): Promise<INestApplication> {
  const parsed = configSchema.parse(input)
  const config = {
    ...parsed,
    cursorKey: parsed.cursorKey ?? randomBytes(32).toString('hex'),
  }
  let stopDispatcher = async () => {}
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: 8,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
  })
  let app: INestApplication | undefined
  try {
    try {
      await verifySchema(pool)
    } catch (e) {
      if (e instanceof Error && /does not exist/.test(e.message))
        throw new Error('Schema incompatible', { cause: e })
      throw e
    }
    const registry = createDomainRegistry()
    @Module({
      controllers: [
        HealthController,
        SessionController,
        CasesController,
        ...operationControllers,
        ...communicationControllers,
        ReportingController,
        CutController,
        QueryController,
        EventsController,
        ImportsController,
        OpenApiController,
      ],
      providers: [
        { provide: EXECUTOR, useValue: new CommandExecutor(pool, registry) },
        { provide: IDENTITY, useValue: new Identity(pool, config) },
        {
          provide: APP_GUARD,
          useFactory: (identity: Identity) => new AuthGuard(identity),
          inject: [IDENTITY],
        },
        { provide: POOL, useValue: pool },
        { provide: CONFIG, useValue: config },
        {
          provide: 'PoolShutdown',
          useValue: {
            onModuleDestroy: async () => {
              await stopDispatcher()
              await pool.end()
            },
          },
        },
      ],
    })
    class AppModule {}
    app = await NestFactory.create(AppModule, {
      logger: false,
      bodyParser: false,
    })
    app.use(
      (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => {
        res.locals.correlationId = randomUUID()
        res.setHeader('X-Correlation-Id', res.locals.correlationId)
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('Cache-Control', 'no-store')
        const origin = req.headers.origin
        if (origin && config.webOrigins.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin)
          res.setHeader('Vary', 'Origin')
          res.setHeader('Access-Control-Allow-Credentials', 'true')
          res.setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type,X-CSRF-Token,Idempotency-Key',
          )
          res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        }
        if (req.method === 'OPTIONS') {
          res
            .status(origin && config.webOrigins.includes(origin) ? 204 : 403)
            .end()
          return
        }
        next()
      },
    )
    app.use('/v1/imports/preview', express.json({ limit: '10mb' }))
    app.use(express.json({ limit: '1mb' }))
    app.use(cookieParser())
    app.use(
      (
        err: unknown,
        _req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => {
        if (
          err &&
          typeof err === 'object' &&
          'type' in err &&
          err.type === 'entity.too.large'
        ) {
          const out = errorBody(
            new (class extends Error {})(),
            res.locals.correlationId,
          )
          res.status(413).json({ ...out.body, code: 'PAYLOAD_TOO_LARGE' })
          return
        }
        if (err) {
          res.status(422).json({
            code: 'INVALID_JSON',
            message: 'JSON inválido.',
            correlationId: res.locals.correlationId,
          })
          return
        }
        next()
      },
    )
    app.useGlobalFilters(new ErrorFilter())
    await app.init()
    stopDispatcher = startDispatcher(pool)
    return app
  } catch (e) {
    if (app) await app.close()
    else await pool.end()
    throw e
  }
}
