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

| Date       | Branch or ref                 | Reviewed HEAD                            | Scope                                      | Outcome                                                                                                | Checks                                                                                                                                                                                                        |
| ---------- | ----------------------------- | ---------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-09 | example/branch                | abc1234                                  | branch-cleanup                             | Example: already merged into `main`; no unique patch content.                                          | `git log --right-only --cherry-pick main...example/branch`; `git diff --name-status main...example/branch`                                                                                                    |
| 2026-07-10 | codex/pr-testing-streamlining | 155c801cd58f797037d8aaa8b885405a1c599249 | working-tree diff: PR testing streamlining | Changes requested: 2 P1 clinical-gate defects and 7 P2/P3 scope, local parity, and UI-process defects. | `npm run check:ci-scope`; `npm run check:github-actions`; `npm run check:codex-autofix-workflow`; `npm run eval:rag:offline`; `npm run test:e2e:critical`; targeted scope classifications; `git diff --check` |
| 2026-07-10 | codex/pr-testing-streamlining | 155c801cd58f797037d8aaa8b885405a1c599249 | working-tree remediation review            | All recorded P1-P3 findings fixed; no remaining high-confidence issue in the changed scope.            | `npm run verify:cheap`; `npm run verify:pr-local`; `npm run eval:rag:offline`; `npm run test:e2e:critical`; `npm run test:e2e:advisory`; CI YAML parse; scope/action/Codex guards; `git diff --check`         |
