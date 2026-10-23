import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.module.ts'
import { parseConfig } from '../src/config.ts'
import { database } from './database.ts'

describe('server boundaries', () => {
  it('serves shallow health and hides internals on failed routes and oversize requests', async () => {
    const db = await database()
    const app = await createApp({
      databaseUrl: db.url,
      webOrigins: ['http://localhost:5174'],
      production: false,
    })
    try {
      const http = request(app.getHttpServer())
      expect((await http.get('/health')).body).toEqual({ status: 'ok' })
      const missing = await http.get('/not-a-route')
      expect(missing.status).toBe(404)
      expect(missing.body.correlationId).toBeTruthy()
      expect(missing.text).not.toMatch(/stack|SELECT|password/)
      expect(
        (
          await http
            .post('/v1/session/login')
            .send({ data: 'a'.repeat(1048600) })
        ).status,
      ).toBe(413)
      expect((await http.get('/ready')).status).toBe(401)
    } finally {
      await app.close()
      await db.close()
    }
  })
  it('does not become ready on missing database or wrong schema', async () => {
    const db = await database(false)
    try {
      await expect(
        createApp({
          databaseUrl: db.url,
          webOrigins: ['http://localhost:5174'],
          production: false,
        }),
      ).rejects.toThrow('Schema incompatible')
      await expect(
        createApp({
          databaseUrl: 'postgresql://invalid:invalid@127.0.0.1:1/absent',
          webOrigins: ['http://localhost:5174'],
          production: false,
        }),
      ).rejects.toThrow()
    } finally {
      await db.close()
    }
  })
  it('requires explicit database and exact safe origins', () => {
    expect(() => parseConfig({})).toThrow()
    expect(() =>
      parseConfig({
        DATABASE_URL: 'postgresql://localhost/vcm',
        WEB_ORIGINS: '*',
      }),
    ).toThrow()
    expect(() =>
      parseConfig({
        DATABASE_URL: 'postgresql://localhost/vcm',
        WEB_ORIGINS: 'https://app.vcmeic.cl/path',
      }),
    ).toThrow()
  })
})
