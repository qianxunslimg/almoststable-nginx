#!/usr/bin/env sh
set -eu

docker compose config -q
docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -v "$PWD/nginx/conf.d:/etc/nginx/conf.d:ro" \
  -v "$PWD/nginx/html:/usr/share/nginx/html:ro" \
  nginx:1.27-alpine \
  nginx -t
