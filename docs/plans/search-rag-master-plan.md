# Search/RAG Master Plan

## Goal

Create the perfected Clinical KB search and answer experience:

- search retrieves and ranks source evidence first,
- the model synthesizes the first answer naturally from that evidence,
- source evidence is attached clearly and clickably,
- weak evidence fails closed instead of returning stitched snippets,
- API validation and error behavior are consistent,
- the full flow is testable, observable, and release-safe.

This plan intentionally treats the issue as a system contract problem, not as a prompt-only problem.

## Guiding Principles

- Evidence first: no clinical answer without source retrieval and source-support reasoning.
- Synthesis first for clinical answers: the first bubble should be model-composed, not chunk-stitched.
- Extractive only by explicit intent: exact quote, document lookup, table lookup, or "what documents support..." style questions.
- Trust controls display: confidence and grounding decide which extras render.
- Fail closed: when evidence or generation quality is weak, return a source-gap answer with helpful source review.
- One canonical render contract: UI should not assemble competing evidence panels from unrelated fields.
- Schema-first APIs: route input parsing must be consistent, typed, and recoverable.
- Small, staged rollout: each phase should have focused tests and a clear rollback path.

## Phase 0: Baseline And Ownership Map

Purpose: make current behavior measurable before changing more logic.

Tasks:

- Record current branch and dirty worktree state before edits.
- Map ownership of answer flow, source display, validation helpers, and document routing.
- Capture current query classes and route modes from RAG tests/evals.
- Identify current source of truth for model defaults in `src/lib/env.ts`, `.env.example`, and local env.
- Confirm current Next.js route-handler guidance from `node_modules/next/dist/docs/` before API route work.

Files to inspect:

- `src/lib/rag/rag.ts`
- `src/lib/rag/rag-routing.ts`
- `src/lib/smart-rag-api.ts`
- `src/lib/openai.ts`
- `src/lib/types.ts`
- `src/components/ClinicalDashboard.tsx`
- `src/lib/ward-output.ts`
- `src/lib/answer-formatting.ts`
- `src/app/api/documents`
- `src/app/api/jobs`
- `src/app/api/ingestion`
- `src/app/api/upload`

Baseline commands:

```powershell
npm run test -- tests/rag-routing.test.ts tests/smart-rag-api.test.ts tests/rag-answer-fallback.test.ts
npm run test -- tests/answer-formatting.test.ts tests/citations.test.ts tests/ward-output.test.ts
npm run eval:retrieval:quality
npm run eval:rag -- --limit 20 --json
```

Exit criteria:

- Current failures are documented as pre-existing or caused by the change under review.
- The plan has a concrete list of touched files and test files.

## Phase 1: API Validation Contract

Purpose: remove validation drift in route families before adding more behavior on top.

Primary skill lens: `api-review`.

Tasks:

- Define one shared validation policy for params, query strings, JSON bodies, multipart form data, and public errors.
- Add shared validation helpers, preferably under `src/lib/validation/`.
- Support explicit policies for `coerce`, `default`, `clamp`, and `reject`.
- Standardize invalid-input responses with a stable public shape.
- Preserve raw provider/database details server-side only.

Recommended files:

- `src/lib/validation/query.ts`
- `src/lib/validation/body.ts`
- `src/lib/validation/form-data.ts`
- `src/lib/validation/http.ts`
- `src/lib/http.ts` if this repo already centralizes public API errors there.

Target route migrations:

- `src/app/api/documents/route.ts`
- `src/app/api/documents/[id]/route.ts`
- `src/app/api/documents/[id]/search/route.ts`
- `src/app/api/ingestion/quality/route.ts`
- `src/app/api/upload/route.ts`
- `src/app/api/jobs/route.ts`
- `src/app/api/ingestion/jobs/route.ts`

Policy decisions:

- Numeric query params should be schema parsed, not manually `parseInt` in route files.
- Existing fallback/clamp behavior can be preserved initially for compatibility.
- Later tightening from clamp-to-reject must be explicit and test-backed.
- Multipart upload should validate metadata fields through schema while leaving file signature/size checks in existing file-safety helpers.

Tests:

- Add focused route validation tests for valid input, malformed input, boundary values, missing fields, unknown fields, and multipart field types.
- Add a static guard or test that flags manual parsing in target route folders.

Exit criteria:

- No target route has route-local `parseInt`/manual clamp logic except domain math unrelated to request parsing.
- All validation failures use one public error shape.

## Phase 2: Answer Plan Contract

Purpose: make `smartApiPlan` the explicit answer plan, not a loose display helper.

Primary skill lenses: `ai-architecture-review`, `frontend-architecture-review`.

