# The PR-handoff stop rule is enforced for Claude Code only — a documented gap

**Status:** gap documentation only — this document builds no mechanism
**Ledger row:** `#258` (P2, rec)
**Checked:** 2026-08-14 against `origin/main` at `d47aa6d`
**Rule it backs:** `AGENTS.md` → "Stop when the pull request is open"

Opening a pull request is the end of a session's handoff, not the start of a supervision
shift. A session that stays attached to its own PR — polling `gh pr checks`, watching workflow
runs, re-running failed jobs, re-syncing the branch, answering review bots, or parking a
wake-up on it — spends a long tail of usage on work nobody asked for. Claude Code on the web is
the worst case, because the cloud session keeps running and nothing naturally ends the loop.

PR #1649 addressed that with two things: the `AGENTS.md` prose, and a Claude Code hook. **Only
one of the three agents this repo supports gets the hook.** This document records where the
enforcement lives, what the other two actually have, and what parity would require — so the
gap is a known limit rather than an open task that looks unstarted.

---

## 1. What Claude Code has

`.claude/hooks/pr-handoff-stop.sh` (259 lines), registered in `.claude/settings.json` as two
matchers:

| Phase         | Matcher                                                                                                                                                                                             | Effect                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `PostToolUse` | `Bash`, `PowerShell`, and any tool whose name matches `create_pull_request`                                                                                                                         | On a call that returns a real PR URL, drops a session-scoped marker and tells the model the handoff is over. |
| `PreToolUse`  | `Bash`, `PowerShell`, `Monitor`, `ScheduleWakeup`, `CronCreate`, plus tool names matching `pull_request` / `workflow_(run\|job)` / `check_(run\|suite)` / `job_log` / `pr_status` / `update_branch` | While that marker exists, denies the call with a reason naming the AGENTS.md rule.                           |

Three deny classes, which is the useful summary of what "enforced" means here:

1. **Shell polling** — `gh pr checks|status|view|diff|list|comment|review`, `gh run watch|view|list|rerun|download`, `gh api …actions/runs|check-runs|check-suites|/pulls/`, and `sync:pr-branches`.
2. **GitHub MCP PR/CI tools**, matched by tool name, so a connector is not a way around the shell rule.
3. **Loop machinery** — `Monitor`, `ScheduleWakeup`, `CronCreate`, which is how a session parks itself on a PR without running a single command.

Committing, pushing, ledger appends, and PR create/merge stay allowed throughout.

Details that matter to anyone reproducing this elsewhere:

- **The marker is session-scoped and durable**, at `<absolute-git-dir>/claude-pr-handoff-<session_id>`, falling back to `TMPDIR` outside a repo. Using the absolute git dir keeps it valid from any cwd and in linked worktrees.
- **It fails open on a missing or unsafe `session_id`** (`^[A-Za-z0-9_-]+$`), rather than sharing one marker across unrelated malformed payloads — path injection included.
- **Sibling sessions' markers are deliberately never pruned.** Post-mode runs on every shell call, so age-based deletion of other sessions' files would disarm a long-lived handoff session that only uses `Read`/`Edit` after opening its PR.
- **Post-mode scans only the request half of the payload**, never `tool_response`, so a command that merely _prints_ `gh pr create` and a PR URL cannot lock the session. Pre-mode deliberately scans the whole payload, because over-blocking is the safe direction there.
- **The escape hatch is explicit and user-driven**: prefix a shell command with `CLAUDE_ALLOW_PR_FOLLOW=1`, or delete the marker the deny reason names. A command that merely mentions a blocked token cannot self-authorise — the prefix must be at the start of the command.
- Sessions that never create a PR are untouched, so `Run PR` sweeps, `pr-ci-fix` work, and review sessions on someone else's PR still function.

---

## 2. What Codex and Cursor have

**The `AGENTS.md` prose, and nothing else.** Checked, rather than assumed:

- `.claude/settings.json` is read only by Claude Code. Its `PreToolUse` / `PostToolUse` registrations are invisible to the other two agents, so the marker is never dropped and no call is ever denied for them.
- `plugins/clinical-kb/.codex-plugin/plugin.json` declares `name`, `version`, `description`, `author`, `repository`, `keywords`, `skills` and an `interface` block. **There is no hook, event, or pre-tool-interception field**, and the plugin ships exactly one skill (`skills/clinical-kb-workflow/SKILL.md`). A Codex session reads guidance; nothing intercepts its tool calls.
- `.cursor/` contains `settings.json` (plugin enablement only — `context7-plugin`, `figma`), `mcp.json`, `agents/` (`design-review.md`, `pr-babysit.md`, `pr-bugbot.md`) and `skills/`. **No deny path.** Note that `.cursor/agents/pr-babysit.md` exists at all: Cursor has a documented agent for exactly the PR-following behaviour the stop rule restricts, with nothing to bound it.

The consequence is precise, and it is worth stating plainly because it is easy to read the
hook's existence as though the problem were solved: **prose alone is what was already in force
before PR #1649, and it was already insufficient — that insufficiency is why the hook was
built.** The cost was not removed; it was relocated to whichever agent lacks the gate. A cloud
Codex session is the worst case, for the same reason Claude Code on the web was.

---

## 3. What a cross-agent mechanism would need

Any parity mechanism has to answer the same three questions the hook answers:

1. **Has this session already opened a PR?** Requires a durable, session-scoped marker written at the moment a PR-creating call returns a real PR URL — not at the moment one is attempted, since a failed create would otherwise end the session with no PR to hand over.
2. **Is this call one of the three deny classes?** Shell PR/CI polling, PR/CI tool calls by name, and loop machinery. Matching must cover the connector path as well as the shell, or the rule is trivially bypassed.
3. **Has the user explicitly asked to follow the PR anyway?** There must be an unlock, it must be user-driven, and a call must not be able to self-authorise by merely mentioning the unlock token.

Plus three properties the existing hook already got right and a second implementation would
have to match: fail open on an unidentifiable session; never prune a sibling session's marker;
and never let a tool's _output_ arm the marker.

**Cheapest first**, per `#258`'s own next step: check whether Codex or Cursor has since exposed
any pre-tool interception this repo can register — Codex plugin hooks under
`plugins/clinical-kb/`, Cursor rules or agent configuration under `.cursor/`. As of this
document, neither manifest exposes one.

**If no deny path exists**, the fallback the row proposes is a shared marker file plus a wrapper
that agents are instructed to route `gh` through. That is strictly weaker — it is advisory, an
agent can call `gh` directly, and it cannot touch the MCP-connector or loop-machinery classes at
all — but a wrapper can _log_, which makes a violation detectable after the fact rather than
invisible. Detection is not prevention, and a design that claims otherwise should be rejected.

---

## 4. Stop

- **Do not weaken the Claude Code hook to make the three agents symmetric.** Removing working enforcement to achieve uniformity trades a real control for the appearance of one.
- **Do not add a second copy of the deny list.** One script, multiple registrations. Two lists drift, and the drift is silent — the copy that falls behind still looks like enforcement.
- **Do not close `#258` on the strength of this document.** The gap is now recorded rather than open-and-unexamined, but it is still a gap: two of three agents remain prose-only. Re-check the Codex and Cursor manifests when either tool ships hook support, and close the row only when a mechanism exists or the limit is accepted deliberately.
