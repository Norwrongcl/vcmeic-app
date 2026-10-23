import { it, expect } from 'vitest'
import { database } from './helpers/database.ts'
import { project } from './helpers/fixtures.ts'
it('rejects cross-project expense, negative amounts and duplicate commitment attribution', async () => {
  const db = await database()
  try {
    await project(db.client)
    await expect(
      db.client.query(
        "insert into vcm.expenses(id,project_id,budget_item_id,concept,amount,spent_on) values('bad','p','bq','Wrong',10,'2026-10-22')",
      ),
    ).rejects.toMatchObject({ code: '23503' })
    await expect(
      db.client.query(
        "update vcm.budget_items set planned_amount=-1 where id='bi'",
      ),
    ).rejects.toMatchObject({ code: '23514' })
    await db.client.query(
      "update vcm.budget_items set planned_amount=9223372036854775807 where id='bi'",
    )
    expect(
      (
        await db.client.query(
          "select planned_amount from vcm.budget_items where id='bi'",
        )
      ).rows[0].planned_amount,
    ).toBe('9223372036854775807')
    await db.client.query(
      `INSERT INTO vcm.protected_objects(id,kind) VALUES('d','decision'); INSERT INTO vcm.decisions(id,case_id,kind,title,protected_object_id) VALUES('d','a','budget','Presupuesto','d'); INSERT INTO vcm.decision_revisions(id,decision_id,version,proposal,requested_by) VALUES('dr','d',1,'Propuesta','human'); INSERT INTO vcm.approval_records(id,object_id,revision_id,kind,approved_by,reason) VALUES('ap','d','dr','budget','human','Aprobado'); INSERT INTO vcm.budget_authorizations(id,project_id,decision_revision_id,approval_id,amount) VALUES('ba','p','dr','ap',1000); INSERT INTO vcm.commitments(id,project_id,case_id,authorization_id,title,amount,actor_id) VALUES('c1','p','a','ba','Uno',100,'human'),('c2','p','a','ba','Dos',100,'human'); INSERT INTO vcm.expenses(id,project_id,budget_item_id,concept,amount,spent_on) VALUES('e','p','bi','Compra',20,'2026-10-22'); INSERT INTO vcm.commitment_expenses(project_id,commitment_id,expense_id) VALUES('p','c1','e');`,
    )
    await expect(
      db.client.query(
        "INSERT INTO vcm.commitment_expenses(project_id,commitment_id,expense_id) VALUES('p','c2','e')",
      ),
    ).rejects.toMatchObject({ code: '23505' })
  } finally {
    await db.close()
  }
})
