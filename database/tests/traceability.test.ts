import { beforeEach, afterEach, it, expect } from 'vitest'
import { database } from './helpers/database.ts'
import { base } from './helpers/fixtures.ts'
let db: Awaited<ReturnType<typeof database>>
beforeEach(async () => {
  db = await database()
  await base(db.client)
})
afterEach(async () => {
  if (db) await db.close()
})
it('rejects orphan relations and preserves a referenced source', async () => {
  await expect(
    db.client.query(
      "INSERT INTO vcm.case_organizations VALUES('a','missing','partner')",
    ),
  ).rejects.toMatchObject({ code: '23503' })
  await db.client.query(
    "INSERT INTO vcm.evidences(id,case_id,source_id,name) VALUES('e','a','sa','Evidencia')",
  )
  await expect(
    db.client.query("DELETE FROM vcm.sources WHERE id='sa'"),
  ).rejects.toMatchObject({ code: '23503' })
})
it('preserves conflicting values and forbids selecting another case assertion', async () => {
  await db.client.query(
    `INSERT INTO vcm.case_fields(case_id,field_key,schema_version,status) VALUES('a','studentsActual','p52-2026.09-v1','conflict'),('b','studentsActual','p52-2026.09-v1','pending'); INSERT INTO vcm.field_assertions(id,case_id,field_key,source_id,value_type,number_value,actor_id) VALUES('x','a','studentsActual','sa','number',10,'hermes'),('y','a','studentsActual','sa','number',15,'hermes');`,
  )
  await expect(
    db.client.query(
      "UPDATE vcm.case_fields SET selected_assertion_id='x' WHERE case_id='b'",
    ),
  ).rejects.toMatchObject({ code: '23503' })
  expect(
    (
      await db.client.query(
        'SELECT number_value::text FROM vcm.field_assertions ORDER BY id',
      )
    ).rows,
  ).toEqual([{ number_value: '10' }, { number_value: '15' }])
  await expect(
    db.client.query(
      "UPDATE vcm.field_assertions SET number_value=12 WHERE id='x'",
    ),
  ).rejects.toThrow(/immutable/i)
})
it('distinguishes unknown from zero and forbids cross-case evidence source', async () => {
  await db.client.query(
    "INSERT INTO vcm.case_fields(case_id,field_key,schema_version) VALUES('a','studentsActual','p52-2026.09-v1')",
  )
  expect(
    (await db.client.query('select selected_assertion_id from vcm.case_fields'))
      .rows[0].selected_assertion_id,
  ).toBeNull()
  await expect(
    db.client.query(
      "INSERT INTO vcm.evidences(id,case_id,source_id,name) VALUES('e','a','sb','Wrong')",
    ),
  ).rejects.toMatchObject({ code: '23503' })
})
it('requires typed assertion shape and records document confidentiality separately', async () => {
  await db.client.query(
    "INSERT INTO vcm.case_fields(case_id,field_key,schema_version) VALUES('a','studentsActual','p52-2026.09-v1')",
  )
  await expect(
    db.client.query(
      "INSERT INTO vcm.field_assertions(id,case_id,field_key,source_id,value_type,text_value,actor_id) VALUES('bad','a','studentsActual','sa','number','ten','human')",
    ),
  ).rejects.toMatchObject({ code: '23514' })
  await db.client.query(
    "INSERT INTO vcm.protected_objects(id,kind,confidentiality) VALUES('doc','document','sensitive'); INSERT INTO vcm.document_references(id,name,protected_object_id) VALUES('doc','Privado','doc')",
  )
  expect(
    (
      await db.client.query(
        "select confidentiality from vcm.protected_objects where id='doc'",
      )
    ).rows[0].confidentiality,
  ).toBe('sensitive')
})
it('retains immutable review history across evidence versions', async () => {
  await db.client.query(
    "INSERT INTO vcm.users(principal_id,email,password_hash) VALUES('human','test@example.org','fixture'); INSERT INTO vcm.evidences(id,case_id,source_id,name) VALUES('ev','a','sa','Proof'); INSERT INTO vcm.evidence_reviews(id,evidence_id,evidence_version,reviewer_id,result,reason) VALUES('r','ev',1,'human','verified','Checked'); UPDATE vcm.evidences SET version=2,review_status='pending' WHERE id='ev'",
  )
  expect(
    (
      await db.client.query(
        "SELECT evidence_version,result FROM vcm.evidence_reviews WHERE id='r'",
      )
    ).rows[0],
  ).toEqual({ evidence_version: 1, result: 'verified' })
  await expect(
    db.client.query(
      "UPDATE vcm.evidence_reviews SET evidence_version=2 WHERE id='r'",
    ),
  ).rejects.toThrow(/immutable/i)
})
