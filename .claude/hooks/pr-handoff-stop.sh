#!/usr/bin/env bash
# Bound how long a session babysits its own pull request.
#
# Why a budget and not a ban: opening the PR is the handoff, but walking away
# the instant it exists is not useful either — a check that goes red ninety
# seconds later is still this session's to fix, and it is the cheapest moment
# to fix it. The waste worth stopping is the *unbounded* tail: a session
# (especially Claude Code on the web, which keeps running after the PR is
# opened) polling `gh pr checks` / `gh run watch` indefinitely, or parking a
# cron entry on the PR that outlives the session entirely.
#
# So from the moment the PR URL comes back the session may follow its own PR —
# read checks and run logs, re-run a failed job, sync the branch, push fixes —
# for CLAUDE_PR_BABYSIT_BUDGET_MINUTES (default 30). When that budget is spent
# the follow tools are denied, and the session reports where CI stands and
# stops. See AGENTS.md "Babysit the pull request, then stop".
#
# Two modes, both registered in .claude/settings.json:
#
#   post  PostToolUse — after a call that created a PR (the `gh pr create` CLI or
#         a GitHub MCP create_pull_request tool) AND whose output contains a real
#         PR URL, drop a session-scoped marker stamped with the open time and
#         tell the model the babysit budget has started.
#
#   pre   PreToolUse — while that marker exists:
#           * inside the budget, PR/CI follow tools pass. Monitor and
#             ScheduleWakeup pass too: waiting between looks is how the roughly
#             five-minute cadence floor gets honoured, and denying the wait only
#             produces tight polling instead.
#           * outside the budget, those same tools are denied. This is the part
#             with teeth: prose rules in AGENTS.md have not held, a denied tool
#             call does.
#           * CronCreate is denied either way. A cron entry outlives the session,
#             so no later budget check can ever stop it.
#
# Escape hatch: prefix a shell command with CLAUDE_ALLOW_PR_FOLLOW=1 (the user
# asking for CI to be watched past the budget is the authorisation). For
# non-shell tools the unlock is deleting the marker, which the deny reason
# spells out — do that only on an explicit user ask.
#
# `Run PR` sweeps, pr-ci-fix work, and reviews of someone else's PR are
# untouched: they never create a PR, so no marker is ever written.
#
# Contract: never fails a tool call by accident. Any parse problem — a malformed
# payload, an unreadable marker timestamp, a clock that moved backwards — exits 0
# with no decision, which leaves the tool call exactly as it was.
set -uo pipefail

mode="${1:-}"
case "$mode" in
post | pre) ;;
*) exit 0 ;;
esac

# Read stdin with the `read` builtin instead of `$(cat)`: one fewer fork+exec on
# every Bash/PowerShell call, and not slower — measured from 1 KB to 2 MB it wins
# below 256 KB and draws above. `read -d ''` consumes to EOF and reports non-zero
# *there* having already filled the variable, so `|| true` is the expected path.
payload=""
IFS= read -r -d '' payload || true
[ -z "$payload" ] && exit 0

# --- fast reject, before any subprocess ---------------------------------------
# Both modes are registered on EVERY Bash/PowerShell call, and in almost all of
# them there is nothing to do. Reaching that conclusion used to cost four jq
# runs, a grep and a `git rev-parse` — on Windows/Git Bash that is roughly two
# seconds of pure process-spawn latency, twice per tool call. Everything under
# this banner uses shell builtins only.
#
# Each test below is a deliberate SUPERSET of the decision it stands in for, so
# it can only ever let MORE through, never less. Anything it rejects would have
# reached the same exit further down, just slower.

# Post mode acts only when tool_response carries a `github.com/<…>/pull/<n>` URL
# (the URL gate in the post branch). That match is case-sensitive, so the raw
# payload must contain the lowercase bytes `pull`; JSON escaping `/` as `\/`
# cannot hide them. The `\u` arm keeps the claim airtight against a hypothetical
# encoder emitting `\u0070ull`.
if [ "$mode" = post ]; then
  case "$payload" in
  *pull* | *\\u*) ;;
  *) exit 0 ;;
  esac
fi

