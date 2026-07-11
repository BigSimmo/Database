# Branch Review Ledger

Use this ledger to prevent repeated branch and PR reviews when the reviewed HEAD has not changed.

## Lookup Procedure

1. Identify the target branch or ref from the user request. If no target is named, use the current branch.
2. Resolve the current HEAD:

   ```powershell
   git rev-parse <branch-or-ref>
   ```

3. Search this file for a row with the same branch/ref, reviewed HEAD, and review scope.
4. If the HEAD and scope match an existing completed row, do not repeat the review. Summarize the prior outcome and ask before doing a fresh pass.
5. If the HEAD changed, or the user explicitly requests a fresh review, review the changed scope and append a new row.
6. For branch-cleanup passes, run this lookup before inspecting branch diffs so unchanged reviewed branches are filtered out early.

## Review Records

| Date       | Branch or ref                                          | Reviewed HEAD                            | Scope                                       | Outcome                                                                                                                                                                                                                                                                                                                                                    | Checks                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------ | ---------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-09 | example/branch                                         | abc1234                                  | branch-cleanup                              | Example: already merged into `main`; no unique patch content.                                                                                                                                                                                                                                                                                              | `git log --right-only --cherry-pick main...example/branch`; `git diff --name-status main...example/branch`                                                                                                      |
| 2026-07-11 | PR #461 / claude/differentials-search-ux-polish-f2ff06 | 0dca40a27af0bd6e25f48e65386fc15d8a601dab | open-PR review, unresolved comments, and CI | Confirmed the best-answer danger styling and zero-source checked state were already fixed at the reviewed head. Completed selection preservation by carrying `ids` through the presentations redirect and applying them to the comparison workflow; added a browser assertion. Reformatted the CodeRabbit-modified component that failed Static PR checks. | TypeScript; differentials/app-mode Vitest (32/32); focused Prettier; `git diff --check`. Browser proof delegated to hosted CI because Turbopack rejects the isolated worktree's external node_modules junction. |
