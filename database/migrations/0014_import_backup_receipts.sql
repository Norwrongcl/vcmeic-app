SET search_path=vcm,pg_catalog;
CREATE TABLE import_backup_receipts(id text PRIMARY KEY,batch_id text NOT NULL UNIQUE REFERENCES import_batches(id),snapshot_hash text NOT NULL,database_name text NOT NULL,schema_fingerprint text NOT NULL,backup_reference text NOT NULL,backup_checksum text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),consumed_at timestamptz);
GRANT SELECT ON import_backup_receipts TO vcm_runtime;
GRANT UPDATE(consumed_at) ON import_backup_receipts TO vcm_runtime;
