# Branch Cleanup Guide

Last reviewed: 2026-07-04

This guide defines the safe branch cleanup path for this repository. It is written for branch hygiene only: do not use it to discard source work, resolve merge conflicts, merge product changes, or rewrite history.

For historical cleanup snapshots (frozen branch inventories and progress logs), see `docs/archive/`.

## Goals

- Keep `main`, the current working branch, and any branch with useful content not yet represented on `main`.
- Delete local or remote branches only when their patch content is already on `main` or the branch is explicitly not useful.
- Preserve dirty worktrees, checked-out branches, detached review worktrees, and uncommitted user work.
- Avoid force pushes, rebases, resets, broad cleanup, or deleting unknown branch state.

## Safety Rules

Before deleting anything:

1. Fetch and prune:

   ```powershell
   git fetch --prune origin
   ```

2. Confirm `main` and `origin/main`:

   ```powershell
   git rev-parse main origin/main
   ```

3. Check current worktree state:

   ```powershell
   git status --short --branch
   ```

4. Inspect worktrees:

   ```powershell
   git worktree list --porcelain
   ```

5. For each candidate branch, check whether it has patch content not on `main`:

   ```powershell
   git log --format="%h %s" --right-only --cherry-pick main...BRANCH_NAME
   git diff --name-status main...BRANCH_NAME
   ```

Delete a branch only when the cherry-pick-aware log is empty, or when the branch is deliberately rejected as not useful after review.

## Recommended Cleanup Order

1. Fetch and inspect current branch state with the commands above.
2. For each candidate branch, confirm patch-unique commits and file diffs against `main`.
3. Port, commit, or explicitly reject useful patch content before deleting any branch ref.
4. Remove detached worktrees only when clean, unneeded, and absent from active `git worktree list` output.

## Final Verification

After each cleanup pass:

```powershell
git fetch --prune origin
git branch --all --verbose --no-abbrev
git worktree list --porcelain
git status --short --branch
```

Expected invariant:

- `main` remains unchanged unless you intentionally merge or push there.
- The current dirty worktree remains untouched unless you explicitly choose to clean it.
- No branch with patch-unique commits is deleted unless its content was explicitly rejected or safely ported first.
