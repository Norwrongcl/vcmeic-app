import pg from 'pg'
import { provisionUser } from '../src/identity/provision.ts'
import { privateInput } from './private-input.ts'
const input = await privateInput(process.argv[2])
const pool = new pg.Pool({
  connectionString: String(input.operatorDatabaseUrl),
  max: 1,
})
try {
  if (input.operation === 'revoke-sessions') {
    await pool.query(
      'UPDATE vcm.sessions SET revoked_at=now() WHERE user_id=$1',
      [input.principalId],
    )
    process.stdout.write('Sessions revoked\n')
  } else {
    const id = await provisionUser(
      pool,
      input.user as Parameters<typeof provisionUser>[1],
    )
    process.stdout.write('Provisioned principal ' + id + '\n')
  }
} finally {
  await pool.end()
}
