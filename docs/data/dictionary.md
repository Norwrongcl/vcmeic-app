# Diccionario físico VcM

Generado desde 15 migraciones aplicadas a PostgreSQL 18; esquema de negocio `vcm`. 101 tablas. Fuente de verdad física: archivos SQL con checksum en `database/migrations`.

## Convenciones y protección

IDs text estables, fechas civiles date, instantes timestamptz, dinero bigint CLP (API: cadena decimal), magnitudes numeric, NULL desconocido. Claves foráneas sin borrado en cascada; archivo/cancelación para datos formales. Runtime no tiene DELETE/TRUNCATE ni DDL. Revisiones, auditoría y afirmaciones son inmutables; aprobaciones apuntan a object_revisions. Cada objeto protegido conserva confidencialidad; autorización efectiva por objeto y rol se aplica en la API compartida. No se usa RLS todavía.

Los triggers de inmutabilidad impiden UPDATE/DELETE; hijos de revisión editorial aprobada no admiten nuevas inserciones. Invariantes como QA, autoridad por rol, ciclos, vigencia de mandato, comparación de versiones e indicadores elegibles se resuelven en transacciones de API. Las tablas por sí solas no acreditan esos flujos.

## Mapeo heredado

activities/cases se concilian en cases y activity_records, events en projects, eventId en project_id y partners en organizations. El expediente mantiene el estado documental; projects.execution_state conserva el operativo. project_cases admite varios expedientes por proyecto. No importar por coincidencia de nombre. Registros demo y asignaciones sin identidad requieren revisión. Las fechas legacy inválidas se mantienen en staging, no se inventan fechas válidas. Catálogos internos usan códigos propios identificados como internos, nunca IDs institucionales inventados.

Los estados documentales actuales están en catalog/states.json; estados de excepción operativa del PO se conservan como incidencias/bloqueos o pendientes de mapeo explícito. Cambiar este catálogo no cambia la UI automáticamente.

## Tablas

### activity_records

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| case_id | text | NO | — |
| schema_version | text | NO | 'p52-2026.09-v1'::text |
| validation_status | text | NO | 'pending'::text |
| version | integer | NO | 1 |

- Restricción `activity_records_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES cases(id)`
- Restricción `activity_records_case_id_id_key`: `UNIQUE (case_id, id)`
- Restricción `activity_records_case_id_key`: `UNIQUE (case_id)`
- Restricción `activity_records_case_id_not_null`: `NOT NULL case_id`
- Restricción `activity_records_id_not_null`: `NOT NULL id`
- Restricción `activity_records_pkey`: `PRIMARY KEY (id)`
- Restricción `activity_records_schema_version_not_null`: `NOT NULL schema_version`
- Restricción `activity_records_validation_status_check`: `CHECK ((validation_status = ANY (ARRAY['pending'::text, 'observed'::text, 'validated'::text])))`
- Restricción `activity_records_validation_status_not_null`: `NOT NULL validation_status`
- Restricción `activity_records_version_check`: `CHECK ((version > 0))`
- Restricción `activity_records_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX activity_records_case_id_id_key ON vcm.activity_records USING btree (case_id, id)`
- Índice: `CREATE UNIQUE INDEX activity_records_case_id_key ON vcm.activity_records USING btree (case_id)`
- Índice: `CREATE UNIQUE INDEX activity_records_pkey ON vcm.activity_records USING btree (id)`

### agreement_documents

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| agreement_id | text | NO | — |
| document_id | text | NO | — |

- Restricción `agreement_documents_agreement_id_fkey`: `FOREIGN KEY (agreement_id) REFERENCES agreements(id)`
- Restricción `agreement_documents_agreement_id_not_null`: `NOT NULL agreement_id`
- Restricción `agreement_documents_document_id_fkey`: `FOREIGN KEY (document_id) REFERENCES document_references(id)`
- Restricción `agreement_documents_document_id_not_null`: `NOT NULL document_id`
- Restricción `agreement_documents_pkey`: `PRIMARY KEY (agreement_id, document_id)`
- Índice: `CREATE INDEX agreement_documents_document_id_fkey_fkidx ON vcm.agreement_documents USING btree (document_id)`
- Índice: `CREATE UNIQUE INDEX agreement_documents_pkey ON vcm.agreement_documents USING btree (agreement_id, document_id)`

### agreements

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| organization_id | text | NO | — |
| responsible_contact_id | text | YES | — |
| name | text | NO | — |
| type | text | YES | — |
| description | text | YES | — |
| starts_on | date | NO | — |
| ends_on | date | YES | — |
| status | text | NO | 'draft'::text |
| notes | text | YES | — |
| protected_object_id | text | NO | — |
| version | integer | NO | 1 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

- Restricción `agreements_check`: `CHECK (((ends_on IS NULL) OR (ends_on >= starts_on)))`
- Restricción `agreements_created_at_not_null`: `NOT NULL created_at`
- Restricción `agreements_id_not_null`: `NOT NULL id`
- Restricción `agreements_name_not_null`: `NOT NULL name`
- Restricción `agreements_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`
- Restricción `agreements_organization_id_not_null`: `NOT NULL organization_id`
- Restricción `agreements_pkey`: `PRIMARY KEY (id)`
- Restricción `agreements_protected_object_id_fkey`: `FOREIGN KEY (protected_object_id) REFERENCES protected_objects(id)`
- Restricción `agreements_protected_object_id_key`: `UNIQUE (protected_object_id)`
- Restricción `agreements_protected_object_id_not_null`: `NOT NULL protected_object_id`
- Restricción `agreements_responsible_contact_id_fkey`: `FOREIGN KEY (responsible_contact_id) REFERENCES contacts(id)`
- Restricción `agreements_starts_on_not_null`: `NOT NULL starts_on`
- Restricción `agreements_status_check`: `CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'expired'::text, 'cancelled'::text])))`
- Restricción `agreements_status_not_null`: `NOT NULL status`
- Restricción `agreements_updated_at_not_null`: `NOT NULL updated_at`
- Restricción `agreements_version_check`: `CHECK ((version > 0))`
- Restricción `agreements_version_not_null`: `NOT NULL version`
- Índice: `CREATE INDEX agreements_organization_id_fkey_fkidx ON vcm.agreements USING btree (organization_id)`
- Índice: `CREATE UNIQUE INDEX agreements_pkey ON vcm.agreements USING btree (id)`
- Índice: `CREATE UNIQUE INDEX agreements_protected_object_id_key ON vcm.agreements USING btree (protected_object_id)`
- Índice: `CREATE INDEX agreements_responsible_contact_id_fkey_fkidx ON vcm.agreements USING btree (responsible_contact_id)`
- Trigger: `CREATE TRIGGER agreement_protect BEFORE INSERT ON vcm.agreements FOR EACH ROW EXECUTE FUNCTION protect_object('agreement')`

### annual_plans

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| year | integer | NO | — |
| title | text | NO | — |
| status | text | NO | 'draft'::text |
| protected_object_id | text | NO | — |
| version | integer | NO | 1 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

- Restricción `annual_plans_created_at_not_null`: `NOT NULL created_at`
- Restricción `annual_plans_id_not_null`: `NOT NULL id`
- Restricción `annual_plans_pkey`: `PRIMARY KEY (id)`
- Restricción `annual_plans_protected_object_id_fkey`: `FOREIGN KEY (protected_object_id) REFERENCES protected_objects(id)`
- Restricción `annual_plans_protected_object_id_key`: `UNIQUE (protected_object_id)`
- Restricción `annual_plans_protected_object_id_not_null`: `NOT NULL protected_object_id`
- Restricción `annual_plans_status_check`: `CHECK ((status = ANY (ARRAY['draft'::text, 'review'::text, 'sanctioned'::text, 'approved'::text])))`
- Restricción `annual_plans_status_not_null`: `NOT NULL status`
- Restricción `annual_plans_title_not_null`: `NOT NULL title`
- Restricción `annual_plans_updated_at_not_null`: `NOT NULL updated_at`
- Restricción `annual_plans_version_check`: `CHECK ((version > 0))`
- Restricción `annual_plans_version_not_null`: `NOT NULL version`
- Restricción `annual_plans_year_check`: `CHECK (((year >= 1900) AND (year <= 9999)))`
- Restricción `annual_plans_year_not_null`: `NOT NULL year`
- Índice: `CREATE UNIQUE INDEX annual_plans_pkey ON vcm.annual_plans USING btree (id)`
- Índice: `CREATE UNIQUE INDEX annual_plans_protected_object_id_key ON vcm.annual_plans USING btree (protected_object_id)`
- Trigger: `CREATE TRIGGER plan_protect BEFORE INSERT ON vcm.annual_plans FOR EACH ROW EXECUTE FUNCTION protect_object('annual_plan')`

### approval_records

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| object_id | text | NO | — |
| revision_id | text | NO | — |
| kind | text | NO | — |
| approved_by | text | NO | — |
| reason | text | NO | — |
| approved_at | timestamp with time zone | NO | now() |
| expires_at | timestamp with time zone | YES | — |

- Restricción `approval_records_approved_at_not_null`: `NOT NULL approved_at`
- Restricción `approval_records_approved_by_fkey`: `FOREIGN KEY (approved_by) REFERENCES principals(id)`
- Restricción `approval_records_approved_by_not_null`: `NOT NULL approved_by`
- Restricción `approval_records_check`: `CHECK (((expires_at IS NULL) OR (expires_at > approved_at)))`
- Restricción `approval_records_id_not_null`: `NOT NULL id`
- Restricción `approval_records_kind_check`: `CHECK ((kind = ANY (ARRAY['annual_plan'::text, 'flow'::text, 'budget'::text, 'campaign'::text, 'content'::text, 'package'::text, 'institutional'::text])))`
- Restricción `approval_records_kind_not_null`: `NOT NULL kind`
- Restricción `approval_records_object_id_not_null`: `NOT NULL object_id`
- Restricción `approval_records_object_id_revision_id_fkey`: `FOREIGN KEY (object_id, revision_id) REFERENCES object_revisions(object_id, id)`
- Restricción `approval_records_pkey`: `PRIMARY KEY (id)`
- Restricción `approval_records_reason_check`: `CHECK ((length(TRIM(BOTH FROM reason)) > 0))`
- Restricción `approval_records_reason_not_null`: `NOT NULL reason`
- Restricción `approval_records_revision_id_id_key`: `UNIQUE (revision_id, id)`
- Restricción `approval_records_revision_id_not_null`: `NOT NULL revision_id`
- Índice: `CREATE INDEX approval_records_approved_by_fkey_fkidx ON vcm.approval_records USING btree (approved_by)`
- Índice: `CREATE INDEX approval_records_object_id_revision_id_fkey_fkidx ON vcm.approval_records USING btree (object_id, revision_id)`
- Índice: `CREATE UNIQUE INDEX approval_records_pkey ON vcm.approval_records USING btree (id)`
- Índice: `CREATE UNIQUE INDEX approval_records_revision_id_id_key ON vcm.approval_records USING btree (revision_id, id)`
- Trigger: `CREATE TRIGGER approval_human BEFORE INSERT ON vcm.approval_records FOR EACH ROW EXECUTE FUNCTION human_approval()`
- Trigger: `CREATE TRIGGER approval_immutable BEFORE DELETE OR UPDATE ON vcm.approval_records FOR EACH ROW EXECUTE FUNCTION immutable_row()`

### approval_revocations

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| approval_id | text | NO | — |
| revoked_by | text | NO | — |
| reason | text | NO | — |
| revoked_at | timestamp with time zone | NO | now() |

- Restricción `approval_revocations_approval_id_fkey`: `FOREIGN KEY (approval_id) REFERENCES approval_records(id)`
- Restricción `approval_revocations_approval_id_not_null`: `NOT NULL approval_id`
- Restricción `approval_revocations_pkey`: `PRIMARY KEY (approval_id)`
- Restricción `approval_revocations_reason_check`: `CHECK ((length(TRIM(BOTH FROM reason)) > 0))`
- Restricción `approval_revocations_reason_not_null`: `NOT NULL reason`
- Restricción `approval_revocations_revoked_at_not_null`: `NOT NULL revoked_at`
- Restricción `approval_revocations_revoked_by_fkey`: `FOREIGN KEY (revoked_by) REFERENCES principals(id)`
- Restricción `approval_revocations_revoked_by_not_null`: `NOT NULL revoked_by`
- Índice: `CREATE UNIQUE INDEX approval_revocations_pkey ON vcm.approval_revocations USING btree (approval_id)`
- Índice: `CREATE INDEX approval_revocations_revoked_by_fkey_fkidx ON vcm.approval_revocations USING btree (revoked_by)`
- Trigger: `CREATE TRIGGER revocation_immutable BEFORE DELETE OR UPDATE ON vcm.approval_revocations FOR EACH ROW EXECUTE FUNCTION immutable_row()`

### audit_events

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| object_id | text | NO | — |
| actor_id | text | NO | — |
| acting_service_id | text | YES | — |
| action | text | NO | — |
| reason | text | NO | — |
| before_data | jsonb | YES | — |
| after_data | jsonb | YES | — |
| rule_version | text | NO | — |
| correlation_id | text | NO | — |
| at | timestamp with time zone | NO | now() |

- Restricción `audit_events_acting_service_id_fkey`: `FOREIGN KEY (acting_service_id) REFERENCES principals(id)`
- Restricción `audit_events_action_not_null`: `NOT NULL action`
- Restricción `audit_events_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES principals(id)`
- Restricción `audit_events_actor_id_not_null`: `NOT NULL actor_id`
- Restricción `audit_events_at_not_null`: `NOT NULL at`
- Restricción `audit_events_correlation_id_not_null`: `NOT NULL correlation_id`
- Restricción `audit_events_id_not_null`: `NOT NULL id`
- Restricción `audit_events_object_id_fkey`: `FOREIGN KEY (object_id) REFERENCES protected_objects(id)`
- Restricción `audit_events_object_id_not_null`: `NOT NULL object_id`
- Restricción `audit_events_pkey`: `PRIMARY KEY (id)`
- Restricción `audit_events_reason_not_null`: `NOT NULL reason`
- Restricción `audit_events_rule_version_not_null`: `NOT NULL rule_version`
- Índice: `CREATE INDEX audit_correlation_idx ON vcm.audit_events USING btree (correlation_id)`
- Índice: `CREATE INDEX audit_events_acting_service_id_fkey_fkidx ON vcm.audit_events USING btree (acting_service_id)`
- Índice: `CREATE INDEX audit_events_actor_id_fkey_fkidx ON vcm.audit_events USING btree (actor_id)`
- Índice: `CREATE UNIQUE INDEX audit_events_pkey ON vcm.audit_events USING btree (id)`
- Índice: `CREATE INDEX audit_object_time_idx ON vcm.audit_events USING btree (object_id, at)`
- Trigger: `CREATE TRIGGER audit_immutable BEFORE DELETE OR UPDATE ON vcm.audit_events FOR EACH ROW EXECUTE FUNCTION immutable_row()`

### automation_rule_versions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| rule_id | text | NO | — |
| version | integer | NO | — |
| trigger_type | text | NO | — |
| conditions | jsonb | NO | — |
| action_class | text | NO | — |
| retry_policy | jsonb | NO | '{"maxAttempts": 3}'::jsonb |
| created_at | timestamp with time zone | NO | now() |

- Restricción `automation_rule_versions_action_class_not_null`: `NOT NULL action_class`
- Restricción `automation_rule_versions_conditions_check`: `CHECK ((jsonb_typeof(conditions) = 'object'::text))`
- Restricción `automation_rule_versions_conditions_not_null`: `NOT NULL conditions`
- Restricción `automation_rule_versions_created_at_not_null`: `NOT NULL created_at`
- Restricción `automation_rule_versions_id_not_null`: `NOT NULL id`
- Restricción `automation_rule_versions_pkey`: `PRIMARY KEY (id)`
- Restricción `automation_rule_versions_retry_policy_not_null`: `NOT NULL retry_policy`
- Restricción `automation_rule_versions_rule_id_fkey`: `FOREIGN KEY (rule_id) REFERENCES automation_rules(id)`
- Restricción `automation_rule_versions_rule_id_not_null`: `NOT NULL rule_id`
- Restricción `automation_rule_versions_rule_id_version_key`: `UNIQUE (rule_id, version)`
- Restricción `automation_rule_versions_trigger_type_not_null`: `NOT NULL trigger_type`
- Restricción `automation_rule_versions_version_check`: `CHECK ((version > 0))`
- Restricción `automation_rule_versions_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX automation_rule_versions_pkey ON vcm.automation_rule_versions USING btree (id)`
- Índice: `CREATE UNIQUE INDEX automation_rule_versions_rule_id_version_key ON vcm.automation_rule_versions USING btree (rule_id, version)`
- Trigger: `CREATE TRIGGER automation_revision_immutable BEFORE DELETE OR UPDATE ON vcm.automation_rule_versions FOR EACH ROW EXECUTE FUNCTION immutable_row()`

### automation_rules

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| name | text | NO | — |
| enabled | boolean | NO | false |
| version | integer | NO | 1 |

- Restricción `automation_rules_enabled_not_null`: `NOT NULL enabled`
- Restricción `automation_rules_id_not_null`: `NOT NULL id`
- Restricción `automation_rules_name_not_null`: `NOT NULL name`
- Restricción `automation_rules_pkey`: `PRIMARY KEY (id)`
- Restricción `automation_rules_version_check`: `CHECK ((version > 0))`
- Restricción `automation_rules_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX automation_rules_pkey ON vcm.automation_rules USING btree (id)`

### budget_authorization_revocations

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| authorization_id | text | NO | — |
| revoked_by | text | NO | — |
| reason | text | NO | — |
| revoked_at | timestamp with time zone | NO | now() |

- Restricción `budget_authorization_revocations_authorization_id_fkey`: `FOREIGN KEY (authorization_id) REFERENCES budget_authorizations(id)`
- Restricción `budget_authorization_revocations_authorization_id_not_null`: `NOT NULL authorization_id`
- Restricción `budget_authorization_revocations_pkey`: `PRIMARY KEY (authorization_id)`
- Restricción `budget_authorization_revocations_reason_check`: `CHECK ((length(TRIM(BOTH FROM reason)) > 0))`
- Restricción `budget_authorization_revocations_reason_not_null`: `NOT NULL reason`
- Restricción `budget_authorization_revocations_revoked_at_not_null`: `NOT NULL revoked_at`
- Restricción `budget_authorization_revocations_revoked_by_fkey`: `FOREIGN KEY (revoked_by) REFERENCES principals(id)`
- Restricción `budget_authorization_revocations_revoked_by_not_null`: `NOT NULL revoked_by`
- Índice: `CREATE UNIQUE INDEX budget_authorization_revocations_pkey ON vcm.budget_authorization_revocations USING btree (authorization_id)`
- Trigger: `CREATE TRIGGER authorization_revocation_immutable BEFORE DELETE OR UPDATE ON vcm.budget_authorization_revocations FOR EACH ROW EXECUTE FUNCTION immutable_row()`

### budget_authorizations

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| project_id | text | NO | — |
| decision_revision_id | text | NO | — |
| approval_id | text | NO | — |
| amount | bigint | NO | — |
| valid_from | timestamp with time zone | NO | now() |
| valid_until | timestamp with time zone | YES | — |
| authorization_key | text | NO | — |
| version | integer | NO | 1 |
| supersedes_id | text | YES | — |

- Restricción `authorization_revision_key`: `UNIQUE (authorization_key, version)`
- Restricción `budget_authorizations_amount_check`: `CHECK ((amount >= 0))`
- Restricción `budget_authorizations_amount_not_null`: `NOT NULL amount`
- Restricción `budget_authorizations_approval_id_not_null`: `NOT NULL approval_id`
- Restricción `budget_authorizations_authorization_key_not_null`: `NOT NULL authorization_key`
- Restricción `budget_authorizations_check`: `CHECK (((valid_until IS NULL) OR (valid_until > valid_from)))`
- Restricción `budget_authorizations_decision_revision_id_approval_id_fkey`: `FOREIGN KEY (decision_revision_id, approval_id) REFERENCES approval_records(revision_id, id)`
- Restricción `budget_authorizations_decision_revision_id_fkey`: `FOREIGN KEY (decision_revision_id) REFERENCES decision_revisions(id)`
- Restricción `budget_authorizations_decision_revision_id_not_null`: `NOT NULL decision_revision_id`
- Restricción `budget_authorizations_id_not_null`: `NOT NULL id`
- Restricción `budget_authorizations_pkey`: `PRIMARY KEY (id)`
- Restricción `budget_authorizations_project_id_fkey`: `FOREIGN KEY (project_id) REFERENCES projects(id)`
- Restricción `budget_authorizations_project_id_id_key`: `UNIQUE (project_id, id)`
- Restricción `budget_authorizations_project_id_not_null`: `NOT NULL project_id`
- Restricción `budget_authorizations_supersedes_id_fkey`: `FOREIGN KEY (supersedes_id) REFERENCES budget_authorizations(id)`
- Restricción `budget_authorizations_valid_from_not_null`: `NOT NULL valid_from`
- Restricción `budget_authorizations_version_check`: `CHECK ((version > 0))`
- Restricción `budget_authorizations_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX authorization_revision_key ON vcm.budget_authorizations USING btree (authorization_key, version)`
- Índice: `CREATE INDEX authorization_supersedes_idx ON vcm.budget_authorizations USING btree (supersedes_id)`
- Índice: `CREATE INDEX budget_authorizations_decision_revision_id_approval_id_fkidx ON vcm.budget_authorizations USING btree (decision_revision_id, approval_id)`
- Índice: `CREATE INDEX budget_authorizations_decision_revision_id_fkey_fkidx ON vcm.budget_authorizations USING btree (decision_revision_id)`
- Índice: `CREATE UNIQUE INDEX budget_authorizations_pkey ON vcm.budget_authorizations USING btree (id)`
- Índice: `CREATE UNIQUE INDEX budget_authorizations_project_id_id_key ON vcm.budget_authorizations USING btree (project_id, id)`
- Trigger: `CREATE TRIGGER authorization_identity BEFORE INSERT ON vcm.budget_authorizations FOR EACH ROW EXECUTE FUNCTION authorization_identity()`
- Trigger: `CREATE TRIGGER authorization_immutable BEFORE DELETE OR UPDATE ON vcm.budget_authorizations FOR EACH ROW EXECUTE FUNCTION immutable_row()`

