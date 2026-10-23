import { it, expect } from 'vitest'
import { database } from './helpers/database.ts'
import { base } from './helpers/fixtures.ts'
it('scopes idempotency to actor and operation and skips locked jobs', async () => {
  const db = await database()
  const other = await db.pool.connect()
  try {
    await base(db.client)
    await db.client.query(
      `INSERT INTO vcm.idempotency_requests(principal_id,operation,key,request_hash) VALUES('human','create','key','h'),('hermes','create','key','h'); INSERT INTO vcm.automation_rules(id,name) VALUES('rule','Falta encuesta'); INSERT INTO vcm.automation_rule_versions(id,rule_id,version,trigger_type,conditions,action_class) VALUES('rv','rule',1,'changed','{}','lookup'); INSERT INTO vcm.jobs(id,rule_revision_id,case_id,idempotency_key) VALUES('j1','rv','a','1'),('j2','rv','b','2');`,
    )
    await expect(
      db.client.query(
        "INSERT INTO vcm.idempotency_requests(principal_id,operation,key,request_hash) VALUES('human','create','key','h')",
      ),
    ).rejects.toMatchObject({ code: '23505' })
    await db.client.query('BEGIN')
    const a = await db.client.query(
      "SELECT id FROM vcm.jobs WHERE status='pending' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1",
    )
    await other.query('BEGIN')
    const b = await other.query(
      "SELECT id FROM vcm.jobs WHERE status='pending' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1",
    )
    expect(a.rows[0].id).toBe('j1')
    expect(b.rows[0].id).toBe('j2')
    await other.query('ROLLBACK')
    await db.client.query('ROLLBACK')
  } finally {
    other.release()
    await db.close()
  }
})
