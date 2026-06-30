# Search/RAG Phase 0 Baseline

Date: 2026-06-29
Workspace: `C:\Dev\Apps\Database`
Branch: `codex/RAG_FIX`

## Phase 0 purpose

Establish the current search/RAG behavior before changing logic. The main question for Phase 0 is whether the poor answer experience is caused by missing tests, retrieval drift, routing policy, rendering policy, model synthesis policy, or API-contract inconsistency.

## Phase 0 checklist reconciliation

Phase 0 checklist status:

- Branch and dirty worktree state recorded before Phase 1 edits.
- Answer flow ownership mapped through `src/lib/rag.ts`, `src/lib/rag-routing.ts`, `src/lib/smart-rag-api.ts`, `src/lib/openai.ts`, `src/lib/types.ts`, and the answer API routes.
- Source display ownership mapped through `src/components/ClinicalDashboard.tsx`, `src/lib/ward-output.ts`, and `src/lib/answer-formatting.ts`.
- Validation helper and document routing ownership mapped through `src/app/api/documents`, `src/app/api/jobs`, `src/app/api/ingestion`, and `src/app/api/upload`.
- Current query classes and route modes captured from the RAG unit tests and eval outputs.
- Model defaults identified in `src/lib/env.ts`, `.env.example`, and non-secret local env keys.
- Current Next.js route-handler guidance checked from local `node_modules/next/dist/docs/` before API route work.
- Baseline commands were run and their failures/passes are documented below.
- Current eval failures are documented as pre-existing Phase 0 baseline behavior.
- Concrete implementation and test file candidates are listed for later phases.

## Skills applied

- `api-review`: API route contracts, validation drift, auth/error boundaries, schema-first input handling.
- `ai-architecture-review`: retrieval, answer planning, model synthesis, citations, fallbacks, evals, latency/cost.
- `repo-auditor`: ownership map and duplicated helper surfaces.
- `testing-review`: baseline coverage and missing acceptance tests.
- `release-readiness-review`: verification gates and production-readiness implications.

## Current repo state

Current branch:

```text
## codex/RAG_FIX
 M scripts/production-readiness.ts
 M src/lib/rag.ts
?? docs/search-rag-master-context.md
?? docs/search-rag-master-plan.md
```

Existing modified files before this Phase 0 report:

```text
scripts/production-readiness.ts
src/lib/rag.ts
```

Recent branch context:

```text
3cedd60b2 (HEAD -> codex/RAG_FIX, origin/main, origin/HEAD, main, claude/work, claude/CLAUDE_BRANCH) Merge pull request #105 from BigSimmo/feature/production-readiness-review
d148b3071 fix: use pop-in animation for top-aligned mobile sheets to fix CI test
c6edf8616 fix: resolve PR #105 comments for workflow tags and HR abbreviations
810246f66 feat: production-readiness reliability, CI gates, and DB governance
a3c82c410 fix: address RAG review comments on toxicity gates, neutrophil terms, monitoring ranges, and extractive quality filtering
```

Important note: `scripts/production-readiness.ts` and `src/lib/rag.ts` were already modified when Phase 0 started. They must be treated as pre-existing work unless the next implementation phase deliberately owns them.

## Package/runtime baseline

- Package manager: `npm@11.17.0`
- Node engine: `24.x`
- npm engine: `11.x`
- Framework/runtime: `next@16.2.9`, `react@19.2.7`
- OpenAI SDK: `openai@^6.45.0`
- Validation library: `zod@^4.4.3`
- Test runner: `vitest@4.1.8`

## Model and OpenAI environment source of truth

`src/lib/env.ts`, `.env.example`, and local non-secret model keys currently align around:

