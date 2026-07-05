# almoststable-nginx

Unified entrypoint for `almoststable.com`.

Routes:

- `/`: simple directory page
- `/truss-engine/`: truss engine frontend on host port `10001`
- `/truss-engine/api/`: truss engine backend on host port `10000`
- `/web-tools/`: web tools frontend on host port `9001`
- `/web-tools/api/`: web tools API through the web tools frontend nginx

The server already has `nginx:1.27-alpine`; do not change the image tag unless the server image is updated first.

Deploy:

```sh
docker compose up -d
```

Check config:

```sh
scripts/check.sh
```
