# Phase 5.5b: Visual Retrieval And Supported-Answer Recovery

## Diagnosis

Phase 5.5 fixed the first set of targeted retrieval misses, but the follow-up eval still showed two retrieval defects and a separate RAG-eval visibility problem:

- `show-source-table-image` needed source-image/table evidence and the clinical term `ANC` in the selected top results.
- `flowchart-next-step` needed risk/red-zone flowchart evidence, not a generic flowchart or generic risk overview.
- RAG eval failures did not show enough source identity detail to tell whether the expected document was absent, present but outside the match window, or present under a different file/source identity.
- Some source-backed routine answers could still be converted to unsupported when the final quality gate failed only a recoverable query-overlap or query-intent heuristic.

## Implemented Contract

- Retrieval intent now distinguishes source-image requests, exact visual-table requests, and risk/red-zone flowchart requests.
- Source selection now records and boosts `source_image`, `visual_table`, `risk`, and `red_zone` signals.
- Text retrieval query construction now preserves source-image/table terms for visual requests and risk/red-zone/next-step terms for flowchart requests.
- RAG answer/search cache dependency version was bumped because retrieval behavior changed.
- RAG eval JSON now includes expected, matched, missing, and retrieved source identity diagnostics plus answer-plan retrieval intent/source-selection metadata.
- Final answer quality recovery is intentionally narrow: it only preserves grounded, cited answers with strong selected sources when the failing reason is `missing_query_intent` or `missing_query_overlap`.

## Validation Targets

- `tests/retrieval-selection.test.ts`
- `tests/retrieval-query-variants.test.ts`
- `tests/rag-answer-fallback.test.ts`
- `npm run eval:retrieval:quality`
- `npm run eval:rag -- --limit 20 --json`

Do not move to Phase 6 until the two remaining targeted retrieval cases and the source-backed routine answer regressions are reviewed with the new diagnostics.

## Implementation status - 2026-06-29

Implemented in this pass:

- Added retrieval intent signals for source-image requests, exact visual tables, risk/red-zone flowcharts, admission-community title aliases, and discharge title aliases.
- Added ranking and query-variant support for source table images, flowchart next-step queries, admission of community patients, and discharge summary/documentation queries.
- Added direct document title-alias rescue inside the document lookup fast path, preserving existing owner/document filters and reusing the existing best-chunk selection path.
- Added source identity diagnostics to the RAG eval JSON output and alias-aware expected-file coverage for legacy eval file names.
- Added source-backed generation-timeout recovery that first attempts deterministic extractive synthesis, then falls back to a cited source-status answer when extraction is ungrounded or fragment-like.
- Kept max-output/incomplete generation failures fail-closed; those do not use the source-backed timeout recovery.

Validation results:

- `npm run test -- tests/eval-search.test.ts tests/eval-utils.test.ts tests/clinical-search.test.ts tests/retrieval-selection.test.ts tests/retrieval-query-variants.test.ts tests/rag-answer-fallback.test.ts`: 6 files, 84 tests passed.
- `npm run typecheck`: passed.
- `npm run eval:retrieval:quality`: 10/10 cases passed; document_recall@5=1, content_recall@5=1, top_k_hit_rate=1, failed_cases=0.
- `npm run eval:rag -- --limit 20 --json`: 20/20 supported cases grounded, 20/20 expected-file hits, 0 case-level failures.
- Remaining non-case threshold: `routine extractive p95 over 2000ms`, caused by provider timeout fallback cases waiting for generation timeout before returning cited extractive/source-status output.
- `npm run check:production-readiness`: passed.

Phase 5.5 is functionally clean for retrieval/source-selection correctness. The remaining latency-only threshold should be handled as performance work, not as a retrieval correctness blocker.
