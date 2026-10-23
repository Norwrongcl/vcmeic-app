#!/usr/bin/env bash
# Run ONLY after action-time approval for the app's new limited SQL access.
# All preparation, code review and image tests happen before this script.
set -euo pipefail
umask 077
[[ ${1:-} == --apply-private ]] || { echo 'Explicit --apply-private required after access approval' >&2; exit 2; }
cd /docker/vcm-services
[[ -s api-verified-images && -s api-source-sha ]]
mapfile -t verified < api-verified-images
[[ ${verified[0]} == "$(cat api-source-sha)" ]]
api_image=${verified[2]}
[[ $(docker image inspect --format '{{index .Config.Labels "org.vcmeic.source-sha"}}' "$api_image") == "${verified[0]}" ]]
[[ -s secrets/postgres_password ]]
install -d -m 700 secrets/api
# Refuse to change an existing login or discard its secret during a retry.
existing=$(docker compose exec -T postgres psql -U postgres -d vcm -Atqc "SELECT count(*) FROM pg_roles WHERE rolname='vcm_api'")
if [[ $existing == 0 ]]; then
  [[ ! -e secrets/api/database_url ]] || { echo 'Unexpected existing app secret; investigate' >&2; exit 1; }
  python3 - <<'PY'
from pathlib import Path
import secrets,subprocess
password=secrets.token_hex(32)
# Generated hex only, SQL delivered on stdin; no credential appears in argv or logs.
sql="CREATE ROLE vcm_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS IN ROLE vcm_runtime PASSWORD '"+password+"';\n"
subprocess.run(['docker','compose','exec','-T','postgres','psql','-U','postgres','-d','vcm','-v','ON_ERROR_STOP=1','-q'],input=sql,text=True,check=True,stdout=subprocess.DEVNULL)
Path('secrets/api/database_url').write_text('postgresql://vcm_api:'+password+'@postgres:5432/vcm\n')
PY
else
  [[ -s secrets/api/database_url ]] || { echo 'Existing SQL login has no known app secret; no password reset performed' >&2; exit 1; }
fi
valid=$(docker compose exec -T postgres psql -U postgres -d vcm -Atqc "SELECT count(*) FROM pg_roles r WHERE r.rolname='vcm_api' AND r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolreplication AND NOT r.rolbypassrls AND pg_has_role('vcm_api','vcm_runtime','member') AND NOT pg_has_role('vcm_api','vcm_migrator','member') AND NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid WHERE m.member=r.oid AND parent.rolname<>'vcm_runtime')")
[[ $valid == 1 ]] || { echo 'SQL app identity has unexpected privileges; deployment refused' >&2; exit 1; }
[[ -e secrets/api/cursor_key ]] || python3 - <<'PY'
from pathlib import Path
import secrets
Path('secrets/api/cursor_key').write_text(secrets.token_hex(32)+'\n')
PY
chown 1000:1000 secrets/api/database_url secrets/api/cursor_key
chmod 400 secrets/api/database_url secrets/api/cursor_key
# API-only provisional origin. A Hostinger Apps origin must be verified before public connection.
printf 'API_IMAGE=%s\nWEB_ORIGINS=https://api.vcmeic.cl\n' "$api_image" > .api.env
chmod 600 .api.env
docker compose --env-file .api.env -f api.compose.yaml up -d api
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:32800/health >/dev/null; then
    curl --fail --silent http://127.0.0.1:32800/health
    printf '\nPrivate API ready at host loopback; no public route configured\n'
    exit 0
  fi
  sleep 1
done
echo 'API did not become healthy; inspect redacted container logs' >&2
exit 1
