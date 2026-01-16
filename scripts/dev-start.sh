#!/bin/bash
# Start the dev server with MCP configuration
# Usage: ./scripts/dev-start.sh
#
# Environment variables:
#   DOT_AI_MCP_URL        - MCP server URL (fetched from cluster if not set)
#   DOT_AI_AUTH_TOKEN     - MCP auth token (fetched from cluster if not set)
#   DOT_AI_UI_AUTH_TOKEN  - UI login token (auto-generated if not set, printed to console)
#
# If DOT_AI_MCP_URL or DOT_AI_AUTH_TOKEN are not set, the script will attempt
# to fetch them from the Kubernetes cluster using kubectl.

set -e

# Only use kubectl if we need to fetch missing env vars
need_kubectl=false
if [ -z "$DOT_AI_AUTH_TOKEN" ] || [ -z "$DOT_AI_MCP_URL" ]; then
  need_kubectl=true
fi

if [ "$need_kubectl" = true ]; then
  # Set KUBECONFIG if not already set and kubeconfig-test.yaml exists
  if [ -z "$KUBECONFIG" ] && [ -f "kubeconfig-test.yaml" ]; then
    export KUBECONFIG="kubeconfig-test.yaml"
    echo "Using KUBECONFIG: kubeconfig-test.yaml"
  fi

  # Fetch auth token from cluster secret if not set
  if [ -z "$DOT_AI_AUTH_TOKEN" ]; then
    echo "Fetching MCP auth token from cluster..."
    export DOT_AI_AUTH_TOKEN=$(kubectl get secret -n dot-ai dot-ai-secrets -o jsonpath='{.data.auth-token}' | base64 -d)
    if [ -z "$DOT_AI_AUTH_TOKEN" ]; then
      echo "Error: Failed to fetch DOT_AI_AUTH_TOKEN from cluster"
      echo "Set DOT_AI_AUTH_TOKEN env var or ensure dot-ai-secrets exists"
      exit 1
    fi
  fi

  # Fetch MCP URL from ingress if not set
  if [ -z "$DOT_AI_MCP_URL" ]; then
    echo "Fetching MCP URL from ingress..."
    INGRESS_HOST=$(kubectl get ingress -n dot-ai dot-ai -o jsonpath='{.spec.rules[0].host}' 2>/dev/null)
    if [ -z "$INGRESS_HOST" ]; then
      echo "Error: Failed to fetch ingress host from cluster"
      echo "Set DOT_AI_MCP_URL env var or ensure dot-ai ingress exists"
      exit 1
    fi
    export DOT_AI_MCP_URL="http://${INGRESS_HOST}:8180"
  fi
fi

# Kill any stale processes on the ports
echo "Cleaning up stale processes..."
lsof -i :24678 -t | xargs kill 2>/dev/null || true
lsof -i :3000 -t | xargs kill 2>/dev/null || true
sleep 1

# Set default UI auth token for development
export DOT_AI_UI_AUTH_TOKEN="${DOT_AI_UI_AUTH_TOKEN:-admin}"

echo ""
echo "Starting dev server..."
echo "  MCP URL: $DOT_AI_MCP_URL"
echo "  MCP Auth: ${DOT_AI_AUTH_TOKEN:+***set***}"
echo "  UI Auth Token: $DOT_AI_UI_AUTH_TOKEN"
echo ""

npm run dev
