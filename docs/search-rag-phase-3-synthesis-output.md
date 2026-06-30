# Phase 3: Synthesis Prompt And Structured Output Hardening

## Purpose

Make the model the final clinical composer while keeping generated output grounded, evidence-ID constrained, and machine-validated before it reaches the user.

## Implemented

- Reframed generation instructions around composing a complete clinical answer, not summarizing snippets or stitching source fragments.
- Strengthened the answer field contract so the first sentence must be complete prose and directly answer the user question.
- Added explicit evidence-ID rules to the model instructions and answer input.
- Added `valid_evidence_chunk_ids` and an evidence contract to the generated answer input.
- Tightened structured schema descriptions for citations, quote cards, and answer-section evidence IDs.
- Preserved existing runtime schema enum constraints for retrieved chunk IDs across citations, quote cards, answer sections, and conflicts/gaps.
- Bumped the answer generation prompt cache key from `clinical-rag-answer-v12` to `clinical-rag-answer-v13`.
- Added deterministic validation for incomplete/source-heading opening sentences.
- Made invalid model citation IDs observable through routing reasons instead of silently treating them as generic unsupported output.
- Added fast-to-strong retry for invalid evidence IDs and general fast quality-gate failures.
- Added strong-model quality repair for deterministic validation failures, including invalid evidence IDs and incomplete opening sentences.
- Preserved fail-closed behavior after strong repair: weak or unsupported answers return source-gap output rather than stitched extractive clinical prose.

## Validation coverage added

- Schema enum constraints now assert retrieved chunk ID enums for citations, quote cards, answer-section `citation_chunk_ids`, and conflict/gap source IDs.
- Invalid fast-model evidence IDs now trigger a strong retry and keep only valid retrieved evidence in the final answer.
- Source-heading first answers, such as `Dosage and monitoring.`, now fail closed to a source-gap response instead of surfacing as clinical prose.

## Checks run

- `npm run test -- tests/rag-answer-fallback.test.ts tests/rag-routing.test.ts tests/smart-rag-api.test.ts`
  - Passed: 43 tests.
- `npm run typecheck`
  - Passed.
- `npm run check:production-readiness`
  - Passed.

## Remaining Phase 3 risk

- This phase hardens generation and output validation. It does not fix the Phase 0 retrieval misses for active-community ED, agitation medication/table, flowchart, or dose-route retrieval cases.
- Retrieval-quality failures remain Phase 4 work unless the phase plan is renumbered.
