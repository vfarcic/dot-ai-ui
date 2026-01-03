#!/bin/bash
# Stop the dev server and clean up ports
# Usage: ./scripts/dev-stop.sh

echo "Stopping dev server..."
lsof -i :24678 -t | xargs kill 2>/dev/null || true
lsof -i :3000 -t | xargs kill 2>/dev/null || true
echo "Done."
