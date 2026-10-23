import { afterEach, describe, it, expect } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { database } from './helpers/database.ts'
import { migrate } from '../src/migrate.ts'
describe('transactional migrations', () => {
  let clean: Array<() => Promise<unknown>> = []
  afterEach(async () => {
    for (const f of clean.reverse()) await f()
    clean = []
  })
  async function fixture(sql: string) {
    const db = await database(false)
    clean.push(() => db.close())
    const dir = await mkdtemp(join(tmpdir(), 'vcm-migration-'))
    clean.push(() => rm(dir, { recursive: true, force: true }))
    await writeFile(join(dir, '0001_fixture.sql'), sql)
    return { ...db, dir }
  }
  it('applies once and persists checksum', async () => {
    const { client, dir } = await fixture(
      'CREATE TABLE fixture(id text primary key);',
    )
    expect((await migrate(client, dir)).applied).toEqual(['0001_fixture.sql'])
    expect((await migrate(client, dir)).applied).toEqual([])
    expect(
      (
        await client.query(
          'select count(*)::int n from vcm_meta.schema_migrations',
        )
      ).rows[0].n,
    ).toBe(1)
  })
  it('rejects changed checksum', async () => {
    const { client, dir } = await fixture('CREATE TABLE fixture(id text);')
    await migrate(client, dir)
    await writeFile(
      join(dir, '0001_fixture.sql'),
      'CREATE TABLE fixture(id int);',
    )
    await expect(migrate(client, dir)).rejects.toThrow(/checksum/i)
  })
  it('rolls back failed migration and its history', async () => {
    const { client, dir } = await fixture(
      'CREATE TABLE partial(id text); SELECT missing_function();',
    )
    await expect(migrate(client, dir)).rejects.toThrow()
    expect(
      (await client.query("select to_regclass('public.partial') name")).rows[0]
        .name,
    ).toBeNull()
    expect(
      (
        await client.query(
          'select count(*)::int n from vcm_meta.schema_migrations',
        )
      ).rows[0].n,
    ).toBe(0)
  })
  it('serializes concurrent runners', async () => {
    const { client, pool, dir } = await fixture(
      'SELECT pg_sleep(0.1); CREATE TABLE fixture(id text);',
    )
    const other = await pool.connect()
    try {
      const r = await Promise.all([migrate(client, dir), migrate(other, dir)])
      expect(r.flatMap((x) => x.applied)).toEqual(['0001_fixture.sql'])
    } finally {
      other.release()
    }
  })
})
