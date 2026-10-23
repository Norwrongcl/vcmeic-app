#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ $(id -u) == 0 ]] || { echo 'Run as root on the VPS.' >&2; exit 1; }
cd "$(dirname "$0")"
[[ $PWD == /docker/vcm-services ]] || { echo 'Install files in /docker/vcm-services.' >&2; exit 1; }
[[ ! -e .env && ! -e secrets/postgres_password ]] || { echo 'Existing installation: aborting without changing secrets.' >&2; exit 1; }
docker compose version >/dev/null
install -d -m 700 secrets /var/backups/vcm-postgres
openssl rand -hex 32 > secrets/postgres_password
chmod 600 secrets/postgres_password
docker pull postgres:18-bookworm
image=$(docker image inspect postgres:18-bookworm --format '{{index .RepoDigests 0}}')
[[ $image == postgres@sha256:* ]] || { echo 'Missing immutable image digest.' >&2; exit 1; }
printf 'POSTGRES_IMAGE=%s\n' "$image" > .env
docker compose config --quiet
docker compose up -d --wait --wait-timeout 180
chmod 700 backup.sh
cat > /etc/systemd/system/vcm-postgres-backup.service <<'UNIT'
[Unit]
Description=VcM PostgreSQL local backup
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
UMask=0077
ExecStart=/docker/vcm-services/backup.sh
UNIT
cat > /etc/systemd/system/vcm-postgres-backup.timer <<'UNIT'
[Unit]
Description=Daily VcM PostgreSQL backup

[Timer]
OnCalendar=*-*-* 06:20:00 UTC
Persistent=true
RandomizedDelaySec=300
Unit=vcm-postgres-backup.service

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now vcm-postgres-backup.timer
systemctl start vcm-postgres-backup.service
docker compose ps
systemctl list-timers vcm-postgres-backup.timer --no-pager
