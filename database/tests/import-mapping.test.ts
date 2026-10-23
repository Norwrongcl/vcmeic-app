import { it, expect } from 'vitest'
import { database } from './helpers/database.ts'
it('retains unmapped demo references without creating privileged users', async () => {
  const db = await database()
  try {
    await db.client.query(
      `INSERT INTO vcm.import_batches(id,source_version,source_hash,status) VALUES('i',4,'sha','preview'); INSERT INTO vcm.import_mappings(batch_id,entity_type,legacy_id,demo,payload) VALUES('i','case','stable-id',true,'{"responsible":"demo-direction"}'); INSERT INTO vcm.import_issues(id,batch_id,entity_type,legacy_id,code,detail) VALUES('issue','i','case','stable-id','unmapped_actor','Review needed');`,
    )
    expect(
      (
        await db.client.query(
          'select legacy_id,internal_id,demo from vcm.import_mappings',
        )
      ).rows[0],
    ).toEqual({ legacy_id: 'stable-id', internal_id: null, demo: true })
    expect(
      (await db.client.query('select count(*)::int n from vcm.users')).rows[0]
        .n,
    ).toBe(0)
  } finally {
    await db.close()
  }
})
