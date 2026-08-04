#!/usr/bin/env bash

set -Eeuo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  printf '[codex-cloud:maintenance] ERROR: Run this script from the Database repository.\n' >&2
  exit 1
}
cd "$repo_root"

if [[ -f "$HOME/.clinical-kb-codex-cloud.sh" ]]; then
  # shellcheck source=/dev/null
  source "$HOME/.clinical-kb-codex-cloud.sh"
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  printf '[codex-cloud:maintenance] Node/npm unavailable; rerunning full setup.\n'
  exec bash scripts/setup-codex-cloud.sh
fi

node scripts/ensure-codex-cloud-git-remote.mjs --configure-gh-helper
npm run check:codex-cloud
if ! npm run check:codex-cloud -- --runtime; then
  printf '[codex-cloud:maintenance] Runtime or toolchain drift detected; rerunning full setup.\n'
  exec bash scripts/setup-codex-cloud.sh
fi

printf '[codex-cloud:maintenance] PASS: Cloud runtime and repository toolchain are current.\n'
