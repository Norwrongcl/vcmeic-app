#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /docker/vcm-services
source_sha=${1:?source archive SHA256 required}
[[ $source_sha =~ ^[a-f0-9]{64}$ ]] || exit 2
verify_image=$(docker image inspect --format '{{.Id}}' vcm-api-verify:20261022)
runtime_image=$(docker image inspect --format '{{.Id}}' vcm-api-runtime:20261022)
for image in "$verify_image" "$runtime_image"; do
  [[ $(docker image inspect --format '{{index .Config.Labels "org.vcmeic.source-sha"}}' "$image") == "$source_sha" ]]
done
docker run --rm --read-only --tmpfs /tmp:rw,nosuid,size=128m --cap-drop ALL --security-opt no-new-privileges --memory 1g --cpus 1 --network vcm_backend --mount type=bind,src=/docker/vcm-services/secrets/postgres_password,dst=/run/secrets/operator_password,readonly "$verify_image"
printf '%s\n%s\n%s\n' "$source_sha" "$verify_image" "$runtime_image" > api-verified-images
printf 'API tests verified against immutable images\n'