### budget_items

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| project_id | text | NO | — |
| name | text | NO | — |
| planned_amount | bigint | YES | — |
| protected_object_id | text | NO | — |
| version | integer | NO | 1 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

- Restricción `budget_items_created_at_not_null`: `NOT NULL created_at`
- Restricción `budget_items_id_not_null`: `NOT NULL id`
- Restricción `budget_items_name_not_null`: `NOT NULL name`
- Restricción `budget_items_pkey`: `PRIMARY KEY (id)`
- Restricción `budget_items_planned_amount_check`: `CHECK ((planned_amount >= 0))`
- Restricción `budget_items_project_id_fkey`: `FOREIGN KEY (project_id) REFERENCES projects(id)`
- Restricción `budget_items_project_id_id_key`: `UNIQUE (project_id, id)`
- Restricción `budget_items_project_id_not_null`: `NOT NULL project_id`
- Restricción `budget_items_protected_object_id_fkey`: `FOREIGN KEY (protected_object_id) REFERENCES protected_objects(id)`
- Restricción `budget_items_protected_object_id_key`: `UNIQUE (protected_object_id)`
- Restricción `budget_items_protected_object_id_not_null`: `NOT NULL protected_object_id`
- Restricción `budget_items_updated_at_not_null`: `NOT NULL updated_at`
- Restricción `budget_items_version_check`: `CHECK ((version > 0))`
- Restricción `budget_items_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX budget_items_pkey ON vcm.budget_items USING btree (id)`
- Índice: `CREATE UNIQUE INDEX budget_items_project_id_id_key ON vcm.budget_items USING btree (project_id, id)`
- Índice: `CREATE UNIQUE INDEX budget_items_protected_object_id_key ON vcm.budget_items USING btree (protected_object_id)`
- Trigger: `CREATE TRIGGER budget_item_protect BEFORE INSERT ON vcm.budget_items FOR EACH ROW EXECUTE FUNCTION protect_object('budget')`

### campaign_revisions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| campaign_id | text | NO | — |
| version | integer | NO | — |
| charter | jsonb | NO | — |
| actor_id | text | NO | — |

- Restricción `campaign_revisions_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES principals(id)`
- Restricción `campaign_revisions_actor_id_not_null`: `NOT NULL actor_id`
- Restricción `campaign_revisions_campaign_id_fkey`: `FOREIGN KEY (campaign_id) REFERENCES campaigns(id)`
- Restricción `campaign_revisions_campaign_id_id_key`: `UNIQUE (campaign_id, id)`
- Restricción `campaign_revisions_campaign_id_not_null`: `NOT NULL campaign_id`
- Restricción `campaign_revisions_campaign_id_version_key`: `UNIQUE (campaign_id, version)`
- Restricción `campaign_revisions_charter_check`: `CHECK ((jsonb_typeof(charter) = 'object'::text))`
- Restricción `campaign_revisions_charter_not_null`: `NOT NULL charter`
- Restricción `campaign_revisions_id_fkey`: `FOREIGN KEY (id) REFERENCES object_revisions(id)`
- Restricción `campaign_revisions_id_not_null`: `NOT NULL id`
- Restricción `campaign_revisions_pkey`: `PRIMARY KEY (id)`
- Restricción `campaign_revisions_version_check`: `CHECK ((version > 0))`
- Restricción `campaign_revisions_version_not_null`: `NOT NULL version`
- Índice: `CREATE INDEX campaign_revisions_actor_id_fkey_fkidx ON vcm.campaign_revisions USING btree (actor_id)`
- Índice: `CREATE UNIQUE INDEX campaign_revisions_campaign_id_id_key ON vcm.campaign_revisions USING btree (campaign_id, id)`
- Índice: `CREATE UNIQUE INDEX campaign_revisions_campaign_id_version_key ON vcm.campaign_revisions USING btree (campaign_id, version)`
- Índice: `CREATE UNIQUE INDEX campaign_revisions_pkey ON vcm.campaign_revisions USING btree (id)`
- Trigger: `CREATE TRIGGER campaign_revision_immutable BEFORE DELETE OR UPDATE ON vcm.campaign_revisions FOR EACH ROW EXECUTE FUNCTION immutable_row()`
- Trigger: `CREATE TRIGGER campaign_revision_register BEFORE INSERT ON vcm.campaign_revisions FOR EACH ROW EXECUTE FUNCTION register_revision('campaigns', 'campaign_id')`

### campaigns

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| case_id | text | NO | — |
| name | text | NO | — |
| responsible_id | text | YES | — |
| protected_object_id | text | NO | — |
| version | integer | NO | 1 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

- Restricción `campaigns_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES cases(id)`
- Restricción `campaigns_case_id_id_key`: `UNIQUE (case_id, id)`
- Restricción `campaigns_case_id_not_null`: `NOT NULL case_id`
- Restricción `campaigns_created_at_not_null`: `NOT NULL created_at`
- Restricción `campaigns_id_not_null`: `NOT NULL id`
- Restricción `campaigns_name_not_null`: `NOT NULL name`
- Restricción `campaigns_pkey`: `PRIMARY KEY (id)`
- Restricción `campaigns_protected_object_id_fkey`: `FOREIGN KEY (protected_object_id) REFERENCES protected_objects(id)`
- Restricción `campaigns_protected_object_id_key`: `UNIQUE (protected_object_id)`
- Restricción `campaigns_protected_object_id_not_null`: `NOT NULL protected_object_id`
- Restricción `campaigns_responsible_id_fkey`: `FOREIGN KEY (responsible_id) REFERENCES principals(id)`
- Restricción `campaigns_updated_at_not_null`: `NOT NULL updated_at`
- Restricción `campaigns_version_check`: `CHECK ((version > 0))`
- Restricción `campaigns_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX campaigns_case_id_id_key ON vcm.campaigns USING btree (case_id, id)`
- Índice: `CREATE UNIQUE INDEX campaigns_pkey ON vcm.campaigns USING btree (id)`
- Índice: `CREATE UNIQUE INDEX campaigns_protected_object_id_key ON vcm.campaigns USING btree (protected_object_id)`
- Índice: `CREATE INDEX campaigns_responsible_id_fkey_fkidx ON vcm.campaigns USING btree (responsible_id)`
- Trigger: `CREATE TRIGGER campaign_protect BEFORE INSERT ON vcm.campaigns FOR EACH ROW EXECUTE FUNCTION protect_object('campaign')`

### case_agreements

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| case_id | text | NO | — |
| agreement_id | text | NO | — |
| active | boolean | NO | true |

- Restricción `case_agreements_active_not_null`: `NOT NULL active`
- Restricción `case_agreements_agreement_id_fkey`: `FOREIGN KEY (agreement_id) REFERENCES agreements(id)`
- Restricción `case_agreements_agreement_id_not_null`: `NOT NULL agreement_id`
- Restricción `case_agreements_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES cases(id)`
- Restricción `case_agreements_case_id_not_null`: `NOT NULL case_id`
- Restricción `case_agreements_pkey`: `PRIMARY KEY (case_id, agreement_id)`
- Índice: `CREATE INDEX case_agreements_agreement_id_fkey_fkidx ON vcm.case_agreements USING btree (agreement_id)`
- Índice: `CREATE UNIQUE INDEX case_agreements_pkey ON vcm.case_agreements USING btree (case_id, agreement_id)`

### case_assignments

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| case_id | text | NO | — |
| principal_id | text | NO | — |
| function | text | NO | — |
| valid_from | timestamp with time zone | NO | now() |
| valid_until | timestamp with time zone | YES | — |

- Restricción `case_assignments_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES cases(id)`
- Restricción `case_assignments_case_id_not_null`: `NOT NULL case_id`
- Restricción `case_assignments_check`: `CHECK (((valid_until IS NULL) OR (valid_until > valid_from)))`
- Restricción `case_assignments_function_not_null`: `NOT NULL function`
- Restricción `case_assignments_pkey`: `PRIMARY KEY (case_id, principal_id, function)`
- Restricción `case_assignments_principal_id_fkey`: `FOREIGN KEY (principal_id) REFERENCES principals(id)`
- Restricción `case_assignments_principal_id_not_null`: `NOT NULL principal_id`
- Restricción `case_assignments_valid_from_not_null`: `NOT NULL valid_from`
- Índice: `CREATE INDEX assignments_principal_idx ON vcm.case_assignments USING btree (principal_id)`
- Índice: `CREATE UNIQUE INDEX case_assignments_pkey ON vcm.case_assignments USING btree (case_id, principal_id, function)`

### case_fields

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| case_id | text | NO | — |
| field_key | text | NO | — |
| schema_version | text | NO | — |
| status | text | NO | 'pending'::text |
| observation | text | NO | ''::text |
| selected_assertion_id | text | YES | — |

- Restricción `case_fields_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES cases(id)`
- Restricción `case_fields_case_id_not_null`: `NOT NULL case_id`
- Restricción `case_fields_field_key_not_null`: `NOT NULL field_key`
- Restricción `case_fields_observation_not_null`: `NOT NULL observation`
- Restricción `case_fields_pkey`: `PRIMARY KEY (case_id, field_key)`
- Restricción `case_fields_schema_version_field_key_fkey`: `FOREIGN KEY (schema_version, field_key) REFERENCES field_definitions(schema_version, field_key)`
- Restricción `case_fields_schema_version_not_null`: `NOT NULL schema_version`
- Restricción `case_fields_status_check`: `CHECK ((status = ANY (ARRAY['confirmed'::text, 'partial'::text, 'pending'::text, 'conflict'::text])))`
- Restricción `case_fields_status_not_null`: `NOT NULL status`
- Restricción `selected_assertion_same_field`: `FOREIGN KEY (case_id, field_key, selected_assertion_id) REFERENCES field_assertions(case_id, field_key, id)`
- Índice: `CREATE UNIQUE INDEX case_fields_pkey ON vcm.case_fields USING btree (case_id, field_key)`
- Índice: `CREATE INDEX case_fields_schema_version_field_key_fkey_fkidx ON vcm.case_fields USING btree (schema_version, field_key)`
- Índice: `CREATE INDEX selected_assertion_same_field_fkidx ON vcm.case_fields USING btree (case_id, field_key, selected_assertion_id)`

### case_organizations

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| case_id | text | NO | — |
| organization_id | text | NO | — |
| role | text | NO | — |
| active | boolean | NO | true |

- Restricción `case_organizations_active_not_null`: `NOT NULL active`
- Restricción `case_organizations_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES cases(id)`
- Restricción `case_organizations_case_id_not_null`: `NOT NULL case_id`
- Restricción `case_organizations_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`
- Restricción `case_organizations_organization_id_not_null`: `NOT NULL organization_id`
- Restricción `case_organizations_pkey`: `PRIMARY KEY (case_id, organization_id, role)`
- Restricción `case_organizations_role_not_null`: `NOT NULL role`
- Índice: `CREATE INDEX case_organizations_organization_id_fkey_fkidx ON vcm.case_organizations USING btree (organization_id)`
- Índice: `CREATE UNIQUE INDEX case_organizations_pkey ON vcm.case_organizations USING btree (case_id, organization_id, role)`

### case_snapshots

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| case_id | text | NO | — |
| version | integer | NO | — |
| payload | jsonb | NO | — |
| actor_id | text | NO | — |
| captured_at | timestamp with time zone | NO | now() |

- Restricción `case_snapshots_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES principals(id)`
- Restricción `case_snapshots_actor_id_not_null`: `NOT NULL actor_id`
- Restricción `case_snapshots_captured_at_not_null`: `NOT NULL captured_at`
- Restricción `case_snapshots_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES cases(id)`
- Restricción `case_snapshots_case_id_not_null`: `NOT NULL case_id`
- Restricción `case_snapshots_payload_check`: `CHECK ((jsonb_typeof(payload) = 'object'::text))`
- Restricción `case_snapshots_payload_not_null`: `NOT NULL payload`
- Restricción `case_snapshots_pkey`: `PRIMARY KEY (case_id, version)`
- Restricción `case_snapshots_version_check`: `CHECK ((version > 0))`
- Restricción `case_snapshots_version_not_null`: `NOT NULL version`
- Índice: `CREATE INDEX case_snapshots_actor_id_fkey_fkidx ON vcm.case_snapshots USING btree (actor_id)`
- Índice: `CREATE UNIQUE INDEX case_snapshots_pkey ON vcm.case_snapshots USING btree (case_id, version)`
- Trigger: `CREATE TRIGGER snapshot_immutable BEFORE DELETE OR UPDATE ON vcm.case_snapshots FOR EACH ROW EXECUTE FUNCTION immutable_row()`

### cases

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| code | text | NO | — |
| name | text | NO | — |
| kind | text | NO | — |
| portfolio_id | text | YES | — |
| responsible_id | text | YES | — |
| responsible_label | text | YES | — |
| protected_object_id | text | NO | — |
| state | text | NO | 'open'::text |
| rule_version | text | NO | 'PO-2026.09-v1'::text |
| state_object_kind | text | NO | 'case'::text |
| priority | text | NO | 'medium'::text |
| version | integer | NO | 1 |
| demo | boolean | NO | false |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| archived_at | timestamp with time zone | YES | — |

- Restricción `cases_code_key`: `UNIQUE (code)`
- Restricción `cases_code_not_null`: `NOT NULL code`
- Restricción `cases_created_at_not_null`: `NOT NULL created_at`
- Restricción `cases_demo_not_null`: `NOT NULL demo`
- Restricción `cases_id_not_null`: `NOT NULL id`
- Restricción `cases_kind_check`: `CHECK ((kind = ANY (ARRAY['initiative'::text, 'event'::text, 'activity'::text, 'presence'::text, 'campaign'::text])))`
- Restricción `cases_kind_not_null`: `NOT NULL kind`
- Restricción `cases_name_not_null`: `NOT NULL name`
- Restricción `cases_pkey`: `PRIMARY KEY (id)`
- Restricción `cases_portfolio_id_fkey`: `FOREIGN KEY (portfolio_id) REFERENCES portfolios(id)`
- Restricción `cases_priority_check`: `CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))`
- Restricción `cases_priority_not_null`: `NOT NULL priority`
- Restricción `cases_protected_object_id_fkey`: `FOREIGN KEY (protected_object_id) REFERENCES protected_objects(id)`
- Restricción `cases_protected_object_id_key`: `UNIQUE (protected_object_id)`
- Restricción `cases_protected_object_id_not_null`: `NOT NULL protected_object_id`
- Restricción `cases_responsible_id_fkey`: `FOREIGN KEY (responsible_id) REFERENCES principals(id)`
- Restricción `cases_rule_version_not_null`: `NOT NULL rule_version`
- Restricción `cases_state_not_null`: `NOT NULL state`
- Restricción `cases_state_object_kind_check`: `CHECK ((state_object_kind = 'case'::text))`
- Restricción `cases_state_object_kind_not_null`: `NOT NULL state_object_kind`
- Restricción `cases_state_object_kind_rule_version_state_fkey`: `FOREIGN KEY (state_object_kind, rule_version, state) REFERENCES state_definitions(object_kind, rule_version, code)`
- Restricción `cases_updated_at_not_null`: `NOT NULL updated_at`
- Restricción `cases_version_check`: `CHECK ((version > 0))`
- Restricción `cases_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX cases_code_key ON vcm.cases USING btree (code)`
- Índice: `CREATE UNIQUE INDEX cases_pkey ON vcm.cases USING btree (id)`
- Índice: `CREATE INDEX cases_portfolio_id_fkey_fkidx ON vcm.cases USING btree (portfolio_id)`
- Índice: `CREATE UNIQUE INDEX cases_protected_object_id_key ON vcm.cases USING btree (protected_object_id)`
- Índice: `CREATE INDEX cases_responsible_id_fkey_fkidx ON vcm.cases USING btree (responsible_id)`
- Índice: `CREATE INDEX cases_state_object_kind_rule_version_state_fkey_fkidx ON vcm.cases USING btree (state_object_kind, rule_version, state)`
- Trigger: `CREATE TRIGGER case_protect BEFORE INSERT ON vcm.cases FOR EACH ROW EXECUTE FUNCTION protect_object('case')`

### catalog_entries

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| catalog_version_id | text | NO | — |
| code | text | NO | — |
| label | text | NO | — |
| active | boolean | NO | true |

- Restricción `catalog_entries_active_not_null`: `NOT NULL active`
- Restricción `catalog_entries_catalog_version_id_fkey`: `FOREIGN KEY (catalog_version_id) REFERENCES catalog_versions(id)`
- Restricción `catalog_entries_catalog_version_id_not_null`: `NOT NULL catalog_version_id`
- Restricción `catalog_entries_code_not_null`: `NOT NULL code`
- Restricción `catalog_entries_label_not_null`: `NOT NULL label`
- Restricción `catalog_entries_pkey`: `PRIMARY KEY (catalog_version_id, code)`
- Índice: `CREATE UNIQUE INDEX catalog_entries_pkey ON vcm.catalog_entries USING btree (catalog_version_id, code)`

### catalog_versions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| kind | text | NO | — |
| source | text | YES | — |
| availability | text | NO | — |
| valid_from | date | YES | — |
| valid_until | date | YES | — |

- Restricción `catalog_versions_availability_check`: `CHECK ((availability = ANY (ARRAY['available'::text, 'pending'::text])))`
- Restricción `catalog_versions_availability_not_null`: `NOT NULL availability`
- Restricción `catalog_versions_id_not_null`: `NOT NULL id`
- Restricción `catalog_versions_kind_id_key`: `UNIQUE (kind, id)`
- Restricción `catalog_versions_kind_not_null`: `NOT NULL kind`
- Restricción `catalog_versions_pkey`: `PRIMARY KEY (id)`
- Índice: `CREATE UNIQUE INDEX catalog_versions_kind_id_key ON vcm.catalog_versions USING btree (kind, id)`
- Índice: `CREATE UNIQUE INDEX catalog_versions_pkey ON vcm.catalog_versions USING btree (id)`

### commitment_expenses

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| project_id | text | NO | — |
| commitment_id | text | NO | — |
| expense_id | text | NO | — |

- Restricción `commitment_expenses_commitment_id_not_null`: `NOT NULL commitment_id`
- Restricción `commitment_expenses_expense_id_key`: `UNIQUE (expense_id)`
- Restricción `commitment_expenses_expense_id_not_null`: `NOT NULL expense_id`
- Restricción `commitment_expenses_pkey`: `PRIMARY KEY (commitment_id, expense_id)`
- Restricción `commitment_expenses_project_id_commitment_id_fkey`: `FOREIGN KEY (project_id, commitment_id) REFERENCES commitments(project_id, id)`
- Restricción `commitment_expenses_project_id_expense_id_fkey`: `FOREIGN KEY (project_id, expense_id) REFERENCES expenses(project_id, id)`
- Restricción `commitment_expenses_project_id_not_null`: `NOT NULL project_id`
- Índice: `CREATE UNIQUE INDEX commitment_expenses_expense_id_key ON vcm.commitment_expenses USING btree (expense_id)`
- Índice: `CREATE UNIQUE INDEX commitment_expenses_pkey ON vcm.commitment_expenses USING btree (commitment_id, expense_id)`
- Índice: `CREATE INDEX commitment_expenses_project_id_commitment_id_fkey_fkidx ON vcm.commitment_expenses USING btree (project_id, commitment_id)`
- Índice: `CREATE INDEX commitment_expenses_project_id_expense_id_fkey_fkidx ON vcm.commitment_expenses USING btree (project_id, expense_id)`

### commitments

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| project_id | text | NO | — |
| case_id | text | NO | — |
| authorization_id | text | NO | — |
| title | text | NO | — |
| amount | bigint | NO | — |
| reference | text | YES | — |
| status | text | NO | 'active'::text |
| reason | text | YES | — |
| actor_id | text | NO | — |
| version | integer | NO | 1 |
| at | timestamp with time zone | NO | now() |

- Restricción `commitments_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES principals(id)`
- Restricción `commitments_actor_id_not_null`: `NOT NULL actor_id`
- Restricción `commitments_amount_check`: `CHECK ((amount >= 0))`
- Restricción `commitments_amount_not_null`: `NOT NULL amount`
- Restricción `commitments_at_not_null`: `NOT NULL at`
- Restricción `commitments_authorization_id_not_null`: `NOT NULL authorization_id`
- Restricción `commitments_case_id_not_null`: `NOT NULL case_id`
- Restricción `commitments_id_not_null`: `NOT NULL id`
- Restricción `commitments_pkey`: `PRIMARY KEY (id)`
- Restricción `commitments_project_id_authorization_id_fkey`: `FOREIGN KEY (project_id, authorization_id) REFERENCES budget_authorizations(project_id, id)`
- Restricción `commitments_project_id_case_id_fkey`: `FOREIGN KEY (project_id, case_id) REFERENCES project_cases(project_id, case_id)`
- Restricción `commitments_project_id_id_key`: `UNIQUE (project_id, id)`
- Restricción `commitments_project_id_not_null`: `NOT NULL project_id`
- Restricción `commitments_status_check`: `CHECK ((status = ANY (ARRAY['active'::text, 'cancelled'::text])))`
- Restricción `commitments_status_not_null`: `NOT NULL status`
- Restricción `commitments_title_not_null`: `NOT NULL title`
- Restricción `commitments_version_check`: `CHECK ((version > 0))`
- Restricción `commitments_version_not_null`: `NOT NULL version`
- Índice: `CREATE INDEX commitments_actor_id_fkey_fkidx ON vcm.commitments USING btree (actor_id)`
- Índice: `CREATE UNIQUE INDEX commitments_pkey ON vcm.commitments USING btree (id)`
- Índice: `CREATE INDEX commitments_project_id_authorization_id_fkey_fkidx ON vcm.commitments USING btree (project_id, authorization_id)`
- Índice: `CREATE INDEX commitments_project_id_case_id_fkey_fkidx ON vcm.commitments USING btree (project_id, case_id)`
- Índice: `CREATE UNIQUE INDEX commitments_project_id_id_key ON vcm.commitments USING btree (project_id, id)`