Tasks:

- Expand `smartApiPlan` or introduce an adjacent `answerPlan` with stable typed fields.
- Include retrieval quality, query class, route mode, model strategy, quality criteria, fallback contract, and source policy.
- Pass the answer plan into model-generation context.
- Include answer-plan metadata in telemetry/logging.

Proposed `answerPlan` fields:

```ts
type AnswerPlan = {
  intent: "clinical_synthesis" | "source_lookup" | "document_lookup" | "unsupported";
  routeMode: "fast" | "strong" | "extractive" | "unsupported";
  modelStrategy: "fast_model_then_quality_gate" | "strong_model_then_quality_gate" | "extractive_lookup" | "source_gap";
  retrievalQuality: "strong" | "partial" | "weak" | "conflicting";
  qualityCriteria: string[];
  fallbackBehavior: "retry_strong_then_source_gap" | "source_gap" | "extractive_lookup_only";
  sourcePolicy: "required_citations" | "nearby_sources_allowed" | "exact_source_links";
};
```

Routing rules:

- Clinical synthesis is default for user-facing clinical questions.
- Source/document lookup stays extractive only when the question explicitly asks for source location, quotes, or supporting documents.
- Medication, dosing, monitoring, threshold, risk, comparison, pathway, and referral questions route to model synthesis.
- Safety-sensitive, conflicting, comparison, weak-but-plausible, or failed-fast cases route to strong.
- No strong failure should fall through to stitched extractive clinical prose.

Tests:

- `tests/rag-routing.test.ts`
- `tests/smart-rag-api.test.ts`
- `tests/rag-answer-fallback.test.ts`

Exit criteria:

- Every generated answer has an answer plan.
- Route decisions are inspectable and test-covered.
- Source lookup behavior remains intentionally extractive.

## Phase 3: Synthesis Prompt And Structured Output Hardening

Purpose: make the model the final composer while keeping output grounded and machine-validated.

Primary skill lens: `ai-architecture-review`.

Tasks:

- Rewrite the generation instructions around "compose a complete clinical answer" rather than "summarize snippets".
- Include answer-plan requirements in the model input.
- Require evidence IDs for claims in structured output.
- Generate JSON schemas that constrain citations to retrieved chunk IDs where practical.
- Version schema/cache keys whenever output contract changes.
- Keep partial provider streaming hidden until validation passes.

Generation requirements:

- First sentence directly answers the question.
- Use full sentences.
- Reconcile conflicts explicitly.
- State uncertainty when evidence is partial.
- Do not promote source headings, labels, or section names as prose.
- Do not invent claims outside evidence IDs.
- Avoid unsupported numbers, doses, frequencies, thresholds, or routes.

Quality gates:

- Complete opening sentence.
- Query intent coverage.
- Evidence ID validity.
- Numeric/dose support.
- Cross-medication leakage.
- Fragment/heading detection.
- Source-card label detection.
- Grounding/citation coverage.

Fallback sequence:

1. Fast model attempt for routine supported answers.
2. Deterministic quality gate.
3. Strong model repair/retry if needed.
4. Deterministic quality gate.
5. Clean source-gap answer with nearby-source review if still weak.

Tests:

- Medication dosing.
- Threshold/risk.
- Monitoring action.
- Pathway/referral.
- Comparison/conflict.
- Exact source lookup.
- Weak retrieval/source gap.
- Malformed fast output.
- Strong truncation/failure.
- Citation ID mismatch.

Exit criteria:

- No clinical user-facing answer can return a source heading or stitched fragment as the first answer.
- Unsupported or weak answers are visibly source-gap answers.

## Phase 4: Canonical Render Policy

Purpose: prevent noisy extra panels by rendering from policy, not raw field presence.

Primary skill lenses: `frontend-architecture-review`, `ux-review`, `code-quality-review`.

Tasks:

- Introduce a normalized render model between `RagAnswer` payload and dashboard rendering.
- Deduplicate evidence across sources, citations, smart panel, quote cards, best source, source coverage, and answer sections.
- Decide which supplemental blocks are allowed by trust state.
- Cap optional block counts.
- Preserve full payload for diagnostics; render only policy-approved blocks.
- Add QA/debug explainability for show/hide decisions.

Suggested module:

- `src/lib/answer-render-policy.ts`

Suggested output:

```ts
type AnswerRenderModel = {
  answerText: string;
  trust: "unsupported" | "low" | "medium" | "high";
  allowedBlocks: Array<
    | "sourceStatus"
    | "reviewSources"
    | "evidenceMap"
    | "quoteCards"
    | "visualEvidence"
    | "relatedDocuments"
    | "warnings"
    | "diagnostics"
  >;
  primarySources: SourceLink[];
  evidenceRows: EvidenceRow[];
  warnings: string[];
  copyText: string;
  debugReasons?: Record<string, { shown: boolean; reason: string; triggerField?: string }>;
};
```

