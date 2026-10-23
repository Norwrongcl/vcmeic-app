import { it, expect } from 'vitest'
import { database } from './helpers/database.ts'
import { base } from './helpers/fixtures.ts'
it('keeps targets independent and rejects duplicate or cross-case contribution evidence', async () => {
  const db = await database()
  try {
    await base(db.client)
    expect(
      (
        await db.client.query(
          "select target::text from vcm.indicator_targets where indicator_id='4.2.5' and period=2026",
        )
      ).rows[0].target,
    ).toBe('14')
    expect(
      (
        await db.client.query(
          'select count(*)::int n from vcm.indicator_contributions',
        )
      ).rows[0].n,
    ).toBe(0)
    await db.client.query(
      `INSERT INTO vcm.presence_records(id,case_id) VALUES('pres','b'); INSERT INTO vcm.evidences(id,case_id,source_id,name) VALUES('ea','a','sa','Evidence'); INSERT INTO vcm.indicator_contributions(id,case_id,presence_id,indicator_id,rule_version,period,value,actor_id) VALUES('ic','b','pres','4.2.5','PO-2026.09-v1',2026,1,'human');`,
    )
    await expect(
      db.client.query(
        "INSERT INTO vcm.indicator_contributions(id,case_id,presence_id,indicator_id,rule_version,period,value,actor_id) VALUES('dup','b','pres','4.2.5','PO-2026.09-v1',2026,1,'human')",
      ),
    ).rejects.toMatchObject({ code: '23505' })
    await expect(
      db.client.query(
        "INSERT INTO vcm.contribution_evidences(contribution_id,case_id,evidence_id,evidence_version) VALUES('ic','b','ea',1)",
      ),
    ).rejects.toMatchObject({ code: '23503' })
    expect(
      (
        await db.client.query(
          "select availability from vcm.indicator_rule_versions where indicator_id='4.2.2'",
        )
      ).rows[0].availability,
    ).toBe('pending')
  } finally {
    await db.close()
  }
})
