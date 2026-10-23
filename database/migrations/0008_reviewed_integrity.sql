SET search_path=vcm,pg_catalog;
-- Approval and every mutation of its reviewed aggregate serialize on revision rows.
CREATE OR REPLACE FUNCTION human_approval() RETURNS trigger LANGUAGE plpgsql SET search_path=vcm,pg_catalog AS $$ BEGIN
 PERFORM 1 FROM object_revisions WHERE id=NEW.revision_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM principals WHERE id=NEW.approved_by AND kind='human' AND active) THEN RAISE EXCEPTION 'Approval requires active human' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION revision_unsealed() RETURNS trigger LANGUAGE plpgsql SET search_path=vcm,pg_catalog AS $$ DECLARE roots text[]; locks text[]; root text; BEGIN
 IF TG_TABLE_NAME='package_items' THEN PERFORM 1 FROM object_revisions WHERE id=NEW.content_revision_id FOR UPDATE; roots=ARRAY[NEW.package_revision_id]; locks=ARRAY[NEW.package_revision_id];
 ELSIF TG_TABLE_NAME='content_assets' THEN PERFORM 1 FROM object_revisions WHERE id=NEW.content_revision_id FOR UPDATE; roots=ARRAY[NEW.content_revision_id] || ARRAY(SELECT package_revision_id FROM package_items WHERE content_revision_id=NEW.content_revision_id); locks=roots;
 ELSIF TG_TABLE_NAME='objective_cases' THEN SELECT plan_revision_id INTO root FROM plan_objectives WHERE id=NEW.objective_id; roots=ARRAY[root]; locks=roots;
 ELSE roots=ARRAY[to_jsonb(NEW)->>TG_ARGV[0]]; locks=roots;
 END IF;
 PERFORM 1 FROM object_revisions WHERE id=ANY(locks) ORDER BY id FOR UPDATE;
 -- Re-read after the lock: READ COMMITTED sees a competing committed approval.
 IF EXISTS(SELECT 1 FROM approval_records WHERE revision_id=ANY(roots)) THEN RAISE EXCEPTION 'sealed revision cannot receive new children' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER objective_cases_unsealed BEFORE INSERT ON objective_cases FOR EACH ROW EXECUTE FUNCTION revision_unsealed('');
-- Captured reference identity is declared in the immutable typed assertion.
ALTER TABLE field_assertion_references ADD COLUMN case_id text, ADD COLUMN field_key text;
ALTER TABLE resolution_assertions ADD COLUMN case_id text, ADD COLUMN field_key text;
UPDATE field_assertion_references r SET case_id=a.case_id,field_key=a.field_key FROM field_assertions a WHERE a.id=r.assertion_id;
UPDATE resolution_assertions r SET case_id=f.case_id,field_key=f.field_key FROM field_resolutions f WHERE f.id=r.resolution_id;
ALTER TABLE field_assertion_references ALTER COLUMN case_id SET NOT NULL, ALTER COLUMN field_key SET NOT NULL;
ALTER TABLE resolution_assertions ALTER COLUMN case_id SET NOT NULL, ALTER COLUMN field_key SET NOT NULL;
ALTER TABLE field_resolutions ADD CONSTRAINT resolution_identity_key UNIQUE(case_id,field_key,id);
ALTER TABLE field_assertion_references ADD CONSTRAINT captured_assertion_identity FOREIGN KEY(case_id,field_key,assertion_id) REFERENCES field_assertions(case_id,field_key,id), ADD CONSTRAINT captured_evidence_case FOREIGN KEY(case_id,evidence_id) REFERENCES evidences(case_id,id);
ALTER TABLE resolution_assertions ADD CONSTRAINT resolution_candidate_same_field FOREIGN KEY(case_id,field_key,assertion_id) REFERENCES field_assertions(case_id,field_key,id), ADD CONSTRAINT resolution_candidate_parent FOREIGN KEY(case_id,field_key,resolution_id) REFERENCES field_resolutions(case_id,field_key,id);
CREATE FUNCTION trace_reference_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=vcm,pg_catalog AS $$ DECLARE c text; f text; refs jsonb; reference_kind text; reference_id text; BEGIN
 IF TG_TABLE_NAME='field_assertion_references' THEN
  SELECT case_id,field_key,references_value INTO c,f,refs FROM field_assertions WHERE id=NEW.assertion_id;
  reference_kind=CASE WHEN NEW.evidence_id IS NOT NULL THEN 'evidence' WHEN NEW.organization_id IS NOT NULL THEN 'organization' ELSE 'agreement' END;
  reference_id=coalesce(NEW.evidence_id,NEW.organization_id,NEW.agreement_id);
  IF refs IS NULL OR NOT refs @> jsonb_build_array(jsonb_build_object('type',reference_kind,'id',reference_id)) THEN RAISE EXCEPTION 'Reference was not declared in captured references' USING ERRCODE='23514'; END IF;
 ELSE SELECT case_id,field_key INTO c,f FROM field_resolutions WHERE id=NEW.resolution_id;
 END IF;
 IF (NEW.case_id IS NOT NULL AND NEW.case_id<>c) OR (NEW.field_key IS NOT NULL AND NEW.field_key<>f) THEN RAISE EXCEPTION 'Trace identity mismatch' USING ERRCODE='23503'; END IF;
 NEW.case_id=c; NEW.field_key=f; RETURN NEW;
