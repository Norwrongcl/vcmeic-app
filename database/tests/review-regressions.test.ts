import { it, expect } from 'vitest'
import { database } from './helpers/database.ts'
import { base } from './helpers/fixtures.ts'
async function content(db: Awaited<ReturnType<typeof database>>) {
  await base(db.client)
  await db.client.query(
    `INSERT INTO vcm.contents(id,case_id,title) VALUES('c','a','Post'); INSERT INTO vcm.content_revisions(id,content_id,version,brief,copy,channel,actor_id) VALUES('cv','c',1,'b','copy','ig','human'); INSERT INTO vcm.editorial_packages(id,name,period_starts_on) VALUES('pkg','Week','2026-10-19'); INSERT INTO vcm.package_revisions(id,package_id,version,actor_id) VALUES('pr','pkg',1,'human');`,
  )
}
const approvePackage = `INSERT INTO vcm.approval_records(id,object_id,revision_id,kind,approved_by,reason) SELECT 'ap',protected_object_id,'pr','package','human','OK' FROM vcm.editorial_packages WHERE id='pkg'`
const addItem = `INSERT INTO vcm.package_items(package_revision_id,content_id,content_revision_id) VALUES('pr','c','cv')`
it('serializes approval before a competing package membership insert', async () => {
  const db = await database()
  const b = await db.pool.connect()
  try {
    await content(db)
    await db.client.query('BEGIN')
    await db.client.query(approvePackage)
    let settled = false
    const write = b.query(addItem).then(
      () => {
        settled = true
        return 'accepted'
      },
      (e) => {
        settled = true
        return e.message as string
      },
    )
    await new Promise((r) => setTimeout(r, 100))
    expect(settled).toBe(false)
    await db.client.query('COMMIT')
    expect(await write).toMatch(/sealed/i)
  } finally {
    await db.client.query('ROLLBACK')
    b.release()
    await db.close()
  }
})
it('serializes package membership before a competing approval', async () => {
  const db = await database()
  const b = await db.pool.connect()
  try {
    await content(db)
    await db.client.query('BEGIN')
    await db.client.query(addItem)
    let settled = false
    const approval = b.query(approvePackage).then(() => {
      settled = true
    })
    await new Promise((r) => setTimeout(r, 100))
    expect(settled).toBe(false)
    await db.client.query('COMMIT')
    await approval
    expect(
      (await db.client.query('select count(*)::int n from vcm.package_items'))
        .rows[0].n,
    ).toBe(1)
  } finally {
    await db.client.query('ROLLBACK')
    b.release()
    await db.close()
  }
})
it('seals assets transitively through approved packages', async () => {
  const db = await database()
  try {
    await content(db)
    await db.client.query(addItem)
    await db.client.query(approvePackage)
    await db.client.query(
      "INSERT INTO vcm.document_references(id,name) VALUES('doc','Asset')",
    )
    await expect(
      db.client.query(
        "INSERT INTO vcm.content_assets(content_revision_id,document_id) VALUES('cv','doc')",
      ),
    ).rejects.toThrow(/sealed/i)
  } finally {
    await db.close()
  }
})
it('seals objective membership with the approved plan revision', async () => {
  const db = await database()
  try {
    await base(db.client)
    await db.client.query(
      `INSERT INTO vcm.annual_plans(id,year,title) VALUES('pl',2026,'Plan'); INSERT INTO vcm.plan_revisions(id,plan_id,version,reason,actor_id) VALUES('plr','pl',1,'Plan','human'); INSERT INTO vcm.plan_objectives(id,plan_revision_id,title,measure) VALUES('o','plr','Objective','completed'); INSERT INTO vcm.approval_records(id,object_id,revision_id,kind,approved_by,reason) SELECT 'ap',protected_object_id,'plr','annual_plan','human','OK' FROM vcm.annual_plans WHERE id='pl';`,
    )
    await expect(
      db.client.query(
        "INSERT INTO vcm.objective_cases(objective_id,case_id) VALUES('o','a')",
      ),
    ).rejects.toThrow(/sealed/i)
  } finally {
    await db.close()
  }
})
it('prevents cross-case evidence references and rewriting captured reference membership', async () => {
  const db = await database()
  try {
    await base(db.client)
    await db.client.query(
      `INSERT INTO vcm.evidences(id,case_id,source_id,name) VALUES('ea','a','sa','A'),('eb','b','sb','B'); INSERT INTO vcm.case_fields(case_id,field_key,schema_version) VALUES('a','evidence','p52-2026.09-v1'); INSERT INTO vcm.field_assertions(id,case_id,field_key,source_id,actor_id,value_type,references_value) VALUES('fa','a','evidence','sa','hermes','references','[{"type":"evidence","id":"ea"},{"type":"evidence","id":"eb"}]'); INSERT INTO vcm.field_assertion_references(assertion_id,evidence_id) VALUES('fa','ea');`,
    )
    await expect(
      db.client.query(
        "INSERT INTO vcm.field_assertion_references(assertion_id,evidence_id) VALUES('fa','eb')",
      ),
    ).rejects.toMatchObject({ code: '23503' })
    await expect(
      db.client.query(
        "UPDATE vcm.field_assertion_references SET evidence_id='eb' WHERE assertion_id='fa'",
      ),
    ).rejects.toThrow(/immutable/i)
  } finally {
    await db.close()
  }
})
it('rejects newly invented references not declared in the captured assertion', async () => {
  const db = await database()
  try {
    await base(db.client)
    await db.client.query(
      `INSERT INTO vcm.evidences(id,case_id,source_id,name) VALUES('ea','a','sa','A'); INSERT INTO vcm.case_fields(case_id,field_key,schema_version) VALUES('a','evidence','p52-2026.09-v1'); INSERT INTO vcm.field_assertions(id,case_id,field_key,source_id,actor_id,value_type,references_value) VALUES('fa','a','evidence','sa','hermes','references','[]');`,
    )
    await expect(
      db.client.query(
        "INSERT INTO vcm.field_assertion_references(assertion_id,evidence_id) VALUES('fa','ea')",
      ),
    ).rejects.toThrow(/captured reference/i)
  } finally {
    await db.close()
  }
})
it('rejects resolution candidates from another field or case', async () => {
  const db = await database()
  try {
    await base(db.client)
    await db.client.query(
      `INSERT INTO vcm.case_fields(case_id,field_key,schema_version) VALUES('a','studentsActual','p52-2026.09-v1'),('b','studentsActual','p52-2026.09-v1'); INSERT INTO vcm.field_assertions(id,case_id,field_key,source_id,actor_id,value_type,number_value) VALUES('fa','a','studentsActual','sa','human','number',1),('fb','b','studentsActual','sb','human','number',2); INSERT INTO vcm.field_resolutions(id,case_id,field_key,selected_assertion_id,actor_id,reason) VALUES('r','a','studentsActual','fa','human','Checked');`,
    )
    await expect(
      db.client.query(
        "INSERT INTO vcm.resolution_assertions(resolution_id,assertion_id) VALUES('r','fb')",
      ),
    ).rejects.toMatchObject({ code: '23503' })
  } finally {
    await db.close()
  }
})
it('rejects strategy revision from another campaign including campaignless content', async () => {
  const db = await database()
  try {
    await base(db.client)
    await db.client.query(
      `INSERT INTO vcm.campaigns(id,case_id,name) VALUES('ca','a','A'),('cb','b','B'); INSERT INTO vcm.campaign_revisions(id,campaign_id,version,charter,actor_id) VALUES('cbr','cb',1,'{}','human'); INSERT INTO vcm.contents(id,case_id,campaign_id,title) VALUES('c','a','ca','Post'); INSERT INTO vcm.contents(id,case_id,title) VALUES('none','a','No campaign');`,
    )
    for (const id of ['c', 'none'])
      await expect(
        db.client.query(
          "INSERT INTO vcm.content_revisions(id,content_id,version,campaign_revision_id,brief,copy,channel,actor_id) VALUES($1,$2,1,'cbr','b','copy','ig','human')",
          ['bad-' + id, id],
        ),
      ).rejects.toMatchObject({ code: '23503' })
  } finally {
    await db.close()
  }
})
it('requires a real cut revision and freezes its finalized membership', async () => {
  const db = await database()
  try {
    await base(db.client)
    await db.client.query(
      "INSERT INTO vcm.case_snapshots(case_id,version,payload,actor_id) VALUES('a',1,'{}','human'); INSERT INTO vcm.institutional_cuts(id,name,period) VALUES('cut','Cut','2026')",
    )
    await expect(
      db.client.query("INSERT INTO vcm.cut_cases VALUES('cut',999,'a',1)"),
    ).rejects.toMatchObject({ code: '23503' })
    await db.client.query(
      "INSERT INTO vcm.cut_revisions(cut_id,version) VALUES('cut',1); UPDATE vcm.cut_revisions SET sealed_at=now() WHERE cut_id='cut' AND version=1",
    )
    await expect(
      db.client.query("INSERT INTO vcm.cut_cases VALUES('cut',1,'a',1)"),
    ).rejects.toThrow(/sealed/i)
  } finally {
    await db.close()
  }
})
it('makes budget authorizations immutable once referenced', async () => {
  const db = await database()
  try {
    await base(db.client)
    await db.client.query(
      `INSERT INTO vcm.projects(id,name) VALUES('p','P'); INSERT INTO vcm.project_cases VALUES('p','a'); INSERT INTO vcm.decisions(id,case_id,kind,title) VALUES('d','a','budget','Budget'); INSERT INTO vcm.decision_revisions(id,decision_id,version,proposal,requested_by) VALUES('dr','d',1,'P','human'); INSERT INTO vcm.approval_records(id,object_id,revision_id,kind,approved_by,reason) SELECT 'ap',protected_object_id,'dr','budget','human','OK' FROM vcm.decisions WHERE id='d'; INSERT INTO vcm.budget_authorizations(id,project_id,decision_revision_id,approval_id,amount) VALUES('ba','p','dr','ap',1000); INSERT INTO vcm.commitments(id,project_id,case_id,authorization_id,title,amount,actor_id) VALUES('com','p','a','ba','C',100,'human');`,
    )
    await expect(
      db.client.query(
        "UPDATE vcm.budget_authorizations SET amount=2000 WHERE id='ba'",
      ),
    ).rejects.toThrow(/immutable/i)
  } finally {
    await db.close()
  }
})
it('authorizes exact package members without inventing per-content approvals', async () => {
  const db = await database()
  try {
    await content(db)
    await db.client.query(addItem)
    await db.client.query(approvePackage)
    await db.client.query(
      "INSERT INTO vcm.publication_operations(id,content_revision_id,approval_id,provider,idempotency_key) VALUES('pub','cv','ap','buffer','key')",
    )
    expect(
      (
        await db.client.query(
          "SELECT status FROM vcm.publication_operations WHERE id='pub'",
        )
      ).rows[0].status,
    ).toBe('prepared')
  } finally {
    await db.close()
  }
})
it('rechecks transitive package seals after waiting for a concurrent membership transaction', async () => {
  const db = await database()
  const other = await db.pool.connect()
  try {
    await content(db)
    await db.client.query(
      "INSERT INTO vcm.document_references(id,name) VALUES('doc','Asset')",
    )
    await db.client.query('BEGIN')
    await db.client.query(addItem)
    await db.client.query(approvePackage)
    let settled = false
    const pending = other
      .query(
        "INSERT INTO vcm.content_assets(content_revision_id,document_id) VALUES('cv','doc')",
      )
      .then(
        () => {
          settled = true
          return 'accepted'
        },
        (e) => {
          settled = true
          return e.message as string
        },
      )
    await new Promise((r) => setTimeout(r, 100))
    expect(settled).toBe(false)
    await db.client.query('COMMIT')
    expect(await pending).toMatch(/sealed/i)
  } finally {
    await db.client.query('ROLLBACK')
    other.release()
    await db.close()
  }
})
