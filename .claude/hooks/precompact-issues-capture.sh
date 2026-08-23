#!/usr/bin/env bash
# PreCompact observability hook — record that compaction fired.
#
# Claude Code does not add successful plain-text stdout from PreCompact hooks
# to model context. Its documented PreCompact output contract also has no
# additionalContext path. This hook is therefore deliberately silent: it only
# leaves execution evidence under the worktree's git dir. The SessionStart
# reminder in `.claude/hooks/issues-surface.sh` remains the post-compaction
# backstop that Claude can actually receive.
#
# Contract: log-only, silent on stdout/stderr, and always exits 0. It never
# writes the ledger, never commits, and must never be able to fail compaction.
set -uo pipefail

payload="$(cat 2>/dev/null || true)"

# `trigger` is "manual" (the user ran /compact) or "auto" (the context window
# filled). Normalize anything else before it reaches the compact execution log.
trigger="$(printf '%s' "$payload" \
  | grep -o '"trigger"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -n1 | sed -E 's/.*"([^"]*)"$/\1/')"

# Keep the log value bounded even if a malformed payload supplies another trigger.
case "$trigger" in
manual | auto) ;;
*) trigger="unknown" ;;
esac

# Append one line per firing outside the worktree so the hook remains observable
# without putting ineffective output in the transcript or model context.
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
