# Phase 4: Canonical Render Policy

## Purpose

Prevent noisy answer panels by rendering from a normalized display policy instead of raw `RagAnswer` field presence.

## Implemented

- Added `src/lib/answer-render-policy.ts` as the canonical policy layer between `RagAnswer` and dashboard rendering.
- Introduced `AnswerRenderModel` with:
  - normalized trust: `unsupported`, `low`, `medium`, `high`
  - policy-approved `allowedBlocks`
  - deduplicated `primarySources`
  - capped `reviewSources`
  - capped `quoteCards`, `visualEvidence`, and `relatedDocuments`
  - deduplicated `evidenceRows`
  - warnings
  - `copyText`
  - optional `debugReasons` for QA/explainability
- Routed `ClinicalDashboard` optional evidence rendering through `AnswerRenderModel`.
- Preserved the raw `RagAnswer` payload for diagnostics and downstream metadata.
- Changed dashboard evidence drawers, source review lists, quote cards, image/table evidence, related documents, and bottom navigation counts to use policy-approved arrays.
- Hid recommendation-style optional extras for unsupported answers even when raw sources, quotes, images, and related documents are present.
- Restricted medium-trust answers to source status, source review, and evidence map instead of quote/related-document clutter.
- Capped high-trust optional evidence blocks.
- Dropped empty or placeholder quote cards before rendering.

## Display behavior

- Unsupported:
  - Shows source-gap answer, limited source review, and warnings.
  - Hides quote cards, visual evidence, related documents, and recommendation-style extras.
- Low trust:
  - Shows caution, source status, limited source review, warnings, and capped evidence map when available.
  - Avoids quote-card and related-document clutter.
- Medium trust:
  - Shows answer, source status, top sources, and evidence map.
  - Keeps optional quote/related evidence hidden.
- High trust:
  - Shows answer, source status, top sources, evidence map, and capped optional evidence blocks.

## Validation coverage added

- Unsupported answer with raw sources/extras present.
- Medium-confidence answer with many optional raw fields.
- High-confidence answer with duplicated evidence channels and optional block caps.
- Conflicting/duplicated answer-section evidence.
- Empty/placeholder supplemental quote content.

## Checks run

- `npm run test -- tests/answer-render-policy.test.ts tests/answer-formatting.test.ts tests/clinical-dashboard-search-utils.test.ts`
  - Passed: 18 tests.
- `npm run typecheck`
  - Passed.
- `npm run check:production-readiness`
  - Passed.
- `npm run ensure`
  - Confirmed local project server at `http://localhost:4298`.
- `npm run verify:ui`
  - Passed: 39 Chromium UI tests.

## Remaining risk

- Phase 4 does not improve retrieval relevance. The known Phase 0 retrieval misses remain future retrieval/source-selection work.
- The render policy is intentionally conservative. If clinicians later want medium-trust quote cards or visual evidence by default, that should be a policy change with tests rather than a dashboard raw-field condition.
