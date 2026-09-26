#!/usr/bin/env bash
# SessionStart hook — one line of organisation-map health, only when it matters.
#
# Runs the organisation checker in its report-free mode
# (`check-organisation.mjs --no-report --json`) and prints one line when the map
# has problems, unplaced files, stale entries or rules matching nothing (files
# not yet placed are a normal, recorded state, so they alone never trigger it,
# though their count is included when the line prints). When all of those are
# zero it prints nothing. The logic lives in scripts/organisation/agent-hooks.mjs.
#
# Contract: READ-ONLY and unfailable. It writes no report and takes no lock, so
# it works in a fresh cloud container where no report exists yet. It exits 0 on
# every path, including a missing node, a checker that cannot run, and a
# checker that runs past its time limit (all of which print nothing). The line
# goes to stdout as `additionalContext`, because SessionStart stderr never
# reaches the model.
set -uo pipefail

root="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$root" ]; then
  here="${BASH_SOURCE[0]%/*}"
  root="$(cd "$here/../.." 2>/dev/null && pwd || true)"
fi
script="$root/scripts/organisation/agent-hooks.mjs"

if [ -z "$root" ] || [ ! -f "$script" ] || ! command -v node >/dev/null 2>&1; then
  # Drain stdin so the caller never blocks on an unread pipe. `cat` rather than a
  # `read` loop: `read` stops at a NUL byte and can leave the rest of the pipe unread.
  cat >/dev/null 2>&1 || true
  exit 0
fi

node "$script" session 2>/dev/null || true
exit 0
