# P08B Task 5 correction R2 report

## Scope

Corrected the accepted Task 5 review findings without starting Task 6. The correction keeps one context-pack authority, preserves the byte-exact legacy cache/loader branch, and does not add provider, hosted, schema, migration, deployment, or publication work.

## RED evidence

- `node scripts/run-vitest.mjs run tests/rag-context-pack.test.ts` — failed before production changes because the new authoritative admission boundary was absent (`Cannot find package '@/lib/rag/rag-context-admission'`).
- After the first implementation increment, the same selector ran 22 tests and exposed four remaining behavioral gaps: a mismatched-release fixture still carried a valid receipt, the old overlapping-family expectation conflicted with exact-family dedupe, the legal lane fixture used an ineligible role, and the omitted-source fixture was not truncation-sensitive.

## Correction

- Added an opaque server-issued context-pack admission receipt. Governed retrieval strips any inbound receipt, binds Clinical KB rows to the validated release/epoch/pending-exclusion result, and hydrates document owner/status/generation/publication receipt data at the authoritative server boundary. Missing or mismatched admission fails closed in the packer.
- Preserved local/shared RAG cache compatibility by reissuing a structurally valid cached receipt only inside the already validated cache clone boundary; ordinary structured clones remain untrusted and fail closed. The shared search-cache wire now carries that receipt, so the dependency namespace advances from `rag-cache-v21` to `rag-cache-v22` and cannot consume pre-receipt entries.
- Removed request-snapshot provenance synthesis from model-context selection.
- Changed family collapse to deterministic `[claimRole, complete sorted family set]` identity. Partial family overlaps survive, cross-role lanes cannot borrow eligibility, and conflict members bypass family collapse.
- Admitted verified source-policy conflict pairs as one atomic packing unit.
- Hashed every governed selection candidate and every governed result in cache identity while leaving the predecessor no-coverage branch unchanged.
- Reconciled served and retry selections, coverage, conflicts, generation, preview, citations, artifacts, related documents, numeric verification, and fallback paths to the exact packed result arrays.
- Recomputed cross-document fusion inside each generation attempt from that attempt's packed corpus.
- Extended the canonical clinical-value detector for milliseconds, tablet/puff quantities, and every-N schedules; population, action, exception, clinical-value, and structured-table groups are all truncation-sensitive.

## GREEN evidence

- `node scripts/run-vitest.mjs run tests/rag-context-pack.test.ts tests/rag-context-budget.test.ts tests/rag-content-accuracy.test.ts tests/rag-claim-support.test.ts tests/table-fact-ranking.test.ts tests/rag-governed-corpus-retrieval.test.ts` — 6 files passed, 265 tests passed.
- `node scripts/run-vitest.mjs run tests/rag-context-pack.test.ts tests/rag-cache-utils.test.ts tests/rag-cache-invalidation.test.ts tests/rag-site-content-freshness.test.ts` — 4 files passed, 64 tests passed.
- `node scripts/run-vitest.mjs run tests/rag-injection.test.ts tests/rag-trust.test.ts` — 2 files passed, 61 tests passed.
- `npm run arbiter -- typecheck` — RUN; db scope never defers.
- `npm run typecheck` — passed; 11,744 input files, receipt recorded.
- `npm run check:maintainability-budgets` — passed; `src/lib/rag/rag.ts` is 4,360/4,362 lines.
- Scoped Prettier — passed for all correction-owned product and test files.
- `git diff --check` — passed.

The first typecheck correctly failed because the exhaustive client source-field policy did not yet classify the new server-only field and two new test fixtures were incomplete. Those compile issues were corrected; the final typecheck above is green.

## Remaining boundaries

- Evidence is local/offline only. No provider, hosted Supabase, Docker, deployment, migration, push, or pull-request action was run.
- The authoritative document admission hydration depends on the existing Supabase relationship between `document_chunks` and `documents`; read failure leaves the retrieval result unreceipted so governed packing omits it.