### communication_operations

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| object_id | text | NO | — |
| destination_reference | text | NO | — |
| action_class | text | NO | — |
| mandate_id | text | YES | — |
| decision_outcome_id | text | YES | — |
| draft | text | NO | — |
| status | text | NO | 'prepared'::text |
| provider | text | YES | — |
| external_id | text | YES | — |
| idempotency_key | text | NO | — |
| result | jsonb | YES | — |
| created_at | timestamp with time zone | NO | now() |

- Restricción `communication_operations_action_class_not_null`: `NOT NULL action_class`
- Restricción `communication_operations_check`: `CHECK ((num_nonnulls(mandate_id, decision_outcome_id) >= 1))`
- Restricción `communication_operations_created_at_not_null`: `NOT NULL created_at`
- Restricción `communication_operations_decision_outcome_id_fkey`: `FOREIGN KEY (decision_outcome_id) REFERENCES decision_outcomes(id)`
- Restricción `communication_operations_destination_reference_not_null`: `NOT NULL destination_reference`
- Restricción `communication_operations_draft_not_null`: `NOT NULL draft`
- Restricción `communication_operations_id_not_null`: `NOT NULL id`
- Restricción `communication_operations_idempotency_key_key`: `UNIQUE (idempotency_key)`
- Restricción `communication_operations_idempotency_key_not_null`: `NOT NULL idempotency_key`
- Restricción `communication_operations_mandate_id_fkey`: `FOREIGN KEY (mandate_id) REFERENCES operation_mandates(id)`
- Restricción `communication_operations_object_id_fkey`: `FOREIGN KEY (object_id) REFERENCES protected_objects(id)`
- Restricción `communication_operations_object_id_not_null`: `NOT NULL object_id`
- Restricción `communication_operations_pkey`: `PRIMARY KEY (id)`
- Restricción `communication_operations_status_check`: `CHECK ((status = ANY (ARRAY['prepared'::text, 'requested'::text, 'confirmed'::text, 'failed'::text, 'ambiguous'::text, 'cancelled'::text])))`
- Restricción `communication_operations_status_not_null`: `NOT NULL status`
- Índice: `CREATE INDEX communication_operations_decision_outcome_id_fkey_fkidx ON vcm.communication_operations USING btree (decision_outcome_id)`
- Índice: `CREATE UNIQUE INDEX communication_operations_idempotency_key_key ON vcm.communication_operations USING btree (idempotency_key)`
- Índice: `CREATE INDEX communication_operations_mandate_id_fkey_fkidx ON vcm.communication_operations USING btree (mandate_id)`
- Índice: `CREATE INDEX communication_operations_object_id_fkey_fkidx ON vcm.communication_operations USING btree (object_id)`
- Índice: `CREATE UNIQUE INDEX communication_operations_pkey ON vcm.communication_operations USING btree (id)`

### contacts

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| name | text | NO | — |
| email | text | YES | — |
| phone | text | YES | — |
| principal_id | text | YES | — |
| version | integer | NO | 1 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| archived_at | timestamp with time zone | YES | — |

- Restricción `contacts_created_at_not_null`: `NOT NULL created_at`
- Restricción `contacts_id_not_null`: `NOT NULL id`
- Restricción `contacts_name_not_null`: `NOT NULL name`
- Restricción `contacts_pkey`: `PRIMARY KEY (id)`
- Restricción `contacts_principal_id_fkey`: `FOREIGN KEY (principal_id) REFERENCES users(principal_id)`
- Restricción `contacts_updated_at_not_null`: `NOT NULL updated_at`
- Restricción `contacts_version_check`: `CHECK ((version > 0))`
- Restricción `contacts_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX contacts_pkey ON vcm.contacts USING btree (id)`
- Índice: `CREATE INDEX contacts_principal_id_fkey_fkidx ON vcm.contacts USING btree (principal_id)`

### content_assets

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| content_revision_id | text | NO | — |
| document_id | text | NO | — |

- Restricción `content_assets_content_revision_id_fkey`: `FOREIGN KEY (content_revision_id) REFERENCES content_revisions(id)`
- Restricción `content_assets_content_revision_id_not_null`: `NOT NULL content_revision_id`
- Restricción `content_assets_document_id_fkey`: `FOREIGN KEY (document_id) REFERENCES document_references(id)`
- Restricción `content_assets_document_id_not_null`: `NOT NULL document_id`
- Restricción `content_assets_pkey`: `PRIMARY KEY (content_revision_id, document_id)`
- Índice: `CREATE INDEX content_assets_document_id_fkey_fkidx ON vcm.content_assets USING btree (document_id)`
- Índice: `CREATE UNIQUE INDEX content_assets_pkey ON vcm.content_assets USING btree (content_revision_id, document_id)`
- Trigger: `CREATE TRIGGER content_assets_unsealed BEFORE INSERT ON vcm.content_assets FOR EACH ROW EXECUTE FUNCTION revision_unsealed('content_revision_id')`

### content_revisions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| content_id | text | NO | — |
| version | integer | NO | — |
| campaign_revision_id | text | YES | — |
| brief | text | NO | — |
| copy | text | NO | — |
| channel | text | NO | — |
| scheduled_at | timestamp with time zone | YES | — |
| timezone | text | NO | 'America/Santiago'::text |
| actor_id | text | NO | — |

- Restricción `content_revisions_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES principals(id)`
- Restricción `content_revisions_actor_id_not_null`: `NOT NULL actor_id`
- Restricción `content_revisions_brief_not_null`: `NOT NULL brief`
- Restricción `content_revisions_campaign_revision_id_fkey`: `FOREIGN KEY (campaign_revision_id) REFERENCES campaign_revisions(id)`
- Restricción `content_revisions_channel_not_null`: `NOT NULL channel`
- Restricción `content_revisions_content_id_fkey`: `FOREIGN KEY (content_id) REFERENCES contents(id)`
- Restricción `content_revisions_content_id_id_key`: `UNIQUE (content_id, id)`
- Restricción `content_revisions_content_id_not_null`: `NOT NULL content_id`
- Restricción `content_revisions_content_id_version_key`: `UNIQUE (content_id, version)`
- Restricción `content_revisions_copy_not_null`: `NOT NULL copy`
- Restricción `content_revisions_id_fkey`: `FOREIGN KEY (id) REFERENCES object_revisions(id)`
- Restricción `content_revisions_id_not_null`: `NOT NULL id`
- Restricción `content_revisions_pkey`: `PRIMARY KEY (id)`
- Restricción `content_revisions_timezone_not_null`: `NOT NULL timezone`
- Restricción `content_revisions_version_check`: `CHECK ((version > 0))`
- Restricción `content_revisions_version_not_null`: `NOT NULL version`
- Índice: `CREATE INDEX content_revisions_actor_id_fkey_fkidx ON vcm.content_revisions USING btree (actor_id)`
- Índice: `CREATE INDEX content_revisions_campaign_revision_id_fkey_fkidx ON vcm.content_revisions USING btree (campaign_revision_id)`
- Índice: `CREATE UNIQUE INDEX content_revisions_content_id_id_key ON vcm.content_revisions USING btree (content_id, id)`
- Índice: `CREATE UNIQUE INDEX content_revisions_content_id_version_key ON vcm.content_revisions USING btree (content_id, version)`
- Índice: `CREATE UNIQUE INDEX content_revisions_pkey ON vcm.content_revisions USING btree (id)`
- Trigger: `CREATE TRIGGER content_campaign_identity BEFORE INSERT ON vcm.content_revisions FOR EACH ROW EXECUTE FUNCTION content_campaign_identity()`
- Trigger: `CREATE TRIGGER content_revision_immutable BEFORE DELETE OR UPDATE ON vcm.content_revisions FOR EACH ROW EXECUTE FUNCTION immutable_row()`
- Trigger: `CREATE TRIGGER content_revision_register BEFORE INSERT ON vcm.content_revisions FOR EACH ROW EXECUTE FUNCTION register_revision('contents', 'content_id')`

### contents

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| case_id | text | NO | — |
| campaign_id | text | YES | — |
| title | text | NO | — |
| mode | text | NO | 'weekly'::text |
| protected_object_id | text | NO | — |
| version | integer | NO | 1 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

- Restricción `contents_case_id_campaign_id_fkey`: `FOREIGN KEY (case_id, campaign_id) REFERENCES campaigns(case_id, id)`
- Restricción `contents_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES cases(id)`
- Restricción `contents_case_id_not_null`: `NOT NULL case_id`
- Restricción `contents_created_at_not_null`: `NOT NULL created_at`
- Restricción `contents_id_not_null`: `NOT NULL id`
- Restricción `contents_mode_check`: `CHECK ((mode = ANY (ARRAY['weekly'::text, 'exception'::text])))`
- Restricción `contents_mode_not_null`: `NOT NULL mode`
- Restricción `contents_pkey`: `PRIMARY KEY (id)`
- Restricción `contents_protected_object_id_fkey`: `FOREIGN KEY (protected_object_id) REFERENCES protected_objects(id)`
- Restricción `contents_protected_object_id_key`: `UNIQUE (protected_object_id)`
- Restricción `contents_protected_object_id_not_null`: `NOT NULL protected_object_id`
- Restricción `contents_title_not_null`: `NOT NULL title`
- Restricción `contents_updated_at_not_null`: `NOT NULL updated_at`
- Restricción `contents_version_check`: `CHECK ((version > 0))`
- Restricción `contents_version_not_null`: `NOT NULL version`
- Índice: `CREATE INDEX contents_case_id_campaign_id_fkey_fkidx ON vcm.contents USING btree (case_id, campaign_id)`
- Índice: `CREATE INDEX contents_case_id_fkey_fkidx ON vcm.contents USING btree (case_id)`
- Índice: `CREATE UNIQUE INDEX contents_pkey ON vcm.contents USING btree (id)`
- Índice: `CREATE UNIQUE INDEX contents_protected_object_id_key ON vcm.contents USING btree (protected_object_id)`
- Trigger: `CREATE TRIGGER content_protect BEFORE INSERT ON vcm.contents FOR EACH ROW EXECUTE FUNCTION protect_object('content')`

### contribution_evidences

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| contribution_id | text | NO | — |
| case_id | text | NO | — |
| evidence_id | text | NO | — |
| evidence_version | integer | NO | — |

- Restricción `contribution_evidences_case_id_contribution_id_fkey`: `FOREIGN KEY (case_id, contribution_id) REFERENCES indicator_contributions(case_id, id)`
- Restricción `contribution_evidences_case_id_evidence_id_fkey`: `FOREIGN KEY (case_id, evidence_id) REFERENCES evidences(case_id, id)`
- Restricción `contribution_evidences_case_id_not_null`: `NOT NULL case_id`
- Restricción `contribution_evidences_contribution_id_not_null`: `NOT NULL contribution_id`
- Restricción `contribution_evidences_evidence_id_not_null`: `NOT NULL evidence_id`
- Restricción `contribution_evidences_evidence_version_check`: `CHECK ((evidence_version > 0))`
- Restricción `contribution_evidences_evidence_version_not_null`: `NOT NULL evidence_version`
- Restricción `contribution_evidences_pkey`: `PRIMARY KEY (contribution_id, evidence_id)`
- Índice: `CREATE INDEX contribution_evidences_case_id_contribution_id_fkey_fkidx ON vcm.contribution_evidences USING btree (case_id, contribution_id)`
- Índice: `CREATE INDEX contribution_evidences_case_id_evidence_id_fkey_fkidx ON vcm.contribution_evidences USING btree (case_id, evidence_id)`
- Índice: `CREATE UNIQUE INDEX contribution_evidences_pkey ON vcm.contribution_evidences USING btree (contribution_id, evidence_id)`

### cut_cases

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| cut_id | text | NO | — |
| cut_version | integer | NO | — |
| case_id | text | NO | — |
| case_version | integer | NO | — |

- Restricción `cut_cases_case_id_case_version_fkey`: `FOREIGN KEY (case_id, case_version) REFERENCES case_snapshots(case_id, version)`
- Restricción `cut_cases_case_id_not_null`: `NOT NULL case_id`
- Restricción `cut_cases_case_version_not_null`: `NOT NULL case_version`
- Restricción `cut_cases_cut_id_fkey`: `FOREIGN KEY (cut_id) REFERENCES institutional_cuts(id)`
- Restricción `cut_cases_cut_id_not_null`: `NOT NULL cut_id`
- Restricción `cut_cases_cut_version_check`: `CHECK ((cut_version > 0))`
- Restricción `cut_cases_cut_version_not_null`: `NOT NULL cut_version`
- Restricción `cut_cases_pkey`: `PRIMARY KEY (cut_id, cut_version, case_id)`
- Restricción `cut_membership_revision`: `FOREIGN KEY (cut_id, cut_version) REFERENCES cut_revisions(cut_id, version)`
- Índice: `CREATE INDEX cut_cases_case_id_case_version_fkey_fkidx ON vcm.cut_cases USING btree (case_id, case_version)`
- Índice: `CREATE UNIQUE INDEX cut_cases_pkey ON vcm.cut_cases USING btree (cut_id, cut_version, case_id)`
- Trigger: `CREATE TRIGGER cut_cases_immutable BEFORE DELETE OR UPDATE ON vcm.cut_cases FOR EACH ROW EXECUTE FUNCTION immutable_row()`
- Trigger: `CREATE TRIGGER cut_membership_unsealed BEFORE INSERT ON vcm.cut_cases FOR EACH ROW EXECUTE FUNCTION cut_membership_unsealed()`

### cut_observations

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| cut_id | text | NO | — |
| case_id | text | NO | — |
| category | text | NO | — |
| text | text | NO | — |
| responsible_id | text | YES | — |
| responsible_label | text | YES | — |
| status | text | NO | 'open'::text |
| resolution | text | YES | — |
| resolved_at | timestamp with time zone | YES | — |
| version | integer | NO | 1 |

- Restricción `cut_observations_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES cases(id)`
- Restricción `cut_observations_case_id_not_null`: `NOT NULL case_id`
- Restricción `cut_observations_category_not_null`: `NOT NULL category`
- Restricción `cut_observations_check`: `CHECK (((status <> 'resolved'::text) OR ((resolution IS NOT NULL) AND (resolved_at IS NOT NULL))))`
- Restricción `cut_observations_cut_id_fkey`: `FOREIGN KEY (cut_id) REFERENCES institutional_cuts(id)`
- Restricción `cut_observations_cut_id_not_null`: `NOT NULL cut_id`
- Restricción `cut_observations_id_not_null`: `NOT NULL id`
- Restricción `cut_observations_pkey`: `PRIMARY KEY (id)`
- Restricción `cut_observations_responsible_id_fkey`: `FOREIGN KEY (responsible_id) REFERENCES principals(id)`
- Restricción `cut_observations_status_check`: `CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text])))`
- Restricción `cut_observations_status_not_null`: `NOT NULL status`
- Restricción `cut_observations_text_not_null`: `NOT NULL text`
- Restricción `cut_observations_version_check`: `CHECK ((version > 0))`
- Restricción `cut_observations_version_not_null`: `NOT NULL version`
- Índice: `CREATE INDEX cut_observations_case_id_fkey_fkidx ON vcm.cut_observations USING btree (case_id)`
- Índice: `CREATE INDEX cut_observations_cut_id_fkey_fkidx ON vcm.cut_observations USING btree (cut_id)`
- Índice: `CREATE UNIQUE INDEX cut_observations_pkey ON vcm.cut_observations USING btree (id)`
- Índice: `CREATE INDEX cut_observations_responsible_id_fkey_fkidx ON vcm.cut_observations USING btree (responsible_id)`

### cut_revisions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| cut_id | text | NO | — |
| version | integer | NO | — |
| created_at | timestamp with time zone | NO | now() |
| sealed_at | timestamp with time zone | YES | — |

- Restricción `cut_revisions_created_at_not_null`: `NOT NULL created_at`
- Restricción `cut_revisions_cut_id_fkey`: `FOREIGN KEY (cut_id) REFERENCES institutional_cuts(id)`
- Restricción `cut_revisions_cut_id_not_null`: `NOT NULL cut_id`
- Restricción `cut_revisions_pkey`: `PRIMARY KEY (cut_id, version)`
- Restricción `cut_revisions_version_check`: `CHECK ((version > 0))`
- Restricción `cut_revisions_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX cut_revisions_pkey ON vcm.cut_revisions USING btree (cut_id, version)`
- Trigger: `CREATE TRIGGER cut_revision_no_delete BEFORE DELETE ON vcm.cut_revisions FOR EACH ROW EXECUTE FUNCTION immutable_row()`
- Trigger: `CREATE TRIGGER cut_revision_seal BEFORE UPDATE ON vcm.cut_revisions FOR EACH ROW EXECUTE FUNCTION seal_cut_revision()`

### decision_outcomes

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| decision_revision_id | text | NO | — |
| decided_by | text | NO | — |
| recorded_by | text | NO | — |
| outcome | text | NO | — |
| reason | text | NO | — |
| approved_scope | text | YES | — |
| budget_basis | text | YES | — |
| channel | text | NO | — |
| delegation_reference | text | YES | — |
| decided_at | timestamp with time zone | NO | now() |

- Restricción `decision_outcomes_channel_check`: `CHECK ((channel = ANY (ARRAY['web'::text, 'telegram'::text])))`
- Restricción `decision_outcomes_channel_not_null`: `NOT NULL channel`
- Restricción `decision_outcomes_decided_at_not_null`: `NOT NULL decided_at`
- Restricción `decision_outcomes_decided_by_fkey`: `FOREIGN KEY (decided_by) REFERENCES users(principal_id)`
- Restricción `decision_outcomes_decided_by_not_null`: `NOT NULL decided_by`
- Restricción `decision_outcomes_decision_revision_id_fkey`: `FOREIGN KEY (decision_revision_id) REFERENCES decision_revisions(id)`
- Restricción `decision_outcomes_decision_revision_id_not_null`: `NOT NULL decision_revision_id`
- Restricción `decision_outcomes_id_not_null`: `NOT NULL id`
- Restricción `decision_outcomes_outcome_check`: `CHECK ((outcome = ANY (ARRAY['approved'::text, 'rejected'::text, 'returned'::text, 'postponed'::text])))`
- Restricción `decision_outcomes_outcome_not_null`: `NOT NULL outcome`
- Restricción `decision_outcomes_pkey`: `PRIMARY KEY (id)`
- Restricción `decision_outcomes_reason_check`: `CHECK ((length(TRIM(BOTH FROM reason)) > 0))`
- Restricción `decision_outcomes_reason_not_null`: `NOT NULL reason`
- Restricción `decision_outcomes_recorded_by_fkey`: `FOREIGN KEY (recorded_by) REFERENCES principals(id)`
- Restricción `decision_outcomes_recorded_by_not_null`: `NOT NULL recorded_by`
- Índice: `CREATE INDEX decision_outcomes_decided_by_fkey_fkidx ON vcm.decision_outcomes USING btree (decided_by)`
- Índice: `CREATE INDEX decision_outcomes_decision_revision_id_fkey_fkidx ON vcm.decision_outcomes USING btree (decision_revision_id)`
- Índice: `CREATE UNIQUE INDEX decision_outcomes_pkey ON vcm.decision_outcomes USING btree (id)`
- Índice: `CREATE INDEX decision_outcomes_recorded_by_fkey_fkidx ON vcm.decision_outcomes USING btree (recorded_by)`
- Trigger: `CREATE TRIGGER outcome_immutable BEFORE DELETE OR UPDATE ON vcm.decision_outcomes FOR EACH ROW EXECUTE FUNCTION immutable_row()`

### decision_revisions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| decision_id | text | NO | — |
| version | integer | NO | — |
| proposal | text | NO | — |
| alternatives | text | YES | — |
| recommendation | text | YES | — |
| impact | text | YES | — |
| amount | bigint | YES | — |
| requested_by | text | NO | — |
| created_at | timestamp with time zone | NO | now() |
| project_id | text | YES | — |

