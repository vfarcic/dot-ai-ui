#!/bin/bash
# Start the dev server with MCP configuration
# Usage: ./scripts/dev-start.sh
#
# Required environment variables:
#   DOT_AI_MCP_URL      - MCP server URL (e.g., http://localhost:8080)
#   DOT_AI_AUTH_TOKEN   - Auth token for MCP server

set -e

# Validate required environment variables
if [ -z "$DOT_AI_MCP_URL" ]; then
  echo "Error: DOT_AI_MCP_URL is not set"
  echo "Example: export DOT_AI_MCP_URL=http://localhost:8080"
  exit 1
fi

if [ -z "$DOT_AI_AUTH_TOKEN" ]; then
  echo "Error: DOT_AI_AUTH_TOKEN is not set"
  echo "Example: export DOT_AI_AUTH_TOKEN=your-token"
  exit 1
fi

# Kill any stale processes on the ports
echo "Cleaning up stale processes..."
lsof -i :24678 -t | xargs kill 2>/dev/null || true
lsof -i :3000 -t | xargs kill 2>/dev/null || true
sleep 1

echo "Starting dev server..."
echo "  MCP URL: $DOT_AI_MCP_URL"
echo "  Auth Token: ***set***"

npm run dev
