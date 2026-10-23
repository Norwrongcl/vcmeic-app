import { it, expect } from 'vitest'
import { database } from './helpers/database.ts'
import { base } from './helpers/fixtures.ts'
it('rolls back audit and outbox with a failed business transaction', async () => {
  const db = await database()
  try {
    await base(db.client)
    await db.client.query('BEGIN')
    await db.client.query(
      "INSERT INTO vcm.audit_events(id,object_id,actor_id,action,reason,rule_version,correlation_id) VALUES('audit','case-a','human','update','test','PO-2026.09-v1','corr'); INSERT INTO vcm.outbox_events(object_id,event_type,payload,correlation_id) VALUES('case-a','changed','{}','corr')",
    )
    await expect(
      db.client.query("UPDATE vcm.cases SET priority='nonsense' WHERE id='a'"),
    ).rejects.toThrow()
    await db.client.query('ROLLBACK')
    expect(
      (await db.client.query('select count(*)::int n from vcm.audit_events'))
        .rows[0].n,
    ).toBe(0)
    expect(
      (await db.client.query('select count(*)::int n from vcm.outbox_events'))
        .rows[0].n,
    ).toBe(0)
  } finally {
    await db.close()
  }
})
