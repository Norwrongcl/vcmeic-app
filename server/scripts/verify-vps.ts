import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
const password = (
  await readFile(
    process.env.OPERATOR_PASSWORD_FILE ?? '/run/secrets/operator_password',
    'utf8',
  )
).trim()
const url = new URL('postgresql://postgres@postgres:5432/postgres')
url.password = password
const child = spawn(
  process.execPath,
  ['node_modules/vitest/vitest.mjs', 'run', '--configLoader', 'native'],
  {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, TEST_DATABASE_URL: url.href },
  },
)
process.exitCode = await new Promise<number>((resolve, reject) => {
  child.on('error', reject)
  child.on('exit', (code) => resolve(code ?? 1))
})
