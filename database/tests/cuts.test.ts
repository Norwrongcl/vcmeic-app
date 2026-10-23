import { it, expect } from 'vitest'
import { database } from './helpers/database.ts'
import { base } from './helpers/fixtures.ts'
it('preserves the dossier version included in an institutional cut', async () => {
  const db = await database()
  try {
    await base(db.client)
    await db.client.query(
      `INSERT INTO vcm.case_snapshots(case_id,version,payload,actor_id) VALUES('a',1,'{"name":"Original"}','human'); INSERT INTO vcm.institutional_cuts(id,name,period) VALUES('cut','Corte','2026'); INSERT INTO vcm.cut_revisions(cut_id,version) VALUES('cut',1); INSERT INTO vcm.cut_cases(cut_id,cut_version,case_id,case_version) VALUES('cut',1,'a',1); UPDATE vcm.cases SET name='Nuevo',version=2 WHERE id='a';`,
    )
    expect(
      (
        await db.client.query(
          "select payload->>'name' name from vcm.case_snapshots s join vcm.cut_cases c on c.case_id=s.case_id and c.case_version=s.version",
        )
      ).rows[0].name,
    ).toBe('Original')
    await expect(
      db.client.query(
        "UPDATE vcm.case_snapshots SET payload='{}' WHERE case_id='a'",
      ),
    ).rejects.toThrow(/immutable/i)
  } finally {
    await db.close()
  }
})