END $$;
CREATE TRIGGER captured_reference_identity BEFORE INSERT ON field_assertion_references FOR EACH ROW EXECUTE FUNCTION trace_reference_identity();
CREATE TRIGGER resolution_reference_identity BEFORE INSERT ON resolution_assertions FOR EACH ROW EXECUTE FUNCTION trace_reference_identity();
CREATE TRIGGER captured_reference_immutable BEFORE UPDATE OR DELETE ON field_assertion_references FOR EACH ROW EXECUTE FUNCTION immutable_row();
CREATE TRIGGER resolution_reference_immutable BEFORE UPDATE OR DELETE ON resolution_assertions FOR EACH ROW EXECUTE FUNCTION immutable_row();
REVOKE UPDATE,DELETE,TRUNCATE ON field_assertion_references FROM vcm_runtime;
CREATE INDEX captured_assertion_identity_idx ON field_assertion_references(case_id,field_key,assertion_id);
CREATE INDEX captured_evidence_case_idx ON field_assertion_references(case_id,evidence_id);
CREATE INDEX resolution_candidate_identity_idx ON resolution_assertions(case_id,field_key,assertion_id);
-- The content strategy must belong to the content's own campaign.
CREATE FUNCTION content_campaign_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=vcm,pg_catalog AS $$ BEGIN
 IF NEW.campaign_revision_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM contents c JOIN campaign_revisions r ON r.campaign_id=c.campaign_id WHERE c.id=NEW.content_id AND r.id=NEW.campaign_revision_id) THEN RAISE EXCEPTION 'Content campaign revision mismatch' USING ERRCODE='23503'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER content_campaign_identity BEFORE INSERT ON content_revisions FOR EACH ROW EXECUTE FUNCTION content_campaign_identity();
-- Cut revisions are explicit, and sealing is one-way. The cut row also serializes closure.
ALTER TABLE cut_cases ADD CONSTRAINT cut_membership_revision FOREIGN KEY(cut_id,cut_version) REFERENCES cut_revisions(cut_id,version);
ALTER TABLE cut_revisions ADD COLUMN sealed_at timestamptz;
CREATE FUNCTION cut_membership_unsealed() RETURNS trigger LANGUAGE plpgsql SET search_path=vcm,pg_catalog AS $$ DECLARE closed boolean; seal timestamptz; BEGIN
 SELECT status='closed' INTO closed FROM institutional_cuts WHERE id=NEW.cut_id FOR UPDATE;
 SELECT sealed_at INTO seal FROM cut_revisions WHERE cut_id=NEW.cut_id AND version=NEW.cut_version FOR UPDATE;
 IF closed OR seal IS NOT NULL THEN RAISE EXCEPTION 'sealed institutional cut revision' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cut_membership_unsealed BEFORE INSERT ON cut_cases FOR EACH ROW EXECUTE FUNCTION cut_membership_unsealed();
