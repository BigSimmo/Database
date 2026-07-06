# Pre-Phase 2 Dirty Diff Classification

Date: 2026-06-29
Workspace: `C:\Dev\Apps\Database`
Branch: `codex/RAG_FIX`

## Purpose

Classify the two files that were already modified before Phase 1 so Phase 2 does not accidentally overwrite, revert, or mix unrelated work into the RAG answer-contract implementation.

## Current worktree context

The current worktree now includes Phase 1 API validation work plus the two pre-existing dirty files.

Pre-existing dirty files from Phase 0:

- `scripts/production-readiness.ts`
- `src/lib/rag.ts`

Phase 1 files added/modified later:

- `src/lib/validation/*`
- `src/app/api/documents/route.ts`
- `src/app/api/documents/[id]/route.ts`
- `src/app/api/documents/[id]/search/route.ts`
- `src/app/api/documents/[id]/reindex/route.ts`
- `src/app/api/ingestion/jobs/route.ts`
- `src/app/api/ingestion/quality/route.ts`
- `src/app/api/upload/route.ts`
- `tests/api-validation-contract.test.ts`
- `docs/search-rag-phase-1-api-validation.md`

## Diff classification

### `src/lib/rag.ts`

Diff summary:

- Removes `memoryCardAnswerLabel`.
- Removes `selectDiverseMemoryCards`.

Reference check:

- No references to `memoryCardAnswerLabel` or `selectDiverseMemoryCards` remain in `src`, `tests`, `scripts`, or `docs`.

Classification:

- Keep as intended pre-existing cleanup, or separate into its own cleanup checkpoint.
- Do not treat this as Phase 2 functionality.
- It does not appear to block Phase 2 because the removed functions are unreferenced.

Risk:

- Low functional risk if the search result is correct.
- Main risk is process hygiene: this cleanup is in the main RAG file, which Phase 2 will likely touch. If Phase 2 edits the same file, the cleanup and Phase 2 behavior change will be mixed unless separated by commit/checkpoint.

Recommended action before Phase 2:

- Keep the diff if this cleanup is intended.
- Prefer committing/checkpointing it separately from Phase 2 if commit workflow is desired.
- Do not revert unless the owner confirms the cleanup is unwanted.

### `scripts/production-readiness.ts`

Diff summary:

- Adds `hasFile(filePath)` helper.
- Removes `.env.local` from the service-role exposure scan list.
- Changes local override reporting so:
  - `.env.local` is still reported if present.
  - `.env` is reported if present.
  - a warning is emitted only when neither `.env.local` nor `.env` exists.

Classification:

- Keep as intended pre-existing production-readiness hardening.
- Separate from Phase 2. It is not RAG answer-routing work.

Risk:

- Low immediate risk: `npm run check:production-readiness` passed after Phase 1.
- Policy consideration: excluding `.env.local` from service-role exposure scanning is a deliberate safety/product decision. It may avoid reading local secret-heavy files, but it also means `.env.local` is not checked by that specific exposure scan.

Recommended action before Phase 2:

- Keep if the intended policy is not to scan `.env.local` for service-role exposure.
- If the intended policy is to scan `.env.local` without leaking values, adjust that script in a separate production-readiness task before Phase 2.
- Do not mix this file into Phase 2 RAG answer changes.

## Phase 2 safety decision

Safe to begin Phase 2 if:

- The user accepts the `src/lib/rag.ts` cleanup as pre-existing or separates it before Phase 2.
- The user accepts the production-readiness policy change as pre-existing or separates it before Phase 2.
- Phase 2 edits to `src/lib/rag.ts` are made carefully on top of the existing cleanup, without reintroducing deleted unused helpers.

Best process:

1. Treat `scripts/production-readiness.ts` as outside Phase 2 scope.
2. Treat the current `src/lib/rag.ts` deletion as pre-existing cleanup.
3. If Phase 2 changes `src/lib/rag.ts`, document that the file already contained the unused-helper cleanup before Phase 2 started.
