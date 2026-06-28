# Branch Cleanup Guide

Last reviewed: 2026-06-28

This guide defines the safe branch cleanup path for this repository. It is written for branch hygiene only: do not use it to discard source work, resolve merge conflicts, merge product changes, or rewrite history.

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

## Current Branch State

Baseline:

- `main` and `origin/main`: `9bad09523` (`Merge pull request #83 from BigSimmo/codex/80-20-remediation`)
- Current branch: `codex/rag-retry-telemetry-main`
- Current branch status: behind `origin/codex/rag-retry-telemetry-main` by 1 commit, with substantial uncommitted source changes. Do not switch, reset, or clean this worktree as part of branch cleanup.

## Cleanup Progress

Completed on 2026-06-28:

- Deleted local branch `claude/quizzical-bhaskara-97feda` after confirming it had no patch-unique content beyond `main`.
- Deleted remote branch `origin/revert-72-codex/backup-20260623-233849` after confirming it was only the rollback branch for `Save Codex changes`.
- Removed clean detached worktrees `C:\Dev\Apps\Database-80-20-clean` and `C:\Users\joshs\.codex\worktrees\4468\Database` after confirming their HEAD commits were contained in `main`.
- Reviewed `origin/fix/rag-pipeline-stage3-generation`, `claude/recursing-agnesi-28f476`, and `codex/80-20-remediation`; kept them because they still contain useful or not-yet-committed work.
- Reviewed `copilot/simplify-operational-tooling`; rejected it as a branch to preserve because useful source/test overlap is covered by the current dirty tree or `codex/80-20-remediation`, while the remaining unique content is generated/local agent files, broad dependency-repair tooling, or duplicated env/startup patterns.

Windows left some unregistered `.claude/worktrees/*` folders locked on disk during cleanup. Treat those as filesystem leftovers, not branch refs, after confirming they do not appear in `git worktree list --porcelain`.

## Delete Candidates Already On Main

These add no patch content beyond `main`:

- None known after the 2026-06-28 cleanup pass.

## Keep For Review

These have patch content not represented on `main`. Do not delete before review.

### `claude/recursing-agnesi-28f476`

Status:

- Local branch checked out in `C:\Dev\Apps\Database\.claude\worktrees\recursing-agnesi-28f476`
- 3 patch-unique commits
- 18 files changed

Content:

- Node 24 / npm 11 runtime requirement work.
- Retrieval and ingestion performance work.
- HNSW `ef_search = 100` migration and schema updates.
- Changes touch `src/lib/rag.ts`, worker code, runtime scripts, docs, and tests.

Recommendation:

- Keep.
- Review and salvage selectively.
- Do not merge wholesale until conflicts with current `main` are resolved and runtime expectations are confirmed.
- The local dirty worktree already appears to include Node 24/npm 11, HNSW `ef_search`, and related committed-generation work. Delete this branch only after that work is committed, ported, or explicitly rejected.

### `codex/80-20-remediation`

Status:

- Local branch only; upstream branch was deleted after its remote content was confirmed merged.
- 8 patch-unique commits
- 19 files changed

Content:

- Additional local remediation beyond the already merged PR #83 branch.
- Eval/search privacy fixes.
- Relevance score component.
- Chunking, image filtering, answer formatting, search interaction, and UI smoke test updates.

Recommendation:

- Keep for review.
- Cherry-pick or port useful fixes after comparing against current uncommitted work on `codex/rag-retry-telemetry-main`.
- Delete only after useful changes are merged or consciously rejected.
- Review found unported-looking pieces such as `src/components/clinical-dashboard/relevance-score.ts`, `tests/document-relevance-score.test.ts`, and `tests/search-interaction-route.test.ts`, so this branch should remain until those are accepted or rejected.

### `copilot/simplify-operational-tooling`

Status:

- Local branch only; remote branch was deleted because its remote patch content was already represented on `main`.
- 3 patch-unique local commits
- 113 files changed
- Rejected during phase 3 cleanup review.

Content:

- Large mixed branch with tooling scripts, local agent skill files, Node/runtime updates, mockups, dashboard and profile UI work, answer formatting changes, and broad tests.

Recommendation:

- Delete the local branch ref.
- Do not port `.agents/**`, `skills-lock.json`, `scripts/repair-node-modules.cjs`, `scripts/ensure-next-runtime.mjs`, `scripts/next-build.mjs`, or `scripts/run-local-tool.mjs` from this branch.
- Do not port `src/lib/startup-check.ts` or `src/lib/supabase/env.ts`; current env handling already lives in `src/lib/env.ts`, `src/lib/supabase/client.tsx`, `scripts/check-ci-env.mjs`, and Supabase project checks.
- Keep using `codex/80-20-remediation` as the review source for `relevance-score`, search interaction/eval privacy fixes, and focused tests.

## Remote Branches Not On Main

### `origin/claude/recursing-agnesi-28f476`

Status:

- 1 patch-unique commit
- 14 files changed

Content:

- Remote subset of the local `claude/recursing-agnesi-28f476` work, mainly Node 24 / npm 11 runtime requirement changes.

Recommendation:

- Keep while local `claude/recursing-agnesi-28f476` is under review.
- Delete remote only after deciding whether to keep the runtime upgrade work.

### `origin/fix/rag-pipeline-stage3-generation`

Status:

- 1 patch-unique commit
- 7 files changed
- Reviewed during cleanup pass and kept.

Content:

- Old Stage 3 generation safety fixes.
- Touches answer verification, RAG routing, RAG trust tests, and ingestion retry route.
- Also includes committed-index-generation filtering in RAG source expansion and answer-prose guardrails.

Recommendation:

- Keep for clinical-safety review.
- Compare against current answer verification and ingestion retry code before deciding.
- If still relevant, port the useful tests/fixes rather than merging blindly.
- Current dirty worktree already appears to contain the numeric-verification fixes, retry-route TOCTOU guard, committed-index-generation filtering, and answer prose guardrails. Keep the branch until those changes are committed or safely represented elsewhere.

## Detached Worktrees

These are not branch refs, so do not treat them as branch cleanup until inspected separately.

Removed after clean/main-contained verification:

- `C:\Dev\Apps\Database-80-20-clean`
- `C:\Users\joshs\.codex\worktrees\4468\Database`

Required checks before removing either:

```powershell
git -C PATH status --short --branch
git -C PATH log -1 --oneline
git worktree list --porcelain
```

Remove only if clean and no longer needed:

```powershell
git worktree remove PATH
```

## Recommended Next Cleanup Order

1. Commit, port, or explicitly reject the current dirty work that appears to subsume `origin/fix/rag-pipeline-stage3-generation` and parts of `claude/recursing-agnesi-28f476`.
2. Review local `codex/80-20-remediation`; port useful extra remediation or delete.
3. Delete reviewed branches only after their useful changes are either represented in committed history or intentionally rejected.

## Final Verification

After each cleanup pass:

```powershell
git fetch --prune origin
git branch --all --verbose --no-abbrev
git worktree list --porcelain
git status --short --branch
```

Expected invariant:

- `main` remains unchanged.
- The current dirty worktree remains untouched.
- No branch with patch-unique commits is deleted unless its content was explicitly rejected or safely ported first.