Display policy:

- Unsupported: show source-gap answer, limited nearby-source review, warnings if useful; hide recommendation-style extras.
- Low trust: show answer caution, top sources, gaps; avoid quote-card/visual-evidence clutter unless directly relevant.
- Medium trust: show answer, source status, top sources, evidence map.
- High trust: show answer, source status, top sources, evidence map, then capped optional evidence blocks.

Tests:

- Unsupported answer with sources present.
- Medium-confidence answer with many optional fields.
- High-confidence answer with duplicated evidence channels.
- Conflicting `answerSections` from parser and backend.
- Empty/placeholder supplemental content.

Exit criteria:

- Dashboard has one answer-render policy path.
- Optional extras no longer appear just because a raw field is populated.

## Phase 5: Source Review UX

Purpose: make evidence review fast, consistent, and clickable.

Primary skill lenses: `ux-review`, `accessibility-review`, `design-review` light-touch.

Tasks:

- Make evidence-map rows clickable when a row has `href`.
- Make each source preview row independently clickable.
- Ensure source-gap answers still allow nearby-source review when sources exist.
- Rename misleading labels such as "Open PDF drawer" if the action navigates to a document page.
- Add a clear copy behavior: copy answer with citations/source status by default, or a clearly labeled "Copy with sources".
- Align desktop and mobile evidence navigation so the same conceptual tabs/sections exist.
- Ensure buttons/links have accessible names, keyboard behavior, focus styles, and touch targets.

Acceptance details:

- Clicking a source opens the intended document, page, and chunk when available.
- Evidence-map rows expose "Open source" or equivalent accessible action.
- Copy output includes enough source metadata for review outside the app.
- Source preview does not imply all rows open the same best source.

Tests:

- Unit tests for render model and copy formatter.
- Playwright smoke for source-backed answer, evidence row click, source-gap nearby-source review, and copy action.
- Accessibility checks for keyboard navigation through source cards/drawer/tabs.

Exit criteria:

- Source review is direct, repeatable, and accessible.

## Phase 6: Security, Privacy, And Error Hardening

Purpose: ensure safer contracts do not expose sensitive internals or weaken auth/source access.

Primary skill lens: `security-review`.

Tasks:

- Verify all touched API routes keep auth and local-no-auth rules intact.
- Confirm public validation errors do not leak stack traces, raw SQL/Supabase details, OpenAI request payloads, keys, or service-role markers.
- Confirm source/document links require the same access policy as the underlying document.
- Confirm no server-only env values are imported into client bundles.
- Keep raw model/provider errors server-side while exposing request/support IDs where useful.

Tests/checks:

- Existing private route/access tests.
- API invalid-input tests.
- Production-readiness check.
- Supabase project check if env/config changes.

Exit criteria:

- Better UX and validation do not weaken privacy, auth, or source access.

## Phase 7: Performance, Cost, And Observability

Purpose: keep the improved answer experience fast enough and measurable.

Primary skill lens: `performance-review`.

Tasks:

- Track per-answer route mode, model used, retry path, fallback reason, latency, token usage, cached input tokens, and OpenAI request IDs.
- Preserve or improve answer in-flight coalescing for duplicate scoped answer requests.
- Avoid duplicate client retries after server generation starts.
- Keep provider streaming behind a separate product decision; do not expose partial clinical text before validation.
- Cap render block counts and memoize derived render policy if needed.
- Lazy-load heavy document/source viewer surfaces if they regress rendering.

Metrics:

- p50/p95 answer latency by route mode.
- fast-to-strong retry rate.
- source-gap rate.
- unsupported rate.
- invalid citation rate.
- answer quality eval pass rate.
- retrieval quality pass rate.
- cost per answer by model path.

Exit criteria:

- Better synthesis does not create unbounded latency, token, or render cost.
- Cost/quality tradeoffs are visible in eval output.

Implemented outcome:

- Added `OPENAI_ANSWER_TIMEOUT_MS=12000` as a dedicated answer-generation timeout.
- RAG answer generation now passes the dedicated timeout into structured OpenAI answer calls.
- Provider timeout fallbacks remain source-backed and bounded instead of waiting on the global `OPENAI_REQUEST_TIMEOUT_MS=45000` budget.
- RAG eval latency accounting now excludes `generation_fallback` answers from the intentional routine-extractive p95 bucket.
- Focused tests, typecheck, production-readiness, and `npm run eval:rag -- --limit 20 --json --fail-on-threshold` passed.