```text
OPENAI_ANSWER_MODEL=gpt-5.5
OPENAI_FAST_ANSWER_MODEL=gpt-5.5
OPENAI_STRONG_ANSWER_MODEL=gpt-5.5-pro
OPENAI_MAX_OUTPUT_TOKENS=4000
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
OPENAI_VISION_MODEL=gpt-5.5
OPENAI_REQUEST_TIMEOUT_MS=45000
OPENAI_ANSWER_TIMEOUT_MS=12000
OPENAI_MAX_RETRIES=2
OPENAI_GENERATION_MAX_RETRIES=0
OPENAI_PROMPT_CACHE_RETENTION=24h
OPENAI_STORE_RESPONSES=false
OPENAI_FAST_REASONING_EFFORT=low
OPENAI_STRONG_REASONING_EFFORT=high
OPENAI_SUMMARY_REASONING_EFFORT=medium
OPENAI_VISION_REASONING_EFFORT=low
OPENAI_TEXT_VERBOSITY=low
```

The current model setup is not the primary Phase 0 blocker. The observed failures point more strongly to routing/retrieval/output-contract behavior than to model choice alone.

Post-Phase 7 note: `OPENAI_ANSWER_TIMEOUT_MS=12000` was added after this baseline to make answer generation fail into the source-backed fallback path faster than the global OpenAI request timeout.

## Next.js route-handler guidance checked

Per local `node_modules/next/dist/docs/` guidance for this repo's Next.js version:

- Route handlers live in `route.ts`.
- They use Web `Request`/`Response` primitives, with `NextRequest`/`NextResponse` helpers available.
- Route handlers are not cached by default.
- Request-specific access such as URL, headers, and cookies makes behavior dynamic.
- `.env*` files are loaded from the project root, not from `src`.
- Non-`NEXT_PUBLIC_` environment variables stay server-side.

Implication: schema-first query/body validation should sit at route boundaries, and answer/search routes should keep server-only model configuration in server-side helpers.

## Ownership map

Primary API routes:

- `src/app/api/search/route.ts`: search endpoint, smart RAG API plan construction, search telemetry.
- `src/app/api/answer/route.ts`: non-stream answer endpoint, smart plan construction, answer sanitization.
- `src/app/api/answer/stream/route.ts`: streaming answer endpoint, smart plan construction, answer sanitization.

OpenAI and generation helpers:

- `src/lib/openai.ts`: Responses API calls, embeddings, structured text generation.
- `src/lib/env.ts`: model defaults and runtime config.
- `src/lib/rag.ts`: answer orchestration, route choice, smart plan injection, answer generation, fallback handling.
- `src/lib/rag-routing.ts`: answer route decision policy.
- `src/lib/smart-rag-api.ts`: `SmartRagAnswerPlan`, core source links, smart plan construction.
- `src/lib/types.ts`: shared answer/search response contracts.

Frontend/source rendering:

- `src/components/ClinicalDashboard.tsx`: answer display, source/evidence panels, smart display mode handling.
- `src/components/clinical-dashboard/search-utils.ts`: answer payload usability.
- `src/lib/ward-output.ts`: evidence map and clipboard formatting.
- `src/lib/answer-formatting.ts`: dynamic answer-line parsing, display grouping, display modes, and presentation symbols.

API validation and document routing:

- `src/app/api/documents`: document list/detail/search/reindex/labels/table-facts/bulk routes and document-specific request boundaries.
- `src/app/api/jobs`: job listing route.
- `src/app/api/ingestion`: ingestion jobs, batches, retry, and quality review routes.
- `src/app/api/upload`: multipart upload boundary and file metadata handling.

Existing focused tests:

- `tests/rag-routing.test.ts`
- `tests/smart-rag-api.test.ts`
- `tests/rag-answer-fallback.test.ts`
- `tests/answer-formatting.test.ts`
- `tests/citations.test.ts`
- `tests/ward-output.test.ts`
- `tests/clinical-dashboard-search-utils.test.ts`
- `tests/openai-cache.test.ts`
- `tests/private-access-routes.test.ts`

## API validation drift baseline

