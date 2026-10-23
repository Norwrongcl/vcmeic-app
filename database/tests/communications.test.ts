import { it, expect } from 'vitest'
import { database } from './helpers/database.ts'
import { base } from './helpers/fixtures.ts'
it('pins editorial packages and publication operations to exact revisions', async () => {
  const db = await database()
  try {
    await base(db.client)
    await db.client.query(
      `INSERT INTO vcm.campaigns(id,case_id,name) VALUES('cam','a','Campaña'); INSERT INTO vcm.campaign_revisions(id,campaign_id,version,charter,actor_id) VALUES('cr','cam',1,'{"objective":"test"}','human'); INSERT INTO vcm.contents(id,case_id,campaign_id,title) VALUES('con','a','cam','Post'); INSERT INTO vcm.content_revisions(id,content_id,version,campaign_revision_id,brief,copy,channel,actor_id) VALUES('v1','con',1,'cr','Brief','Original','instagram','human'),('v2','con',2,'cr','Brief','Nuevo','instagram','human'); INSERT INTO vcm.editorial_packages(id,name,period_starts_on) VALUES('pkg','Semana','2026-10-19'); INSERT INTO vcm.package_revisions(id,package_id,version,actor_id) VALUES('pr','pkg',1,'human'); INSERT INTO vcm.package_items(package_revision_id,content_id,content_revision_id) VALUES('pr','con','v1'); INSERT INTO vcm.approval_records(id,object_id,revision_id,kind,approved_by,reason) SELECT 'ap',protected_object_id,'v1','content','human','OK' FROM vcm.contents WHERE id='con'; INSERT INTO vcm.publication_operations(id,content_revision_id,approval_id,provider,idempotency_key) VALUES('pub','v1','ap','buffer','pub-key');`,
    )
    expect(
      (
        await db.client.query(
          "select copy from vcm.content_revisions where id=(select content_revision_id from vcm.package_items where package_revision_id='pr')",
        )
      ).rows[0].copy,
    ).toBe('Original')
    expect(
      (
        await db.client.query(
          "select status from vcm.publication_operations where id='pub'",
        )
      ).rows[0].status,
    ).toBe('prepared')
    await expect(
      db.client.query(
        "UPDATE vcm.content_revisions set copy='Overwrite' where id='v1'",
      ),
    ).rejects.toThrow(/immutable/i)
    await expect(
      db.client.query(
        "INSERT INTO vcm.publication_operations(id,content_revision_id,approval_id,provider,idempotency_key) VALUES('bad','v2','ap','buffer','bad')",
      ),
    ).rejects.toMatchObject({ code: '23503' })
  } finally {
    await db.close()
  }
})
it('rejects appending an item to an already approved package revision', async () => {
  const db = await database()
  try {
    await base(db.client)
    await db.client.query(
      `INSERT INTO vcm.contents(id,case_id,title) VALUES('c','a','Post'); INSERT INTO vcm.content_revisions(id,content_id,version,brief,copy,channel,actor_id) VALUES('cv','c',1,'b','copy','ig','human'); INSERT INTO vcm.editorial_packages(id,name,period_starts_on) VALUES('pkg','Semana','2026-10-19'); INSERT INTO vcm.package_revisions(id,package_id,version,actor_id) VALUES('pr','pkg',1,'human'); INSERT INTO vcm.approval_records(id,object_id,revision_id,kind,approved_by,reason) SELECT 'ap',protected_object_id,'pr','package','human','OK' FROM vcm.editorial_packages WHERE id='pkg';`,
    )
    await expect(
      db.client.query(
        "INSERT INTO vcm.package_items(package_revision_id,content_id,content_revision_id) VALUES('pr','c','cv')",
      ),
    ).rejects.toThrow(/sealed/i)
  } finally {
    await db.close()
  }
})