- Restricción `decision_revisions_amount_check`: `CHECK ((amount >= 0))`
- Restricción `decision_revisions_created_at_not_null`: `NOT NULL created_at`
- Restricción `decision_revisions_decision_id_fkey`: `FOREIGN KEY (decision_id) REFERENCES decisions(id)`
- Restricción `decision_revisions_decision_id_not_null`: `NOT NULL decision_id`
- Restricción `decision_revisions_decision_id_version_key`: `UNIQUE (decision_id, version)`
- Restricción `decision_revisions_id_fkey`: `FOREIGN KEY (id) REFERENCES object_revisions(id)`
- Restricción `decision_revisions_id_not_null`: `NOT NULL id`
- Restricción `decision_revisions_pkey`: `PRIMARY KEY (id)`
- Restricción `decision_revisions_project_id_fkey`: `FOREIGN KEY (project_id) REFERENCES projects(id)`
- Restricción `decision_revisions_proposal_not_null`: `NOT NULL proposal`
- Restricción `decision_revisions_requested_by_fkey`: `FOREIGN KEY (requested_by) REFERENCES principals(id)`
- Restricción `decision_revisions_requested_by_not_null`: `NOT NULL requested_by`
- Restricción `decision_revisions_version_check`: `CHECK ((version > 0))`
- Restricción `decision_revisions_version_not_null`: `NOT NULL version`
- Índice: `CREATE INDEX decision_revision_project_idx ON vcm.decision_revisions USING btree (project_id)`
- Índice: `CREATE UNIQUE INDEX decision_revisions_decision_id_version_key ON vcm.decision_revisions USING btree (decision_id, version)`
- Índice: `CREATE UNIQUE INDEX decision_revisions_pkey ON vcm.decision_revisions USING btree (id)`
- Índice: `CREATE INDEX decision_revisions_requested_by_fkey_fkidx ON vcm.decision_revisions USING btree (requested_by)`
- Trigger: `CREATE TRIGGER decision_revision_immutable BEFORE DELETE OR UPDATE ON vcm.decision_revisions FOR EACH ROW EXECUTE FUNCTION immutable_row()`
- Trigger: `CREATE TRIGGER decision_revision_register BEFORE INSERT ON vcm.decision_revisions FOR EACH ROW EXECUTE FUNCTION register_revision('decisions', 'decision_id')`

### decisions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| case_id | text | NO | — |
| kind | text | NO | — |
| title | text | NO | — |
| status | text | NO | 'pending'::text |
| authority | text | NO | 'coordination'::text |
| protected_object_id | text | NO | — |
| version | integer | NO | 1 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

- Restricción `decisions_authority_check`: `CHECK ((authority = ANY (ARRAY['coordination'::text, 'leadership'::text, 'direction'::text])))`
- Restricción `decisions_authority_not_null`: `NOT NULL authority`
- Restricción `decisions_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES cases(id)`
- Restricción `decisions_case_id_not_null`: `NOT NULL case_id`
- Restricción `decisions_created_at_not_null`: `NOT NULL created_at`
- Restricción `decisions_id_not_null`: `NOT NULL id`
- Restricción `decisions_kind_check`: `CHECK ((kind = ANY (ARRAY['priority'::text, 'budget'::text, 'exception'::text, 'flow'::text])))`
- Restricción `decisions_kind_not_null`: `NOT NULL kind`
- Restricción `decisions_pkey`: `PRIMARY KEY (id)`
- Restricción `decisions_protected_object_id_fkey`: `FOREIGN KEY (protected_object_id) REFERENCES protected_objects(id)`
- Restricción `decisions_protected_object_id_key`: `UNIQUE (protected_object_id)`
- Restricción `decisions_protected_object_id_not_null`: `NOT NULL protected_object_id`
- Restricción `decisions_status_check`: `CHECK ((status = ANY (ARRAY['pending'::text, 'coordination_review'::text, 'leadership_review'::text, 'direction_required'::text, 'approved'::text, 'rejected'::text, 'returned'::text, 'postponed'::text, 'in_execution'::text, 'closed'::text, 'escalated'::text])))`
- Restricción `decisions_status_not_null`: `NOT NULL status`
- Restricción `decisions_title_not_null`: `NOT NULL title`
- Restricción `decisions_updated_at_not_null`: `NOT NULL updated_at`
- Restricción `decisions_version_check`: `CHECK ((version > 0))`
- Restricción `decisions_version_not_null`: `NOT NULL version`
- Índice: `CREATE INDEX decisions_case_id_fkey_fkidx ON vcm.decisions USING btree (case_id)`
- Índice: `CREATE UNIQUE INDEX decisions_pkey ON vcm.decisions USING btree (id)`
- Índice: `CREATE UNIQUE INDEX decisions_protected_object_id_key ON vcm.decisions USING btree (protected_object_id)`
- Trigger: `CREATE TRIGGER decision_protect BEFORE INSERT ON vcm.decisions FOR EACH ROW EXECUTE FUNCTION protect_object('decision')`

### document_references

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| name | text | NO | — |
| provider | text | NO | 'reference'::text |
| external_id | text | YES | — |
| url | text | YES | — |
| document_version | text | YES | — |
| checksum | text | YES | — |
| protected_object_id | text | NO | — |
| version | integer | NO | 1 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

- Restricción `document_references_created_at_not_null`: `NOT NULL created_at`
- Restricción `document_references_id_not_null`: `NOT NULL id`
- Restricción `document_references_name_not_null`: `NOT NULL name`
- Restricción `document_references_pkey`: `PRIMARY KEY (id)`
- Restricción `document_references_protected_object_id_fkey`: `FOREIGN KEY (protected_object_id) REFERENCES protected_objects(id)`
- Restricción `document_references_protected_object_id_key`: `UNIQUE (protected_object_id)`
- Restricción `document_references_protected_object_id_not_null`: `NOT NULL protected_object_id`
- Restricción `document_references_provider_not_null`: `NOT NULL provider`
- Restricción `document_references_updated_at_not_null`: `NOT NULL updated_at`
- Restricción `document_references_version_check`: `CHECK ((version > 0))`
- Restricción `document_references_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX document_external_idx ON vcm.document_references USING btree (provider, external_id) WHERE (external_id IS NOT NULL)`
- Índice: `CREATE UNIQUE INDEX document_references_pkey ON vcm.document_references USING btree (id)`
- Índice: `CREATE UNIQUE INDEX document_references_protected_object_id_key ON vcm.document_references USING btree (protected_object_id)`
- Trigger: `CREATE TRIGGER document_protect BEFORE INSERT ON vcm.document_references FOR EACH ROW EXECUTE FUNCTION protect_object('document')`

### editorial_packages

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| name | text | NO | — |
| period_starts_on | date | NO | — |
| protected_object_id | text | NO | — |
| version | integer | NO | 1 |

- Restricción `editorial_packages_id_not_null`: `NOT NULL id`
- Restricción `editorial_packages_name_not_null`: `NOT NULL name`
- Restricción `editorial_packages_period_starts_on_not_null`: `NOT NULL period_starts_on`
- Restricción `editorial_packages_pkey`: `PRIMARY KEY (id)`
- Restricción `editorial_packages_protected_object_id_fkey`: `FOREIGN KEY (protected_object_id) REFERENCES protected_objects(id)`
- Restricción `editorial_packages_protected_object_id_key`: `UNIQUE (protected_object_id)`
- Restricción `editorial_packages_protected_object_id_not_null`: `NOT NULL protected_object_id`
- Restricción `editorial_packages_version_check`: `CHECK ((version > 0))`
- Restricción `editorial_packages_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX editorial_packages_pkey ON vcm.editorial_packages USING btree (id)`
- Índice: `CREATE UNIQUE INDEX editorial_packages_protected_object_id_key ON vcm.editorial_packages USING btree (protected_object_id)`
- Trigger: `CREATE TRIGGER package_protect BEFORE INSERT ON vcm.editorial_packages FOR EACH ROW EXECUTE FUNCTION protect_object('package')`

### event_deliveries

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| cursor | bigint | NO | — |
| outbox_sequence | bigint | NO | — |
| created_at | timestamp with time zone | NO | now() |

- Restricción `event_deliveries_created_at_not_null`: `NOT NULL created_at`
- Restricción `event_deliveries_cursor_not_null`: `NOT NULL cursor`
- Restricción `event_deliveries_outbox_sequence_fkey`: `FOREIGN KEY (outbox_sequence) REFERENCES outbox_events(sequence)`
- Restricción `event_deliveries_outbox_sequence_key`: `UNIQUE (outbox_sequence)`
- Restricción `event_deliveries_outbox_sequence_not_null`: `NOT NULL outbox_sequence`
- Restricción `event_deliveries_pkey`: `PRIMARY KEY (cursor)`
- Índice: `CREATE UNIQUE INDEX event_deliveries_outbox_sequence_key ON vcm.event_deliveries USING btree (outbox_sequence)`
- Índice: `CREATE UNIQUE INDEX event_deliveries_pkey ON vcm.event_deliveries USING btree (cursor)`
- Índice: `CREATE INDEX event_deliveries_retention_idx ON vcm.event_deliveries USING btree (created_at, cursor)`
- Trigger: `CREATE TRIGGER delivery_immutable BEFORE DELETE OR UPDATE ON vcm.event_deliveries FOR EACH ROW EXECUTE FUNCTION immutable_row()`

### evidence_reviews

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| evidence_id | text | NO | — |
| evidence_version | integer | NO | — |
| reviewer_id | text | NO | — |
| result | text | NO | — |
| reason | text | NO | — |
| reviewed_at | timestamp with time zone | NO | now() |

- Restricción `evidence_reviews_evidence_id_fkey`: `FOREIGN KEY (evidence_id) REFERENCES evidences(id)`
- Restricción `evidence_reviews_evidence_id_not_null`: `NOT NULL evidence_id`
- Restricción `evidence_reviews_evidence_version_check`: `CHECK ((evidence_version > 0))`
- Restricción `evidence_reviews_evidence_version_not_null`: `NOT NULL evidence_version`
- Restricción `evidence_reviews_id_not_null`: `NOT NULL id`
- Restricción `evidence_reviews_pkey`: `PRIMARY KEY (id)`
- Restricción `evidence_reviews_reason_check`: `CHECK ((length(TRIM(BOTH FROM reason)) > 0))`
- Restricción `evidence_reviews_reason_not_null`: `NOT NULL reason`
- Restricción `evidence_reviews_result_check`: `CHECK ((result = ANY (ARRAY['verified'::text, 'rejected'::text])))`
- Restricción `evidence_reviews_result_not_null`: `NOT NULL result`
- Restricción `evidence_reviews_reviewed_at_not_null`: `NOT NULL reviewed_at`
- Restricción `evidence_reviews_reviewer_id_fkey`: `FOREIGN KEY (reviewer_id) REFERENCES users(principal_id)`
- Restricción `evidence_reviews_reviewer_id_not_null`: `NOT NULL reviewer_id`
- Índice: `CREATE INDEX evidence_reviews_evidence_id_fkey_fkidx ON vcm.evidence_reviews USING btree (evidence_id)`
- Índice: `CREATE UNIQUE INDEX evidence_reviews_pkey ON vcm.evidence_reviews USING btree (id)`
- Índice: `CREATE INDEX evidence_reviews_reviewer_id_fkey_fkidx ON vcm.evidence_reviews USING btree (reviewer_id)`
- Trigger: `CREATE TRIGGER evidence_review_immutable BEFORE DELETE OR UPDATE ON vcm.evidence_reviews FOR EACH ROW EXECUTE FUNCTION immutable_row()`

### evidences

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| case_id | text | NO | — |
| document_id | text | YES | — |
| source_id | text | NO | — |
| name | text | NO | — |
| review_status | text | NO | 'pending'::text |
| version | integer | NO | 1 |

- Restricción `evidences_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES cases(id)`
- Restricción `evidences_case_id_id_key`: `UNIQUE (case_id, id)`
- Restricción `evidences_case_id_not_null`: `NOT NULL case_id`
- Restricción `evidences_case_id_source_id_fkey`: `FOREIGN KEY (case_id, source_id) REFERENCES sources(case_id, id)`
- Restricción `evidences_document_id_fkey`: `FOREIGN KEY (document_id) REFERENCES document_references(id)`
- Restricción `evidences_id_not_null`: `NOT NULL id`
- Restricción `evidences_name_not_null`: `NOT NULL name`
- Restricción `evidences_pkey`: `PRIMARY KEY (id)`
- Restricción `evidences_review_status_check`: `CHECK ((review_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])))`
- Restricción `evidences_review_status_not_null`: `NOT NULL review_status`
- Restricción `evidences_source_id_not_null`: `NOT NULL source_id`
- Restricción `evidences_version_check`: `CHECK ((version > 0))`
- Restricción `evidences_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX evidences_case_id_id_key ON vcm.evidences USING btree (case_id, id)`
- Índice: `CREATE INDEX evidences_case_id_source_id_fkey_fkidx ON vcm.evidences USING btree (case_id, source_id)`
- Índice: `CREATE INDEX evidences_document_id_fkey_fkidx ON vcm.evidences USING btree (document_id)`
- Índice: `CREATE UNIQUE INDEX evidences_pkey ON vcm.evidences USING btree (id)`

### expenses

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| project_id | text | NO | — |
| budget_item_id | text | NO | — |
| concept | text | NO | — |
| amount | bigint | NO | — |
| spent_on | date | NO | — |
| supplier_id | text | YES | — |
| supplier_label | text | YES | — |
| reference | text | YES | — |
| version | integer | NO | 1 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| authorization_id | text | YES | — |
| archived_at | timestamp with time zone | YES | — |

- Restricción `expense_authorization_project`: `FOREIGN KEY (project_id, authorization_id) REFERENCES budget_authorizations(project_id, id)`
- Restricción `expenses_amount_check`: `CHECK ((amount >= 0))`
- Restricción `expenses_amount_not_null`: `NOT NULL amount`
- Restricción `expenses_budget_item_id_not_null`: `NOT NULL budget_item_id`
- Restricción `expenses_concept_not_null`: `NOT NULL concept`
- Restricción `expenses_created_at_not_null`: `NOT NULL created_at`
- Restricción `expenses_id_not_null`: `NOT NULL id`
- Restricción `expenses_pkey`: `PRIMARY KEY (id)`
- Restricción `expenses_project_id_budget_item_id_fkey`: `FOREIGN KEY (project_id, budget_item_id) REFERENCES budget_items(project_id, id)`
- Restricción `expenses_project_id_id_key`: `UNIQUE (project_id, id)`
- Restricción `expenses_project_id_not_null`: `NOT NULL project_id`
- Restricción `expenses_spent_on_not_null`: `NOT NULL spent_on`
- Restricción `expenses_supplier_id_fkey`: `FOREIGN KEY (supplier_id) REFERENCES organizations(id)`
- Restricción `expenses_updated_at_not_null`: `NOT NULL updated_at`
- Restricción `expenses_version_check`: `CHECK ((version > 0))`
- Restricción `expenses_version_not_null`: `NOT NULL version`
- Índice: `CREATE INDEX expense_authorization_idx ON vcm.expenses USING btree (authorization_id)`
- Índice: `CREATE UNIQUE INDEX expenses_pkey ON vcm.expenses USING btree (id)`
- Índice: `CREATE INDEX expenses_project_id_budget_item_id_fkey_fkidx ON vcm.expenses USING btree (project_id, budget_item_id)`
- Índice: `CREATE UNIQUE INDEX expenses_project_id_id_key ON vcm.expenses USING btree (project_id, id)`
- Índice: `CREATE INDEX expenses_supplier_id_fkey_fkidx ON vcm.expenses USING btree (supplier_id)`

### external_links

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| object_id | text | NO | — |
| provider | text | NO | — |
| external_type | text | NO | — |
| external_id | text | NO | — |
| sync_status | text | NO | 'pending'::text |
| field_ownership | jsonb | NO | '{}'::jsonb |
| last_synced_at | timestamp with time zone | YES | — |

- Restricción `external_links_external_id_not_null`: `NOT NULL external_id`
- Restricción `external_links_external_type_not_null`: `NOT NULL external_type`
- Restricción `external_links_field_ownership_not_null`: `NOT NULL field_ownership`
- Restricción `external_links_id_not_null`: `NOT NULL id`
- Restricción `external_links_object_id_fkey`: `FOREIGN KEY (object_id) REFERENCES protected_objects(id)`
- Restricción `external_links_object_id_not_null`: `NOT NULL object_id`
- Restricción `external_links_pkey`: `PRIMARY KEY (id)`
- Restricción `external_links_provider_external_type_external_id_key`: `UNIQUE (provider, external_type, external_id)`
- Restricción `external_links_provider_not_null`: `NOT NULL provider`
- Restricción `external_links_sync_status_check`: `CHECK ((sync_status = ANY (ARRAY['pending'::text, 'linked'::text, 'conflict'::text, 'failed'::text])))`
- Restricción `external_links_sync_status_not_null`: `NOT NULL sync_status`
- Índice: `CREATE INDEX external_links_object_id_fkey_fkidx ON vcm.external_links USING btree (object_id)`
- Índice: `CREATE UNIQUE INDEX external_links_pkey ON vcm.external_links USING btree (id)`
- Índice: `CREATE UNIQUE INDEX external_links_provider_external_type_external_id_key ON vcm.external_links USING btree (provider, external_type, external_id)`

### field_assertion_references

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| assertion_id | text | NO | — |
| organization_id | text | YES | — |
| agreement_id | text | YES | — |
| evidence_id | text | YES | — |
| case_id | text | NO | — |
| field_key | text | NO | — |

- Restricción `captured_assertion_identity`: `FOREIGN KEY (case_id, field_key, assertion_id) REFERENCES field_assertions(case_id, field_key, id)`
- Restricción `captured_evidence_case`: `FOREIGN KEY (case_id, evidence_id) REFERENCES evidences(case_id, id)`
- Restricción `field_assertion_references_agreement_id_fkey`: `FOREIGN KEY (agreement_id) REFERENCES agreements(id)`
- Restricción `field_assertion_references_assertion_id_fkey`: `FOREIGN KEY (assertion_id) REFERENCES field_assertions(id)`
- Restricción `field_assertion_references_assertion_id_not_null`: `NOT NULL assertion_id`
- Restricción `field_assertion_references_assertion_id_organization_id_agr_key`: `UNIQUE NULLS NOT DISTINCT (assertion_id, organization_id, agreement_id, evidence_id)`
- Restricción `field_assertion_references_case_id_not_null`: `NOT NULL case_id`
- Restricción `field_assertion_references_check`: `CHECK ((num_nonnulls(organization_id, agreement_id, evidence_id) = 1))`
- Restricción `field_assertion_references_evidence_id_fkey`: `FOREIGN KEY (evidence_id) REFERENCES evidences(id)`
- Restricción `field_assertion_references_field_key_not_null`: `NOT NULL field_key`
- Restricción `field_assertion_references_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`
- Índice: `CREATE INDEX captured_assertion_identity_idx ON vcm.field_assertion_references USING btree (case_id, field_key, assertion_id)`
- Índice: `CREATE INDEX captured_evidence_case_idx ON vcm.field_assertion_references USING btree (case_id, evidence_id)`
- Índice: `CREATE INDEX field_assertion_references_agreement_id_fkey_fkidx ON vcm.field_assertion_references USING btree (agreement_id)`
- Índice: `CREATE UNIQUE INDEX field_assertion_references_assertion_id_organization_id_agr_key ON vcm.field_assertion_references USING btree (assertion_id, organization_id, agreement_id, evidence_id) NULLS NOT DISTINCT`
- Índice: `CREATE INDEX field_assertion_references_evidence_id_fkey_fkidx ON vcm.field_assertion_references USING btree (evidence_id)`
- Índice: `CREATE INDEX field_assertion_references_organization_id_fkey_fkidx ON vcm.field_assertion_references USING btree (organization_id)`
- Trigger: `CREATE TRIGGER captured_reference_identity BEFORE INSERT ON vcm.field_assertion_references FOR EACH ROW EXECUTE FUNCTION trace_reference_identity()`
- Trigger: `CREATE TRIGGER captured_reference_immutable BEFORE DELETE OR UPDATE ON vcm.field_assertion_references FOR EACH ROW EXECUTE FUNCTION immutable_row()`

### field_assertions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| case_id | text | NO | — |
| field_key | text | NO | — |
| source_id | text | NO | — |
| actor_id | text | NO | — |
| captured_at | timestamp with time zone | NO | now() |
| value_type | text | NO | — |
| text_value | text | YES | — |
| number_value | numeric | YES | — |
| money_value | bigint | YES | — |
| date_value | date | YES | — |
| references_value | jsonb | YES | — |

- Restricción `field_assertions_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES principals(id)`
- Restricción `field_assertions_actor_id_not_null`: `NOT NULL actor_id`
- Restricción `field_assertions_captured_at_not_null`: `NOT NULL captured_at`
- Restricción `field_assertions_case_id_field_key_fkey`: `FOREIGN KEY (case_id, field_key) REFERENCES case_fields(case_id, field_key)`
- Restricción `field_assertions_case_id_field_key_id_key`: `UNIQUE (case_id, field_key, id)`
- Restricción `field_assertions_case_id_not_null`: `NOT NULL case_id`
- Restricción `field_assertions_case_id_source_id_fkey`: `FOREIGN KEY (case_id, source_id) REFERENCES sources(case_id, id)`
- Restricción `field_assertions_check`: `CHECK ((num_nonnulls(text_value, number_value, money_value, date_value, references_value) = 1))`
- Restricción `field_assertions_check1`: `CHECK ((((value_type = 'text'::text) AND (text_value IS NOT NULL)) OR ((value_type = 'number'::text) AND (number_value IS NOT NULL) AND (number_value >= (0)::numeric)) OR ((value_type = 'money'::text) AND (money_value IS NOT NULL)) OR ((value_type = 'date'::text) AND (date_value IS NOT NULL)) OR ((value_type = 'references'::text) AND (jsonb_typeof(references_value) = 'array'::text))))`
- Restricción `field_assertions_field_key_not_null`: `NOT NULL field_key`
- Restricción `field_assertions_id_not_null`: `NOT NULL id`
- Restricción `field_assertions_money_value_check`: `CHECK ((money_value >= 0))`
- Restricción `field_assertions_pkey`: `PRIMARY KEY (id)`
- Restricción `field_assertions_source_id_not_null`: `NOT NULL source_id`
- Restricción `field_assertions_value_type_not_null`: `NOT NULL value_type`
- Índice: `CREATE INDEX field_assertions_actor_id_fkey_fkidx ON vcm.field_assertions USING btree (actor_id)`
- Índice: `CREATE UNIQUE INDEX field_assertions_case_id_field_key_id_key ON vcm.field_assertions USING btree (case_id, field_key, id)`
- Índice: `CREATE INDEX field_assertions_case_id_source_id_fkey_fkidx ON vcm.field_assertions USING btree (case_id, source_id)`
- Índice: `CREATE UNIQUE INDEX field_assertions_pkey ON vcm.field_assertions USING btree (id)`
- Trigger: `CREATE TRIGGER assertion_immutable BEFORE DELETE OR UPDATE ON vcm.field_assertions FOR EACH ROW EXECUTE FUNCTION immutable_row()`
- Trigger: `CREATE TRIGGER assertion_type_check BEFORE INSERT ON vcm.field_assertions FOR EACH ROW EXECUTE FUNCTION assertion_type()`

