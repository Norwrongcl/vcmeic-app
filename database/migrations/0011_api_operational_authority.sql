SET search_path=vcm,pg_catalog;
ALTER TABLE expenses ADD COLUMN authorization_id text, ADD COLUMN archived_at timestamptz;
ALTER TABLE expenses ADD CONSTRAINT expense_authorization_project FOREIGN KEY(project_id,authorization_id) REFERENCES budget_authorizations(project_id,id);
CREATE INDEX expense_authorization_idx ON expenses(authorization_id);
-- SELECT FOR UPDATE requires UPDATE privilege; immutable trigger still rejects every actual mutation.
GRANT UPDATE(id) ON object_revisions TO vcm_runtime;
