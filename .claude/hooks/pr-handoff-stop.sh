#!/usr/bin/env bash
# Stop the session once its pull request exists.
#
# Why: an agent session (especially Claude Code on the web, which keeps running
# after the PR is opened) that stays attached to its own PR burns usage in a
# long tail of `gh pr checks` / `gh run watch` / branch-sync polling, or of
# Monitor/wake-up loops parked on the same PR. Opening the PR is the handoff;
# CI, review bots, and merge are the user's call from there.
#
# Two modes, both registered in .claude/settings.json:
#
#   post  PostToolUse — after a call that created a PR (the `gh pr create` CLI or
#         a GitHub MCP create_pull_request tool) AND whose output contains a real
#         PR URL, drop a session-scoped marker and tell the model the handoff is
#         complete and the turn should end.
#
#   pre   PreToolUse — while that marker exists, deny the PR/CI-following tools:
#         shell polling commands, GitHub MCP PR/CI read tools, and the loop
#         machinery (Monitor / ScheduleWakeup / CronCreate). This is the part
#         with teeth: prose rules in AGENTS.md have not held, a denied tool call
#         does.
#
# Escape hatch: prefix a shell command with CLAUDE_ALLOW_PR_FOLLOW=1 (the user
# asking for CI to be watched is the authorisation). For non-shell tools the
# unlock is deleting the marker, which the deny reason spells out — do that only
# on an explicit user ask.
#
# `Run PR` sweeps, pr-ci-fix work, and reviews of someone else's PR are
# untouched: they never create a PR, so no marker is ever written.
#
# Contract: never fails a tool call by accident. Any parse problem exits 0 with
# no decision, which leaves the tool call exactly as it was.
set -uo pipefail

mode="${1:-}"
payload="$(cat 2>/dev/null || true)"
[ -z "$payload" ] && exit 0

# Extract a JSON string value for key $1 from the raw payload (first match).
# Handles only simple double-quoted values (no escapes). Empty on miss.
json_string_field() {
  local key="$1"
  printf '%s' "$payload" \
    | grep -o "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" \
    | head -n1 \
    | sed -E 's/.*"([^"]*)"$/\1/'
}

# --- payload fields -----------------------------------------------------------
# jq when available (exact). Without jq:
#   - tool_name / session_id from crude key extraction
#   - command_text from tool_input command/script/code/input fields when present,
#     else the whole payload (pre-mode shell deny still needs a searchable string)
#   - tool_output ONLY from the substring after "tool_response" — never the whole
#     payload. Falling back to the whole payload would let a failed `gh pr create`
#     whose *input* mentions another PR URL write the handoff marker.
if command -v jq >/dev/null 2>&1; then
  tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // empty' 2>/dev/null || true)"
  # Bash uses .command; PowerShell payloads may use script/code/input instead.
  command_text="$(printf '%s' "$payload" | jq -r '
    .tool_input.command // .tool_input.script // .tool_input.code // .tool_input.input // empty
  ' 2>/dev/null || true)"
  tool_output="$(printf '%s' "$payload" | jq -r '[.tool_response] | tostring' 2>/dev/null || true)"
  session_id="$(printf '%s' "$payload" | jq -r '.session_id // empty' 2>/dev/null || true)"
else
  tool_name="$(json_string_field tool_name)"
  session_id="$(json_string_field session_id)"
  command_text="$(json_string_field command)"
  [ -z "$command_text" ] && command_text="$(json_string_field script)"
  [ -z "$command_text" ] && command_text="$(json_string_field code)"
  [ -z "$command_text" ] && command_text="$(json_string_field input)"
  # pre-mode shell deny: if no command field was found, scan the raw payload.
  # post-mode never uses command_text as the URL source (see tool_output below).
  [ -z "$command_text" ] && command_text="$payload"
  if printf '%s' "$payload" | grep -Fq '"tool_response"'; then
    tool_output="${payload#*\"tool_response\"}"
  else
    tool_output=""
  fi
fi

[ -z "$session_id" ] && session_id="unknown-session"
# Reject path-injection / odd session ids before they become a marker filename.
# Claude session ids are alphanumeric with dashes/underscores; anything else
# collapses to the safe unknown-session fallback.
if ! printf '%s' "$session_id" | grep -Eq '^[A-Za-z0-9_-]+$'; then
  session_id="unknown-session"
fi

# --- marker location ----------------------------------------------------------
# Absolute git dir so the marker path is valid from any cwd (and for linked
# worktrees). Falls back to TMPDIR outside a repo.
git_dir="$(git rev-parse --absolute-git-dir 2>/dev/null || true)"
[ -z "$git_dir" ] && git_dir="${TMPDIR:-/tmp}"
marker="$git_dir/claude-pr-handoff-$session_id"

# Drop handoff markers older than a day so the git dir does not accumulate them
# across sessions. Only touches our own claude-pr-handoff-* files. Never prune
# the current session's marker — retention is from last activity (refreshed in
# pre-mode), not from creation, so a long-lived cloud session keeps enforcement.
prune_stale_markers() {
  local dir="$1"
  local keep_name="$2"
  [ -d "$dir" ] || return 0
  if [ -n "$keep_name" ]; then
    find "$dir" -maxdepth 1 -type f -name 'claude-pr-handoff-*' ! -name "$keep_name" -mtime +1 -delete 2>/dev/null || true
  else
    find "$dir" -maxdepth 1 -type f -name 'claude-pr-handoff-*' -mtime +1 -delete 2>/dev/null || true
  fi
}

