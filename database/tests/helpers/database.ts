import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { fileURLToPath } from 'node:url'
import { migrate } from '../../src/migrate.ts'
export const migrationsDirectory = fileURLToPath(
  new URL('../../migrations/', import.meta.url),
)
export async function database(withMigrations = true) {
  const url = process.env.TEST_DATABASE_URL
  if (!url)
    throw new Error('TEST_DATABASE_URL required; tests never use DATABASE_URL')
  const admin = new pg.Client({ connectionString: url })
  await admin.connect()
  const name = `vcm_test_${randomUUID().replaceAll('-', '')}`
  await admin.query(`CREATE DATABASE "${name}"`)
  const testUrl = new URL(url)
  testUrl.pathname = '/' + name
  const pool = new pg.Pool({ connectionString: testUrl.href, max: 5 })
  const client = await pool.connect()
  try {
    if (withMigrations) await migrate(client, migrationsDirectory)
  } catch (e) {
    client.release()
    await pool.end()
    await waitForDisconnect(admin, name)
    await admin.query(`DROP DATABASE "${name}"`)
    await admin.end()
    throw e
  }
  return {
    client,
    pool,
    name,
    async close() {
      client.release()
      await pool.end()
      if (!/^vcm_test_[a-f0-9]{32}$/.test(name))
        throw new Error('Unsafe cleanup')
      await waitForDisconnect(admin, name)
      await admin.query(`DROP DATABASE "${name}"`)
      await admin.end()
    },
  }
}

async function waitForDisconnect(admin: pg.Client, name: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const active = await admin.query<{ n: number }>(
      'SELECT count(*)::int n FROM pg_stat_activity WHERE datname=$1',
      [name],
    )
    if (active.rows[0].n === 0) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(
    'Test database still has connections; refusing forced termination',
  )
}
