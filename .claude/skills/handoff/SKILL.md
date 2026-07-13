---
name: handoff
description: Safely commit, verify, and push completed work on a feature branch in this repo, then open a PR and record the review in the ledger. Use when work is finished and you want to hand it off — it runs the repo's verification gate, preserves unrelated work, and never touches protected branches without the required confirmation.
---

# handoff — commit, verify, push, PR

Encodes this repo's safe Git handoff. The goal is to leave completed work committed and
pushed on a `claude/*` feature branch with a PR; NOT to merge into a protected branch,
force-push, or discard work.

## Preconditions

- You are on a `claude/*` (or other non-protected) feature branch, not `main`/`master`/
  `develop`/`release/*`. If on a protected branch, create a feature branch first.
- Only your own paths are staged (this worktree may hold other sessions' WIP).

## Steps

1. **Inspect first (read-only):** `git status --short --branch`, `git diff`, `git diff --cached`,
   and the ahead/behind from `node scripts/check-base-freshness.mjs`. If staged paths are found
   that aren't part of the current session's own work (leftover from other sessions' WIP),
   unstage them with `git restore --staged <path>` before proceeding.
2. **Stage coherent, completed changes only.** Stage explicit paths — never `git add -A`
   blindly. Do not stage `.env*`, secrets, build output, logs, or unrelated WIP; if you
   see a possible secret, report the path (never the value) and stop.
3. **Verify** with the smallest sufficient gate:
   - Default: `npm run verify:pr-local` (format + cheap gate, plus build/RAG when the
     scope needs them).
   - Touched UI/routing/styling: add `npm run verify:ui`.
   - Touched Supabase env/config: `npm run check:supabase-project` (provider — confirm first).
     Do not claim a gate passed unless it actually ran.
4. **Commit** with a clear message. End the message with:
   `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
5. **Push** the feature branch: `git push -u origin <branch>`. The pre-push guards run
   (auto-merge sentinel, format, drift) — heed a block rather than overriding blindly.
6. **Open a PR** with `gh pr create --base main`, body ending with the Claude Code
   attribution line. Enabling squash-auto-merge (`gh pr merge --squash --auto`) is the
   repo norm but requires explicit user confirmation before enabling; the PR lands on green.
7. **Record** the review in `docs/branch-review-ledger.md` (Date | Branch/ref | Reviewed
   HEAD | Scope | Outcome | Checks).

## Requires explicit confirmation (do not do automatically)

Merging into a protected branch, enabling auto-merge (`gh pr merge --squash --auto`),
force-push, rebasing a shared branch, deleting/renaming branches, `git reset --hard`,
`git clean -fd`, or any provider-touching verification.
