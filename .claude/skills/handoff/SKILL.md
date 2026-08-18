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
   and the ahead/behind from `node scripts/check-base-freshness.mjs`. Record the exact cached index
   state with `git diff --cached --raw --no-renames` before staging. Also record the worktree and
   untracked state for every intended path with `git status --porcelain=v1 -z --untracked-files=all -- <intended-paths>`.
   Immediately before staging, repeat and compare both snapshots; if any intended path changed,
   appeared, or disappeared, stop or move the handoff to an isolated worktree. Do not accept a
   concurrent change merely because its path is intended. If the cached index contains paths outside
   this session, stop and move the handoff to an isolated worktree; never unstage or otherwise
   mutate another session's index entries.
   Record `git branch --show-current` and `git rev-parse HEAD`; repeat both immediately before and
   after the commit. Immediately before committing, repeat `git diff --cached --raw --no-renames`
   and verify that every pre-existing cached entry is unchanged and every new entry is in the
   explicit intended-path allowlist. Stop if the branch moved, HEAD changed before your commit, or
   the cached index differs outside those intended paths. A shared worktree/index is not safe
   handoff state.
2. **Stage coherent, completed changes only.** Stage explicit paths — never `git add -A`
   blindly. Do not stage `.env*`, secrets, build output, logs, or unrelated WIP; if you
   see a possible secret, report the path (never the value) and stop.
3. **Format and verify.** From a fully owned feature worktree, run `npm run format`, inspect the
   complete formatter diff, and include only intended formatting. Then invoke
   `verification-router` (or the `gates` skill when scope is already clear) and run the one
   smallest sufficient gate it selects. Default PR-ready work uses
   `npm run verify:pr-local`; inspect its selection with `--dry-run` when uncertain. For
   UI/routing/styling, prove the affected journey first and add `verify:ui` only for shared UI
   foundations or when the router says its distinct coverage is necessary. Never stack
   `verify:cheap` + `verify:ui` + `verify:release` by default.
   - Touched `src/app/`, `src/components/`, or `tests/` (or design-system adoption
     inputs): run `npm run design-system:adoption:update` and stage any regenerated
     `docs/design-system/adoption-manifest.json` / marked COMPONENTS/ADOPTION sections
     before push. Pre-commit syncs this when hooks are installed; Cloud agents that
     bypass hooks still need the explicit update or static-pr + coverage fail together
     (PR #1782).
   - Touched Supabase env/config: `npm run check:supabase-project` (provider — confirm first).
     Do not claim a gate passed unless it actually ran. Paste the decisive proof line (for example,
     the test count or named check success), not only exit code 0.
4. **Commit** with a clear message, then verify the new commit has your message, only your intended
   paths (`git show --name-only --format=fuller HEAD`), and the same branch name recorded in step 1.
   End the message with:
   `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
5. **Push** the feature branch: `git push -u origin <branch>`. Per-PR auto-merge state is user-owned:
   automation must not disable or re-enable it. If the branch already has an open PR with auto-merge
   armed, an ordinary fast-forward push (this step) is still safe — GitHub re-validates required
   checks against the new head before it merges. Never force-push, rewrite history, or change the
   branch/base while auto-merge is armed; that alone stays frozen until the PR merges or the user
   manually changes that state. Never pipe the push through `tail`,
   `head`, or another command that can mask its status. Confirm the remote tip equals local HEAD
   with `git ls-remote` before reporting success. The pre-push guards run
   (auto-merge sentinel, format, drift) — heed a block rather than overriding blindly.

   **Restarting a branch whose PR already merged:** GitHub deletes the remote branch on merge,
   so the local `origin/<branch>` ref is stale and `--force-with-lease` fails with `stale info`
   before it ever reaches the remote. That is not a lease violation to override — run
   `git remote prune origin` and push normally. There is nothing to force: the branch no longer
   exists remotely, so the push creates it fresh. Observed 2026-08-14 restarting this branch
   after PR #1944 merged.

6. **Open a PR** with `gh pr create --base main`, body ending with the Claude Code
   attribution line. Write the body from `.github/pull_request_template.md` in full normal
   prose — exact `## Summary` / `## Verification` / `## Risk and rollout` / (when clinical-risk
   or RAG-ranking files are touched) `## Clinical Governance Preflight` headings, every governance
   box checked, and a satisfying `RAG impact:` line — never caveman-compressed; `pr-policy.yml`
   parses this text verbatim and hard-blocks the merge on a paraphrased or dropped item (see
   AGENTS.md "External skill precedence"). Enabling squash-auto-merge is the repo norm but
   requires explicit user confirmation before enabling (`gh pr merge --squash --auto`); the
   PR lands on green.
7. **Record** the review with `npm run ledger:append`, passing `--ref <branch>`, `--head`
   (the full 40-character SHA), `--scope`, `--outcome`, and `--checks`. Do not hand-write
   the row into `docs/branch-review-ledger.md`.
8. **Stop.** Report the PR URL and a short summary, then end the turn. Do not follow the
   PR from here — no CI polling, no `gh run watch`, no re-runs, no branch sync, no replies
   to review bots, no `Monitor`/`ScheduleWakeup`/cron parked on it. That tail is the
   wasted-usage loop AGENTS.md "Stop when the pull request is open" rules out, and
   `.claude/hooks/pr-handoff-stop.sh` denies those commands, the equivalent GitHub MCP
   tools, and that loop machinery for the rest of the session.

## Requires explicit confirmation (do not do automatically)

Merging into a protected branch, enabling auto-merge (`gh pr merge --squash --auto`),
force-push, rebasing a shared branch, deleting/renaming branches, `git reset --hard`,
`git clean -fd`, or any provider-touching verification.
