#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /docker/vcm-services
pg_container=vcm-services-postgres-1
stage_db=vcm_stage_20261022
stage_restore=vcm_stage_restore_20261022
live_restore=vcm_domain_restore_20261022
sql(){ docker exec "$pg_container" psql -X -v ON_ERROR_STOP=1 -At -U postgres -d "$1" -c "$2" </dev/null; }
# Abort instead of overwriting unexpected state. Only fresh named test databases are created.
[[ "$(sql vcm "SELECT count(*) FROM pg_namespace WHERE nspname='vcm'")" = 0 ]]
[[ "$(sql postgres "SELECT count(*) FROM pg_database WHERE datname IN ('$stage_db','$stage_restore','$live_restore')")" = 0 ]]
# Require a complete passing server-side test run before any live migration.
[[ -f /root/vcm-db-tests-final.ok ]]
cmp -s /root/vcm-db-tests-final.ok /docker/vcm-services/database-image-id
grep -aEq '36.*passed' /root/vcm-db-tests-final.log
before_backup=$(bash /docker/vcm-services/backup.sh | sed -n 's/^Backup verified: //p')
[[ -n "$before_backup" && -f "$before_backup/COMPLETE" ]]
(cd "$before_backup" && sha256sum -c SHA256SUMS)
printf 'BEFORE_BACKUP=%s\n' "$before_backup"
docker exec "$pg_container" createdb -U postgres "$stage_db" </dev/null
bash /docker/vcm-services/migrate.sh "$stage_db" > /root/vcm-db-stage-migrate.log 2>&1
# Synthetic relational data only in the explicitly named staging database.
docker exec -i "$pg_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$stage_db" <<'SQL'
INSERT INTO vcm.principals(id,kind,name) VALUES('infra-probe','human','Prueba técnica, sin acceso');
INSERT INTO vcm.cases(id,code,name,kind,demo) VALUES('probe-a','PROBE-A','Prueba A','event',true),('probe-b','PROBE-B','Prueba B','activity',true);
INSERT INTO vcm.projects(id,name,kind) VALUES('probe-project','Prueba de relación','event');
INSERT INTO vcm.project_cases VALUES('probe-project','probe-a'),('probe-project','probe-b');
INSERT INTO vcm.sources(id,case_id,name,channel,actor_id) VALUES('probe-source','probe-a','Dato sintético','legacy','infra-probe');
INSERT INTO vcm.case_fields(case_id,field_key,schema_version,status) VALUES('probe-a','studentsActual','p52-2026.09-v1','conflict');
INSERT INTO vcm.field_assertions(id,case_id,field_key,source_id,actor_id,value_type,number_value) VALUES('probe-10','probe-a','studentsActual','probe-source','infra-probe','number',10),('probe-15','probe-a','studentsActual','probe-source','infra-probe','number',15);
SQL
proof_dir=/var/backups/vcm-postgres/domain-proof-20261022
install -d -m 700 "$proof_dir"
docker exec "$pg_container" pg_dump -U postgres -d "$stage_db" -Fc </dev/null > "$proof_dir/stage.dump"
(cd "$proof_dir" && sha256sum stage.dump > stage.SHA256SUMS && sha256sum -c stage.SHA256SUMS)
docker exec "$pg_container" createdb -U postgres -O vcm_migrator "$stage_restore" </dev/null
docker exec -i "$pg_container" pg_restore -U postgres --role=vcm_migrator --exit-on-error --no-owner -d "$stage_restore" < "$proof_dir/stage.dump"
[[ "$(sql "$stage_restore" 'SELECT count(*) FROM vcm.project_cases')" = 2 ]]
[[ "$(sql "$stage_restore" "SELECT string_agg(number_value::text,',' ORDER BY number_value) FROM vcm.field_assertions")" = '10,15' ]]
printf 'STAGING_RESTORE_OK: 2 cases, 2 project links, conflicting assertions 10 and 15\n'
# Main database receives schema/catalogs only; no test cases or service accounts.
bash /docker/vcm-services/migrate.sh vcm > /root/vcm-db-live-migrate.log 2>&1
bash /docker/vcm-services/migrate.sh vcm > /root/vcm-db-idempotent.log 2>&1
grep -Fq '"applied":[]' /root/vcm-db-idempotent.log
[[ "$(sql vcm 'SELECT count(*) FROM vcm_meta.schema_migrations')" = 8 ]]
[[ "$(sql vcm "SELECT count(*) FROM pg_tables WHERE schemaname='vcm'")" = 98 ]]
[[ "$(sql vcm 'SELECT count(*) FROM vcm.cases')" = 0 ]]
[[ "$(sql vcm "SELECT count(*) FROM vcm.field_definitions WHERE schema_version='p52-2026.09-v1'")" = 49 ]]
[[ "$(sql vcm "SELECT count(*) FROM vcm.catalog_entries WHERE catalog_version_id='presence-2026.09-v1'")" = 7 ]]
after_backup=$(bash /docker/vcm-services/backup.sh | sed -n 's/^Backup verified: //p')
[[ -n "$after_backup" && -f "$after_backup/COMPLETE" ]]
(cd "$after_backup" && sha256sum -c SHA256SUMS)
printf 'AFTER_BACKUP=%s\n' "$after_backup"
docker exec "$pg_container" createdb -U postgres -O vcm_migrator "$live_restore" </dev/null
docker exec -i "$pg_container" pg_restore -U postgres --role=vcm_migrator --exit-on-error --no-owner -d "$live_restore" < "$after_backup/vcm.dump"
[[ "$(sql "$live_restore" 'SELECT count(*) FROM vcm_meta.schema_migrations')" = 8 ]]
[[ "$(sql "$live_restore" "SELECT count(*) FROM pg_tables WHERE schemaname='vcm'")" = 98 ]]
printf 'LIVE_BACKUP_RESTORE_OK: 8 migrations, 98 tables\n'
docker restart "$pg_container" >/dev/null
ready=0
for attempt in $(seq 1 30); do if docker exec "$pg_container" pg_isready -U postgres -d vcm >/dev/null 2>&1; then ready=1; break; fi; sleep 1; done
[[ "$ready" = 1 ]]
[[ "$(sql vcm 'SELECT count(*) FROM vcm_meta.schema_migrations')" = 8 ]]
[[ "$(sql "$stage_restore" 'SELECT count(*) FROM vcm.project_cases')" = 2 ]]
printf 'RESTART_PERSISTENCE_OK\n'
printf 'MAIN_DB: '
sql vcm "SELECT 'migrations='||(SELECT count(*) FROM vcm_meta.schema_migrations)||', tables='||(SELECT count(*) FROM pg_tables WHERE schemaname='vcm')||', cases='||(SELECT count(*) FROM vcm.cases)"
sql vcm "SELECT rolname||': login='||rolcanlogin||', super='||rolsuper||', bypassRLS='||rolbypassrls FROM pg_roles WHERE rolname IN ('vcm_runtime','vcm_migrator') ORDER BY rolname"
sql vcm "SELECT nspname||': owner='||pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname IN ('vcm','vcm_meta') ORDER BY nspname"
printf 'SQL_PUBLISHED_PORTS: '
docker inspect "$pg_container" --format '{{json .HostConfig.PortBindings}}'
curl -sS --max-time 20 -o /dev/null -w 'HERMES_HTTPS: %{http_code}\n' https://hermes.vcmeic.cl
docker ps --format '{{.Names}} | {{.Status}}'
printf 'DATABASE_DELIVERY_VERIFIED\n'
