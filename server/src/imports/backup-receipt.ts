import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
export async function schemaFingerprint(client: Pool | PoolClient) {
  const rows = (
    await client.query(
      'SELECT version,checksum FROM vcm_meta.schema_migrations ORDER BY version',
    )
  ).rows
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex')
}
// Operator-only function. The HTTP identity has no INSERT privilege on receipts.
// COMPLETE is produced by the host backup script after pg_restore --list succeeds.
export async function issueImportBackupReceipt(
  pool: Pool,
  batchId: string,
  directory: string,
) {
  await stat(join(directory, 'COMPLETE'))
  const manifest = await readFile(join(directory, 'SHA256SUMS'), 'utf8'),
    line = manifest.split('\n').find((l) => / {2}vcm\.dump$/.test(l))
  if (!line) throw new Error('Verified vcm.dump checksum required')
  const dump = await readFile(join(directory, 'vcm.dump'))
  if (dump.subarray(0, 5).toString() !== 'PGDMP')
    throw new Error('Custom PostgreSQL dump required')
  const checksum = createHash('sha256').update(dump).digest('hex')
  if (line.split(/\s+/)[0] !== checksum)
    throw new Error('Backup checksum mismatch')
  const batch = (
    await pool.query(
      "SELECT source_hash FROM vcm.import_batches WHERE id=$1 AND status='preview'",
      [batchId],
    )
  ).rows[0]
  if (!batch) throw new Error('Preview batch required')
  const db = (await pool.query('SELECT current_database() name')).rows[0].name,
    id = randomUUID()
  await pool.query(
    'INSERT INTO vcm.import_backup_receipts(id,batch_id,snapshot_hash,database_name,schema_fingerprint,backup_reference,backup_checksum) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [
      id,
      batchId,
      batch.source_hash,
      db,
      await schemaFingerprint(pool),
      directory,
      checksum,
    ],
  )
  return id
}
