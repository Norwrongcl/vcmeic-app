import pg from 'pg'
import { fileURLToPath } from 'node:url'
import { migrate } from './migrate.ts'
const url = process.env.DATABASE_URL
if (!url)
  throw new Error('DATABASE_URL required (private server environment only)')
const pool = new pg.Pool({ connectionString: url, max: 1 })
const client = await pool.connect()
try {
  console.log(
    JSON.stringify(
      await migrate(
        client,
        fileURLToPath(new URL('../migrations/', import.meta.url)),
      ),
    ),
  )
} finally {
  client.release()
  await pool.end()
}
