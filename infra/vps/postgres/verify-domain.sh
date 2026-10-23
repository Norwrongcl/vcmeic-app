#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /docker/vcm-services
migration_image=$(cat database-image-id)
[[ "$migration_image" =~ ^sha256:[a-f0-9]{64}$ ]] || exit 2
# Tests use separate vcm_test_* databases and never write cases to vcm.
docker run --rm --network vcm_backend --memory=768m --cpus=1 --pids-limit=256 --cap-drop ALL --security-opt no-new-privileges --read-only --tmpfs /tmp:rw,size=128m --mount type=bind,src=/docker/vcm-services/secrets/postgres_password,dst=/run/secrets/db_password,readonly --user 0:0 --entrypoint sh "$migration_image" -c 'export TEST_DATABASE_URL="postgresql://postgres:$(cat /run/secrets/db_password)@vcm-services-postgres-1:5432/postgres"; exec node node_modules/vitest/vitest.mjs run --configLoader native'
