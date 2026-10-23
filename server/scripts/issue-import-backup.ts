import pg from 'pg'
import { privateInput } from './private-input.ts'
import { issueImportBackupReceipt } from '../src/imports/backup-receipt.ts'
const input = await privateInput(process.argv[2])
const pool = new pg.Pool({
  connectionString: String(input.operatorDatabaseUrl),
  max: 1,
})
try {
  const id = await issueImportBackupReceipt(
    pool,
    String(input.batchId),
    String(input.backupDirectory),
  )
  process.stdout.write('Import backup receipt ' + id + '\n')
} finally {
  await pool.end()
}
