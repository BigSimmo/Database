---
name: prlanded
description: Verify a merged PR actually landed correctly in this repo and clean up after it. Use right after a PR merges (especially squash + auto-merge) to confirm the squashed commit matches your branch by content, catch late commits that were orphaned by the auto-merge race, and update the ledger and memory.
---

# prlanded — confirm a merge landed and tidy up

This repo squash-merges and auto-merges `claude/*` on green, which has twice orphaned a
late follow-up commit and once needed a fix-forward. Run this after a merge to confirm the
work actually landed and to clean up.

## Steps

The user's explicit request to verify a named PR authorizes the read-only PR lookup for that target.
Otherwise ask before GitHub access; never infer provider authority merely from local branch state.

1. **Confirm the merge:** `gh pr view <pr> --json state,mergeCommit,mergedAt` → `MERGED`.
2. **Verify by content, not ancestry** (squash rewrites history, so `git branch --merged`
   is misleading). Compare trees, and compare against the squash commit:

   ```bash
   git fetch --quiet origin main
   git diff --stat <squash-commit> <your-branch-tip>
   ```

   An empty diff means everything landed. Any remaining lines are work that did NOT make
   it — the classic auto-merge race. Investigate before deleting the branch.

   Do not use three-dot `origin/main...<branch>` here. It diffs from the merge base, which
   after a squash is still the pre-merge `main`, so it replays the branch's own delta and
   reports a false orphan on every fresh merge. Two-dot against the squash commit is a tree
   comparison and stays correct after other PRs land on `main`.

3. **Check for orphaned late commits:** if you pushed after enabling auto-merge, confirm
   those commits are in the squashed result (search the merge commit / `git log origin/main`
   for their content). If missing, fix-forward with a new PR — do not force-push.
4. **Prepare cleanup only after the content diff is empty.** Worktree removal, remote branch
   deletion, and `git branch -D` are destructive and require an explicit cleanup request. Resolve
   and validate the exact worktree path from a different worktree, then report the commands or run
   them only within that authorization. For squash-merged branches, explain why `-d` refuses and
   why `-D` would be needed; empty content proof is necessary but does not itself authorize deletion.
5. **Update the ledger** with `npm run ledger:append`, passing `--ref <branch>`, `--head`
   (the merged squash commit's full 40-character SHA, not an abbreviation),
   `--scope prlanded`, `--outcome`, and `--checks`, plus any relevant memory note.

## Notes

- Do not re-review a branch/HEAD already recorded in the ledger for the same scope.
- If the content diff is non-empty and you are unsure why, stop and report rather than
  deleting anything.
