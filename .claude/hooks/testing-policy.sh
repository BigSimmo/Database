#!/usr/bin/env bash
# SessionStart hook — state the verification-cost policy for cloud sessions.
#
# A cloud session starts with no memory of what the last one learned the hard
# way, and the most expensive lesson in this repository is about the browser
# gate: `npm run verify:ui` is ~25 minutes, CI repeats it wholesale on every
# change that touches a browser surface, and a session that does not know this
# will spend those 25 minutes buying a verdict GitHub is about to reach anyway.
# Measured 2026-09-02 on two consecutive changes: 25.0m and 20.5m locally, while
# the focused selection for the same diffs took 37s and 6.1s and agreed.
#
# So this hook says, once per session and in the model's own context, which gate
# to reach for first. It is scoped to cloud sessions because that is where the
# ask came from and where the session has no local history to draw on; a
# workstation session already has the docs, the receipts store, and the operator.
#
# Contract: READ-ONLY and unfailable. Emits nothing but `additionalContext` on
# stdout, exits 0 on every path including a malformed payload, and makes no
# decision — a session that ignores it simply runs the wider gate, which is the
# conservative outcome. SessionStart hook stdout is injected into context;
# stderr is not, which is why every line below goes to stdout.
set -uo pipefail

# Cloud sessions only. `session-start.sh` uses the same gate.
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

# Drain stdin so the caller never blocks on an unread pipe.
cat >/dev/null 2>&1 || true

root="${CLAUDE_PROJECT_DIR:-}"
[ -z "$root" ] && root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -z "$root" ] && root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd || true)"
# Without the planner there is no advice to give, and inventing some would be
# worse than silence.
[ -f "$root/scripts/browser-test-plan.mjs" ] || exit 0

read -r -d '' context <<'POLICY' || true
[testing-policy] Verification cost policy for this cloud session.

CI re-runs the browser suite on every change that touches a browser surface, so a
full local `npm run verify:ui` (~25 min, 646 tests) buys a verdict GitHub is about
to reach. Do not spend it by default.

Before any browser run, ask the planner which part of the suite the diff can break:

    npm run plan:browser              # dry run: the level, the specs, and why
    npm run plan:browser -- --run     # execute the plan it printed

It fails closed: shared foundations, an unattributable UI file, or unknown scope
all escalate to the full suite on their own. You do not have to judge that.

For the static gates the arbiter already answers the same question:

    npm run arbiter -- <gate>         # RUN / DEFER / PROVEN, with its evidence

Reporting rules, which the cost saving depends on:
- A narrowed run is NOT the full gate. Say "focused browser proof at level <x>,
  full suite left to CI" — never "verify:ui passed".
- A deferred gate is not a passed gate; say "deferred to CI".
- Paste the decisive line of real output. Exit 0 alone is not proof.

Unchanged by any of this: GitHub remains the authoritative merge gate and runs
exactly what it ran before. Never weaken a required check to save local time.
POLICY

# The context is a JSON string field, so the only characters that must be escaped
# are backslash and double quote; the heredoc above contains neither, and this
# substitution keeps that true if it ever does. Newlines become \n.
escaped="${context//\\/\\\\}"
escaped="${escaped//\"/\\\"}"
escaped="${escaped//$'\n'/\\n}"

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$escaped"
exit 0
