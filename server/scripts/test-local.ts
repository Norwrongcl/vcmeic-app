import EmbeddedPostgres from '../../database/node_modules/embedded-postgres/dist/index.js'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
const dir = await mkdtemp(join(tmpdir(), 'vcm-pg-'))
const password = randomBytes(24).toString('hex')
const port = process.env.TEST_PG_PORT
  ? Number(process.env.TEST_PG_PORT)
  : await new Promise<number>((resolve, reject) => {
      const server = createServer()
      server.on('error', reject)
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        if (!address || typeof address === 'string') {
          server.close()
          reject(new Error('No test port'))
          return
        }
        const port = address.port
        server.close((e) => (e ? reject(e) : resolve(port)))
      })
    })
const cluster = new EmbeddedPostgres({
  databaseDir: join(dir, 'data'),
  user: 'postgres',
  password,
  port,
  persistent: false,
  authMethod: 'scram-sha-256',
  postgresFlags: ['-h', '127.0.0.1', '-k', dir],
  onLog: () => {},
  onError: () => {},
})
let exitCode = 1
try {
  await cluster.initialise()
  await cluster.start()
  const client = cluster.getPgClient()
  await client.connect()
  process.stdout.write(
    (await client.query('select version()')).rows[0].version + '\n',
  )
  await client.query(
    await readFile(
      new URL('../../database/bootstrap.sql', import.meta.url),
      'utf8',
    ),
  )
  await client.end()
  const args = process.argv.slice(2).filter((v) => v !== '--')
  const command =
    args[0] === '--dictionary'
      ? ['--experimental-strip-types', 'scripts/dictionary.ts']
      : ['node_modules/vitest/vitest.mjs', 'run', ...args]
  const child = spawn(process.execPath, command, {
    cwd: new URL('..', import.meta.url),
    stdio: 'inherit',
    env: {
      ...process.env,
      TEST_DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${port}/postgres`,
    },
  })
  const code = await new Promise<number>((resolve, reject) => {
    child.on('error', reject)
    child.on('exit', (c) => resolve(c ?? 1))
  })
  exitCode = code
} finally {
  await cluster.stop()
  await rm(dir, { recursive: true, force: true })
  // embedded-postgres async-exit-hook resets process.exitCode on beforeExit.
  // An explicit exit after cleanup preserves the test process result.
  process.exit(exitCode)
}
