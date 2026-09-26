#!/usr/bin/env bash
# PreToolUse (Edit|Write|MultiEdit|NotebookEdit) — organisation-framework edit warning.
#
# Adds a short note to the model's context when an edit targets a file on one of
# pr-policy's safety lists: on every edit for ranking-protected files and
# database migrations, once per session for clinical-risk files, and one line
# naming the area and its key docs on the first edit in each area of the
# organisation map (docs/organisation/). The logic lives in
# scripts/organisation/agent-hooks.mjs so it can be tested and can ask pr-policy
# and the organisation checker directly instead of copying their lists.
#
# Contract: WARNS, NEVER BLOCKS. It never emits `permissionDecision` (an "allow"
# would skip the user's permission prompt), never exits non-zero, and makes no
# decision, so a missing node, a malformed payload or a crash leaves the tool
# call exactly as it was. It writes no report and takes no lock; its only write
# is a small per-session memory file in the OS temp folder.
set -uo pipefail

root="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$root" ]; then
  here="${BASH_SOURCE[0]%/*}"
  root="$(cd "$here/../.." 2>/dev/null && pwd || true)"
fi
script="$root/scripts/organisation/agent-hooks.mjs"

if [ -z "$root" ] || [ ! -f "$script" ] || ! command -v node >/dev/null 2>&1; then
  # Drain stdin with a builtin so the caller never blocks on an unread pipe.
  IFS= read -r -d '' drained || true
  exit 0
fi

node "$script" edit 2>/dev/null || true
exit 0