# Resolve the git directory the way `git rev-parse --absolute-git-dir` does, with
# builtins only. fast_git_dir is left EMPTY whenever the answer is not certain —
# any of git's own discovery controls being set, a `.git` file that does not
# resolve, a cwd that is itself a git dir, or no repository above cwd — and every
# one of those falls through to the authoritative `git rev-parse` in the marker
# section below.
#
# The discovery controls are load-bearing, not decoration. GIT_CEILING_DIRECTORIES
# in particular stops git ascending, so from a ceiling-excluded subdirectory git
# reports NO repository and the marker belongs in TMPDIR — while a naive upward
# walk finds the excluded checkout's `.git` and puts it there instead. Those two
# answers disagreeing across a post/pre pair is exactly how this guard would stop
# firing, so treat every discovery control as uncertain rather than guessing.
fast_git_dir=""
resolve_fast_git_dir() {
  # Keep in sync with git's discovery controls; an unrecognised one must fail
  # closed to `git rev-parse`, never be walked past.
  [ -n "${GIT_DIR:-}${GIT_COMMON_DIR:-}${GIT_WORK_TREE:-}${GIT_CEILING_DIRECTORIES:-}${GIT_DISCOVERY_ACROSS_FILESYSTEM:-}" ] && return 0
  # cwd is itself a git dir (bare repo): walking up would find a different repo.
  [ -f "$PWD/HEAD" ] && [ -d "$PWD/objects" ] && [ -d "$PWD/refs" ] && return 0
  local dir="$PWD" line target
  while :; do
    if [ -d "$dir/.git" ]; then
      fast_git_dir="$dir/.git"
      return 0
    fi
    if [ -f "$dir/.git" ]; then
      # Linked worktree: a one-line `gitdir: <path>` pointer.
      IFS= read -r line <"$dir/.git" 2>/dev/null || return 0
      line="${line%$'\r'}"
      case "$line" in
      "gitdir: "*)
        target="${line#gitdir: }"
        case "$target" in
        /* | [A-Za-z]:[/\\]*) ;;
        *) target="$dir/$target" ;;
        esac
        [ -d "$target" ] && fast_git_dir="$target"
        ;;
      esac
      return 0
    fi
    case "$dir" in "" | /) break ;; esac
    dir="${dir%/*}"
    [ -z "$dir" ] && dir=/
  done
  return 0
}
resolve_fast_git_dir

# Pre mode's entire job is gated on this session's marker existing (the first
# line of the pre branch), and no marker is written until this session opens a
# PR. The id is read with bash's own regex engine and accepted only in the same
# safe charset the full parse enforces, so a path-injection id matches nothing
# here and falls through to be rejected there. `-e`, not `-f`: anything present
# at that path defers to the slow path rather than short-circuiting it.
if [ "$mode" = pre ] && [ -n "$fast_git_dir" ]; then
  if [[ "$payload" =~ \"session_id\"[[:space:]]*:[[:space:]]*\"([A-Za-z0-9_-]+)\" ]]; then
    [ -e "$fast_git_dir/claude-pr-handoff-${BASH_REMATCH[1]}" ] || exit 0
  fi
fi

# Extract a JSON string value for key $1 from the raw payload (first match).
# Handles only simple double-quoted values (no escapes). Empty on miss.
# Callers that need shell-token matching must also scan $payload when
# jq_available=0 — this helper truncates at the first escaped quote inside
# the JSON string (e.g. `git commit -m \"msg\" && gh pr checks` → `git commit -m \`).
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
#   - tool_output ONLY from the tool_response region — never the whole payload,
#     and never a suffix that still contains a later tool_input (so an input URL
#     cannot satisfy the post-mode URL gate when keys are ordered response-first)
#   - shell token matching also scans a bounded raw-payload slice when jq is
#     missing, because quote-naive extraction truncates mid-command
jq_available=0
if command -v jq >/dev/null 2>&1; then
  jq_available=1
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
  # If no command-like field was found, scan the input half of the payload only —
  # never tool_response — so a printed `gh pr create` cannot look like a create.
  if [ -z "$command_text" ]; then
    if printf '%s' "$payload" | grep -Fq '"tool_response"'; then
      command_text="${payload%%\"tool_response\"*}"
    else
      command_text="$payload"
    fi
  fi
  if printf '%s' "$payload" | grep -Fq '"tool_response"'; then
    # Prefer a string-valued tool_response when the crude extractor can see it.
    tool_output="$(json_string_field tool_response)"
    if [ -z "$tool_output" ]; then
      # Complex/non-string response: take the slice after tool_response, but
      # stop before a later tool_input so an input URL cannot pass the gate.
      tool_output="${payload#*\"tool_response\"}"
      case "$tool_output" in
      *\"tool_input\"*) tool_output="${tool_output%%\"tool_input\"*}" ;;
      esac
    fi
  else
    tool_output=""
  fi
fi

# Pre-mode follow matching: decoded command, plus (jq-less) the full payload so
# a quote-truncated command_text cannot hide a later follow token. Over-block is
# the safe direction here.
shell_command_matches() {
  local re="$1"
  printf '%s' "$command_text" | grep -Eq "$re" && return 0
  if [ "$jq_available" -eq 0 ]; then
    printf '%s' "$payload" | grep -Eq "$re" && return 0
  fi
  return 1
}

# Post-mode create-token matching: decoded command, plus (jq-less) only the
# payload half *before* tool_response. Scanning tool_response would let a
# command that merely prints `gh pr create` + a PR URL lock the session.
shell_input_matches() {
  local re="$1"
  printf '%s' "$command_text" | grep -Eq "$re" && return 0
  if [ "$jq_available" -eq 0 ]; then
    local input_half="${payload%%\"tool_response\"*}"
    printf '%s' "$input_half" | grep -Eq "$re" && return 0
  fi
  return 1
}

# Missing or unsafe session ids fail open: do not share an unknown-session
# marker across unrelated malformed payloads (path injection included).
if [ -z "$session_id" ] || ! printf '%s' "$session_id" | grep -Eq '^[A-Za-z0-9_-]+$'; then
  exit 0
fi

# --- marker location ----------------------------------------------------------
# Absolute git dir so the marker path is valid from any cwd (and for linked
# worktrees). The builtin resolver above answers this without spawning git in
# the ordinary cases; `git rev-parse` stays the authority everywhere it did not.
# Falls back to TMPDIR outside a repo.
git_dir="$fast_git_dir"
[ -z "$git_dir" ] && git_dir="$(git rev-parse --absolute-git-dir 2>/dev/null || true)"
[ -z "$git_dir" ] && git_dir="${TMPDIR:-/tmp}"
marker="$git_dir/claude-pr-handoff-$session_id"

# Intentionally do not prune sibling sessions' markers. Post-mode runs on every
# Bash/PowerShell call (settings matcher), so age-based deletion of *other*
# sessions' files would disarm a session that is still inside its babysit budget.
# The budget is measured from the `epoch=` stamp in the marker's contents, never
# from its mtime, so nothing here needs to touch the file to keep it live.
# Markers are one-line files under the git dir and disappear with the worktree;
# leftover orphans are cheap hygiene, not worth silent enforcement loss.

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


# --- babysit budget -----------------------------------------------------------
# Minutes a session may follow its own pull request after opening it. A value
# that is not a plain integer, or falls outside 1..240, is ignored in favour of
# the default: a typo must not remove the ceiling or pin it to zero.
budget_minutes="${CLAUDE_PR_BABYSIT_BUDGET_MINUTES:-30}"
if ! printf '%s' "$budget_minutes" | grep -Eq '^[0-9]+$' ||
  [ "$budget_minutes" -lt 1 ] ||
  [ "$budget_minutes" -gt 240 ]; then
  budget_minutes=30
fi

case "$mode" in
post)
  # A PR-creating call that actually returned a PR URL. Both halves matter:
  # without the URL check a failed create would start a babysit budget with no
  # PR to babysit.
  created=1
  if is_shell_tool && shell_input_matches 'gh[[:space:]]+pr[[:space:]]+create'; then
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

  # `epoch=` is what pre-mode measures the budget from. A clock that cannot be
  # read is written as unknown, and pre-mode then fails open rather than denying
  # on a timestamp it never had.
  opened_epoch="$(date -u +%s 2>/dev/null || true)"
  printf '%s' "$opened_epoch" | grep -Eq '^[0-9]+$' || opened_epoch="unknown"

  # Only tell the model a budget is running when the marker actually landed. A
  # failed write (permissions / full disk) must fail open with no context —
  # otherwise the model paces itself against a ceiling pre-mode never enforces.
  if ! printf 'pr-opened %s epoch=%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo unknown)" \
    "$opened_epoch" >"$marker" 2>/dev/null; then
    exit 0
  fi
  [ -f "$marker" ] || exit 0

  context="The pull request is open: hand over its URL and stop. Do not read checks, wait, sync from main, or push follow-up fixes unless the user expressly asks to babysit or continue PR work. If they do ask in this session, CI follow-up is bounded to ${budget_minutes} minutes; use a slow cadence and stop as soon as CI settles. Do not park a cron job on this PR — it would outlive the session. See AGENTS.md \"Babysit the pull request, then stop\"."
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' "$(json_escape "$context")"
  exit 0
  ;;

pre)
  [ -f "$marker" ] || exit 0
  matches_pr_write_tool && exit 0

  # How much of the budget is left. Every unreadable input fails open: a marker
  # written before this budget existed, or a clock that jumped, must not silently
  # deny an entire session.
  opened_epoch="$(sed -n 's/.*epoch=\([0-9][0-9]*\).*/\1/p' "$marker" 2>/dev/null | head -n1)"
  [ -n "$opened_epoch" ] || exit 0
  now_epoch="$(date -u +%s 2>/dev/null || true)"
  printf '%s' "$now_epoch" | grep -Eq '^[0-9]+$' || exit 0
  elapsed=$((now_epoch - opened_epoch))
  [ "$elapsed" -lt 0 ] && exit 0
  expired=0
  [ "$elapsed" -ge $((budget_minutes * 60)) ] && expired=1

  spent_reason="Blocked: the ${budget_minutes}-minute budget for babysitting this session's own pull request is spent, and following it further is the unbounded loop AGENTS.md \"Babysit the pull request, then stop\" rules out. Tell the user where CI stands, hand over the PR URL, and stop."

  reason=""

  # 1. Loop machinery. CronCreate is denied for the whole session at any point in
  #    the budget: a cron entry outlives the session, so no later budget check
  #    can stop it. Monitor and ScheduleWakeup are how the cadence floor gets
  #    honoured, so they pass until the budget is spent.
  case "$tool_name" in
  CronCreate)
    reason="Blocked: a cron entry parked on this pull request outlives the session, so no later budget check can stop it. Babysit within the session's own budget instead — ScheduleWakeup is the right way to wait between checks — then report where CI stands and stop. AGENTS.md \"Babysit the pull request, then stop\"."
    ;;
  Monitor | ScheduleWakeup)
    [ "$expired" -eq 1 ] && reason="$spent_reason"
    ;;
  esac

  # 2. GitHub MCP tools that read or mutate PR / CI state.
  # Keep this token list in sync with the PreToolUse matcher in .claude/settings.json.
  if [ -z "$reason" ] && [ "$expired" -eq 1 ] && printf '%s' "$tool_name" \
    | grep -Eqi 'pull_?request|workflow_run|workflow_job|check_run|check_suite|job_log|pr_status|update_branch'; then
    reason="$spent_reason"
  fi

  # 3. Shell polling, once the budget is spent. Narrow on purpose: committing,
  #    pushing, ledger appends, and `gh pr merge` (already gated on explicit user
  #    confirmation) stay allowed throughout. Matches are substring-based (cheap,
  #    no shell parse); false positives that only *mention* a blocked token can
  #    use CLAUDE_ALLOW_PR_FOLLOW=1.
  if [ -z "$reason" ] && [ "$expired" -eq 1 ] && is_shell_tool; then
    # Escape hatch: documented prefix only (not an incidental echo/mention).
    # A quote-truncated command_text still sees a leading CLAUDE_ALLOW_PR_FOLLOW=1.
    printf '%s' "$command_text" \
      | grep -Eq '^[[:space:]]*CLAUDE_ALLOW_PR_FOLLOW=1([[:space:]]|$)' \
      && exit 0
    # comment/review cover the "answer review bots" tail; merge stays allowed
    # (explicit-confirmation rule elsewhere).
    follow_re='gh[[:space:]]+pr[[:space:]]+(checks|status|view|diff|list|comment|review)'
    follow_re="$follow_re"'|gh[[:space:]]+run[[:space:]]+(watch|view|list|rerun|download)'
    follow_re="$follow_re"'|gh[[:space:]]+api[^|;]*(actions/runs|check-runs|check-suites|/pulls/)'
    follow_re="$follow_re"'|sync:pr-branches'
    if shell_command_matches "$follow_re"; then
      reason="$spent_reason If the user has asked for CI to be watched past the budget, re-run the command prefixed with CLAUDE_ALLOW_PR_FOLLOW=1."
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
