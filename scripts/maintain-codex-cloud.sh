#!/usr/bin/env bash

set -Eeuo pipefail

log() {
  printf '[codex-cloud:maintenance] %s\n' "$*"
}

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  printf '[codex-cloud:maintenance] ERROR: Run this script from the Database repository.\n' >&2
  exit 1
}
cd "$repo_root"

if [[ -f "$HOME/.clinical-kb-codex-cloud.sh" ]]; then
  # shellcheck source=/dev/null
  source "$HOME/.clinical-kb-codex-cloud.sh"
fi

expected_node_major="$(tr -cd '0-9' < .node-version)"
actual_node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
if [[ "$actual_node_major" != "$expected_node_major" ]]; then
  log "Runtime drift detected; running the full setup again."
  exec bash scripts/setup-codex-cloud.sh
fi

if ! npm run check:installed-lock-parity >/dev/null 2>&1; then
  log "Dependency drift detected; restoring package-lock.json exactly."
  npm ci --include=dev
fi

npm run check:runtime
npm run check:installed-lock-parity
npm run check:codex-cloud -- --runtime
log "Maintenance complete."
