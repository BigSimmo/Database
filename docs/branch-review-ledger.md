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

| Date       | Branch or ref             | Reviewed HEAD                            | Scope                        | Outcome                                                                                                                                                                                         | Checks                                                                                                                                                                                                                                              |
| ---------- | ------------------------- | ---------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-09 | example/branch            | abc1234                                  | branch-cleanup               | Example: already merged into `main`; no unique patch content.                                                                                                                                   | `git log --right-only --cherry-pick main...example/branch`; `git diff --name-status main...example/branch`                                                                                                                                          |
| 2026-07-10 | codex/review-autofix-flow | 155c801cd58f797037d8aaa8b885405a1c599249 | codex-autofix-flow           | Fixed exact connector authorization, trusted-marker deduplication, and strict self-trigger matching; added regression coverage.                                                                 | `npm run check:codex-autofix-workflow`; focused Vitest (4 passed); `npm run verify:cheap` pre-test stages passed before tool timeout; `npm test` (1,415 passed, 1 skipped); focused Prettier check; `npm run check:github-actions`                  |
| 2026-07-10 | codex/review-autofix-flow | 155c801cd58f797037d8aaa8b885405a1c599249 | codex-autofix-flow-followup  | Fixed untrusted workflow-level concurrency interference and migrated the bridge from the Node 20 action runtime to `actions/github-script@v9`; added direct embedded-script execution coverage. | Focused Vitest (13 passed); targeted ESLint; `tsc --noEmit`; `npm run check:codex-autofix-workflow`; `npm run check:github-actions`; focused Prettier check; `git diff --check`                                                                     |
| 2026-07-10 | codex/review-autofix-flow | 155c801cd58f797037d8aaa8b885405a1c599249 | codex-autofix-residual-fixes | Replaced one-shot PR deduplication with a three-cycle head-SHA cap, made comment permission failures fail visibly, and pinned `github-script` v9.0.0 to its verified immutable commit.          | TDD red run (7 expected failures); focused Vitest green run (15 passed); `npm run verify:cheap` (152 files passed, 1 skipped; 1,426 tests passed, 1 skipped); focused Prettier check; `git diff --check`; official `git ls-remote` tag verification |
