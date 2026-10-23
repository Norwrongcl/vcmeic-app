import { it, expect } from 'vitest'
import { database } from './helpers/database.ts'
import { base } from './helpers/fixtures.ts'
it('preserves the exact historical revision after a new proposal', async () => {
  const db = await database()
  try {
    await base(db.client)
    await db.client.query(
      `INSERT INTO vcm.protected_objects(id,kind) VALUES('d','decision'); INSERT INTO vcm.decisions(id,case_id,kind,title,protected_object_id) VALUES('d','a','flow','Flujo','d'); INSERT INTO vcm.decision_revisions(id,decision_id,version,proposal,requested_by) VALUES('r1','d',1,'Original','human'),('r2','d',2,'Cambio','human'); INSERT INTO vcm.approval_records(id,object_id,revision_id,kind,approved_by,reason) VALUES('ap','d','r1','flow','human','Revisado');`,
    )
    await expect(
      db.client.query(
        "UPDATE vcm.decision_revisions set proposal='Changed' where id='r1'",
      ),
    ).rejects.toThrow(/immutable/i)
    expect(
      (
        await db.client.query(
          "SELECT proposal FROM vcm.decision_revisions WHERE id=(SELECT revision_id FROM vcm.approval_records WHERE id='ap')",
        )
      ).rows[0].proposal,
    ).toBe('Original')
  } finally {
    await db.close()
  }
})
it('forbids service self-approval', async () => {
  const db = await database()
  try {
    await base(db.client)
    await db.client.query(
      "INSERT INTO vcm.decisions(id,case_id,kind,title) VALUES('d','a','flow','Flow'); INSERT INTO vcm.decision_revisions(id,decision_id,version,proposal,requested_by) VALUES('dr','d',1,'P','hermes')",
    )
    await expect(
      db.client.query(
        "INSERT INTO vcm.approval_records(id,object_id,revision_id,kind,approved_by,reason) SELECT 'ap',protected_object_id,'dr','flow','hermes','yes' FROM vcm.decisions WHERE id='d'",
      ),
    ).rejects.toMatchObject({ code: '23514' })
  } finally {
    await db.close()
  }
})
it('binds a mandate to its own project plan revision', async () => {
  const db = await database()
  try {
    await base(db.client)
    await db.client.query(
      `INSERT INTO vcm.projects(id,name) VALUES('p','Project'),('q','Other'); INSERT INTO vcm.work_plan_revisions(id,project_id,version,objective,results_planned,scope_included,scope_excluded,closing_criteria,expected_evidence,risks,actor_id) VALUES('wp','p',1,'o','r','in','out','close','e','risk','human'); INSERT INTO vcm.decisions(id,case_id,kind,title) VALUES('d','a','flow','Flow'); INSERT INTO vcm.decision_revisions(id,decision_id,version,proposal,requested_by) VALUES('dr','d',1,'P','human'); INSERT INTO vcm.approval_records(id,object_id,revision_id,kind,approved_by,reason) SELECT 'ap',protected_object_id,'dr','flow','human','OK' FROM vcm.decisions WHERE id='d'; INSERT INTO vcm.operation_mandates(id,project_id,plan_revision_id,approval_id) VALUES('m','p','wp','ap');`,
    )
    await expect(
      db.client.query(
        "INSERT INTO vcm.operation_mandates(id,project_id,plan_revision_id,approval_id) VALUES('bad','q','wp','ap')",
      ),
    ).rejects.toMatchObject({ code: '23503' })
    expect(
      (
        await db.client.query(
          "SELECT plan_revision_id,approval_id FROM vcm.operation_mandates WHERE id='m'",
        )
      ).rows[0],
    ).toEqual({ plan_revision_id: 'wp', approval_id: 'ap' })
  } finally {
    await db.close()
  }
})
