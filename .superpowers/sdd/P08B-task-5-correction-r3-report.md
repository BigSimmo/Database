# P08B Task 5 correction R3 report

## Scope

Corrected the verified R3 findings against rejected R2 HEAD `db405bf92dd615a27177061739104bd84b7516aa`. Task 6, providers, hosted systems, Docker, schema/migrations, deployment, publication, push, and PR work remained out of scope. The protected `1/` tree and unrelated rejected-review record were preserved.

## RED evidence

- `node scripts/run-vitest.mjs run tests/rag-context-pack.test.ts -t "joins safe same-document adjacency|partitions governed cache identity|omits action and population atoms"` — 4 expected failures: ranking-interleaved same-document chunks did not join; required-state-only cache changes were invisible; and action/population atoms truncated from synopsis and adjacent context were not detected.
- `node scripts/run-vitest.mjs run tests/rag-governed-corpus-retrieval.test.ts -t "issues document admission only"` — failed because an `uploaded_local` row incorrectly received a positive document admission receipt.
- After correcting the governed answer fixture to use a catalogue-valid Australian public source, the focused answer selector failed because the delivered comparison matrix retained the unreceipted source ID and its unique `9.87 x 10^9/L` value.

## Correction

- Packed the governed route selection before routing, artifact construction, related-document lookup, unsupported return, or source-only/extractive return. The legacy no-coverage path remains unchanged and keeps its predecessor loader/cache behavior.
- Recomputed delivered comparison matrices from the exact active packed result array, including the final generated/recovery selection.
- Reworked ordinary adjacency into deterministic identity-bucketed connected components so matching same-document chunks remain one admission unit even when ranking interleaves another document. Conflict admission units remain isolated and atomic.
- Centralized clinical action and population signals for query planning, extractive completion, and packing. Atomic detection now scans all serialized clinical evidence: content, retrieval synopsis, adjacent context, table fields/snippets, memory cards, and clinical-image table text.
- Extended serialization-preservation checks to memory-card count/content and clinical-image table text, while retaining canonical clinical-value/schedule detection for mmHg, milliseconds, ng/mL, tablet/puff quantities, and every-N schedules.
- Added required-subquestion state and canonical source-policy conflict state/member IDs to governed cache identity without changing the legacy no-coverage key branch.
- Restricted positive document receipt hydration to authoritative current `australian_public` metadata. Uploaded-local and international rows remain receiptless/fail-closed pending their own activation contracts.
- Added a genuine issued-receipt client-boundary fixture proving `context_pack_admission` is stripped.
- Kept `src/lib/rag/rag.ts` at the explicit 4,359-line cumulative Task 5 ceiling.

## GREEN evidence

- `node scripts/run-vitest.mjs run tests/rag-context-pack.test.ts tests/rag-context-budget.test.ts tests/rag-content-accuracy.test.ts tests/rag-claim-support.test.ts tests/table-fact-ranking.test.ts tests/rag-governed-corpus-retrieval.test.ts` — 6 files passed, 271 tests passed.
- `node scripts/run-vitest.mjs run tests/rag-answer-fallback.test.ts -t "packs governed source-only evidence before exposing extractive artifacts|fails governed unsupported output closed when admission hydration fails|recomputes governed source-only comparison artifacts from the packed corpus"` — 3 tests passed.
- `node scripts/run-vitest.mjs run tests/answer-client-payload.test.ts tests/rag-governed-corpus-retrieval.test.ts` — 2 files passed, 25 tests passed.
- `node scripts/run-vitest.mjs run tests/rag-generation-fingerprint.test.ts tests/rag-eval-source-governance.test.ts` — 2 files passed, 24 tests passed.
- `node scripts/run-vitest.mjs run tests/rag-governed-corpus-retrieval.test.ts tests/supabase-schema.test.ts` — 2 files passed, 151 tests passed.
- `node scripts/run-vitest.mjs run tests/rag-query-plan.test.ts tests/extractive-answer-formatting.test.ts` — 2 files passed, 171 tests passed.
- `npm run arbiter -- typecheck` — RUN; db scope never defers.
- `npm run typecheck` — final run passed; 11,878 input files and a gate receipt recorded. An earlier run found one implicit-any introduced while extracting shared packer options; it was corrected before the final pass.
- `npm run check:maintainability-budgets` — passed; `src/lib/rag/rag.ts` is 4,359/4,362 lines and satisfies the stricter Task 5 ceiling.
- Scoped Prettier write/check — all correction-owned product and test files use Prettier style.
- `git diff --check` — passed.

## Remaining boundaries

- Evidence is local/offline only. No provider, hosted Supabase, Docker, deployment, migration, push, or pull-request action was performed.
- Uploaded-local and international governed-v3 document receipts intentionally remain unavailable until P16 defines authoritative activation contracts.
- Fresh exact-head retrieval/specification and clinical-governance/privacy re-reviews are still required before Task 6 begins.
