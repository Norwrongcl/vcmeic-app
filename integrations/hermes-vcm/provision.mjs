// Run only in the API image on vcm_backend with the operator password mounted read-only.
import { createRequire } from 'node:module'
import { readFile, writeFile, chown, unlink } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
const require = createRequire('/app/server/package.json')
const pg = require('pg')
const { provisionService, revokeService } = await import(
  'file:///app/server/dist/server/src/identity/provision.js'
)
const profile = process.argv[2]
const profiles = {
  interview: {
    name: 'Hermes WhatsApp VcM Entrevistas',
    scopes: ['interview:read', 'interview:capture'],
    destination: '/opt/data/profiles/vcm-entrevistas/vcm-api-credential.json',
  },
  coordination: {
    name: 'Hermes Telegram VcM Coordinación',
    scopes: ['coordination:read', 'coordination:write'],
    destination: '/opt/data/vcm-api-credential.json',
  },
}
if (!Object.hasOwn(profiles, profile)) throw new Error('Unknown profile')
const spec = profiles[profile]
const password = (await readFile('/run/secrets/postgres_password', 'utf8')).trim()
const pool = new pg.Pool({
  host: 'vcm-services-postgres-1',
  port: 5432,
  database: 'vcm',
  user: 'postgres',
  password,
  max: 1,
})
try {
  const token = randomBytes(32).toString('base64url')
  const identity = await provisionService(pool, {
    name: spec.name,
    scopes: spec.scopes,
    token,
  })
  let created = false
  try {
    await writeFile(spec.destination, JSON.stringify({ ...identity, token }) + '\n', {
      mode: 0o600,
      flag: 'wx',
    })
    created = true
    await chown(spec.destination, 10000, 10000)
  } catch (error) {
    if (created) await unlink(spec.destination).catch(() => {})
    await revokeService(pool, identity.credentialId)
    throw error
  }
  process.stdout.write(`Provisioned ${profile}: ${identity.credentialId}\n`)
} finally {
  await pool.end()
}
