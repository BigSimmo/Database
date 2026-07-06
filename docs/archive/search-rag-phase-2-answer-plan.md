# Search/RAG Phase 2: Answer Plan Contract

Date: 2026-06-29
Workspace: `C:\Dev\Apps\Database`
Status: implemented

## Objective

Make `smartApiPlan.answerPlan` the explicit answer-generation contract rather than a loose display helper. The plan is now typed, inspectable, passed into model context, and logged in telemetry.

## Skills applied

- `ai-architecture-review`: model boundary, retrieval quality, route mode, fallback behavior, source policy, and observability.
- `frontend-architecture-review`: stable payload fields for UI/client inspection without requiring the frontend to infer route behavior from display mode alone.

## Implemented contract

`SmartRagAnswerPlan` now includes:

- `intent`: `clinical_synthesis`, `source_lookup`, `document_lookup`, or `unsupported`.
- `queryClass`: the classified RAG query class.
- `routeMode`: `fast`, `strong`, `extractive`, or `unsupported`.
- `modelStrategy`: `fast_model_then_quality_gate`, `strong_model_then_quality_gate`, `extractive_lookup`, or `source_gap`.
- `retrievalQuality`: `strong`, `partial`, `weak`, or `conflicting`.
- `qualityCriteria`: explicit quality gate labels.
- `fallbackBehavior`: `retry_strong_then_source_gap`, `source_gap`, or `extractive_lookup_only`.
- `sourcePolicy`: `required_citations`, `nearby_sources_allowed`, or `exact_source_links`.

## Routing policy changes

- Clinical synthesis is now the default for user-facing clinical content questions.
- Extractive mode is limited to explicit source/document lookup behavior:
  - source-support questions such as "what documents support..."
  - explicit document/file lookup
  - source location, page, quote, or citation requests
- Medication, dose, monitoring, threshold, risk, pathway, referral, and comparison questions avoid extractive clinical prose.
- Comparison questions now route to strong synthesis rather than fast synthesis.
- Weak-but-plausible evidence still routes to strong.
- Unsupported/source-gap behavior remains explicit and does not generate unsupported clinical advice.

## Generation context changes

The model input now includes explicit answer-plan metadata:

- `answer_plan.intent`
- `answer_plan.route_mode`
- `answer_plan.model_strategy`
- `answer_plan.retrieval_quality`
- `answer_plan.source_policy`
- `quality_gate`
- `fallback_behavior`

This gives the model a stable contract instead of relying on display mode or route reason alone.

## Telemetry changes

RAG query metadata now logs:

- `smart_api_answer_plan_intent`
- `smart_api_answer_plan_query_class`
- `smart_api_retrieval_quality`
- `smart_api_answer_route`
- `smart_api_model_strategy`
- `smart_api_fallback_behavior`
- `smart_api_quality_criteria`
- `smart_api_source_policy`

## Files changed

- `src/lib/types.ts`
- `src/lib/smart-rag-api.ts`
- `src/lib/rag-routing.ts`
- `src/lib/rag.ts`
- `tests/rag-routing.test.ts`
- `tests/smart-rag-api.test.ts`
- `tests/rag-answer-fallback.test.ts`

## Validation run

Focused Phase 2 tests:

```powershell
npm run test -- tests/rag-routing.test.ts tests/smart-rag-api.test.ts tests/rag-answer-fallback.test.ts
```

Result:

```text
Test Files  3 passed (3)
Tests       41 passed (41)
```

Typecheck:

```powershell
npm run typecheck
```

Result: passed.

Production readiness:

```powershell
npm run check:production-readiness
```

Result: passed against `Clinical KB Database (sjrfecxgysukkwxsowpy)`.

## Remaining risks for later phases

- Retrieval eval failures from Phase 0 remain expected and are not fixed by this contract phase alone.
- The answer plan is now explicit, but retrieval/ranking still needs Phase 3 work for active-community ED, agitation medication/table, flowchart, and dose-route cases.
- UI rendering still needs later source-panel/source-drawer tuning so the new plan is presented naturally rather than as extra machinery.
