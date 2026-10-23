#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /docker/vcm-services
exec 9>/run/lock/vcm-postgres-backup.lock
flock -n 9 || exit 0
stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="/var/backups/vcm-postgres/$stamp"
install -d -m 700 "$target"
docker compose exec -T postgres pg_dump -U postgres -d vcm -Fc > "$target/vcm.dump.partial"
docker compose exec -T postgres pg_restore --list < "$target/vcm.dump.partial" >/dev/null
mv "$target/vcm.dump.partial" "$target/vcm.dump"
docker compose exec -T postgres pg_dumpall -U postgres --globals-only > "$target/globals.sql.partial"
mv "$target/globals.sql.partial" "$target/globals.sql"
cp compose.yaml .env "$target/"
# Keep recovery credentials/configuration inside the same root-only backup.
install -d -m 700 "$target/secrets"
cp secrets/postgres_password "$target/secrets/postgres_password"
chmod 600 "$target/secrets/postgres_password"
extra=(secrets/postgres_password)
if [[ -f api.compose.yaml ]]; then
  install -d -m 700 "$target/api/secrets"
  cp api.compose.yaml .api.env "$target/api/"
  cp secrets/api/database_url secrets/api/cursor_key "$target/api/secrets/"
  chmod 600 "$target/api/"*yaml "$target/api/.api.env" "$target/api/secrets/"*
  extra+=(api/api.compose.yaml api/.api.env api/secrets/database_url api/secrets/cursor_key)
fi
(
  cd "$target"
  sha256sum vcm.dump globals.sql compose.yaml .env "${extra[@]}" > SHA256SUMS
)
touch "$target/COMPLETE"
printf 'Backup verified: %s\n' "$target"
