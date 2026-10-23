SET search_path=vcm,pg_catalog;
-- Logical removal preserves relationship history; runtime never needs DELETE.
ALTER TABLE case_organizations ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE case_agreements ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE task_dependencies ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE task_assignees ADD COLUMN active boolean NOT NULL DEFAULT true;
