#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /docker/vcm-services
migration_db=${1:-vcm}
case "$migration_db" in vcm|vcm_stage_[0-9]*) ;; *) echo 'Refusing unexpected database name' >&2; exit 2;; esac
[[ "$migration_db" =~ ^[a-z0-9_]+$ ]] || exit 2
[[ -f database-image-id && -s secrets/postgres_password ]] || { echo 'Missing private deployment prerequisites' >&2; exit 2; }
migration_image=$(cat database-image-id)
[[ "$migration_image" =~ ^sha256:[a-f0-9]{64}$ ]] || exit 2
# NOLOGIN groups, no password changes and no API/Hermes credentials.
docker exec -i vcm-services-postgres-1 psql -X -v ON_ERROR_STOP=1 -U postgres -d "$migration_db" < database/bootstrap.sql
docker exec vcm-services-postgres-1 psql -X -v ON_ERROR_STOP=1 -U postgres -d "$migration_db" -c "GRANT CREATE ON DATABASE \"$migration_db\" TO vcm_migrator" </dev/null
docker run --rm --network vcm_backend --memory=768m --cpus=1 --pids-limit=256 --cap-drop ALL --security-opt no-new-privileges --read-only --tmpfs /tmp:rw,size=64m --mount type=bind,src=/docker/vcm-services/secrets/postgres_password,dst=/run/secrets/db_password,readonly --user 0:0 -e VCM_MIGRATION_DB="$migration_db" --entrypoint sh "$migration_image" -c 'export DATABASE_URL="postgresql://postgres:$(cat /run/secrets/db_password)@vcm-services-postgres-1:5432/$VCM_MIGRATION_DB"; export PGOPTIONS="-c role=vcm_migrator"; exec node --experimental-strip-types src/cli.ts'
