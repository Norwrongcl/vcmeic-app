import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../src/app.module.ts'
import { provisionUser, provisionService } from '../src/identity/provision.ts'
import type { Role } from '../src/contracts/common.ts'
import { database } from './database.ts'
export async function fixture(role: Role = 'coordination') {
  const db = await database(),
    origin = 'http://localhost:5174'
  const userId = await provisionUser(db.pool, {
    email: 'u@example.cl',
    name: role,
    password: 'test-password-123',
    roles: [role],
  })
  const runtimeUrl = new URL(db.url)
  runtimeUrl.searchParams.set('options', '-c role=vcm_runtime')
  const app = await createApp({
      databaseUrl: runtimeUrl.href,
      webOrigins: [origin],
      production: false,
    }),
    http = request(app.getHttpServer())
  const login = await http
    .post('/v1/session/login')
    .set('Origin', origin)
    .send({ email: 'u@example.cl', password: 'test-password-123' })
  const cookie = login.headers['set-cookie'][0].split(';')[0]
  const csrf = (await http.get('/v1/session/csrf').set('Cookie', cookie)).body
    .token
  return {
    db,
    app,
    userId,
    http,
    get: (url: string) => http.get(url).set('Cookie', cookie),
    post: (url: string, body: Record<string, unknown>) =>
      http
        .post(url)
        .set('Cookie', cookie)
        .set('Origin', origin)
        .set('X-CSRF-Token', csrf)
        .send(body),
    command: (
      command: Record<string, unknown>,
      expectedVersion: number,
      key = randomUUID(),
    ) =>
      http
        .post(
          command.caseId
            ? '/v1/cases/' + command.caseId + '/commands'
            : '/v1/cases',
        )
        .set('Cookie', cookie)
        .set('Origin', origin)
        .set('X-CSRF-Token', csrf)
        .send({ command, expectedVersion, idempotencyKey: key }),
    async service(scopes: string[] = ['interview:read', 'interview:capture']) {
      const token =
        randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '')
      const creds = await provisionService(db.pool, {
        name: 'Hermes',
        scopes,
        token,
      })
      return { ...creds, token }
    },
    async close() {
      await app.close()
      await db.close()
    },
  }
}
export const createCase = {
  type: 'createCase',
  kind: 'presence',
  name: 'Seminario de Alumni',
  responsible: 'Docente',
  description: 'Participación como expositor',
  startsAt: '2026-10-22',
  endsAt: '2026-10-22',
}
