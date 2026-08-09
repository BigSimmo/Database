---
name: newtask
description: Bootstrap a clean session for new work in this repo — create a fresh git worktree off the latest origin/main, install deps, warm routes, and confirm the base is current. Use at the start of a task when you want an isolated, up-to-date working copy and want to avoid the stale-base, cold-worktree, and reserved-port traps this repo is prone to.
---

# newtask — start a clean, current working copy

This repo moves fast (`claude/*` branches auto-merge on green) and shares ~40 worktrees
and one stash stack, so starting work on a stale base or a cold worktree is the default
failure. This skill sets up an isolated, current worktree so new work starts clean.

## Before you start

Check whether this task can ride an already-open PR you own or bundle with other queued
low-risk work instead of minting a new branch — see AGENTS.md "PR bundling (reduce
one-task-one-PR churn)". Only proceed to the steps below (which create a new branch and
worktree) once bundling doesn't apply: the work isn't independently low-risk by that
rule's test, or there's no suitable open PR to ride.

**Ask that same open-PR list a second question: is someone already building this?** Some
ledger rows carry a progress marker in their prose (`IN PROGRESS`, `IMPLEMENTED in PR
#1766`), but there is no structured status field and no atomic claim — a marker is written
by whoever did the work, usually after the fact, and nothing requires or checks one, so its
absence means nothing. Two sessions can read the same queued `/issues` item and both build
it. That is not hypothetical — on
2026-08-09 two assistants took the same queued item about four hours apart and shipped the
same conversion twice (PR #1766, and PR #1767 closed as a duplicate), which also left two
divergent shapes to adjudicate afterwards. Before starting a queued item, scan the open PRs
for the **route, component, or surface** it touches, not just for a matching ledger id — the
duplicate PR will rarely quote the id. If you find one, stop and reconcile with it rather
than opening a second branch. This is one GitHub read (`mcp__github__list_pull_requests`, or
`gh pr list` where available) and it falls inside the existing provider-confirmation
boundary. If GitHub is unreachable, treat it as a warning and continue — an offline session
must still be able to start work. Recorded as `#292`.

## Steps

1. **Sync main.** `git fetch --quiet origin main`.
2. **Create an isolated worktree** off the latest main (never reuse another session's
   checkout, and never switch the main checkout's branch):
   ```bash
   git worktree add -b claude/<task-slug> ../wt-<task-slug> origin/main
   ```
   Use a short, descriptive `<task-slug>`.
3. **Install deps in the new worktree** (worktrees do NOT share `node_modules`; a cold
   worktree fails `vitest`/`tsc`). `npm ci` keeps the lockfile untouched:
   ```bash
   cd ../wt-<task-slug> && npm ci --no-audit --no-fund
   ```
   `postinstall` installs the pre-push guards automatically.
4. **Confirm the base is current:** `node scripts/check-base-freshness.mjs` — expect
   `behind 0`. If it reports behind, the fetch/worktree base is stale; recreate.
5. **Warm routes before any browser/UI work** (fresh worktrees can hash onto a
   Next-reserved port and 404 all routes until warmed): `npm run ensure`, then hit
   `/` and `/applications` once.

## Notes

- Never `git stash` here — the stash stack is global across all worktrees. Use a
  throwaway worktree or a patch file instead.
- Do the work on the `claude/<task-slug>` branch; commit only your own paths.
- When done, hand off with the `handoff` skill.
