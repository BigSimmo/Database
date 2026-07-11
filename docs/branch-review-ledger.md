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

| Date       | Branch or ref                           | Reviewed HEAD                            | Scope                                  | Outcome                                                                                                                                                                                                                                                                                                                                          | Checks                                                                                                                                                                                                                                        |
| ---------- | --------------------------------------- | ---------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-09 | example/branch                          | abc1234                                  | branch-cleanup                         | Example: already merged into `main`; no unique patch content.                                                                                                                                                                                                                                                                                    | `git log --right-only --cherry-pick main...example/branch`; `git diff --name-status main...example/branch`                                                                                                                                    |
| 2026-07-11 | PR #481 / claude/perf-r2-auth-roundtrip | a21a2a9690e3a5c64d672255052c7fbf9b20f950 | open-PR review and unresolved comments | Two P2 findings fixed: cookie-authenticated API requests again return rotated SSR cookies, and route-boundary payload trimming preserves full source content required by client safety scanning while still removing server-only fields. Added focused regression coverage. No additional high-confidence defect was found in the six-file diff. | Focused proxy, payload, and clinical-safety Vitest (17/17); TypeScript; focused Prettier; `git diff --check`. Production readiness ran fail-closed with provider variables cleared and reported only expected missing provider configuration. |
