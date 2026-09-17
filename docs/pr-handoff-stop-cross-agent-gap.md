# The PR cron-block is enforced for Claude Code only — a documented gap

**Status:** gap documentation only — this document builds no mechanism
**Ledger row:** `#258` (P2, rec)
**Checked:** 2026-08-14 against `origin/main` at `d47aa6d`; simplified from a 30-minute budget to a
single CronCreate block 2026-09-17 (owner-approved governance cut)
**Rule it backs:** `AGENTS.md` → "Babysit the pull request, then stop"

A session should follow its own pull request's CI while that is useful, fix only what this
change broke, and stop once CI settles. The one failure mode prose alone cannot prevent is a
cron entry parked on the PR: it outlives the session, so nothing later can stop it. That is the
only thing this hook enforces — everything else about following a PR (reading checks, re-running
a job, syncing the branch, pushing fixes, waiting between looks) is ordinary work.

An earlier version of this rule (PR #1649, reshaped 2026-08-19) enforced a 30-minute babysit
budget with several deny classes; that machinery was removed 2026-09-17 as unnecessary
complexity once the rule was restated as "follow while useful, stop when it settles" rather than
a timer. **Only one of the three agents this repo supports gets any hook at all.** This document
records where the enforcement lives, what the other two actually have, and what parity would
require — so the gap is a known limit rather than an open task that looks unstarted.

---

## 1. What Claude Code has

`.claude/hooks/pr-handoff-stop.sh`, registered in `.claude/settings.json`:

| Phase         | Matcher                                                                     | Effect                                                                                                                 |
| ------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `PostToolUse` | `Bash`, `PowerShell`, and any tool whose name matches `create_pull_request` | On a call that returns a real PR URL, drops a session-scoped marker so the session is known to have an open PR.        |
| `PreToolUse`  | `CronCreate`                                                                | While that marker exists, denies the call with a reason naming the AGENTS.md rule. Every other tool call is untouched. |

Committing, pushing, ledger appends, PR create/merge, `gh pr` reads, GitHub MCP PR/CI tools,
`Monitor`, and `ScheduleWakeup` are all ordinary, unrestricted work now — none of them are gated
by this hook in any way.

Details that matter to anyone reproducing this elsewhere:

- **The marker is session-scoped and durable**, at `<absolute-git-dir>/claude-pr-handoff-<session_id>`, falling back to `TMPDIR` outside a repo. Using the absolute git dir keeps it valid from any cwd and in linked worktrees.
- **The marker has no expiry.** There is no budget to measure it against; its only job is recording that this session has an open PR, so `CronCreate` stays denied for as long as the marker exists.
- **It fails open on a missing or unsafe `session_id`** (`^[A-Za-z0-9_-]+$`), rather than sharing one marker across unrelated malformed payloads — path injection included.
- **Sibling sessions' markers are deliberately never pruned.** Post-mode runs on every shell call, so age-based deletion of other sessions' files would disarm a session that still has an open PR.
- **Post-mode scans only the request half of the payload**, never `tool_response`, so a command that merely _prints_ `gh pr create` and a PR URL cannot mark the session.
- **The escape hatch is explicit and user-driven**: delete the marker the deny reason names, on an explicit user ask. A command that merely mentions a blocked token cannot self-authorise.
- Sessions that never create a PR are untouched, so `Run PR` sweeps, `pr-ci-fix` work, and review sessions on someone else's PR still function.

---

## 2. What Codex and Cursor have

**The `AGENTS.md` prose, and nothing else.** Checked, rather than assumed:

- `.claude/settings.json` is read only by Claude Code. Its `PreToolUse` / `PostToolUse` registrations are invisible to the other two agents, so the marker is never dropped and no call is ever denied for them.
- `plugins/clinical-kb/.codex-plugin/plugin.json` declares `name`, `version`, `description`, `author`, `repository`, `keywords`, `skills` and an `interface` block. **There is no hook, event, or pre-tool-interception field**, and the plugin ships exactly one skill (`skills/clinical-kb-workflow/SKILL.md`). A Codex session reads guidance; nothing intercepts its tool calls.
- `.cursor/` contains `settings.json` (plugin enablement only — `context7-plugin`, `figma`), `mcp.json`, `agents/` (`design-review.md`, `pr-babysit.md`, `pr-bugbot.md`) and `skills/`. **No deny path.** Note that `.cursor/agents/pr-babysit.md` exists at all: Cursor has a documented agent for exactly the PR-following behaviour the stop rule restricts, with nothing to stop a cron entry being parked on one either.

The consequence is precise, and it is worth stating plainly because it is easy to read the
hook's existence as though the problem were solved: **prose alone is what was already in force
before PR #1649, and it was already insufficient — that insufficiency is why the hook was
built.** The cost was not removed; it was relocated to whichever agent lacks the gate. A cloud
Codex session is the worst case, for the same reason Claude Code on the web was.

---

## 3. What a cross-agent mechanism would need

Any parity mechanism has to answer the same two questions the hook answers:

1. **Has this session already opened a PR?** Requires a durable, session-scoped marker written at the moment a PR-creating call returns a real PR URL — not at the moment one is attempted, since a failed create would otherwise end the session with no PR to hand over.
2. **Is this call a cron/scheduled-task creation?** Denied outright once the marker exists, because a cron entry outlives the session. Matching must cover the connector path as well as the shell, or the rule is trivially bypassed.

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
