#!/usr/bin/env bash
# Run on the Oracle VM to pull latest API code and rebuild containers.
# Usage:
#   ./deploy.sh              # pull main, rebuild
#   ./deploy.sh main         # pull a branch
#   ./deploy.sh --no-pull    # rebuild only (no git pull)
#   ./deploy.sh --env-only   # restart with current .env (no rebuild)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BRANCH="main"
DO_PULL=1
ENV_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --no-pull) DO_PULL=0 ;;
    --env-only) ENV_ONLY=1; DO_PULL=0 ;;
    -h|--help)
      sed -n '2,8p' "$0" | tr -d '#'
      exit 0
      ;;
    -*)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
    *)
      BRANCH="$arg"
      ;;
  esac
done

cd "$SCRIPT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing $SCRIPT_DIR/.env — copy from .env.example and fill secrets first." >&2
  exit 1
fi

if [[ "$DO_PULL" -eq 1 ]]; then
  echo "==> Pulling origin/$BRANCH in $REPO_ROOT"
  cd "$REPO_ROOT"
  git fetch origin "$BRANCH"
  git pull --ff-only origin "$BRANCH"
  cd "$SCRIPT_DIR"
fi

if [[ "$ENV_ONLY" -eq 1 ]]; then
  echo "==> Restarting containers (env-only, no rebuild)"
  docker compose up -d
else
  echo "==> Building and starting containers"
  docker compose up -d --build
fi

echo "==> Status"
docker compose ps

echo "==> Waiting for API health…"
ok=0
for _ in $(seq 1 30); do
  if docker compose exec -T api node -e \
    "fetch('http://127.0.0.1:3001/auth/me').then(r=>process.exit(r.status===401?0:1)).catch(()=>process.exit(1))" \
    >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done

if [[ "$ok" -eq 1 ]]; then
  echo "==> API healthy (GET /auth/me → 401). Public check: https://api.go-wind.com/auth/me"
else
  echo "==> API not healthy yet. Check logs:" >&2
  echo "    docker compose logs --tail=80 api" >&2
  exit 1
fi