## Phase 7b: Latency Polish For Explicit Lookup

Purpose: make source/table/document lookup questions feel immediate without weakening clinical synthesis behavior.

Primary skill lens: `performance-review`.

Implemented tasks:

- Detect explicit table, chart, flowchart, figure, appendix, and form lookup intent in `src/lib/rag/rag-routing.ts`.
- Route safe explicit lookup questions to extractive when retrieval has direct title, table, visual, or strong score support.
- Preserve model synthesis for medication/action/dose/threshold questions that ask for clinical interpretation.
- Add routing regressions for explicit table lookup versus medication action synthesis.

Validation:

```powershell
npm run test -- tests/rag-routing.test.ts tests/rag-answer-fallback.test.ts
npm run typecheck
npm run check:production-readiness
npm run eval:rag -- --limit 20 --json --fail-on-threshold
```

Observed effect:

- `agitation-arousal-table-lookup` routed to `extractive`.
- `generation_latency_ms=0`.
- Total latency was sub-second in the Phase 7b validation run.
- RAG threshold failures remained empty.

## Phase 8: Test And Release Gate

Purpose: make the new behavior durable and safe to ship.

Primary skill lenses: `testing-review`, `release-readiness-review`.

Focused tests:

```powershell
npm run test -- tests/rag-routing.test.ts tests/smart-rag-api.test.ts tests/rag-answer-fallback.test.ts
npm run test -- tests/answer-formatting.test.ts tests/citations.test.ts tests/ward-output.test.ts
npm run test -- tests/private-access-routes.test.ts
```

Route contract tests:

```powershell
npm run test -- tests/api-validation.test.ts
```

Evals:

```powershell
npm run eval:retrieval:quality
npm run eval:rag -- --limit 20 --json --fail-on-threshold
```

Browser/UI:

```powershell
npm run ensure
npx playwright test tests/ui-smoke.spec.ts -g "demo answer flow reaches a source-backed answer" --project=chromium --workers=1 --timeout=60000
```

Broad gates:

```powershell
npm run verify:cheap
npm run verify:ui
npm run check:production-readiness
npm run check:supabase-project
npm audit --audit-level=high
```

Use `npm run verify:ui` for broader UI changes and `npm run verify:release` only when the branch is ready for handoff confidence.

Exit criteria:

- Focused tests pass.
- Broad cheap gate passes or any failures are clearly pre-existing and documented.
- Production-readiness passes.
- Browser source-backed answer flow passes after UI/source changes.
- Known eval regressions are either fixed or documented with owner and follow-up.

## Implementation Sequence

Recommended order:

1. Add API validation helpers and migrate high-risk route parsing.
2. Add answer-plan type/contract and route-mode policy.
3. Harden model prompt/schema/quality gates.
4. Add canonical render-policy normalization.
5. Fix source-review UI and copy behavior.
6. Add route contract, RAG, render-policy, and Playwright coverage.
7. Run evals and tune fast/strong thresholds.
8. Run release-readiness gates and document final behavior.

Why this order:

- API contract work reduces hidden edge-case drift before UI/model behavior gets more complex.
- Answer-plan work gives the model and UI the same source of truth.
- Render-policy work should happen after answer-plan shape is known.
- UI polish should happen after the render contract is stable.
- Performance/security/release checks should gate the final state, not drive premature design decisions.

## Rollback Strategy

Each phase should be separable.

- API validation helpers can preserve old defaults/clamps, so rollback is route-local.
- Answer-plan routing can be guarded behind route-mode tests and reverted without UI changes.
- Render-policy normalization can keep raw payload fields intact, so rollback can switch UI back to legacy rendering.
- Source-link UI fixes are additive when the data already has `href`.
- Model thresholds can be tuned through route policy and env defaults without changing source retrieval.

## Final Acceptance Criteria

The work is complete when all of these are true:

- First answer is synthesized for clinical questions and directly answers the query.
- Extractive mode appears only for explicit lookup/source tasks.
- Fast/strong model routing is deterministic, observable, and test-covered.
- Failed generation produces a source-gap answer, not stitched clinical prose.
- Citations and evidence IDs are constrained to retrieved chunks.
- Optional evidence panels are governed by a render policy.
- Evidence rows and source preview rows are clickable when source targets exist.
- Copy output can include citations and source status.
- API validation in target route families is schema-first and consistently errors.
- Security-sensitive errors and source access remain safe.
- Focused tests, broad verification, production-readiness, and browser source smoke pass or document known pre-existing failures.