The reported API validation issue is confirmed. Several route families still manually parse or clamp inputs instead of using one schema-first route-boundary pattern.

Examples found:

- `src/app/api/ingestion/quality/route.ts`: manual `Math.min(Math.max(Number(...)))` pagination/clamping.
- `src/app/api/documents/[id]/search/route.ts`: manual `Number.parseInt`.
- `src/app/api/documents/[id]/route.ts`: custom `boundedInteger` and manual query parsing.
- `src/app/api/documents/route.ts`: custom `parsePositiveInt`, `parseOffset`, and manual query parsing.

Schema-first examples already exist and should be reused as the standard:

- `src/app/api/documents/[id]/labels/route.ts`
- `src/app/api/documents/[id]/table-facts/route.ts`
- `src/app/api/documents/[id]/signed-url/route.ts`
- `src/app/api/documents/bulk/reindex/route.ts`
- `src/app/api/documents/bulk/route.ts`

Implication: a small shared validation helper plus route-specific Zod schemas is the correct direction. Do not rewrite every route manually in a different style.

## Baseline checks run

### RAG routing and smart API unit baseline

Command:

```powershell
npm run test -- tests/rag-routing.test.ts tests/smart-rag-api.test.ts tests/rag-answer-fallback.test.ts
```

Result:

```text
Test Files  3 passed (3)
Tests       39 passed (39)
```

Interpretation: current route/smart-plan unit tests pass, so the issue is not exposed by the existing unit contract.

### Answer formatting and citation unit baseline

Command:

```powershell
npm run test -- tests/answer-formatting.test.ts tests/citations.test.ts tests/ward-output.test.ts
```

Result:

```text
Test Files  3 passed (3)
Tests       31 passed (31)
```

Interpretation: current formatting/citation tests pass, so the unnatural response problem is not sufficiently captured by existing formatting tests.

### Retrieval quality eval

Command:

```powershell
npm run eval:retrieval:quality
```

Result summary:

```text
cases=10
document_recall@5=0.6
content_recall@5=0.9167
top_k_hit_rate=0.9
mrr@10=0.631
median_latency_ms=3151
p90_latency_ms=5325
failed_cases=4
```

Failed cases:

```text
agitation-im-po-options
active-community-patient-ed
flowchart-next-step
medication-chart-dose-route
```

Key pattern:

- All four failures were concentrated in vector fallback or table/clinical routing edge cases.
- Document recall is materially weaker than content recall, which means the system often finds related content but misses the expected document/source identity.
- Agitation medication/table questions are a repeated weak area.
- Active-community-patient-in-ED remains a repeated weak area.
- Flowchart/red-zone risk retrieval remains a weak visual/flowchart case.

### Capped RAG eval

Command:

```powershell
npm run eval:rag -- --limit 20 --json
```

Result summary:

```text
supported grounded 10/20
routine extractive p95 over 2000ms
20 case-level failure(s)
```

Important failures:

- `active-community-patient-ed`: routed `unsupported`, expected grounded answer and citations.
- `active-community-pt-ed-short-terms`: routed `unsupported`, expected grounded answer and citations.
- `community-admission`: only 1 citation, expected at least 2.
- Several extractive answers were not grounded enough for the eval.
- Every sampled case reported expected document not in retrieved sources, which suggests either retrieval/source mismatch or stale/strict expected-document labels.

Latency pattern:

- Generated `fast` answers often took about 8-16 seconds total.
- Many extractive answers were much faster but failed groundedness or expected-document checks.
- Retrieval p95 for routine extractive cases exceeded the eval threshold.

## Phase 0 conclusions

1. The user-facing issue is real and measurable.

The app can pass existing unit tests while still producing poor search/RAG answers. The eval baseline exposes the gap: current tests validate pieces of the contract, but not the end-to-end "retrieve relevant evidence, synthesize naturally, show useful sources" behavior.