### field_definitions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| schema_version | text | NO | — |
| field_key | text | NO | — |
| label | text | NO | — |
| group_name | text | NO | — |
| value_type | text | NO | — |
| unit | text | YES | — |
| multiple | boolean | NO | false |
| classification | boolean | NO | false |

- Restricción `field_definitions_classification_not_null`: `NOT NULL classification`
- Restricción `field_definitions_field_key_not_null`: `NOT NULL field_key`
- Restricción `field_definitions_group_name_not_null`: `NOT NULL group_name`
- Restricción `field_definitions_label_not_null`: `NOT NULL label`
- Restricción `field_definitions_multiple_not_null`: `NOT NULL multiple`
- Restricción `field_definitions_pkey`: `PRIMARY KEY (schema_version, field_key)`
- Restricción `field_definitions_schema_version_not_null`: `NOT NULL schema_version`
- Restricción `field_definitions_value_type_check`: `CHECK ((value_type = ANY (ARRAY['text'::text, 'number'::text, 'money'::text, 'date'::text, 'references'::text])))`
- Restricción `field_definitions_value_type_not_null`: `NOT NULL value_type`
- Índice: `CREATE UNIQUE INDEX field_definitions_pkey ON vcm.field_definitions USING btree (schema_version, field_key)`

### field_resolutions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| case_id | text | NO | — |
| field_key | text | NO | — |
| selected_assertion_id | text | NO | — |
| actor_id | text | NO | — |
| reason | text | NO | — |
| resolved_at | timestamp with time zone | NO | now() |

- Restricción `field_resolutions_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES principals(id)`
- Restricción `field_resolutions_actor_id_not_null`: `NOT NULL actor_id`
- Restricción `field_resolutions_case_id_field_key_selected_assertion_id_fkey`: `FOREIGN KEY (case_id, field_key, selected_assertion_id) REFERENCES field_assertions(case_id, field_key, id)`
- Restricción `field_resolutions_case_id_not_null`: `NOT NULL case_id`
- Restricción `field_resolutions_field_key_not_null`: `NOT NULL field_key`
- Restricción `field_resolutions_id_not_null`: `NOT NULL id`
- Restricción `field_resolutions_pkey`: `PRIMARY KEY (id)`
- Restricción `field_resolutions_reason_check`: `CHECK ((length(TRIM(BOTH FROM reason)) > 0))`
- Restricción `field_resolutions_reason_not_null`: `NOT NULL reason`
- Restricción `field_resolutions_resolved_at_not_null`: `NOT NULL resolved_at`
- Restricción `field_resolutions_selected_assertion_id_not_null`: `NOT NULL selected_assertion_id`
- Restricción `resolution_identity_key`: `UNIQUE (case_id, field_key, id)`
- Índice: `CREATE INDEX field_resolutions_actor_id_fkey_fkidx ON vcm.field_resolutions USING btree (actor_id)`
- Índice: `CREATE INDEX field_resolutions_case_id_field_key_selected_assertion_fkidx ON vcm.field_resolutions USING btree (case_id, field_key, selected_assertion_id)`
- Índice: `CREATE UNIQUE INDEX field_resolutions_pkey ON vcm.field_resolutions USING btree (id)`
- Índice: `CREATE UNIQUE INDEX resolution_identity_key ON vcm.field_resolutions USING btree (case_id, field_key, id)`
- Trigger: `CREATE TRIGGER resolution_immutable BEFORE DELETE OR UPDATE ON vcm.field_resolutions FOR EACH ROW EXECUTE FUNCTION immutable_row()`

### follow_ups

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| object_id | text | NO | — |
| issue_id | text | YES | — |
| owner_id | text | YES | — |
| due_on | date | YES | — |
| description | text | NO | — |
| status | text | NO | 'pending'::text |
| resolution | text | YES | — |
| version | integer | NO | 1 |

- Restricción `follow_ups_description_not_null`: `NOT NULL description`
- Restricción `follow_ups_id_not_null`: `NOT NULL id`
- Restricción `follow_ups_issue_id_fkey`: `FOREIGN KEY (issue_id) REFERENCES issues(id)`
- Restricción `follow_ups_object_id_fkey`: `FOREIGN KEY (object_id) REFERENCES protected_objects(id)`
- Restricción `follow_ups_object_id_not_null`: `NOT NULL object_id`
- Restricción `follow_ups_owner_id_fkey`: `FOREIGN KEY (owner_id) REFERENCES principals(id)`
- Restricción `follow_ups_pkey`: `PRIMARY KEY (id)`
- Restricción `follow_ups_status_check`: `CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'cancelled'::text])))`
- Restricción `follow_ups_status_not_null`: `NOT NULL status`
- Restricción `follow_ups_version_check`: `CHECK ((version > 0))`
- Restricción `follow_ups_version_not_null`: `NOT NULL version`
- Índice: `CREATE INDEX follow_ups_issue_id_fkey_fkidx ON vcm.follow_ups USING btree (issue_id)`
- Índice: `CREATE INDEX follow_ups_object_id_fkey_fkidx ON vcm.follow_ups USING btree (object_id)`
- Índice: `CREATE INDEX follow_ups_owner_id_fkey_fkidx ON vcm.follow_ups USING btree (owner_id)`
- Índice: `CREATE UNIQUE INDEX follow_ups_pkey ON vcm.follow_ups USING btree (id)`

### forecasts

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| project_id | text | NO | — |
| remaining | bigint | NO | — |
| basis | jsonb | NO | — |
| reason | text | NO | — |
| actor_id | text | NO | — |
| version | integer | NO | — |
| at | timestamp with time zone | NO | now() |

- Restricción `forecasts_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES principals(id)`
- Restricción `forecasts_actor_id_not_null`: `NOT NULL actor_id`
- Restricción `forecasts_at_not_null`: `NOT NULL at`
- Restricción `forecasts_basis_check`: `CHECK ((jsonb_typeof(basis) = 'object'::text))`
- Restricción `forecasts_basis_not_null`: `NOT NULL basis`
- Restricción `forecasts_id_not_null`: `NOT NULL id`
- Restricción `forecasts_pkey`: `PRIMARY KEY (id)`
- Restricción `forecasts_project_id_fkey`: `FOREIGN KEY (project_id) REFERENCES projects(id)`
- Restricción `forecasts_project_id_not_null`: `NOT NULL project_id`
- Restricción `forecasts_project_id_version_key`: `UNIQUE (project_id, version)`
- Restricción `forecasts_reason_check`: `CHECK ((length(TRIM(BOTH FROM reason)) > 0))`
- Restricción `forecasts_reason_not_null`: `NOT NULL reason`
- Restricción `forecasts_remaining_check`: `CHECK ((remaining >= 0))`
- Restricción `forecasts_remaining_not_null`: `NOT NULL remaining`
- Restricción `forecasts_version_check`: `CHECK ((version > 0))`
- Restricción `forecasts_version_not_null`: `NOT NULL version`
- Índice: `CREATE INDEX forecasts_actor_id_fkey_fkidx ON vcm.forecasts USING btree (actor_id)`
- Índice: `CREATE UNIQUE INDEX forecasts_pkey ON vcm.forecasts USING btree (id)`
- Índice: `CREATE UNIQUE INDEX forecasts_project_id_version_key ON vcm.forecasts USING btree (project_id, version)`

### idempotency_requests

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| principal_id | text | NO | — |
| operation | text | NO | — |
| key | text | NO | — |
| request_hash | text | NO | — |
| response | jsonb | YES | — |
| status_code | integer | YES | — |
| created_at | timestamp with time zone | NO | now() |
| expires_at | timestamp with time zone | NO | (now() + '7 days'::interval) |

- Restricción `idempotency_requests_check`: `CHECK ((expires_at > created_at))`
- Restricción `idempotency_requests_created_at_not_null`: `NOT NULL created_at`
- Restricción `idempotency_requests_expires_at_not_null`: `NOT NULL expires_at`
- Restricción `idempotency_requests_key_not_null`: `NOT NULL key`
- Restricción `idempotency_requests_operation_not_null`: `NOT NULL operation`
- Restricción `idempotency_requests_pkey`: `PRIMARY KEY (principal_id, operation, key)`
- Restricción `idempotency_requests_principal_id_fkey`: `FOREIGN KEY (principal_id) REFERENCES principals(id)`
- Restricción `idempotency_requests_principal_id_not_null`: `NOT NULL principal_id`
- Restricción `idempotency_requests_request_hash_not_null`: `NOT NULL request_hash`
- Índice: `CREATE UNIQUE INDEX idempotency_requests_pkey ON vcm.idempotency_requests USING btree (principal_id, operation, key)`

### import_backup_receipts

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| batch_id | text | NO | — |
| snapshot_hash | text | NO | — |
| database_name | text | NO | — |
| schema_fingerprint | text | NO | — |
| backup_reference | text | NO | — |
| backup_checksum | text | NO | — |
| created_at | timestamp with time zone | NO | now() |
| consumed_at | timestamp with time zone | YES | — |

- Restricción `import_backup_receipts_backup_checksum_not_null`: `NOT NULL backup_checksum`
- Restricción `import_backup_receipts_backup_reference_not_null`: `NOT NULL backup_reference`
- Restricción `import_backup_receipts_batch_id_fkey`: `FOREIGN KEY (batch_id) REFERENCES import_batches(id)`
- Restricción `import_backup_receipts_batch_id_key`: `UNIQUE (batch_id)`
- Restricción `import_backup_receipts_batch_id_not_null`: `NOT NULL batch_id`
- Restricción `import_backup_receipts_created_at_not_null`: `NOT NULL created_at`
- Restricción `import_backup_receipts_database_name_not_null`: `NOT NULL database_name`
- Restricción `import_backup_receipts_id_not_null`: `NOT NULL id`
- Restricción `import_backup_receipts_pkey`: `PRIMARY KEY (id)`
- Restricción `import_backup_receipts_schema_fingerprint_not_null`: `NOT NULL schema_fingerprint`
- Restricción `import_backup_receipts_snapshot_hash_not_null`: `NOT NULL snapshot_hash`
- Índice: `CREATE UNIQUE INDEX import_backup_receipts_batch_id_key ON vcm.import_backup_receipts USING btree (batch_id)`
- Índice: `CREATE UNIQUE INDEX import_backup_receipts_pkey ON vcm.import_backup_receipts USING btree (id)`

### import_batches

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| source_version | integer | NO | — |
| source_hash | text | NO | — |
| status | text | NO | — |
| source_document_id | text | YES | — |
| actor_id | text | YES | — |
| created_at | timestamp with time zone | NO | now() |

- Restricción `import_batches_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES principals(id)`
- Restricción `import_batches_created_at_not_null`: `NOT NULL created_at`
- Restricción `import_batches_id_not_null`: `NOT NULL id`
- Restricción `import_batches_pkey`: `PRIMARY KEY (id)`
- Restricción `import_batches_source_document_id_fkey`: `FOREIGN KEY (source_document_id) REFERENCES document_references(id)`
- Restricción `import_batches_source_hash_not_null`: `NOT NULL source_hash`
- Restricción `import_batches_source_version_check`: `CHECK (((source_version >= 1) AND (source_version <= 4)))`
- Restricción `import_batches_source_version_not_null`: `NOT NULL source_version`
- Restricción `import_batches_status_check`: `CHECK ((status = ANY (ARRAY['preview'::text, 'approved'::text, 'importing'::text, 'completed'::text, 'failed'::text])))`
- Restricción `import_batches_status_not_null`: `NOT NULL status`
- Índice: `CREATE INDEX import_batches_actor_id_fkey_fkidx ON vcm.import_batches USING btree (actor_id)`
- Índice: `CREATE UNIQUE INDEX import_batches_pkey ON vcm.import_batches USING btree (id)`
- Índice: `CREATE INDEX import_batches_source_document_id_fkey_fkidx ON vcm.import_batches USING btree (source_document_id)`

### import_issues

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| batch_id | text | NO | — |
| entity_type | text | NO | — |
| legacy_id | text | NO | — |
| code | text | NO | — |
| detail | text | NO | — |
| status | text | NO | 'open'::text |
| resolution | text | YES | — |

- Restricción `import_issues_batch_id_entity_type_legacy_id_fkey`: `FOREIGN KEY (batch_id, entity_type, legacy_id) REFERENCES import_mappings(batch_id, entity_type, legacy_id)`
- Restricción `import_issues_batch_id_not_null`: `NOT NULL batch_id`
- Restricción `import_issues_code_not_null`: `NOT NULL code`
- Restricción `import_issues_detail_not_null`: `NOT NULL detail`
- Restricción `import_issues_entity_type_not_null`: `NOT NULL entity_type`
- Restricción `import_issues_id_not_null`: `NOT NULL id`
- Restricción `import_issues_legacy_id_not_null`: `NOT NULL legacy_id`
- Restricción `import_issues_pkey`: `PRIMARY KEY (id)`
- Restricción `import_issues_status_check`: `CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text])))`
- Restricción `import_issues_status_not_null`: `NOT NULL status`
- Índice: `CREATE INDEX import_issues_batch_id_entity_type_legacy_id_fkey_fkidx ON vcm.import_issues USING btree (batch_id, entity_type, legacy_id)`
- Índice: `CREATE UNIQUE INDEX import_issues_pkey ON vcm.import_issues USING btree (id)`

### import_mappings

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| batch_id | text | NO | — |
| entity_type | text | NO | — |
| legacy_id | text | NO | — |
| internal_id | text | YES | — |
| demo | boolean | NO | false |
| payload | jsonb | NO | — |

- Restricción `import_mappings_batch_id_fkey`: `FOREIGN KEY (batch_id) REFERENCES import_batches(id)`
- Restricción `import_mappings_batch_id_not_null`: `NOT NULL batch_id`
- Restricción `import_mappings_demo_not_null`: `NOT NULL demo`
- Restricción `import_mappings_entity_type_not_null`: `NOT NULL entity_type`
- Restricción `import_mappings_legacy_id_not_null`: `NOT NULL legacy_id`
- Restricción `import_mappings_payload_check`: `CHECK ((jsonb_typeof(payload) = 'object'::text))`
- Restricción `import_mappings_payload_not_null`: `NOT NULL payload`
- Restricción `import_mappings_pkey`: `PRIMARY KEY (batch_id, entity_type, legacy_id)`
- Índice: `CREATE UNIQUE INDEX import_mappings_pkey ON vcm.import_mappings USING btree (batch_id, entity_type, legacy_id)`

### indicator_contributions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| case_id | text | NO | — |
| presence_id | text | YES | — |
| activity_id | text | YES | — |
| indicator_id | text | NO | — |
| rule_version | text | NO | — |
| period | integer | NO | — |
| value | numeric | NO | — |
| status | text | NO | 'pending'::text |
| actor_id | text | NO | — |
| version | integer | NO | 1 |
| validated_by | text | YES | — |
| validated_at | timestamp with time zone | YES | — |

- Restricción `indicator_contributions_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES principals(id)`
- Restricción `indicator_contributions_actor_id_not_null`: `NOT NULL actor_id`
- Restricción `indicator_contributions_case_id_activity_id_fkey`: `FOREIGN KEY (case_id, activity_id) REFERENCES activity_records(case_id, id)`
- Restricción `indicator_contributions_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES cases(id)`
- Restricción `indicator_contributions_case_id_id_key`: `UNIQUE (case_id, id)`
- Restricción `indicator_contributions_case_id_not_null`: `NOT NULL case_id`
- Restricción `indicator_contributions_case_id_presence_id_fkey`: `FOREIGN KEY (case_id, presence_id) REFERENCES presence_records(case_id, id)`
- Restricción `indicator_contributions_check`: `CHECK ((num_nonnulls(presence_id, activity_id) = 1))`
- Restricción `indicator_contributions_check1`: `CHECK (((indicator_id <> '4.2.5'::text) OR ((presence_id IS NOT NULL) AND (value = (1)::numeric))))`
- Restricción `indicator_contributions_check2`: `CHECK (((status <> 'validated'::text) OR ((validated_by IS NOT NULL) AND (validated_at IS NOT NULL))))`
- Restricción `indicator_contributions_id_not_null`: `NOT NULL id`
- Restricción `indicator_contributions_indicator_id_not_null`: `NOT NULL indicator_id`
- Restricción `indicator_contributions_indicator_id_period_fkey`: `FOREIGN KEY (indicator_id, period) REFERENCES indicator_targets(indicator_id, period)`
- Restricción `indicator_contributions_indicator_id_rule_version_fkey`: `FOREIGN KEY (indicator_id, rule_version) REFERENCES indicator_rule_versions(indicator_id, version)`
- Restricción `indicator_contributions_period_not_null`: `NOT NULL period`
- Restricción `indicator_contributions_pkey`: `PRIMARY KEY (id)`
- Restricción `indicator_contributions_rule_version_not_null`: `NOT NULL rule_version`
- Restricción `indicator_contributions_status_check`: `CHECK ((status = ANY (ARRAY['pending'::text, 'validated'::text, 'rejected'::text])))`
- Restricción `indicator_contributions_status_not_null`: `NOT NULL status`
- Restricción `indicator_contributions_validated_by_fkey`: `FOREIGN KEY (validated_by) REFERENCES users(principal_id)`
- Restricción `indicator_contributions_value_check`: `CHECK ((value >= (0)::numeric))`
- Restricción `indicator_contributions_value_not_null`: `NOT NULL value`
- Restricción `indicator_contributions_version_check`: `CHECK ((version > 0))`
- Restricción `indicator_contributions_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX contribution_activity_key ON vcm.indicator_contributions USING btree (activity_id, indicator_id, period) WHERE (activity_id IS NOT NULL)`
- Índice: `CREATE UNIQUE INDEX contribution_presence_key ON vcm.indicator_contributions USING btree (presence_id, indicator_id, period) WHERE (presence_id IS NOT NULL)`
- Índice: `CREATE INDEX indicator_contributions_actor_id_fkey_fkidx ON vcm.indicator_contributions USING btree (actor_id)`
- Índice: `CREATE INDEX indicator_contributions_case_id_activity_id_fkey_fkidx ON vcm.indicator_contributions USING btree (case_id, activity_id)`
- Índice: `CREATE UNIQUE INDEX indicator_contributions_case_id_id_key ON vcm.indicator_contributions USING btree (case_id, id)`
- Índice: `CREATE INDEX indicator_contributions_case_id_presence_id_fkey_fkidx ON vcm.indicator_contributions USING btree (case_id, presence_id)`
- Índice: `CREATE INDEX indicator_contributions_indicator_id_period_fkey_fkidx ON vcm.indicator_contributions USING btree (indicator_id, period)`
- Índice: `CREATE INDEX indicator_contributions_indicator_id_rule_version_fkey_fkidx ON vcm.indicator_contributions USING btree (indicator_id, rule_version)`
- Índice: `CREATE UNIQUE INDEX indicator_contributions_pkey ON vcm.indicator_contributions USING btree (id)`
- Índice: `CREATE INDEX indicator_contributions_validated_by_fkey_fkidx ON vcm.indicator_contributions USING btree (validated_by)`

### indicator_rule_versions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| indicator_id | text | NO | — |
| version | text | NO | — |
| availability | text | NO | — |
| criteria | text | YES | — |
| source | text | YES | — |

- Restricción `indicator_rule_versions_availability_check`: `CHECK ((availability = ANY (ARRAY['available'::text, 'pending'::text])))`
- Restricción `indicator_rule_versions_availability_not_null`: `NOT NULL availability`
- Restricción `indicator_rule_versions_check`: `CHECK (((availability <> 'available'::text) OR ((criteria IS NOT NULL) AND (source IS NOT NULL))))`
- Restricción `indicator_rule_versions_indicator_id_fkey`: `FOREIGN KEY (indicator_id) REFERENCES indicators(id)`
- Restricción `indicator_rule_versions_indicator_id_not_null`: `NOT NULL indicator_id`
- Restricción `indicator_rule_versions_pkey`: `PRIMARY KEY (indicator_id, version)`
- Restricción `indicator_rule_versions_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX indicator_rule_versions_pkey ON vcm.indicator_rule_versions USING btree (indicator_id, version)`

### indicator_targets

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| indicator_id | text | NO | — |
| period | integer | NO | — |
| target | numeric | YES | — |
| source | text | NO | — |

- Restricción `indicator_targets_indicator_id_fkey`: `FOREIGN KEY (indicator_id) REFERENCES indicators(id)`
- Restricción `indicator_targets_indicator_id_not_null`: `NOT NULL indicator_id`
- Restricción `indicator_targets_period_check`: `CHECK (((period >= 1900) AND (period <= 9999)))`
- Restricción `indicator_targets_period_not_null`: `NOT NULL period`
- Restricción `indicator_targets_pkey`: `PRIMARY KEY (indicator_id, period)`
- Restricción `indicator_targets_source_not_null`: `NOT NULL source`
- Restricción `indicator_targets_target_check`: `CHECK ((target >= (0)::numeric))`
- Índice: `CREATE UNIQUE INDEX indicator_targets_pkey ON vcm.indicator_targets USING btree (indicator_id, period)`

### indicators

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| name | text | NO | — |
| unit | text | NO | — |

