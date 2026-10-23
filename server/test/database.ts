import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { migrate } from '../../database/src/migrate.ts'
export async function database(withMigrations = true) {
  const url = process.env.TEST_DATABASE_URL
  if (!url)
    throw new Error('TEST_DATABASE_URL required; never uses DATABASE_URL')
  const admin = new pg.Client({ connectionString: url })
  await admin.connect()
  const name = 'vcm_test_' + randomUUID().replaceAll('-', '')
  await admin.query('CREATE DATABASE "' + name + '"')
  const u = new URL(url)
  u.pathname = '/' + name
  const pool = new pg.Pool({ connectionString: u.href, max: 8 })
  if (withMigrations) {
    const c = await pool.connect()
    try {
      await c.query(
        await readFile(
          new URL('../../database/bootstrap.sql', import.meta.url),
          'utf8',
        ),
      )
      await migrate(
        c,
        fileURLToPath(new URL('../../database/migrations/', import.meta.url)),
      )
    } finally {
      c.release()
    }
  }
  return {
    pool,
    url: u.href,
    name,
    async close() {
      await pool.end()
      for (let n = 0; n < 100; n++) {
        const r = await admin.query(
          'SELECT count(*)::int n FROM pg_stat_activity WHERE datname=$1',
          [name],
        )
        if (r.rows[0].n === 0) break
        await new Promise((r) => setTimeout(r, 10))
      }
      await admin.query('DROP DATABASE "' + name + '"')
      await admin.end()
    },
  }
}
export async function withTestDatabase(run: (pool: pg.Pool) => Promise<void>) {
  const db = await database()
  try {
    await run(db.pool)
  } finally {
    await db.close()
  }
}
