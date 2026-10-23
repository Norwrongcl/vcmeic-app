import { it, expect } from 'vitest'
import { database } from './helpers/database.ts'
import { project } from './helpers/fixtures.ts'
it('shares one operational project across two dossiers without duplicate budget', async () => {
  const db = await database()
  try {
    await project(db.client)
    expect(
      (
        await db.client.query(
          "select count(*)::int n from vcm.project_cases where project_id='p'",
        )
      ).rows[0].n,
    ).toBe(2)
    expect(
      (
        await db.client.query(
          'select sum(planned_amount)::text amount from vcm.budget_items where project_id in (select project_id from vcm.project_cases)',
        )
      ).rows[0].amount,
    ).toBe('1000')
  } finally {
    await db.close()
  }
})
