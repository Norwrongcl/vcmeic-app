import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import pg from 'pg'
import { provisionService, revokeService } from '../src/identity/provision.ts'
import { privateInput } from './private-input.ts'
const input = await privateInput(process.argv[2])
const pool = new pg.Pool({
  connectionString: String(input.operatorDatabaseUrl),
  max: 1,
})
try {
  if (input.operation === 'revoke') {
    await revokeService(pool, String(input.credentialId))
    process.stdout.write('Credential revoked\n')
  } else {
    const token = randomBytes(32).toString('base64url')
    const identity = await provisionService(pool, {
      name: String(input.name),
      scopes: input.scopes as string[],
      token,
    })
    try {
      await writeFile(
        String(input.destination),
        JSON.stringify({ ...identity, token }) + '\n',
        { mode: 0o600, flag: 'wx' },
      )
    } catch (e) {
      await revokeService(pool, identity.credentialId)
      throw e
    }
    process.stdout.write(
      'Provisioned credential ' + identity.credentialId + '\n',
    )
  }
} finally {
  await pool.end()
}
