---
name: prlanded
description: Verify a merged PR actually landed correctly in this repo and clean up after it. Use right after a PR merges (especially squash + auto-merge) to confirm the squashed commit matches your branch by content, catch late commits that were orphaned by the auto-merge race, and update the ledger and memory.
---

# prlanded — confirm a merge landed and tidy up

This repo squash-merges and auto-merges `claude/*` on green, which has twice orphaned a
late follow-up commit and once needed a fix-forward. Run this after a merge to confirm the
work actually landed and to clean up.

## Steps

1. **Confirm the merge:** `gh pr view <pr> --json state,mergeCommit,mergedAt` → `MERGED`.
2. **Verify by content, not ancestry** (squash rewrites history, so `git branch --merged`
   is misleading). Diff your branch tip against merged `main`:
   ```bash
   git fetch --quiet origin main
   git diff --stat origin/main...<your-branch>
   ```
   An empty diff means everything landed. Any remaining lines are work that did NOT make
   it — the classic auto-merge race. Investigate before deleting the branch.
3. **Check for orphaned late commits:** if you pushed after enabling auto-merge, confirm
   those commits are in the squashed result (search the merge commit / `git log origin/main`
   for their content). If missing, fix-forward with a new PR — do not force-push.
4. **Clean up the branch** only once the content diff is empty: the PR's
   `--delete-branch` handles the remote; prune locally with `git worktree remove` +
   `git branch -d <branch>` (never `-D`/force unless you have confirmed it is fully landed).
5. **Update the ledger** (`docs/branch-review-ledger.md`) and any relevant memory note with
   the merged HEAD SHA and outcome.

## Notes

- Do not re-review a branch/HEAD already recorded in the ledger for the same scope.
- If the content diff is non-empty and you are unsure why, stop and report rather than
  deleting anything.
