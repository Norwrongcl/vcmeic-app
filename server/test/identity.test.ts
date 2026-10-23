import { it, expect } from 'vitest'
import request from 'supertest'
import { randomBytes } from 'node:crypto'
import { createApp } from '../src/app.module.ts'
import { hashPassword, hashToken } from '../src/identity/password.ts'
import { database } from './database.ts'
import {
  provisionUser,
  provisionService,
  revokeService,
} from '../src/identity/provision.ts'

const origin = 'http://localhost:5174'
it('authenticates real users, protects mutations with origin and csrf, and revokes sessions', async () => {
  const db = await database()
  const app = await createApp({
    databaseUrl: db.url,
    webOrigins: [origin],
    production: false,
  })
  try {
    await provisionUser(db.pool, {
      email: 'TEST@example.cl',
      name: 'Coordinator',
      password: 'test-password-123',
      roles: ['coordination'],
    })
    const http = request(app.getHttpServer())
    expect((await http.get('/v1/session/me')).status).toBe(401)
    expect(
      (
        await http
          .post('/v1/session/login')
          .send({ email: 'TEST@example.cl', password: 'test-password-123' })
      ).status,
    ).toBe(403)
    const bad = await http
      .post('/v1/session/login')
      .set('Origin', origin)
      .send({ email: 'TEST@example.cl', password: 'wrong' })
    const absent = await http
      .post('/v1/session/login')
      .set('Origin', origin)
      .send({ email: 'missing@example.cl', password: 'wrong' })
    expect(bad.status).toBe(401)
    expect(absent.body.code).toBe(bad.body.code)
    const login = await http
      .post('/v1/session/login')
      .set('Origin', origin)
      .send({ email: 'test@example.cl', password: 'test-password-123' })
    expect(login.status).toBe(200)
    const cookie = login.headers['set-cookie'][0].split(';')[0]
    expect(login.headers['set-cookie'][0]).toContain('HttpOnly')
    expect(login.headers['set-cookie'][0]).toContain('SameSite=Lax')
    const me = await http.get('/v1/session/me').set('Cookie', cookie)
    expect(me.body.roles).toEqual(['coordination'])
    expect(me.body).not.toHaveProperty('password_hash')
    const raw = decodeURIComponent(cookie.split('=')[1])
    const rows = await db.pool.query('SELECT token_hash FROM vcm.sessions')
    expect(rows.rows[0].token_hash).toBe(hashToken(raw))
    expect(rows.rows[0].token_hash).not.toBe(raw)
    expect(
      (
        await http
          .post('/v1/session/logout')
          .set('Origin', origin)
          .set('Cookie', cookie)
      ).status,
    ).toBe(403)
    const csrf = await http.get('/v1/session/csrf').set('Cookie', cookie)
    expect(
      (
        await http
          .post('/v1/session/logout')
          .set('Origin', 'https://evil.example')
          .set('Cookie', cookie)
          .set('X-CSRF-Token', csrf.body.token)
      ).status,
    ).toBe(403)
    expect(
      (
        await http
          .post('/v1/session/logout')
          .set('Origin', origin)
          .set('Cookie', cookie)
          .set('X-CSRF-Token', csrf.body.token)
      ).status,
    ).toBe(200)
    expect(
      (await http.get('/v1/session/me').set('Cookie', cookie)).status,
    ).toBe(401)
  } finally {
    await app.close()
    await db.close()
  }
})
it('expires sessions and disables all access when principal becomes inactive', async () => {
  const db = await database()
  const app = await createApp({
    databaseUrl: db.url,
    webOrigins: [origin],
    production: false,
  })
  try {
    const human = await provisionUser(db.pool, {
      email: 'u@example.cl',
      name: 'U',
      password: 'strong-password-123',
      roles: ['viewer'],
    })
    const http = request(app.getHttpServer())
    const login = await http
      .post('/v1/session/login')
      .set('Origin', origin)
      .send({ email: 'u@example.cl', password: 'strong-password-123' })
    const cookie = login.headers['set-cookie'][0].split(';')[0]
    await db.pool.query(
      "UPDATE vcm.sessions SET idle_expires_at=now()-interval '1 second'",
    )
    expect((await http.get('/ready').set('Cookie', cookie)).status).toBe(401)
    await db.pool.query(
      "UPDATE vcm.sessions SET idle_expires_at=now()+interval '1 minute'",
    )
    await db.pool.query('UPDATE vcm.principals SET active=false WHERE id=$1', [
      human,
    ])
    expect((await http.get('/ready').set('Cookie', cookie)).status).toBe(401)
  } finally {
    await app.close()
    await db.close()
  }
})
it('separates service identities from humans and checks expiration/revocation', async () => {
  const db = await database()
  const app = await createApp({
    databaseUrl: db.url,
    webOrigins: [origin],
    production: false,
  })
  try {
    const token = randomBytes(32).toString('base64url')
    const cred = await provisionService(db.pool, {
      name: 'Interview',
      scopes: ['interview:read', 'interview:capture'],
      token,
    })
    const http = request(app.getHttpServer())
    expect(
      (await http.get('/ready').set('Authorization', 'Bearer ' + token)).status,
    ).toBe(200)
    expect(
      (await http.get('/v1/session/me').set('Authorization', 'Bearer ' + token))
        .status,
    ).toBe(403)
    expect(
      (
        await http
          .post('/v1/session/login')
          .set('Authorization', 'Bearer ' + token)
          .set('Origin', origin)
          .send({})
      ).status,
    ).toBe(403)
    await db.pool.query(
      "UPDATE vcm.service_credentials SET expires_at=now()-interval '1 second' WHERE id=$1",
      [cred.credentialId],
    )
    expect(
      (await http.get('/ready').set('Authorization', 'Bearer ' + token)).status,
    ).toBe(401)
    await db.pool.query(
      'UPDATE vcm.service_credentials SET expires_at=NULL WHERE id=$1',
      [cred.credentialId],
    )
    await revokeService(db.pool, cred.credentialId)
    expect(
      (await http.get('/ready').set('Authorization', 'Bearer ' + token)).status,
    ).toBe(401)
    expect(
      (await db.pool.query('SELECT token_hash FROM vcm.service_credentials'))
        .rows[0].token_hash,
    ).not.toBe(token)
  } finally {
    await app.close()
    await db.close()
  }
})
it('throttles login durably and uses versioned password hashing', async () => {
  const db = await database()
  const app = await createApp({
    databaseUrl: db.url,
    webOrigins: [origin],
    production: false,
  })
  try {
    const http = request(app.getHttpServer())
    for (let i = 0; i < 5; i++)
      expect(
        (
          await http
            .post('/v1/session/login')
            .set('Origin', origin)
            .send({ email: 'a@example.cl', password: 'bad' })
        ).status,
      ).toBe(401)
    expect(
      (
        await http
          .post('/v1/session/login')
          .set('Origin', origin)
          .send({ email: 'a@example.cl', password: 'bad' })
      ).status,
    ).toBe(429)
    expect(
      (await db.pool.query('SELECT count(*)::int n FROM vcm.login_limits'))
        .rows[0].n,
    ).toBeGreaterThan(0)
    expect(await hashPassword('test-password-123')).toMatch(/^scrypt\$v1\$/)
    const c = await db.pool.connect()
    try {
      await c.query('SET ROLE vcm_runtime')
      await expect(
        c.query("UPDATE vcm.principal_roles SET role_code='direction'"),
      ).rejects.toMatchObject({ code: '42501' })
    } finally {
      c.release()
    }
  } finally {
    await app.close()
    await db.close()
  }
})
