import { it, expect } from 'vitest'
import { database } from './helpers/database.ts'
it('normalizes unique email independently of contacts', async () => {
  const db = await database()
  try {
    await db.client.query(
      "INSERT INTO vcm.principals(id,kind,name) VALUES('u','human','User'),('v','human','Other'); INSERT INTO vcm.users(principal_id,email,password_hash) VALUES('u','Name@Example.com','test-hash'); INSERT INTO vcm.contacts(id,name,email) VALUES('ct','Name','Name@Example.com')",
    )
    await expect(
      db.client.query(
        "INSERT INTO vcm.users(principal_id,email,password_hash) VALUES('v','name@example.com','test-hash')",
      ),
    ).rejects.toMatchObject({ code: '23505' })
    expect(
      (await db.client.query('select email from vcm.users')).rows[0].email,
    ).toBe('name@example.com')
  } finally {
    await db.close()
  }
})
