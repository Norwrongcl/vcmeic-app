import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import type { PoolClient } from 'pg'
const lock = '783195024219'
export async function migrate(
  client: PoolClient,
  directory: string,
): Promise<{ applied: string[] }> {
  const applied: string[] = []
  await client.query('SELECT pg_advisory_lock($1::bigint)', [lock])
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS vcm_meta')
    await client.query(
      'CREATE TABLE IF NOT EXISTS vcm_meta.schema_migrations(version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    )
    const files = (await readdir(directory))
      .filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f))
      .sort()
    const history = await client.query<{ version: string; checksum: string }>(
      'SELECT version,checksum FROM vcm_meta.schema_migrations ORDER BY version',
    )
    const known = new Map(history.rows.map((r) => [r.version, r.checksum]))
    for (const name of known.keys())
      if (!files.includes(name))
        throw new Error(`Applied migration missing: ${name}`)
    // Validate the entire history before applying any pending file.
    const sources = await Promise.all(
      files.map(async (name) => {
        const sql = await readFile(join(directory, name), 'utf8')
        const checksum = createHash('sha256').update(sql).digest('hex')
        if (known.has(name) && known.get(name) !== checksum)
          throw new Error(`Migration checksum mismatch: ${name}`)
        return { name, sql, checksum }
      }),
    )
    const latest = history.rows.at(-1)?.version
    for (const { name, sql, checksum } of sources) {
      if (known.has(name)) continue
      if (latest && name < latest)
        throw new Error(`Out-of-order migration: ${name}`)
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query(
          'INSERT INTO vcm_meta.schema_migrations(version,checksum) VALUES($1,$2)',
          [name, checksum],
        )
        await client.query('COMMIT')
        applied.push(name)
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    }
    return { applied }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1::bigint)', [lock])
  }
}
