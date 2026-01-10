#!/bin/bash
# Start the dev server with MCP configuration
# Usage: ./scripts/dev-start.sh
#
# Automatically fetches from cluster:
#   DOT_AI_AUTH_TOKEN   - From dot-ai-secrets in dot-ai namespace
#   DOT_AI_MCP_URL      - From dot-ai ingress in dot-ai namespace
#
# Optional environment variables (override auto-detection):
#   KUBECONFIG          - Path to kubeconfig (default: kubeconfig-test.yaml if exists)

set -e

# Set KUBECONFIG if not already set and kubeconfig-test.yaml exists
if [ -z "$KUBECONFIG" ] && [ -f "kubeconfig-test.yaml" ]; then
  export KUBECONFIG="kubeconfig-test.yaml"
  echo "Using KUBECONFIG: kubeconfig-test.yaml"
fi

# Fetch auth token from cluster secret
echo "Fetching auth token from cluster..."
export DOT_AI_AUTH_TOKEN=$(kubectl get secret -n dot-ai dot-ai-secrets -o jsonpath='{.data.auth-token}' | base64 -d)
if [ -z "$DOT_AI_AUTH_TOKEN" ]; then
  echo "Error: Failed to fetch DOT_AI_AUTH_TOKEN from cluster"
  echo "Make sure the dot-ai-secrets secret exists in the dot-ai namespace"
  exit 1
fi

# Fetch MCP URL from ingress
echo "Fetching MCP URL from ingress..."
INGRESS_HOST=$(kubectl get ingress -n dot-ai dot-ai -o jsonpath='{.spec.rules[0].host}' 2>/dev/null)
if [ -z "$INGRESS_HOST" ]; then
  echo "Error: Failed to fetch ingress host from cluster"
  echo "Make sure the dot-ai ingress exists in the dot-ai namespace"
  exit 1
fi
export DOT_AI_MCP_URL="http://${INGRESS_HOST}:8180"

# Kill any stale processes on the ports
echo "Cleaning up stale processes..."
lsof -i :24678 -t | xargs kill 2>/dev/null || true
lsof -i :3000 -t | xargs kill 2>/dev/null || true
sleep 1

echo "Starting dev server..."
echo "  MCP URL: $DOT_AI_MCP_URL"
echo "  Auth Token: ***set***"

npm run dev
