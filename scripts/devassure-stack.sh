#!/usr/bin/env bash
# Kept for the DevAssure workflow, which references this path.
# The stack itself is shared with the Momentic suite — see scripts/mock-stack.sh.
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/mock-stack.sh" "$@"