- Restricción `indicators_id_not_null`: `NOT NULL id`
- Restricción `indicators_name_not_null`: `NOT NULL name`
- Restricción `indicators_pkey`: `PRIMARY KEY (id)`
- Restricción `indicators_unit_not_null`: `NOT NULL unit`
- Índice: `CREATE UNIQUE INDEX indicators_pkey ON vcm.indicators USING btree (id)`

### institutional_cuts

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| name | text | NO | — |
| period | text | NO | — |
| status | text | NO | 'draft'::text |
| response | text | YES | — |
| version | integer | NO | 1 |
| protected_object_id | text | NO | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

- Restricción `institutional_cuts_created_at_not_null`: `NOT NULL created_at`
- Restricción `institutional_cuts_id_not_null`: `NOT NULL id`
- Restricción `institutional_cuts_name_not_null`: `NOT NULL name`
- Restricción `institutional_cuts_period_not_null`: `NOT NULL period`
- Restricción `institutional_cuts_pkey`: `PRIMARY KEY (id)`
- Restricción `institutional_cuts_protected_object_id_fkey`: `FOREIGN KEY (protected_object_id) REFERENCES protected_objects(id)`
- Restricción `institutional_cuts_protected_object_id_key`: `UNIQUE (protected_object_id)`
- Restricción `institutional_cuts_protected_object_id_not_null`: `NOT NULL protected_object_id`
- Restricción `institutional_cuts_status_check`: `CHECK ((status = ANY (ARRAY['draft'::text, 'review'::text, 'ready'::text, 'closed'::text])))`
- Restricción `institutional_cuts_status_not_null`: `NOT NULL status`
- Restricción `institutional_cuts_updated_at_not_null`: `NOT NULL updated_at`
- Restricción `institutional_cuts_version_check`: `CHECK ((version > 0))`
- Restricción `institutional_cuts_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX institutional_cuts_pkey ON vcm.institutional_cuts USING btree (id)`
- Índice: `CREATE UNIQUE INDEX institutional_cuts_protected_object_id_key ON vcm.institutional_cuts USING btree (protected_object_id)`
- Trigger: `CREATE TRIGGER cut_protect BEFORE INSERT ON vcm.institutional_cuts FOR EACH ROW EXECUTE FUNCTION protect_object('cut')`

### integration_connections

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| provider | text | NO | — |
| status | text | NO | 'unverified'::text |
| capabilities | jsonb | NO | '[]'::jsonb |
| secret_reference | text | YES | — |
| verified_at | timestamp with time zone | YES | — |

- Restricción `integration_connections_capabilities_not_null`: `NOT NULL capabilities`
- Restricción `integration_connections_id_not_null`: `NOT NULL id`
- Restricción `integration_connections_pkey`: `PRIMARY KEY (id)`
- Restricción `integration_connections_provider_not_null`: `NOT NULL provider`
- Restricción `integration_connections_status_check`: `CHECK ((status = ANY (ARRAY['unverified'::text, 'connected'::text, 'unavailable'::text, 'revoked'::text])))`
- Restricción `integration_connections_status_not_null`: `NOT NULL status`
- Índice: `CREATE UNIQUE INDEX integration_connections_pkey ON vcm.integration_connections USING btree (id)`

### issues

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| object_id | text | NO | — |
| title | text | NO | — |
| reason | text | YES | — |
| owner_id | text | YES | — |
| due_on | date | YES | — |
| status | text | NO | 'open'::text |
| resolution | text | YES | — |
| version | integer | NO | 1 |
| created_at | timestamp with time zone | NO | now() |

- Restricción `issues_created_at_not_null`: `NOT NULL created_at`
- Restricción `issues_id_not_null`: `NOT NULL id`
- Restricción `issues_object_id_fkey`: `FOREIGN KEY (object_id) REFERENCES protected_objects(id)`
- Restricción `issues_object_id_not_null`: `NOT NULL object_id`
- Restricción `issues_owner_id_fkey`: `FOREIGN KEY (owner_id) REFERENCES principals(id)`
- Restricción `issues_pkey`: `PRIMARY KEY (id)`
- Restricción `issues_status_check`: `CHECK ((status = ANY (ARRAY['open'::text, 'blocked'::text, 'resolved'::text])))`
- Restricción `issues_status_not_null`: `NOT NULL status`
- Restricción `issues_title_not_null`: `NOT NULL title`
- Restricción `issues_version_check`: `CHECK ((version > 0))`
- Restricción `issues_version_not_null`: `NOT NULL version`
- Índice: `CREATE INDEX issues_object_id_fkey_fkidx ON vcm.issues USING btree (object_id)`
- Índice: `CREATE INDEX issues_owner_id_fkey_fkidx ON vcm.issues USING btree (owner_id)`
- Índice: `CREATE UNIQUE INDEX issues_pkey ON vcm.issues USING btree (id)`

### job_attempts

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| job_id | text | NO | — |
| attempt | integer | NO | — |
| started_at | timestamp with time zone | NO | now() |
| finished_at | timestamp with time zone | YES | — |
| status | text | NO | — |
| result | jsonb | YES | — |
| error_code | text | YES | — |

- Restricción `job_attempts_attempt_check`: `CHECK ((attempt > 0))`
- Restricción `job_attempts_attempt_not_null`: `NOT NULL attempt`
- Restricción `job_attempts_id_not_null`: `NOT NULL id`
- Restricción `job_attempts_job_id_attempt_key`: `UNIQUE (job_id, attempt)`
- Restricción `job_attempts_job_id_fkey`: `FOREIGN KEY (job_id) REFERENCES jobs(id)`
- Restricción `job_attempts_job_id_not_null`: `NOT NULL job_id`
- Restricción `job_attempts_pkey`: `PRIMARY KEY (id)`
- Restricción `job_attempts_started_at_not_null`: `NOT NULL started_at`
- Restricción `job_attempts_status_check`: `CHECK ((status = ANY (ARRAY['running'::text, 'succeeded'::text, 'failed'::text, 'ambiguous'::text])))`
- Restricción `job_attempts_status_not_null`: `NOT NULL status`
- Índice: `CREATE UNIQUE INDEX job_attempts_job_id_attempt_key ON vcm.job_attempts USING btree (job_id, attempt)`
- Índice: `CREATE UNIQUE INDEX job_attempts_pkey ON vcm.job_attempts USING btree (id)`

### jobs

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| rule_revision_id | text | NO | — |
| case_id | text | NO | — |
| mandate_id | text | YES | — |
| status | text | NO | 'pending'::text |
| next_run_at | timestamp with time zone | NO | now() |
| lease_until | timestamp with time zone | YES | — |
| lease_owner | text | YES | — |
| attempt_count | integer | NO | 0 |
| max_attempts | integer | NO | 3 |
| idempotency_key | text | NO | — |
| blocked_reason | text | YES | — |
| result | jsonb | YES | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

- Restricción `jobs_attempt_count_check`: `CHECK ((attempt_count >= 0))`
- Restricción `jobs_attempt_count_not_null`: `NOT NULL attempt_count`
- Restricción `jobs_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES cases(id)`
- Restricción `jobs_case_id_not_null`: `NOT NULL case_id`
- Restricción `jobs_check`: `CHECK (((status <> 'running'::text) OR ((lease_until IS NOT NULL) AND (lease_owner IS NOT NULL))))`
- Restricción `jobs_check1`: `CHECK (((status <> 'blocked'::text) OR (blocked_reason IS NOT NULL)))`
- Restricción `jobs_created_at_not_null`: `NOT NULL created_at`
- Restricción `jobs_id_not_null`: `NOT NULL id`
- Restricción `jobs_idempotency_key_key`: `UNIQUE (idempotency_key)`
- Restricción `jobs_idempotency_key_not_null`: `NOT NULL idempotency_key`
- Restricción `jobs_mandate_id_fkey`: `FOREIGN KEY (mandate_id) REFERENCES operation_mandates(id)`
- Restricción `jobs_max_attempts_check`: `CHECK ((max_attempts > 0))`
- Restricción `jobs_max_attempts_not_null`: `NOT NULL max_attempts`
- Restricción `jobs_next_run_at_not_null`: `NOT NULL next_run_at`
- Restricción `jobs_pkey`: `PRIMARY KEY (id)`
- Restricción `jobs_rule_revision_id_fkey`: `FOREIGN KEY (rule_revision_id) REFERENCES automation_rule_versions(id)`
- Restricción `jobs_rule_revision_id_not_null`: `NOT NULL rule_revision_id`
- Restricción `jobs_status_check`: `CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'blocked'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text, 'ambiguous'::text])))`
- Restricción `jobs_status_not_null`: `NOT NULL status`
- Restricción `jobs_updated_at_not_null`: `NOT NULL updated_at`
- Índice: `CREATE INDEX jobs_case_id_fkey_fkidx ON vcm.jobs USING btree (case_id)`
- Índice: `CREATE INDEX jobs_due_idx ON vcm.jobs USING btree (next_run_at, id) WHERE (status = 'pending'::text)`
- Índice: `CREATE UNIQUE INDEX jobs_idempotency_key_key ON vcm.jobs USING btree (idempotency_key)`
- Índice: `CREATE INDEX jobs_lease_idx ON vcm.jobs USING btree (lease_until) WHERE (status = 'running'::text)`
- Índice: `CREATE INDEX jobs_mandate_id_fkey_fkidx ON vcm.jobs USING btree (mandate_id)`
- Índice: `CREATE UNIQUE INDEX jobs_pkey ON vcm.jobs USING btree (id)`
- Índice: `CREATE INDEX jobs_rule_revision_id_fkey_fkidx ON vcm.jobs USING btree (rule_revision_id)`

### login_limits

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| key | text | NO | — |
| window_started_at | timestamp with time zone | NO | now() |
| attempts | integer | NO | — |

- Restricción `login_limits_attempts_check`: `CHECK ((attempts > 0))`
- Restricción `login_limits_attempts_not_null`: `NOT NULL attempts`
- Restricción `login_limits_key_not_null`: `NOT NULL key`
- Restricción `login_limits_pkey`: `PRIMARY KEY (key)`
- Restricción `login_limits_window_started_at_not_null`: `NOT NULL window_started_at`
- Índice: `CREATE UNIQUE INDEX login_limits_pkey ON vcm.login_limits USING btree (key)`

### mandate_actions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| mandate_id | text | NO | — |
| action_class | text | NO | — |
| limits | jsonb | NO | '{}'::jsonb |

- Restricción `mandate_actions_action_class_not_null`: `NOT NULL action_class`
- Restricción `mandate_actions_limits_check`: `CHECK ((jsonb_typeof(limits) = 'object'::text))`
- Restricción `mandate_actions_limits_not_null`: `NOT NULL limits`
- Restricción `mandate_actions_mandate_id_fkey`: `FOREIGN KEY (mandate_id) REFERENCES operation_mandates(id)`
- Restricción `mandate_actions_mandate_id_not_null`: `NOT NULL mandate_id`
- Restricción `mandate_actions_pkey`: `PRIMARY KEY (mandate_id, action_class)`
- Índice: `CREATE UNIQUE INDEX mandate_actions_pkey ON vcm.mandate_actions USING btree (mandate_id, action_class)`

### object_grants

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| object_id | text | NO | — |
| principal_id | text | NO | — |
| permission | text | NO | — |
| valid_from | timestamp with time zone | NO | now() |
| valid_until | timestamp with time zone | YES | — |

- Restricción `object_grants_check`: `CHECK (((valid_until IS NULL) OR (valid_until > valid_from)))`
- Restricción `object_grants_object_id_fkey`: `FOREIGN KEY (object_id) REFERENCES protected_objects(id)`
- Restricción `object_grants_object_id_not_null`: `NOT NULL object_id`
- Restricción `object_grants_permission_check`: `CHECK ((permission = ANY (ARRAY['read'::text, 'write'::text, 'review'::text])))`
- Restricción `object_grants_permission_not_null`: `NOT NULL permission`
- Restricción `object_grants_pkey`: `PRIMARY KEY (object_id, principal_id, permission)`
- Restricción `object_grants_principal_id_fkey`: `FOREIGN KEY (principal_id) REFERENCES principals(id)`
- Restricción `object_grants_principal_id_not_null`: `NOT NULL principal_id`
- Restricción `object_grants_valid_from_not_null`: `NOT NULL valid_from`
- Índice: `CREATE INDEX grants_principal_idx ON vcm.object_grants USING btree (principal_id)`
- Índice: `CREATE UNIQUE INDEX object_grants_pkey ON vcm.object_grants USING btree (object_id, principal_id, permission)`

### object_revisions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| object_id | text | NO | — |
| version | integer | NO | — |
| created_at | timestamp with time zone | NO | now() |

- Restricción `object_revisions_created_at_not_null`: `NOT NULL created_at`
- Restricción `object_revisions_id_not_null`: `NOT NULL id`
- Restricción `object_revisions_object_id_fkey`: `FOREIGN KEY (object_id) REFERENCES protected_objects(id)`
- Restricción `object_revisions_object_id_id_key`: `UNIQUE (object_id, id)`
- Restricción `object_revisions_object_id_not_null`: `NOT NULL object_id`
- Restricción `object_revisions_object_id_version_key`: `UNIQUE (object_id, version)`
- Restricción `object_revisions_pkey`: `PRIMARY KEY (id)`
- Restricción `object_revisions_version_check`: `CHECK ((version > 0))`
- Restricción `object_revisions_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX object_revisions_object_id_id_key ON vcm.object_revisions USING btree (object_id, id)`
- Índice: `CREATE UNIQUE INDEX object_revisions_object_id_version_key ON vcm.object_revisions USING btree (object_id, version)`
- Índice: `CREATE UNIQUE INDEX object_revisions_pkey ON vcm.object_revisions USING btree (id)`
- Trigger: `CREATE TRIGGER revision_immutable BEFORE DELETE OR UPDATE ON vcm.object_revisions FOR EACH ROW EXECUTE FUNCTION immutable_row()`

### objective_cases

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| objective_id | text | NO | — |
| case_id | text | NO | — |

- Restricción `objective_cases_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES cases(id)`
- Restricción `objective_cases_case_id_not_null`: `NOT NULL case_id`
- Restricción `objective_cases_objective_id_fkey`: `FOREIGN KEY (objective_id) REFERENCES plan_objectives(id)`
- Restricción `objective_cases_objective_id_not_null`: `NOT NULL objective_id`
- Restricción `objective_cases_pkey`: `PRIMARY KEY (objective_id, case_id)`
- Índice: `CREATE INDEX objective_cases_case_id_fkey_fkidx ON vcm.objective_cases USING btree (case_id)`
- Índice: `CREATE UNIQUE INDEX objective_cases_pkey ON vcm.objective_cases USING btree (objective_id, case_id)`
- Trigger: `CREATE TRIGGER objective_cases_immutable BEFORE DELETE OR UPDATE ON vcm.objective_cases FOR EACH ROW EXECUTE FUNCTION immutable_row()`
- Trigger: `CREATE TRIGGER objective_cases_unsealed BEFORE INSERT ON vcm.objective_cases FOR EACH ROW EXECUTE FUNCTION revision_unsealed('')`

### operation_mandates

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| project_id | text | NO | — |
| plan_revision_id | text | NO | — |
| approval_id | text | NO | — |
| valid_from | timestamp with time zone | NO | now() |
| valid_until | timestamp with time zone | YES | — |
| revoked_at | timestamp with time zone | YES | — |

- Restricción `mandate_project_plan_fk`: `FOREIGN KEY (project_id, plan_revision_id) REFERENCES work_plan_revisions(project_id, id)`
- Restricción `operation_mandates_approval_id_fkey`: `FOREIGN KEY (approval_id) REFERENCES approval_records(id)`
- Restricción `operation_mandates_approval_id_not_null`: `NOT NULL approval_id`
- Restricción `operation_mandates_check`: `CHECK (((valid_until IS NULL) OR (valid_until > valid_from)))`
- Restricción `operation_mandates_id_not_null`: `NOT NULL id`
- Restricción `operation_mandates_pkey`: `PRIMARY KEY (id)`
- Restricción `operation_mandates_plan_revision_id_fkey`: `FOREIGN KEY (plan_revision_id) REFERENCES work_plan_revisions(id)`
- Restricción `operation_mandates_plan_revision_id_not_null`: `NOT NULL plan_revision_id`
- Restricción `operation_mandates_project_id_fkey`: `FOREIGN KEY (project_id) REFERENCES projects(id)`
- Restricción `operation_mandates_project_id_not_null`: `NOT NULL project_id`
- Restricción `operation_mandates_valid_from_not_null`: `NOT NULL valid_from`
- Índice: `CREATE INDEX mandate_project_plan_fk_fkidx ON vcm.operation_mandates USING btree (project_id, plan_revision_id)`
- Índice: `CREATE INDEX operation_mandates_approval_id_fkey_fkidx ON vcm.operation_mandates USING btree (approval_id)`
- Índice: `CREATE UNIQUE INDEX operation_mandates_pkey ON vcm.operation_mandates USING btree (id)`
- Índice: `CREATE INDEX operation_mandates_plan_revision_id_fkey_fkidx ON vcm.operation_mandates USING btree (plan_revision_id)`
- Índice: `CREATE INDEX operation_mandates_project_id_fkey_fkidx ON vcm.operation_mandates USING btree (project_id)`

### organization_contacts

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| organization_id | text | NO | — |
| contact_id | text | NO | — |
| role | text | NO | ''::text |
| valid_from | date | YES | — |
| valid_until | date | YES | — |

- Restricción `organization_contacts_check`: `CHECK (((valid_until IS NULL) OR (valid_from IS NULL) OR (valid_until >= valid_from)))`
- Restricción `organization_contacts_contact_id_fkey`: `FOREIGN KEY (contact_id) REFERENCES contacts(id)`
- Restricción `organization_contacts_contact_id_not_null`: `NOT NULL contact_id`
- Restricción `organization_contacts_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`
- Restricción `organization_contacts_organization_id_not_null`: `NOT NULL organization_id`
- Restricción `organization_contacts_pkey`: `PRIMARY KEY (organization_id, contact_id, role)`
- Restricción `organization_contacts_role_not_null`: `NOT NULL role`
- Índice: `CREATE INDEX organization_contacts_contact_idx ON vcm.organization_contacts USING btree (contact_id)`
- Índice: `CREATE UNIQUE INDEX organization_contacts_pkey ON vcm.organization_contacts USING btree (organization_id, contact_id, role)`

### organizations

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| name | text | NO | — |
| type | text | YES | — |
| tax_id | text | YES | — |
| email | text | YES | — |
| phone | text | YES | — |
| website | text | YES | — |
| notes | text | YES | — |
| version | integer | NO | 1 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| archived_at | timestamp with time zone | YES | — |

- Restricción `organizations_created_at_not_null`: `NOT NULL created_at`
- Restricción `organizations_id_not_null`: `NOT NULL id`
- Restricción `organizations_name_not_null`: `NOT NULL name`
- Restricción `organizations_pkey`: `PRIMARY KEY (id)`
- Restricción `organizations_updated_at_not_null`: `NOT NULL updated_at`
- Restricción `organizations_version_check`: `CHECK ((version > 0))`
- Restricción `organizations_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX organizations_pkey ON vcm.organizations USING btree (id)`

### outbox_events

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| sequence | bigint | NO | — |
| object_id | text | NO | — |
| event_type | text | NO | — |
| payload | jsonb | NO | — |
| correlation_id | text | NO | — |
| created_at | timestamp with time zone | NO | now() |
| published_at | timestamp with time zone | YES | — |

- Restricción `outbox_events_correlation_id_not_null`: `NOT NULL correlation_id`
- Restricción `outbox_events_created_at_not_null`: `NOT NULL created_at`
- Restricción `outbox_events_event_type_not_null`: `NOT NULL event_type`
- Restricción `outbox_events_object_id_fkey`: `FOREIGN KEY (object_id) REFERENCES protected_objects(id)`
- Restricción `outbox_events_object_id_not_null`: `NOT NULL object_id`
- Restricción `outbox_events_payload_not_null`: `NOT NULL payload`
- Restricción `outbox_events_pkey`: `PRIMARY KEY (sequence)`
- Restricción `outbox_events_sequence_not_null`: `NOT NULL sequence`
- Índice: `CREATE INDEX outbox_events_object_id_fkey_fkidx ON vcm.outbox_events USING btree (object_id)`
- Índice: `CREATE UNIQUE INDEX outbox_events_pkey ON vcm.outbox_events USING btree (sequence)`
- Índice: `CREATE INDEX outbox_pending_idx ON vcm.outbox_events USING btree (sequence) WHERE (published_at IS NULL)`

### package_items

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| package_revision_id | text | NO | — |
| content_id | text | NO | — |
| content_revision_id | text | NO | — |

- Restricción `package_items_content_id_content_revision_id_fkey`: `FOREIGN KEY (content_id, content_revision_id) REFERENCES content_revisions(content_id, id)`
- Restricción `package_items_content_id_not_null`: `NOT NULL content_id`
- Restricción `package_items_content_revision_id_not_null`: `NOT NULL content_revision_id`
- Restricción `package_items_package_revision_id_fkey`: `FOREIGN KEY (package_revision_id) REFERENCES package_revisions(id)`
- Restricción `package_items_package_revision_id_not_null`: `NOT NULL package_revision_id`
- Restricción `package_items_pkey`: `PRIMARY KEY (package_revision_id, content_id)`
- Índice: `CREATE INDEX package_items_content_id_content_revision_id_fkey_fkidx ON vcm.package_items USING btree (content_id, content_revision_id)`
- Índice: `CREATE UNIQUE INDEX package_items_pkey ON vcm.package_items USING btree (package_revision_id, content_id)`
- Trigger: `CREATE TRIGGER package_items_immutable BEFORE DELETE OR UPDATE ON vcm.package_items FOR EACH ROW EXECUTE FUNCTION immutable_row()`
- Trigger: `CREATE TRIGGER package_items_unsealed BEFORE INSERT ON vcm.package_items FOR EACH ROW EXECUTE FUNCTION revision_unsealed('package_revision_id')`

