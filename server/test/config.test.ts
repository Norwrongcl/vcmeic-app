import { it, expect } from 'vitest'
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from '../src/config.ts'
it('loads production secrets from private files and refuses readable secret files or plaintext origins', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vcm-config-'))
  try {
    const db = join(dir, 'database_url'),
      key = join(dir, 'cursor_key')
    await writeFile(db, 'postgresql://vcm_api:fake-test-secret@postgres/vcm', {
      mode: 0o600,
    })
    await writeFile(key, 'a'.repeat(64), { mode: 0o600 })
    const env = {
      NODE_ENV: 'production',
      DATABASE_URL_FILE: db,
      CURSOR_KEY_FILE: key,
      WEB_ORIGINS: 'https://api.vcmeic.cl',
    }
    expect((await loadConfig(env)).production).toBe(true)
    await chmod(db, 0o644)
    await expect(loadConfig(env)).rejects.toThrow('private')
    await chmod(db, 0o600)
    await expect(
      loadConfig({ ...env, WEB_ORIGINS: 'http://localhost:5174' }),
    ).rejects.toThrow()
  } finally {
    await rm(dir, { recursive: true })
  }
})
