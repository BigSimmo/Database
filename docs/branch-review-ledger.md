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

| Date       | Branch or ref                                | Reviewed HEAD                            | Scope                        | Outcome                                                                                                                                                                                                                                               | Checks                                                                                                                                                                                   |
| ---------- | -------------------------------------------- | ---------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-09 | example/branch                               | abc1234                                  | branch-cleanup               | Example: already merged into `main`; no unique patch content.                                                                                                                                                                                         | `git log --right-only --cherry-pick main...example/branch`; `git diff --name-status main...example/branch`                                                                               |
| 2026-07-10 | claude/llm-pipeline-review                   | 009e85c6be437d98dd868d26cc797327bf8fc377 | code-quality-review          | Resolved 1 P2 duplicate href helper issue (unified registryCitationHref in citations.ts with registryCorpusDetailHref in registry-corpus-links.ts). All tests pass.                                                                                   | `git status`; `git diff origin/main...HEAD`; `npm run verify:cheap` (all 1446 unit tests passed)                                                                                         |
| 2026-07-11 | claude/differentials-search-ux-polish-f2ff06 | 648abfa3f7c91395b5eeca543f70e0b6ea59e9e0 | launch-readiness remediation | Local remediation and offline acceptance complete. Live apply stopped before mutation because linked migration history diverges: live-only `20260708150150`/`20260709062443`, plus local pending versions outside the authorized three-migration set. | Focused Vitest; `verify:cheap`; PR-local lanes; build + client scan; critical Chromium (5/5); offline RAG (36/36); local migration replay; project identity + linked migration inventory |