json_escape() {
  # Escape backslash/quote, fold newlines to spaces, and strip other C0 control
  # characters so a future multi-line deny reason cannot emit unparseable JSON.
  printf '%s' "$1" \
    | tr '\n\r\t' '   ' \
    | tr -d '\000-\010\013\014\016-\037' \
    | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

is_shell_tool() {
  case "$tool_name" in
  "" | Bash | PowerShell) return 0 ;;
  *) return 1 ;;
  esac
}

# A PR-creating or PR-merging tool is never blocked — creation is how the PR gets
# opened, and merge already carries its own explicit-confirmation rule.
matches_pr_write_tool() {
  printf '%s' "$tool_name" \
    | grep -Eqi '(create|merge)_?pull_?request$'
}

case "$mode" in
post)
  prune_stale_markers "$git_dir" "claude-pr-handoff-$session_id"

  # A PR-creating call that actually returned a PR URL. Both halves matter:
  # without the URL check a failed create would end the session with no PR to
  # hand off.
  created=1
  if is_shell_tool && printf '%s' "$command_text" | grep -Eq 'gh[[:space:]]+pr[[:space:]]+create'; then
    created=0
  fi
  # End-anchor required: create_pull_request_review / _review_comment must NOT
  # count as opening a PR (pre-mode already uses the same anchored shape).
  if printf '%s' "$tool_name" | grep -Eqi 'create_?pull_?request$'; then
    created=0
  fi
  [ "$created" -eq 0 ] || exit 0
  # Require a non-empty tool_output that itself carries a PR URL. An empty
  # tool_output (jq-less payload with no tool_response key) must not match.
  [ -n "$tool_output" ] || exit 0
  printf '%s' "$tool_output" | grep -Eq 'github\.com/[^ "]+/pull/[0-9]+' || exit 0

  printf 'pr-opened %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo unknown)" >"$marker" 2>/dev/null || true

  context='The pull request is open. That is the end of this session'\''s handoff. Record the ledger row if it is still owed, give the user the PR URL and a short summary, then stop. Do NOT watch CI, poll checks, read workflow runs or job logs, re-run workflows, sync the branch from main, answer review bots, or park a Monitor / ScheduleWakeup / cron loop on this PR — following the PR from here is the wasted-usage loop this repo has explicitly ruled out (AGENTS.md "Stop when the pull request is open"). Those tools are now denied for the rest of this session. If the user asks for CI babysitting afterwards, that is their call and it is allowed then.'
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' "$(json_escape "$context")"
  exit 0
  ;;

pre)
  [ -f "$marker" ] || exit 0
  # Refresh mtime so prune retention tracks last activity, not creation time.
  touch "$marker" 2>/dev/null || true
  matches_pr_write_tool && exit 0

  reason=""

  # 1. Loop machinery — parking a wake-up or watcher on the PR is the same loop
  #    by another route, and hooks are the only thing that can see these.
  case "$tool_name" in
  Monitor | ScheduleWakeup | CronCreate)
    reason='Blocked: this session already opened its pull request, so parking a watcher/wake-up/cron on it is the wasted-usage loop AGENTS.md "Stop when the pull request is open" rules out. Hand the PR URL to the user and stop.'
    ;;
  esac

  # 2. GitHub MCP tools that read or mutate PR / CI state.
  # Keep this token list in sync with the PreToolUse matcher in .claude/settings.json.
  if [ -z "$reason" ] && printf '%s' "$tool_name" \
    | grep -Eqi 'pull_?request|workflow_run|workflow_job|check_run|check_suite|job_log|pr_status|update_branch'; then
    reason='Blocked: this session already opened its pull request, so reading or nudging its CI and review state is the wasted-usage loop AGENTS.md "Stop when the pull request is open" rules out. Hand the PR URL to the user and stop.'
  fi

  # 3. Shell polling. Narrow on purpose: committing, pushing, ledger appends, and
  #    `gh pr merge` (already gated on explicit user confirmation) stay allowed.
  #    Matches are substring-based (cheap, no shell parse); false positives that
  #    only *mention* a blocked token can use CLAUDE_ALLOW_PR_FOLLOW=1.
  if [ -z "$reason" ] && is_shell_tool; then
    printf '%s' "$command_text" | grep -q 'CLAUDE_ALLOW_PR_FOLLOW=1' && exit 0
    follow_re='gh[[:space:]]+pr[[:space:]]+(checks|status|view|diff|list)'
    follow_re="$follow_re"'|gh[[:space:]]+run[[:space:]]+(watch|view|list|rerun|download)'
    follow_re="$follow_re"'|gh[[:space:]]+api[^|;]*(actions/runs|check-runs|check-suites|/pulls/)'
    follow_re="$follow_re"'|sync:pr-branches'
    if printf '%s' "$command_text" | grep -Eq "$follow_re"; then
      reason='Blocked: this session already opened its pull request, so following it (CI polling, run logs, branch sync) is the wasted-usage loop AGENTS.md "Stop when the pull request is open" rules out. Hand the PR URL to the user and stop. If the user has asked for this check, re-run it prefixed with CLAUDE_ALLOW_PR_FOLLOW=1.'
    fi
  fi

  [ -z "$reason" ] && exit 0

  reason="$reason"' Unlock only on an explicit user ask, by deleting the marker: CLAUDE_ALLOW_PR_FOLLOW=1 rm "'"$marker"'".'
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$(json_escape "$reason")"
  exit 0
  ;;

*)
  exit 0
  ;;
esac