### package_revisions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| package_id | text | NO | — |
| version | integer | NO | — |
| actor_id | text | NO | — |

- Restricción `package_revisions_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES principals(id)`
- Restricción `package_revisions_actor_id_not_null`: `NOT NULL actor_id`
- Restricción `package_revisions_id_fkey`: `FOREIGN KEY (id) REFERENCES object_revisions(id)`
- Restricción `package_revisions_id_not_null`: `NOT NULL id`
- Restricción `package_revisions_package_id_fkey`: `FOREIGN KEY (package_id) REFERENCES editorial_packages(id)`
- Restricción `package_revisions_package_id_not_null`: `NOT NULL package_id`
- Restricción `package_revisions_package_id_version_key`: `UNIQUE (package_id, version)`
- Restricción `package_revisions_pkey`: `PRIMARY KEY (id)`
- Restricción `package_revisions_version_check`: `CHECK ((version > 0))`
- Restricción `package_revisions_version_not_null`: `NOT NULL version`
- Índice: `CREATE INDEX package_revisions_actor_id_fkey_fkidx ON vcm.package_revisions USING btree (actor_id)`
- Índice: `CREATE UNIQUE INDEX package_revisions_package_id_version_key ON vcm.package_revisions USING btree (package_id, version)`
- Índice: `CREATE UNIQUE INDEX package_revisions_pkey ON vcm.package_revisions USING btree (id)`
- Trigger: `CREATE TRIGGER package_revision_immutable BEFORE DELETE OR UPDATE ON vcm.package_revisions FOR EACH ROW EXECUTE FUNCTION immutable_row()`
- Trigger: `CREATE TRIGGER package_revision_register BEFORE INSERT ON vcm.package_revisions FOR EACH ROW EXECUTE FUNCTION register_revision('editorial_packages', 'package_id')`

### plan_objectives

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| plan_revision_id | text | NO | — |
| title | text | NO | — |
| responsible_id | text | YES | — |
| responsible_label | text | YES | — |
| due_on | date | YES | — |
| target | numeric | YES | — |
| measure | text | NO | — |
| resources | text | YES | — |
| dependencies | text | YES | — |

- Restricción `plan_objectives_id_not_null`: `NOT NULL id`
- Restricción `plan_objectives_measure_check`: `CHECK ((measure = ANY (ARRAY['completed'::text, 'validated'::text])))`
- Restricción `plan_objectives_measure_not_null`: `NOT NULL measure`
- Restricción `plan_objectives_pkey`: `PRIMARY KEY (id)`
- Restricción `plan_objectives_plan_revision_id_fkey`: `FOREIGN KEY (plan_revision_id) REFERENCES plan_revisions(id)`
- Restricción `plan_objectives_plan_revision_id_not_null`: `NOT NULL plan_revision_id`
- Restricción `plan_objectives_responsible_id_fkey`: `FOREIGN KEY (responsible_id) REFERENCES principals(id)`
- Restricción `plan_objectives_target_check`: `CHECK ((target >= (0)::numeric))`
- Restricción `plan_objectives_title_not_null`: `NOT NULL title`
- Índice: `CREATE UNIQUE INDEX plan_objectives_pkey ON vcm.plan_objectives USING btree (id)`
- Índice: `CREATE INDEX plan_objectives_plan_revision_id_fkey_fkidx ON vcm.plan_objectives USING btree (plan_revision_id)`
- Índice: `CREATE INDEX plan_objectives_responsible_id_fkey_fkidx ON vcm.plan_objectives USING btree (responsible_id)`
- Trigger: `CREATE TRIGGER objective_immutable BEFORE DELETE OR UPDATE ON vcm.plan_objectives FOR EACH ROW EXECUTE FUNCTION immutable_row()`
- Trigger: `CREATE TRIGGER plan_objectives_unsealed BEFORE INSERT ON vcm.plan_objectives FOR EACH ROW EXECUTE FUNCTION revision_unsealed('plan_revision_id')`

### plan_revisions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| plan_id | text | NO | — |
| version | integer | NO | — |
| reason | text | NO | — |
| actor_id | text | NO | — |

- Restricción `plan_revisions_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES principals(id)`
- Restricción `plan_revisions_actor_id_not_null`: `NOT NULL actor_id`
- Restricción `plan_revisions_id_fkey`: `FOREIGN KEY (id) REFERENCES object_revisions(id)`
- Restricción `plan_revisions_id_not_null`: `NOT NULL id`
- Restricción `plan_revisions_pkey`: `PRIMARY KEY (id)`
- Restricción `plan_revisions_plan_id_fkey`: `FOREIGN KEY (plan_id) REFERENCES annual_plans(id)`
- Restricción `plan_revisions_plan_id_not_null`: `NOT NULL plan_id`
- Restricción `plan_revisions_plan_id_version_key`: `UNIQUE (plan_id, version)`
- Restricción `plan_revisions_reason_not_null`: `NOT NULL reason`
- Restricción `plan_revisions_version_check`: `CHECK ((version > 0))`
- Restricción `plan_revisions_version_not_null`: `NOT NULL version`
- Índice: `CREATE INDEX plan_revisions_actor_id_fkey_fkidx ON vcm.plan_revisions USING btree (actor_id)`
- Índice: `CREATE UNIQUE INDEX plan_revisions_pkey ON vcm.plan_revisions USING btree (id)`
- Índice: `CREATE UNIQUE INDEX plan_revisions_plan_id_version_key ON vcm.plan_revisions USING btree (plan_id, version)`
- Trigger: `CREATE TRIGGER plan_revision_immutable BEFORE DELETE OR UPDATE ON vcm.plan_revisions FOR EACH ROW EXECUTE FUNCTION immutable_row()`
- Trigger: `CREATE TRIGGER plan_revision_register BEFORE INSERT ON vcm.plan_revisions FOR EACH ROW EXECUTE FUNCTION register_revision('annual_plans', 'plan_id')`

### portfolios

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| code | text | NO | — |
| name | text | NO | — |
| active | boolean | NO | true |

- Restricción `portfolios_active_not_null`: `NOT NULL active`
- Restricción `portfolios_code_key`: `UNIQUE (code)`
- Restricción `portfolios_code_not_null`: `NOT NULL code`
- Restricción `portfolios_id_not_null`: `NOT NULL id`
- Restricción `portfolios_name_not_null`: `NOT NULL name`
- Restricción `portfolios_pkey`: `PRIMARY KEY (id)`
- Índice: `CREATE UNIQUE INDEX portfolios_code_key ON vcm.portfolios USING btree (code)`
- Índice: `CREATE UNIQUE INDEX portfolios_pkey ON vcm.portfolios USING btree (id)`

### presence_records

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| case_id | text | NO | — |
| type_catalog_id | text | NO | 'presence-2026.09-v1'::text |
| type_code | text | YES | — |
| validation_status | text | NO | 'pending'::text |
| version | integer | NO | 1 |

- Restricción `presence_records_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES cases(id)`
- Restricción `presence_records_case_id_id_key`: `UNIQUE (case_id, id)`
- Restricción `presence_records_case_id_key`: `UNIQUE (case_id)`
- Restricción `presence_records_case_id_not_null`: `NOT NULL case_id`
- Restricción `presence_records_id_not_null`: `NOT NULL id`
- Restricción `presence_records_pkey`: `PRIMARY KEY (id)`
- Restricción `presence_records_type_catalog_id_not_null`: `NOT NULL type_catalog_id`
- Restricción `presence_records_type_catalog_id_type_code_fkey`: `FOREIGN KEY (type_catalog_id, type_code) REFERENCES catalog_entries(catalog_version_id, code)`
- Restricción `presence_records_validation_status_check`: `CHECK ((validation_status = ANY (ARRAY['pending'::text, 'observed'::text, 'validated'::text])))`
- Restricción `presence_records_validation_status_not_null`: `NOT NULL validation_status`
- Restricción `presence_records_version_check`: `CHECK ((version > 0))`
- Restricción `presence_records_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX presence_records_case_id_id_key ON vcm.presence_records USING btree (case_id, id)`
- Índice: `CREATE UNIQUE INDEX presence_records_case_id_key ON vcm.presence_records USING btree (case_id)`
- Índice: `CREATE UNIQUE INDEX presence_records_pkey ON vcm.presence_records USING btree (id)`
- Índice: `CREATE INDEX presence_records_type_catalog_id_type_code_fkey_fkidx ON vcm.presence_records USING btree (type_catalog_id, type_code)`

### principal_roles

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| principal_id | text | NO | — |
| role_code | text | NO | — |

- Restricción `principal_roles_pkey`: `PRIMARY KEY (principal_id, role_code)`
- Restricción `principal_roles_principal_id_fkey`: `FOREIGN KEY (principal_id) REFERENCES users(principal_id)`
- Restricción `principal_roles_principal_id_not_null`: `NOT NULL principal_id`
- Restricción `principal_roles_role_code_fkey`: `FOREIGN KEY (role_code) REFERENCES roles(code)`
- Restricción `principal_roles_role_code_not_null`: `NOT NULL role_code`
- Índice: `CREATE UNIQUE INDEX principal_roles_pkey ON vcm.principal_roles USING btree (principal_id, role_code)`
- Índice: `CREATE INDEX principal_roles_role_code_fkey_fkidx ON vcm.principal_roles USING btree (role_code)`

### principals

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| kind | text | NO | — |
| name | text | NO | — |
| active | boolean | NO | true |
| permissions_version | integer | NO | 1 |
| created_at | timestamp with time zone | NO | now() |

- Restricción `principals_active_not_null`: `NOT NULL active`
- Restricción `principals_created_at_not_null`: `NOT NULL created_at`
- Restricción `principals_id_check`: `CHECK ((length(id) > 0))`
- Restricción `principals_id_kind_key`: `UNIQUE (id, kind)`
- Restricción `principals_id_not_null`: `NOT NULL id`
- Restricción `principals_kind_check`: `CHECK ((kind = ANY (ARRAY['human'::text, 'service'::text])))`
- Restricción `principals_kind_not_null`: `NOT NULL kind`
- Restricción `principals_name_check`: `CHECK ((length(TRIM(BOTH FROM name)) > 0))`
- Restricción `principals_name_not_null`: `NOT NULL name`
- Restricción `principals_permissions_version_check`: `CHECK ((permissions_version > 0))`
- Restricción `principals_permissions_version_not_null`: `NOT NULL permissions_version`
- Restricción `principals_pkey`: `PRIMARY KEY (id)`
- Índice: `CREATE UNIQUE INDEX principals_id_kind_key ON vcm.principals USING btree (id, kind)`
- Índice: `CREATE UNIQUE INDEX principals_pkey ON vcm.principals USING btree (id)`

### project_cases

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| project_id | text | NO | — |
| case_id | text | NO | — |

- Restricción `project_cases_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES cases(id)`
- Restricción `project_cases_case_id_not_null`: `NOT NULL case_id`
- Restricción `project_cases_pkey`: `PRIMARY KEY (project_id, case_id)`
- Restricción `project_cases_project_id_fkey`: `FOREIGN KEY (project_id) REFERENCES projects(id)`
- Restricción `project_cases_project_id_not_null`: `NOT NULL project_id`
- Índice: `CREATE INDEX project_cases_case_id_fkey_fkidx ON vcm.project_cases USING btree (case_id)`
- Índice: `CREATE UNIQUE INDEX project_cases_pkey ON vcm.project_cases USING btree (project_id, case_id)`

### project_resources

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| project_id | text | NO | — |
| resource_id | text | NO | — |
| phase | text | NO | — |
| quantity | numeric | YES | — |

- Restricción `project_resources_phase_check`: `CHECK ((phase = ANY (ARRAY['planned'::text, 'actual'::text])))`
- Restricción `project_resources_phase_not_null`: `NOT NULL phase`
- Restricción `project_resources_pkey`: `PRIMARY KEY (project_id, resource_id, phase)`
- Restricción `project_resources_project_id_fkey`: `FOREIGN KEY (project_id) REFERENCES projects(id)`
- Restricción `project_resources_project_id_not_null`: `NOT NULL project_id`
- Restricción `project_resources_quantity_check`: `CHECK ((quantity >= (0)::numeric))`
- Restricción `project_resources_resource_id_fkey`: `FOREIGN KEY (resource_id) REFERENCES resources(id)`
- Restricción `project_resources_resource_id_not_null`: `NOT NULL resource_id`
- Índice: `CREATE UNIQUE INDEX project_resources_pkey ON vcm.project_resources USING btree (project_id, resource_id, phase)`
- Índice: `CREATE INDEX project_resources_resource_id_fkey_fkidx ON vcm.project_resources USING btree (resource_id)`

### projects

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| name | text | NO | — |
| kind | text | NO | 'initiative'::text |
| execution_state | text | NO | 'draft'::text |
| starts_on | date | YES | — |
| ends_on | date | YES | — |
| timezone | text | NO | 'America/Santiago'::text |
| location | text | YES | — |
| responsible_id | text | YES | — |
| protected_object_id | text | NO | — |
| version | integer | NO | 1 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| archived_at | timestamp with time zone | YES | — |

- Restricción `projects_check`: `CHECK (((ends_on IS NULL) OR (starts_on IS NULL) OR (ends_on >= starts_on)))`
- Restricción `projects_created_at_not_null`: `NOT NULL created_at`
- Restricción `projects_execution_state_check`: `CHECK ((execution_state = ANY (ARRAY['draft'::text, 'planned'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))`
- Restricción `projects_execution_state_not_null`: `NOT NULL execution_state`
- Restricción `projects_id_not_null`: `NOT NULL id`
- Restricción `projects_kind_check`: `CHECK ((kind = ANY (ARRAY['initiative'::text, 'event'::text])))`
- Restricción `projects_kind_not_null`: `NOT NULL kind`
- Restricción `projects_name_not_null`: `NOT NULL name`
- Restricción `projects_pkey`: `PRIMARY KEY (id)`
- Restricción `projects_protected_object_id_fkey`: `FOREIGN KEY (protected_object_id) REFERENCES protected_objects(id)`
- Restricción `projects_protected_object_id_key`: `UNIQUE (protected_object_id)`
- Restricción `projects_protected_object_id_not_null`: `NOT NULL protected_object_id`
- Restricción `projects_responsible_id_fkey`: `FOREIGN KEY (responsible_id) REFERENCES principals(id)`
- Restricción `projects_timezone_not_null`: `NOT NULL timezone`
- Restricción `projects_updated_at_not_null`: `NOT NULL updated_at`
- Restricción `projects_version_check`: `CHECK ((version > 0))`
- Restricción `projects_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX projects_pkey ON vcm.projects USING btree (id)`
- Índice: `CREATE UNIQUE INDEX projects_protected_object_id_key ON vcm.projects USING btree (protected_object_id)`
- Índice: `CREATE INDEX projects_responsible_id_fkey_fkidx ON vcm.projects USING btree (responsible_id)`
- Trigger: `CREATE TRIGGER project_protect BEFORE INSERT ON vcm.projects FOR EACH ROW EXECUTE FUNCTION protect_object('project')`

### protected_objects

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| kind | text | NO | — |
| confidentiality | text | NO | 'internal'::text |
| owner_id | text | YES | — |
| archived_at | timestamp with time zone | YES | — |
| created_at | timestamp with time zone | NO | now() |

- Restricción `protected_objects_confidentiality_check`: `CHECK ((confidentiality = ANY (ARRAY['internal'::text, 'restricted'::text, 'sensitive'::text])))`
- Restricción `protected_objects_confidentiality_not_null`: `NOT NULL confidentiality`
- Restricción `protected_objects_created_at_not_null`: `NOT NULL created_at`
- Restricción `protected_objects_id_not_null`: `NOT NULL id`
- Restricción `protected_objects_kind_not_null`: `NOT NULL kind`
- Restricción `protected_objects_owner_id_fkey`: `FOREIGN KEY (owner_id) REFERENCES principals(id)`
- Restricción `protected_objects_pkey`: `PRIMARY KEY (id)`
- Índice: `CREATE UNIQUE INDEX protected_objects_pkey ON vcm.protected_objects USING btree (id)`
- Índice: `CREATE INDEX protected_owner_idx ON vcm.protected_objects USING btree (owner_id)`

### publication_operations

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| content_revision_id | text | NO | — |
| approval_id | text | NO | — |
| provider | text | NO | — |
| external_id | text | YES | — |
| idempotency_key | text | NO | — |
| status | text | NO | 'prepared'::text |
| requested_at | timestamp with time zone | YES | — |
| confirmed_at | timestamp with time zone | YES | — |
| result | jsonb | YES | — |

- Restricción `publication_approval_fk`: `FOREIGN KEY (approval_id) REFERENCES approval_records(id)`
- Restricción `publication_operations_approval_id_not_null`: `NOT NULL approval_id`
- Restricción `publication_operations_check`: `CHECK (((status <> 'confirmed'::text) OR ((external_id IS NOT NULL) AND (confirmed_at IS NOT NULL))))`
- Restricción `publication_operations_content_revision_id_fkey`: `FOREIGN KEY (content_revision_id) REFERENCES content_revisions(id)`
- Restricción `publication_operations_content_revision_id_not_null`: `NOT NULL content_revision_id`
- Restricción `publication_operations_id_not_null`: `NOT NULL id`
- Restricción `publication_operations_idempotency_key_not_null`: `NOT NULL idempotency_key`
- Restricción `publication_operations_pkey`: `PRIMARY KEY (id)`
- Restricción `publication_operations_provider_idempotency_key_key`: `UNIQUE (provider, idempotency_key)`
- Restricción `publication_operations_provider_not_null`: `NOT NULL provider`
- Restricción `publication_operations_status_check`: `CHECK ((status = ANY (ARRAY['prepared'::text, 'requested'::text, 'confirmed'::text, 'failed'::text, 'ambiguous'::text, 'cancelled'::text])))`
- Restricción `publication_operations_status_not_null`: `NOT NULL status`
- Índice: `CREATE INDEX publication_operations_content_revision_id_approval_id_fkidx ON vcm.publication_operations USING btree (content_revision_id, approval_id)`
- Índice: `CREATE INDEX publication_operations_content_revision_id_fkey_fkidx ON vcm.publication_operations USING btree (content_revision_id)`
- Índice: `CREATE UNIQUE INDEX publication_operations_pkey ON vcm.publication_operations USING btree (id)`
- Índice: `CREATE UNIQUE INDEX publication_operations_provider_idempotency_key_key ON vcm.publication_operations USING btree (provider, idempotency_key)`
- Trigger: `CREATE TRIGGER publication_approval_member BEFORE INSERT OR UPDATE OF content_revision_id, approval_id ON vcm.publication_operations FOR EACH ROW EXECUTE FUNCTION publication_approved_member()`

### report_runs

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| object_id | text | NO | — |
| filters | jsonb | NO | — |
| rule_version | text | NO | — |
| as_of | timestamp with time zone | NO | — |
| actor_id | text | NO | — |
| created_at | timestamp with time zone | NO | now() |
| data_references | jsonb | NO | — |

- Restricción `report_runs_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES principals(id)`
- Restricción `report_runs_actor_id_not_null`: `NOT NULL actor_id`
- Restricción `report_runs_as_of_not_null`: `NOT NULL as_of`
- Restricción `report_runs_created_at_not_null`: `NOT NULL created_at`
- Restricción `report_runs_data_references_not_null`: `NOT NULL data_references`
- Restricción `report_runs_filters_not_null`: `NOT NULL filters`
- Restricción `report_runs_id_not_null`: `NOT NULL id`
- Restricción `report_runs_object_id_fkey`: `FOREIGN KEY (object_id) REFERENCES protected_objects(id)`
- Restricción `report_runs_object_id_not_null`: `NOT NULL object_id`
- Restricción `report_runs_pkey`: `PRIMARY KEY (id)`
- Restricción `report_runs_rule_version_not_null`: `NOT NULL rule_version`
- Índice: `CREATE INDEX report_runs_actor_id_fkey_fkidx ON vcm.report_runs USING btree (actor_id)`
- Índice: `CREATE INDEX report_runs_object_id_fkey_fkidx ON vcm.report_runs USING btree (object_id)`
- Índice: `CREATE UNIQUE INDEX report_runs_pkey ON vcm.report_runs USING btree (id)`

### resolution_assertions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| resolution_id | text | NO | — |
| assertion_id | text | NO | — |
| case_id | text | NO | — |
| field_key | text | NO | — |

- Restricción `resolution_assertions_assertion_id_fkey`: `FOREIGN KEY (assertion_id) REFERENCES field_assertions(id)`
- Restricción `resolution_assertions_assertion_id_not_null`: `NOT NULL assertion_id`
- Restricción `resolution_assertions_case_id_not_null`: `NOT NULL case_id`
- Restricción `resolution_assertions_field_key_not_null`: `NOT NULL field_key`
- Restricción `resolution_assertions_pkey`: `PRIMARY KEY (resolution_id, assertion_id)`
- Restricción `resolution_assertions_resolution_id_fkey`: `FOREIGN KEY (resolution_id) REFERENCES field_resolutions(id)`
- Restricción `resolution_assertions_resolution_id_not_null`: `NOT NULL resolution_id`
- Restricción `resolution_candidate_parent`: `FOREIGN KEY (case_id, field_key, resolution_id) REFERENCES field_resolutions(case_id, field_key, id)`
- Restricción `resolution_candidate_same_field`: `FOREIGN KEY (case_id, field_key, assertion_id) REFERENCES field_assertions(case_id, field_key, id)`
- Índice: `CREATE INDEX resolution_assertions_assertion_id_fkey_fkidx ON vcm.resolution_assertions USING btree (assertion_id)`
- Índice: `CREATE UNIQUE INDEX resolution_assertions_pkey ON vcm.resolution_assertions USING btree (resolution_id, assertion_id)`
- Índice: `CREATE INDEX resolution_candidate_identity_idx ON vcm.resolution_assertions USING btree (case_id, field_key, assertion_id)`
- Trigger: `CREATE TRIGGER resolution_reference_identity BEFORE INSERT ON vcm.resolution_assertions FOR EACH ROW EXECUTE FUNCTION trace_reference_identity()`
- Trigger: `CREATE TRIGGER resolution_reference_immutable BEFORE DELETE OR UPDATE ON vcm.resolution_assertions FOR EACH ROW EXECUTE FUNCTION immutable_row()`