2. This is not only a prompt issue.

The strongest failure signal is a routing and generation contract issue:

- Many routine questions are routed to extractive or unsupported paths.
- Extractive paths can bypass the model synthesis step the user expects.
- Smart plans/source links exist, but the answer route can still produce a non-natural or under-synthesized output.
- The frontend can surface source/evidence structure that feels like extra machinery instead of an answer-first clinical response.

3. Retrieval quality must be fixed alongside answer synthesis.

The answer model cannot reliably synthesize the desired final answer if the expected document/source is missing or demoted. The repeated weak cases are active-community ED, agitation medication/table details, flowchart next-step, and medication dose/route evidence.

4. The current answer contract needs a stricter source of truth.

The app needs one explicit answer payload contract that tells every layer:

- Was this a synthesized answer, extractive answer, unsupported answer, or source-browsing answer?
- Which evidence was used to compose the answer?
- Which sources should be visible by default?
- Which source/detail panels are secondary?
- What is the model allowed to say when evidence is thin?

5. API validation inconsistency is real but should be solved as a foundational cleanup, not mixed into answer generation logic.

The validation fix should be a small schema-first route-boundary pass across the listed documents/jobs/ingestion/upload families. It should reduce drift without touching RAG ranking unless a specific route is part of the answer/search flow.

## Recommended readiness for Phase 1

Phase 1 should start with two narrow foundations:

1. Normalize API validation for the route families already identified.
2. Add missing acceptance tests that lock the intended search/RAG behavior before major generation changes.

Minimum acceptance tests to add before or during implementation:

- Active-community-patient-in-ED should not route to unsupported when relevant evidence exists.
- Short-term queries such as `Active community pt in ED guidance` should expand abbreviations and retrieve the expected evidence.
- Agitation medication chart questions should retrieve dose and route evidence from the expected source.
- Flowchart/red-zone risk questions should preserve visual/flowchart evidence.
- Routine answer questions with multiple sources should use model synthesis unless the route is explicitly source-only.
- Evidence panels/source drawers should be secondary to the answer and should not replace natural synthesis.

## Files likely touched in next phases

Likely implementation files:

- `src/app/api/documents/route.ts`
- `src/app/api/documents/[id]/route.ts`
- `src/app/api/documents/[id]/search/route.ts`
- `src/app/api/documents/[id]/reindex/route.ts`
- `src/app/api/ingestion/quality/route.ts`
- `src/app/api/ingestion/jobs/route.ts`
- `src/app/api/jobs/route.ts`
- `src/app/api/upload/route.ts`
- `src/app/api/search/route.ts`
- `src/app/api/answer/route.ts`
- `src/app/api/answer/stream/route.ts`
- `src/lib/rag.ts`
- `src/lib/rag-routing.ts`
- `src/lib/smart-rag-api.ts`
- `src/lib/types.ts`
- `src/components/ClinicalDashboard.tsx`
- `src/components/clinical-dashboard/search-utils.ts`
- `src/lib/ward-output.ts`
- `src/lib/answer-formatting.ts`

Likely test files:

- `tests/rag-routing.test.ts`
- `tests/smart-rag-api.test.ts`
- `tests/rag-answer-fallback.test.ts`
- `tests/answer-formatting.test.ts`
- `tests/citations.test.ts`
- `tests/ward-output.test.ts`
- `tests/clinical-dashboard-search-utils.test.ts`
- `tests/api-validation-contract.test.ts`
- New or expanded API validation contract tests for documents/jobs/ingestion/upload routes.
- New or expanded eval fixtures for active-community ED, agitation medication chart, flowchart next-step, and synthesized multi-source answers.

## Phase 0 exit status

Phase 0 is complete as the baseline artifact for later work. The current eval failures should be treated as pre-existing behavior unless a later implementation changes them.

No application code was intentionally changed during Phase 0. This report is the Phase 0 artifact.
