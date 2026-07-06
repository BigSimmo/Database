# Phase 5.5: Retrieval Quality And Source Selection Contract

## Purpose

Fix the remaining retrieval/source-selection failures before final security hardening.

This phase keeps the model composer and render policy from Phases 2-5 intact. The change is upstream: make the selected evidence better, typed, inspectable, and regression-tested before the model receives it.

## Implemented

- Added `src/lib/retrieval-selection.ts` as a deterministic retrieval intent and source-selection layer.
- Added typed retrieval contracts in `src/lib/types.ts`:
  - `RetrievalIntent`
  - `RetrievalCandidate`
  - `RetrievalChunkType`
  - `RetrievalSelectionSummary`
- Added answer-plan source-selection metadata through `SmartRagAnswerPlan`.
- Integrated retrieval selection into `searchChunksWithTelemetry` before fast-path, document-lookup, coverage-gate, hybrid, and vector-fallback results are returned.
- Bumped the RAG search cache dependency version to avoid serving stale pre-selection search order.
- Added source-selection telemetry for:
  - retrieval intent
  - selected/candidate counts
  - matched and missing required signals
  - rescue activation
  - top selected chunk types
- Added answer-generation context lines so the model sees required retrieval signals and source-selection status.

## Fixed target classes

- Active-community ED queries now get deterministic patient/community/ED source rescue.
- Agitation IM/PO route questions now promote medication-chart route evidence without requiring a numeric dose.
- Flowchart next-step questions now promote flowchart/pathway/action evidence.
- Medication chart dose-route questions now require dose amount plus route support when the query asks for dose detail.

## Regression coverage

- `tests/retrieval-selection.test.ts` covers the four Phase 0 failure shapes:
  - active-community ED
  - agitation IM/PO options
  - red-zone flowchart next step
  - agitation medication-chart dose route
- `tests/smart-rag-api.test.ts` now asserts answer plans expose retrieval intent and source-selection summaries.

## Exit criteria mapping

- The four Phase 0 retrieval misses are covered by focused regression tests.
- Medication/table/flowchart/patient-education retrieval has deterministic rescue behavior.
- Retrieval quality now considers missing required source-selection signals.
- Source-gap behavior is preserved: missing required retrieval signals downgrade retrieval quality instead of encouraging unsupported synthesis.
- Phases 2-5 are preserved because the model still receives a bounded answer plan, valid evidence IDs, and the canonical render policy remains unchanged.
