#!/usr/bin/env bash
# PreCompact hook — ask for /issues capture BEFORE the context is discarded.
#
# The problem this closes: `.claude/hooks/issues-surface.sh` already prints a
# "run /issues capture" reminder, but it is a SessionStart hook, so on a
# `compact` trigger it fires *after* compaction has already happened. By then
# the in-flight follow-ups, deferrals and half-formed risks it wants recorded
# are exactly what was just summarised away. The reminder arrives after the
# thing it is trying to save is gone.
#
# PreCompact fires while that material is still in context, which is the only
# moment the reminder can actually be acted on.
#
# KNOWN LIMIT — read before trusting this. Claude Code injects hook stdout into
# the model's context for SessionStart / UserPromptSubmit / PreToolUse /
# PostToolUse. Whether it does so for PreCompact is NOT verified here, and could
# not be verified offline. So this hook deliberately prints plain human text
# rather than a hookSpecificOutput JSON envelope: if the platform does inject
# it, the text is useful as-is; if it does not, the operator still sees a clean,
# readable transcript line rather than a raw JSON blob. Either way the
# SessionStart reminder in issues-surface.sh remains the backstop, so nothing
# regresses if this turns out to be transcript-only. Re-check when the hook
# reference documents PreCompact context injection.
#
# Contract: READ-ONLY and always exits 0. It never writes the ledger, never
# commits, and must never be able to fail a compaction.
set -uo pipefail

payload="$(cat 2>/dev/null || true)"

# `trigger` is "manual" (the user ran /compact) or "auto" (the context window
# filled). Both lose the same material; the wording differs only so the operator
# can tell which one they are looking at.
trigger="$(printf '%s' "$payload" \
  | grep -o '"trigger"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -n1 | sed -E 's/.*"([^"]*)"$/\1/')"

case "$trigger" in
manual) why="This compaction was requested manually." ;;
auto) why="The context window filled, so this compaction was automatic." ;;
*) why="This session is about to be compacted." ;;
esac

echo "[issues] ${why} Anything this session discovered but has not written down is about to be summarised away: unresolved follow-ups, deferrals, known risks, and work you decided NOT to do and why. Record them now with /issues add … (or /issues capture for a sweep) — docs/outstanding-issues.md is the only memory that survives a context reset. Requests land as immutable files under docs/outstanding-issues-inbox/; they are not committed unless you are explicitly asked to commit."

exit 0