### resources

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| name | text | NO | — |
| category | text | NO | — |
| unit | text | NO | — |
| quantity | numeric | YES | — |
| description | text | YES | — |
| notes | text | YES | — |
| active | boolean | NO | true |
| version | integer | NO | 1 |

- Restricción `resources_active_not_null`: `NOT NULL active`
- Restricción `resources_category_check`: `CHECK ((category = ANY (ARRAY['space'::text, 'equipment'::text, 'material'::text, 'service'::text])))`
- Restricción `resources_category_not_null`: `NOT NULL category`
- Restricción `resources_id_not_null`: `NOT NULL id`
- Restricción `resources_name_not_null`: `NOT NULL name`
- Restricción `resources_pkey`: `PRIMARY KEY (id)`
- Restricción `resources_quantity_check`: `CHECK ((quantity >= (0)::numeric))`
- Restricción `resources_unit_not_null`: `NOT NULL unit`
- Restricción `resources_version_check`: `CHECK ((version > 0))`
- Restricción `resources_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX resources_pkey ON vcm.resources USING btree (id)`

### risks

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| object_id | text | NO | — |
| title | text | NO | — |
| impact | text | YES | — |
| likelihood | text | YES | — |
| owner_id | text | YES | — |
| status | text | NO | 'open'::text |
| resolution | text | YES | — |
| version | integer | NO | 1 |
| created_at | timestamp with time zone | NO | now() |

- Restricción `risks_created_at_not_null`: `NOT NULL created_at`
- Restricción `risks_id_not_null`: `NOT NULL id`
- Restricción `risks_object_id_fkey`: `FOREIGN KEY (object_id) REFERENCES protected_objects(id)`
- Restricción `risks_object_id_not_null`: `NOT NULL object_id`
- Restricción `risks_owner_id_fkey`: `FOREIGN KEY (owner_id) REFERENCES principals(id)`
- Restricción `risks_pkey`: `PRIMARY KEY (id)`
- Restricción `risks_status_check`: `CHECK ((status = ANY (ARRAY['open'::text, 'mitigating'::text, 'resolved'::text])))`
- Restricción `risks_status_not_null`: `NOT NULL status`
- Restricción `risks_title_not_null`: `NOT NULL title`
- Restricción `risks_version_check`: `CHECK ((version > 0))`
- Restricción `risks_version_not_null`: `NOT NULL version`
- Índice: `CREATE INDEX risks_object_id_fkey_fkidx ON vcm.risks USING btree (object_id)`
- Índice: `CREATE INDEX risks_owner_id_fkey_fkidx ON vcm.risks USING btree (owner_id)`
- Índice: `CREATE UNIQUE INDEX risks_pkey ON vcm.risks USING btree (id)`

### roles

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| code | text | NO | — |

- Restricción `roles_code_not_null`: `NOT NULL code`
- Restricción `roles_pkey`: `PRIMARY KEY (code)`
- Índice: `CREATE UNIQUE INDEX roles_pkey ON vcm.roles USING btree (code)`

### service_credentials

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| principal_id | text | NO | — |
| principal_kind | text | NO | 'service'::text |
| token_hash | text | NO | — |
| scopes | ARRAY | NO | '{}'::text[] |
| created_at | timestamp with time zone | NO | now() |
| expires_at | timestamp with time zone | YES | — |
| revoked_at | timestamp with time zone | YES | — |

- Restricción `service_credentials_created_at_not_null`: `NOT NULL created_at`
- Restricción `service_credentials_id_not_null`: `NOT NULL id`
- Restricción `service_credentials_pkey`: `PRIMARY KEY (id)`
- Restricción `service_credentials_principal_id_not_null`: `NOT NULL principal_id`
- Restricción `service_credentials_principal_id_principal_kind_fkey`: `FOREIGN KEY (principal_id, principal_kind) REFERENCES principals(id, kind)`
- Restricción `service_credentials_principal_kind_check`: `CHECK ((principal_kind = 'service'::text))`
- Restricción `service_credentials_principal_kind_not_null`: `NOT NULL principal_kind`
- Restricción `service_credentials_scopes_not_null`: `NOT NULL scopes`
- Restricción `service_credentials_token_hash_key`: `UNIQUE (token_hash)`
- Restricción `service_credentials_token_hash_not_null`: `NOT NULL token_hash`
- Índice: `CREATE UNIQUE INDEX service_credentials_pkey ON vcm.service_credentials USING btree (id)`
- Índice: `CREATE INDEX service_credentials_principal_id_principal_kind_fkey_fkidx ON vcm.service_credentials USING btree (principal_id, principal_kind)`
- Índice: `CREATE INDEX service_credentials_principal_idx ON vcm.service_credentials USING btree (principal_id)`
- Índice: `CREATE UNIQUE INDEX service_credentials_token_hash_key ON vcm.service_credentials USING btree (token_hash)`

### sessions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| user_id | text | NO | — |
| token_hash | text | NO | — |
| created_at | timestamp with time zone | NO | now() |
| last_seen_at | timestamp with time zone | NO | now() |
| idle_expires_at | timestamp with time zone | NO | — |
| max_expires_at | timestamp with time zone | NO | — |
| revoked_at | timestamp with time zone | YES | — |

- Restricción `sessions_check`: `CHECK ((idle_expires_at <= max_expires_at))`
- Restricción `sessions_created_at_not_null`: `NOT NULL created_at`
- Restricción `sessions_id_not_null`: `NOT NULL id`
- Restricción `sessions_idle_expires_at_not_null`: `NOT NULL idle_expires_at`
- Restricción `sessions_last_seen_at_not_null`: `NOT NULL last_seen_at`
- Restricción `sessions_max_expires_at_not_null`: `NOT NULL max_expires_at`
- Restricción `sessions_pkey`: `PRIMARY KEY (id)`
- Restricción `sessions_token_hash_key`: `UNIQUE (token_hash)`
- Restricción `sessions_token_hash_not_null`: `NOT NULL token_hash`
- Restricción `sessions_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES users(principal_id)`
- Restricción `sessions_user_id_not_null`: `NOT NULL user_id`
- Índice: `CREATE UNIQUE INDEX sessions_pkey ON vcm.sessions USING btree (id)`
- Índice: `CREATE UNIQUE INDEX sessions_token_hash_key ON vcm.sessions USING btree (token_hash)`
- Índice: `CREATE INDEX sessions_user_idx ON vcm.sessions USING btree (user_id)`

### sources

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| case_id | text | NO | — |
| name | text | NO | — |
| channel | text | NO | — |
| actor_id | text | NO | — |
| captured_at | timestamp with time zone | NO | now() |
| external_reference | text | YES | — |

- Restricción `sources_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES principals(id)`
- Restricción `sources_actor_id_not_null`: `NOT NULL actor_id`
- Restricción `sources_captured_at_not_null`: `NOT NULL captured_at`
- Restricción `sources_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES cases(id)`
- Restricción `sources_case_id_id_key`: `UNIQUE (case_id, id)`
- Restricción `sources_case_id_not_null`: `NOT NULL case_id`
- Restricción `sources_channel_check`: `CHECK ((channel = ANY (ARRAY['web'::text, 'legacy'::text, 'whatsapp'::text, 'telegram'::text])))`
- Restricción `sources_channel_not_null`: `NOT NULL channel`
- Restricción `sources_id_not_null`: `NOT NULL id`
- Restricción `sources_name_not_null`: `NOT NULL name`
- Restricción `sources_pkey`: `PRIMARY KEY (id)`
- Índice: `CREATE INDEX sources_actor_id_fkey_fkidx ON vcm.sources USING btree (actor_id)`
- Índice: `CREATE UNIQUE INDEX sources_case_id_id_key ON vcm.sources USING btree (case_id, id)`
- Índice: `CREATE UNIQUE INDEX sources_pkey ON vcm.sources USING btree (id)`

### state_definitions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| object_kind | text | NO | — |
| rule_version | text | NO | — |
| code | text | NO | — |
| label | text | NO | — |

- Restricción `state_definitions_code_not_null`: `NOT NULL code`
- Restricción `state_definitions_label_not_null`: `NOT NULL label`
- Restricción `state_definitions_object_kind_not_null`: `NOT NULL object_kind`
- Restricción `state_definitions_pkey`: `PRIMARY KEY (object_kind, rule_version, code)`
- Restricción `state_definitions_rule_version_not_null`: `NOT NULL rule_version`
- Índice: `CREATE UNIQUE INDEX state_definitions_pkey ON vcm.state_definitions USING btree (object_kind, rule_version, code)`

### task_assignees

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| task_id | text | NO | — |
| contact_id | text | NO | — |
| active | boolean | NO | true |

- Restricción `task_assignees_active_not_null`: `NOT NULL active`
- Restricción `task_assignees_contact_id_fkey`: `FOREIGN KEY (contact_id) REFERENCES contacts(id)`
- Restricción `task_assignees_contact_id_not_null`: `NOT NULL contact_id`
- Restricción `task_assignees_pkey`: `PRIMARY KEY (task_id, contact_id)`
- Restricción `task_assignees_task_id_fkey`: `FOREIGN KEY (task_id) REFERENCES tasks(id)`
- Restricción `task_assignees_task_id_not_null`: `NOT NULL task_id`
- Índice: `CREATE INDEX task_assignees_contact_id_fkey_fkidx ON vcm.task_assignees USING btree (contact_id)`
- Índice: `CREATE UNIQUE INDEX task_assignees_pkey ON vcm.task_assignees USING btree (task_id, contact_id)`

### task_dependencies

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| project_id | text | NO | — |
| task_id | text | NO | — |
| depends_on_id | text | NO | — |
| active | boolean | NO | true |

- Restricción `task_dependencies_active_not_null`: `NOT NULL active`
- Restricción `task_dependencies_check`: `CHECK ((task_id <> depends_on_id))`
- Restricción `task_dependencies_depends_on_id_not_null`: `NOT NULL depends_on_id`
- Restricción `task_dependencies_pkey`: `PRIMARY KEY (task_id, depends_on_id)`
- Restricción `task_dependencies_project_id_depends_on_id_fkey`: `FOREIGN KEY (project_id, depends_on_id) REFERENCES tasks(project_id, id)`
- Restricción `task_dependencies_project_id_not_null`: `NOT NULL project_id`
- Restricción `task_dependencies_project_id_task_id_fkey`: `FOREIGN KEY (project_id, task_id) REFERENCES tasks(project_id, id)`
- Restricción `task_dependencies_task_id_not_null`: `NOT NULL task_id`
- Índice: `CREATE UNIQUE INDEX task_dependencies_pkey ON vcm.task_dependencies USING btree (task_id, depends_on_id)`
- Índice: `CREATE INDEX task_dependencies_project_id_depends_on_id_fkey_fkidx ON vcm.task_dependencies USING btree (project_id, depends_on_id)`
- Índice: `CREATE INDEX task_dependencies_project_id_task_id_fkey_fkidx ON vcm.task_dependencies USING btree (project_id, task_id)`

### tasks

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| project_id | text | NO | — |
| title | text | NO | — |
| kind | text | NO | 'task'::text |
| description | text | YES | — |
| status | text | NO | 'todo'::text |
| priority | text | NO | 'medium'::text |
| phase | text | YES | — |
| due_on | date | YES | — |
| blocked | boolean | NO | false |
| assignee_label | text | YES | — |
| version | integer | NO | 1 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

- Restricción `tasks_blocked_not_null`: `NOT NULL blocked`
- Restricción `tasks_created_at_not_null`: `NOT NULL created_at`
- Restricción `tasks_id_not_null`: `NOT NULL id`
- Restricción `tasks_kind_check`: `CHECK ((kind = ANY (ARRAY['task'::text, 'milestone'::text])))`
- Restricción `tasks_kind_not_null`: `NOT NULL kind`
- Restricción `tasks_phase_check`: `CHECK ((phase = ANY (ARRAY['pre'::text, 'during'::text, 'post'::text])))`
- Restricción `tasks_pkey`: `PRIMARY KEY (id)`
- Restricción `tasks_priority_check`: `CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))`
- Restricción `tasks_priority_not_null`: `NOT NULL priority`
- Restricción `tasks_project_id_fkey`: `FOREIGN KEY (project_id) REFERENCES projects(id)`
- Restricción `tasks_project_id_id_key`: `UNIQUE (project_id, id)`
- Restricción `tasks_project_id_not_null`: `NOT NULL project_id`
- Restricción `tasks_status_check`: `CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'review'::text, 'done'::text, 'cancelled'::text])))`
- Restricción `tasks_status_not_null`: `NOT NULL status`
- Restricción `tasks_title_not_null`: `NOT NULL title`
- Restricción `tasks_updated_at_not_null`: `NOT NULL updated_at`
- Restricción `tasks_version_check`: `CHECK ((version > 0))`
- Restricción `tasks_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX tasks_pkey ON vcm.tasks USING btree (id)`
- Índice: `CREATE UNIQUE INDEX tasks_project_id_id_key ON vcm.tasks USING btree (project_id, id)`

### transition_definitions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| object_kind | text | NO | — |
| rule_version | text | NO | — |
| from_state | text | NO | — |
| to_state | text | NO | — |

- Restricción `transition_definitions_from_state_not_null`: `NOT NULL from_state`
- Restricción `transition_definitions_object_kind_not_null`: `NOT NULL object_kind`
- Restricción `transition_definitions_object_kind_rule_version_from_state_fkey`: `FOREIGN KEY (object_kind, rule_version, from_state) REFERENCES state_definitions(object_kind, rule_version, code)`
- Restricción `transition_definitions_object_kind_rule_version_to_state_fkey`: `FOREIGN KEY (object_kind, rule_version, to_state) REFERENCES state_definitions(object_kind, rule_version, code)`
- Restricción `transition_definitions_pkey`: `PRIMARY KEY (object_kind, rule_version, from_state, to_state)`
- Restricción `transition_definitions_rule_version_not_null`: `NOT NULL rule_version`
- Restricción `transition_definitions_to_state_not_null`: `NOT NULL to_state`
- Índice: `CREATE INDEX transition_definitions_object_kind_rule_version_to_sta_fkidx ON vcm.transition_definitions USING btree (object_kind, rule_version, to_state)`
- Índice: `CREATE UNIQUE INDEX transition_definitions_pkey ON vcm.transition_definitions USING btree (object_kind, rule_version, from_state, to_state)`

### triage_assessments

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| case_id | text | NO | — |
| pertinence | text | NO | — |
| urgency | text | NO | — |
| proposed_priority | text | YES | — |
| resolved_priority | text | YES | — |
| recommendation | text | YES | — |
| reason | text | NO | — |
| actor_id | text | NO | — |
| version | integer | NO | — |
| at | timestamp with time zone | NO | now() |

- Restricción `triage_assessments_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES principals(id)`
- Restricción `triage_assessments_actor_id_not_null`: `NOT NULL actor_id`
- Restricción `triage_assessments_at_not_null`: `NOT NULL at`
- Restricción `triage_assessments_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES cases(id)`
- Restricción `triage_assessments_case_id_not_null`: `NOT NULL case_id`
- Restricción `triage_assessments_case_id_version_key`: `UNIQUE (case_id, version)`
- Restricción `triage_assessments_id_not_null`: `NOT NULL id`
- Restricción `triage_assessments_pertinence_check`: `CHECK ((pertinence = ANY (ARRAY['pending'::text, 'low'::text, 'medium'::text, 'high'::text])))`
- Restricción `triage_assessments_pertinence_not_null`: `NOT NULL pertinence`
- Restricción `triage_assessments_pkey`: `PRIMARY KEY (id)`
- Restricción `triage_assessments_proposed_priority_check`: `CHECK ((proposed_priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))`
- Restricción `triage_assessments_reason_check`: `CHECK ((length(TRIM(BOTH FROM reason)) > 0))`
- Restricción `triage_assessments_reason_not_null`: `NOT NULL reason`
- Restricción `triage_assessments_resolved_priority_check`: `CHECK ((resolved_priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))`
- Restricción `triage_assessments_urgency_check`: `CHECK ((urgency = ANY (ARRAY['pending'::text, 'low'::text, 'medium'::text, 'high'::text])))`
- Restricción `triage_assessments_urgency_not_null`: `NOT NULL urgency`
- Restricción `triage_assessments_version_check`: `CHECK ((version > 0))`
- Restricción `triage_assessments_version_not_null`: `NOT NULL version`
- Índice: `CREATE INDEX triage_assessments_actor_id_fkey_fkidx ON vcm.triage_assessments USING btree (actor_id)`
- Índice: `CREATE UNIQUE INDEX triage_assessments_case_id_version_key ON vcm.triage_assessments USING btree (case_id, version)`
- Índice: `CREATE UNIQUE INDEX triage_assessments_pkey ON vcm.triage_assessments USING btree (id)`

### users

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| principal_id | text | NO | — |
| principal_kind | text | NO | 'human'::text |
| email | text | NO | — |
| password_hash | text | NO | — |

- Restricción `users_email_check`: `CHECK ((length(TRIM(BOTH FROM email)) > 0))`
- Restricción `users_email_not_null`: `NOT NULL email`
- Restricción `users_password_hash_not_null`: `NOT NULL password_hash`
- Restricción `users_pkey`: `PRIMARY KEY (principal_id)`
- Restricción `users_principal_id_not_null`: `NOT NULL principal_id`
- Restricción `users_principal_id_principal_kind_fkey`: `FOREIGN KEY (principal_id, principal_kind) REFERENCES principals(id, kind)`
- Restricción `users_principal_kind_check`: `CHECK ((principal_kind = 'human'::text))`
- Restricción `users_principal_kind_not_null`: `NOT NULL principal_kind`
- Índice: `CREATE UNIQUE INDEX users_email_key ON vcm.users USING btree (lower(email))`
- Índice: `CREATE UNIQUE INDEX users_pkey ON vcm.users USING btree (principal_id)`
- Índice: `CREATE INDEX users_principal_id_principal_kind_fkey_fkidx ON vcm.users USING btree (principal_id, principal_kind)`
- Trigger: `CREATE TRIGGER normalize_email BEFORE INSERT OR UPDATE OF email ON vcm.users FOR EACH ROW EXECUTE FUNCTION normalize_email()`

### work_plan_revisions

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| project_id | text | NO | — |
| version | integer | NO | — |
| objective | text | NO | — |
| results_planned | text | NO | — |
| scope_included | text | NO | — |
| scope_excluded | text | NO | — |
| closing_criteria | text | NO | — |
| expected_evidence | text | NO | — |
| risks | text | NO | — |
| actor_id | text | NO | — |

- Restricción `plan_revision_project_key`: `UNIQUE (project_id, id)`
- Restricción `work_plan_revisions_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES principals(id)`
- Restricción `work_plan_revisions_actor_id_not_null`: `NOT NULL actor_id`
- Restricción `work_plan_revisions_closing_criteria_not_null`: `NOT NULL closing_criteria`
- Restricción `work_plan_revisions_expected_evidence_not_null`: `NOT NULL expected_evidence`
- Restricción `work_plan_revisions_id_fkey`: `FOREIGN KEY (id) REFERENCES object_revisions(id)`
- Restricción `work_plan_revisions_id_not_null`: `NOT NULL id`
- Restricción `work_plan_revisions_objective_not_null`: `NOT NULL objective`
- Restricción `work_plan_revisions_pkey`: `PRIMARY KEY (id)`
- Restricción `work_plan_revisions_project_id_fkey`: `FOREIGN KEY (project_id) REFERENCES projects(id)`
- Restricción `work_plan_revisions_project_id_not_null`: `NOT NULL project_id`
- Restricción `work_plan_revisions_project_id_version_key`: `UNIQUE (project_id, version)`
- Restricción `work_plan_revisions_results_planned_not_null`: `NOT NULL results_planned`
- Restricción `work_plan_revisions_risks_not_null`: `NOT NULL risks`
- Restricción `work_plan_revisions_scope_excluded_not_null`: `NOT NULL scope_excluded`
- Restricción `work_plan_revisions_scope_included_not_null`: `NOT NULL scope_included`
- Restricción `work_plan_revisions_version_check`: `CHECK ((version > 0))`
- Restricción `work_plan_revisions_version_not_null`: `NOT NULL version`
- Índice: `CREATE UNIQUE INDEX plan_revision_project_key ON vcm.work_plan_revisions USING btree (project_id, id)`
- Índice: `CREATE INDEX work_plan_revisions_actor_id_fkey_fkidx ON vcm.work_plan_revisions USING btree (actor_id)`
- Índice: `CREATE UNIQUE INDEX work_plan_revisions_pkey ON vcm.work_plan_revisions USING btree (id)`
- Índice: `CREATE UNIQUE INDEX work_plan_revisions_project_id_version_key ON vcm.work_plan_revisions USING btree (project_id, version)`
- Trigger: `CREATE TRIGGER work_plan_immutable BEFORE DELETE OR UPDATE ON vcm.work_plan_revisions FOR EACH ROW EXECUTE FUNCTION immutable_row()`
- Trigger: `CREATE TRIGGER work_plan_register BEFORE INSERT ON vcm.work_plan_revisions FOR EACH ROW EXECUTE FUNCTION register_revision('projects', 'project_id')`
