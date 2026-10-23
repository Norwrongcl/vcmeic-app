SET search_path=vcm,pg_catalog;
ALTER TABLE decision_revisions ADD COLUMN project_id text REFERENCES projects(id);
CREATE INDEX decision_revision_project_idx ON decision_revisions(project_id);
