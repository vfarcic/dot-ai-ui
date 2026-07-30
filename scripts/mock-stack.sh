#!/usr/bin/env bash
# Launch the deterministic local stack used by the AI E2E suites (Momentic, DevAssure):
#   - mock MCP server (docker) on :3001
#   - UI app server on :3002, pointed at the mock, with a throwaway token
#
# Both CLIs drive a LOCAL browser, so they reach this on localhost.
# Leave this running in one terminal, then run the suite in another.
set -euo pipefail

MOCK_PORT=3001
APP_PORT=3002
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

cleanup() {
  echo "Stopping mock server..."
  docker compose -f e2e/docker-compose.yml down >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Starting mock MCP server on :$MOCK_PORT ..."
docker compose -f e2e/docker-compose.yml up -d

echo "Waiting for mock server to be ready..."
for _ in $(seq 1 60); do
  if curl -sf "http://localhost:$MOCK_PORT/api/v1/users" >/dev/null 2>&1; then
    echo "Mock server is up."
    break
  fi
  sleep 1
done

echo "Starting UI app on http://localhost:$APP_PORT (token: test-token) ..."
PORT="$APP_PORT" \
DOT_AI_MCP_URL="http://localhost:$MOCK_PORT" \
DOT_AI_UI_AUTH_TOKEN="test-token" \
  npx tsx server/index.ts