CREATE FUNCTION seal_cut_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.sealed_at IS NOT NULL OR NEW.sealed_at IS NULL OR (to_jsonb(NEW)-'sealed_at') IS DISTINCT FROM (to_jsonb(OLD)-'sealed_at') THEN RAISE EXCEPTION 'immutable cut revision: only initial sealing permitted' USING ERRCODE='55000'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER cut_revision_seal BEFORE UPDATE ON cut_revisions FOR EACH ROW EXECUTE FUNCTION seal_cut_revision();
CREATE TRIGGER cut_revision_no_delete BEFORE DELETE ON cut_revisions FOR EACH ROW EXECUTE FUNCTION immutable_row();
GRANT UPDATE(sealed_at) ON cut_revisions TO vcm_runtime;
-- An authorization row is an immutable grant revision; amendments are new rows.
ALTER TABLE budget_authorizations ADD COLUMN authorization_key text, ADD COLUMN version int NOT NULL DEFAULT 1 CHECK(version>0), ADD COLUMN supersedes_id text REFERENCES budget_authorizations(id);
UPDATE budget_authorizations SET authorization_key=id;
ALTER TABLE budget_authorizations ALTER COLUMN authorization_key SET NOT NULL;
ALTER TABLE budget_authorizations ADD CONSTRAINT authorization_revision_key UNIQUE(authorization_key,version);
CREATE FUNCTION authorization_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.authorization_key IS NULL THEN NEW.authorization_key=NEW.id; END IF; RETURN NEW; END $$;
CREATE TRIGGER authorization_identity BEFORE INSERT ON budget_authorizations FOR EACH ROW EXECUTE FUNCTION authorization_identity();
CREATE TRIGGER authorization_immutable BEFORE UPDATE OR DELETE ON budget_authorizations FOR EACH ROW EXECUTE FUNCTION immutable_row();
CREATE TABLE budget_authorization_revocations(authorization_id text PRIMARY KEY REFERENCES budget_authorizations(id),revoked_by text NOT NULL REFERENCES principals(id),reason text NOT NULL CHECK(length(trim(reason))>0),revoked_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER authorization_revocation_immutable BEFORE UPDATE OR DELETE ON budget_authorization_revocations FOR EACH ROW EXECUTE FUNCTION immutable_row();
GRANT SELECT,INSERT ON budget_authorization_revocations TO vcm_runtime;
REVOKE UPDATE,DELETE,TRUNCATE ON budget_authorizations FROM vcm_runtime;
CREATE INDEX authorization_supersedes_idx ON budget_authorizations(supersedes_id);
-- Publication can be authorized by its direct content approval or exact package membership.
ALTER TABLE publication_operations DROP CONSTRAINT publication_operations_content_revision_id_approval_id_fkey;
ALTER TABLE publication_operations ADD CONSTRAINT publication_approval_fk FOREIGN KEY(approval_id) REFERENCES approval_records(id);
CREATE FUNCTION publication_approved_member() RETURNS trigger LANGUAGE plpgsql SET search_path=vcm,pg_catalog AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM approval_records a WHERE a.id=NEW.approval_id AND (a.expires_at IS NULL OR a.expires_at>now()) AND NOT EXISTS(SELECT 1 FROM approval_revocations r WHERE r.approval_id=a.id) AND ((a.kind='content' AND a.revision_id=NEW.content_revision_id) OR (a.kind='package' AND EXISTS(SELECT 1 FROM package_items i WHERE i.package_revision_id=a.revision_id AND i.content_revision_id=NEW.content_revision_id)))) THEN RAISE EXCEPTION 'Publication does not belong to approved revision' USING ERRCODE='23503'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER publication_approval_member BEFORE INSERT OR UPDATE OF content_revision_id,approval_id ON publication_operations FOR EACH ROW EXECUTE FUNCTION publication_approved_member();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA vcm FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA vcm TO vcm_runtime;
