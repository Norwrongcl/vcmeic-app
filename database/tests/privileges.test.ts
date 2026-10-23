import { it, expect } from 'vitest'
import { database } from './helpers/database.ts'
it('runtime cannot perform DDL or rewrite audit and historical revisions', async () => {
  const db = await database()
  try {
    await db.client.query('SET ROLE vcm_runtime')
    await expect(
      db.client.query('CREATE TABLE vcm.forbidden(id text)'),
    ).rejects.toMatchObject({ code: '42501' })
    await expect(
      db.client.query("UPDATE vcm.audit_events SET reason='erase'"),
    ).rejects.toMatchObject({ code: '42501' })
    await expect(
      db.client.query('DELETE FROM vcm.content_revisions'),
    ).rejects.toMatchObject({ code: '42501' })
    await db.client.query('RESET ROLE')
    expect(
      (
        await db.client.query(
          "select rolsuper,rolbypassrls from pg_roles where rolname='vcm_runtime'",
        )
      ).rows[0],
    ).toEqual({ rolsuper: false, rolbypassrls: false })
  } finally {
    await db.close()
  }
})
