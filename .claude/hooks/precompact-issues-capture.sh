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

# Self-verification, because the KNOWN LIMIT above cannot be resolved by reading code.
# Whether the platform injects this hook's stdout into model context is not something the
# repo can determine — the installed CLI ships a compiled binary with no inspectable
# bundle. What the repo CAN do is make the question answerable instead of permanently open:
# append one line per firing to a log outside the worktree, so after the next compaction
# `cat "$(git rev-parse --absolute-git-dir)/claude-precompact.log"` says whether the hook
# ran at all. If lines appear but the reminder never reached the model, the limit is real
# and the SessionStart backstop is doing the work; if no lines appear, the registration is
# wrong. Either answer is actionable; "unverified" is not.
#
# Kept under the git dir, never the worktree, so it can never be staged or committed.
log_dir="$(git rev-parse --git-dir 2>/dev/null || git rev-parse --absolute-git-dir 2>/dev/null || true)"
if [ -n "$log_dir" ] && command -v wslpath >/dev/null 2>&1 && [[ "$log_dir" =~ ^[A-Za-z]: ]]; then
  log_dir="$(wslpath -u "$log_dir" 2>/dev/null || true)"
fi
if [ -z "$log_dir" ] && [ -f .git ]; then
  raw_gitdir="$(sed -E 's/^gitdir:[[:space:]]*//' .git 2>/dev/null || true)"
  if [ -n "$raw_gitdir" ]; then
    if command -v wslpath >/dev/null 2>&1 && [[ "$raw_gitdir" =~ ^[A-Za-z]: ]]; then
      log_dir="$(wslpath -u "$raw_gitdir" 2>/dev/null || true)"
    elif [ -d "$raw_gitdir" ]; then
      log_dir="$raw_gitdir"
    fi
  fi
fi
if [ -n "$log_dir" ] && [ -d "$log_dir" ]; then
  timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date +%s 2>/dev/null || echo unknown)"
  printf '%s precompact trigger=%s\n' \
    "$timestamp" \
    "${trigger:-unknown}" \
    >>"$log_dir/claude-precompact.log" 2>/dev/null || true
fi

exit 0
