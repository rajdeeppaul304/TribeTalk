#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "TribeTalk friend demo setup"
echo "This starts the backend replicas, data services, observability stack, and Nginx gateway."

command -v docker >/dev/null || { echo "Docker is required." >&2; exit 1; }
docker compose version >/dev/null || { echo "Docker Compose v2 is required." >&2; exit 1; }
command -v openssl >/dev/null || { echo "OpenSSL is required." >&2; exit 1; }
if ! docker info >/dev/null 2>&1; then
  echo "Docker is installed, but this user cannot access the Docker socket." >&2
  echo "Run: sudo usermod -aG docker \$USER, then log out and back in (or run newgrp docker)." >&2
  exit 1
fi

read -r -p "Vercel frontend URL (for example https://tribetalk.rajdeep.app): " FRONTEND_ORIGIN
read -r -p "Public backend URL (for example https://backend-tribetalk.rajdeep.app): " BACKEND_ORIGIN
read -r -p "Cloudflare Tunnel token (leave blank for local-only mode): " CLOUDFLARE_TUNNEL_TOKEN
read -r -s -p "Grafana admin password: " GRAFANA_ADMIN_PASSWORD
echo

FRONTEND_ORIGIN="${FRONTEND_ORIGIN%/}"
BACKEND_ORIGIN="${BACKEND_ORIGIN%/}"

[[ -n "$FRONTEND_ORIGIN" && -n "$BACKEND_ORIGIN" ]] || { echo "Both public URLs are required." >&2; exit 1; }
[[ -n "$GRAFANA_ADMIN_PASSWORD" ]] || { echo "Grafana password is required." >&2; exit 1; }

BACKEND_ENV="$ROOT_DIR/TribetalkBackend/.env"
BACKEND_TEMPLATE="$ROOT_DIR/TribetalkBackend/.env.example"
if [[ ! -f "$BACKEND_ENV" ]]; then
  cp "$BACKEND_TEMPLATE" "$BACKEND_ENV"
fi

new_secret() { openssl rand -hex 48; }
METRICS_TOKEN="$(openssl rand -hex 32)"

set_env_value() {
  local key="$1" value="$2"
  if grep -qE "^${key}=" "$BACKEND_ENV"; then
    sed -i -E "s#^${key}=.*#${key}=${value}#" "$BACKEND_ENV"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$BACKEND_ENV"
  fi
}

set_env_value ACCESS_TOKEN_SECRET "$(new_secret)"
set_env_value REFRESH_TOKEN_SECRET "$(new_secret)"
set_env_value METRICS_TOKEN "$METRICS_TOKEN"
set_env_value ADMIN_PASSWORD "$(new_secret)"
set_env_value CORS_ORIGIN "$FRONTEND_ORIGIN"
set_env_value COOKIE_SECURE "true"
set_env_value APP_URL "$FRONTEND_ORIGIN"
set_env_value NODE_ENV "production"

PROM_TEMPLATE="$ROOT_DIR/deploy/friend-demo/prometheus.template.yml"
PROM_GENERATED="$ROOT_DIR/deploy/friend-demo/prometheus.generated.yml"
sed "s/__METRICS_TOKEN__/${METRICS_TOKEN}/g" "$PROM_TEMPLATE" > "$PROM_GENERATED"

export FRONTEND_ORIGIN BACKEND_ORIGIN GRAFANA_ADMIN_PASSWORD CLOUDFLARE_TUNNEL_TOKEN
COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.local-scale.yml -f docker-compose.friend-demo.yml)

if [[ -z "$CLOUDFLARE_TUNNEL_TOKEN" ]]; then
  docker compose "${COMPOSE_FILES[@]}" --profile observability up -d --build
else
  docker compose "${COMPOSE_FILES[@]}" --profile observability --profile tunnel up -d --build
fi

echo
echo "TribeTalk demo stack is running."
echo "Local gateway: http://localhost:8080"
echo "Grafana:       ${BACKEND_ORIGIN}/grafana/"
echo "Prometheus:    ${BACKEND_ORIGIN}/prometheus/"
echo "Health:        ${BACKEND_ORIGIN}/api/health"
if [[ -z "$CLOUDFLARE_TUNNEL_TOKEN" ]]; then
  echo "No Cloudflare token was supplied; the gateway is local-only."
fi
