# Clinical RAG Improvement Programme — reviewed and updated implementation guide

**Status:** maintained plan (2026-08-13). Supersedes the uploaded "Clinical RAG Improvement
Programme" PDF, which was pinned to main `130c7746` (main is now past `67db5a1`) and predates
several repo changes. This guide is grounded in the current codebase and is the working
reference for elevating the RAG: first the answer itself (intent-aware related information,
higher clinical yield, moderately longer output), then the PDF's evaluation/safety
infrastructure, corrected.

**Scope discipline:** every Track A item touches protected RAG surfaces
(`docs/rag-behaviour/safeguards.md`). Each PR must flag RAG impact before editing, carry a
`RAG impact:` line in its body (`scripts/pr-policy.mjs` blocks the merge otherwise), and any
behaviour change needs a live eval-canary pair (provider-backed, ~$1–2, explicit approval per
run). Nothing here authorises reindexing, migrations, or provider calls by itself.

---

## 1. Review verdict on the original PDF

### 1.1 Agreed — retained (with corrections applied in Track B)

| PDF item                                                                                    | Verdict                      | Why                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Additive, gate-first philosophy; no production change without a measured promotion gate     | **Keep**                     | Matches the repo's standing rule: "offline green is necessary, never sufficient" (`docs/rag-behaviour/README.md`) — the Phase C regression passed 121/121 offline and failed 3/36 live.                                                                                              |
| Phoenix deferred; assess existing Sentry first with an allow-listed telemetry contract      | **Keep**                     | `src/instrumentation.ts` + `src/lib/observability/agent-monitoring.ts` already trace without content capture; a second tracing vendor adds a data-processing route before proving value.                                                                                             |
| Docling as isolated lab benchmark → worker shadow mode only after Gate B                    | **Keep**                     | The known weak point is tables/layout/OCR; `src/lib/index-quality.ts` signals can select a small shadow cohort instead of mass reprocessing.                                                                                                                                         |
| Offline adversarial (Promptfoo) harness, synthetic-only, network-free                       | **Keep — genuinely missing** | The injection defences exist at runtime (`answerInstructions` §"Source excerpts are untrusted data" in `src/lib/rag/rag.ts`, `hasAdversarialManipulationIntent` in `src/lib/rag/rag-routing.ts:329`) but no fixture suite pins them; a prompt edit could silently weaken them today. |
| Reranker benchmark constraints: 36/36, zero per-case regression, latency/cost headroom      | **Keep**                     | Consistent with refutations 1–2 and outstanding issue `#001` (semantic rerank stays off without an approved ambiguity comparison).                                                                                                                                                   |
| DSPy deferred until ≥100 labelled cases                                                     | **Keep, re-scoped**          | See disagreement 2 — the proposed "query intent classification" target already exists in triplicate.                                                                                                                                                                                 |
| CI tiering through `scripts/ci-change-scope.mjs`, no duplicate workflows, cancel-superseded | **Keep**                     | Matches the existing risk-scoped CI design.                                                                                                                                                                                                                                          |
| PHI posture: synthetic/de-identified fixtures only; canary strings in every sink            | **Keep**                     | Aligns with the privacy boundary and `#053`.                                                                                                                                                                                                                                         |

### 1.2 Disagreed — corrected in this guide

1. **Stale pin and a name collision.** The PDF's PR 0 proposes adding
   `npm run check:rag:fixtures`. That command **already exists**
   (`scripts/check-rag-fixtures.mjs`, validating the golden retrieval fixture and ranking
   snapshot). The adversarial fixture validator must be a new command
   (`check:rag:adversarial-fixtures`) or an extension of the existing script — never a
   silent replacement.
2. **"Add query-intent classification" duplicates existing machinery.** Intent detection
   already exists in three layers: `RagQueryClass` (6 classes, `src/lib/types.ts:718`, with
   an LLM classifier fallback at `rag.ts` `analyzeQueryWithClassifierFallback`),
   `ClinicalQueryIntent` (8 intents, `src/lib/clinical-search.ts:838`), and the
   user-selectable `ClinicalQueryMode` (7 modes whose `clinicalModePrompt` is already
   injected into generation). The genuine gap is **per-intent answer composition** — what
   the answer shows for each question type — not detection. Track A2 targets that gap;
   the PDF's DSPy lab is re-scoped away from classification.
3. **The PDF optimises everything except the answer.** It contains no item on related
   information, answer length, clinical yield, or follow-up questions — the owner's actual
   priority. Track A (new) fills this and is sequenced **first**.
4. **No engagement with the refuted-approaches ledger.** `docs/rag-behaviour/refuted-approaches.md`
   records live-refuted shapes the PDF's conditional experiments could re-walk:
   per-class feature-weight tuning (live no-op), comparator-key spread (live regression,
   doc-recall 1.0 → 0.9167), governance currentness penalties/boosts (measured harm —
   deliberately shipped at 0), and token streaming (removed as a clinical-safety control;
   raw tokens bypass post-generation verification). Binding constraints are now embedded in
   Track B items 6–7: any new ranking discriminator sits **strictly below `relevance.score`**;
   benchmark fixtures must use differently-relevant candidates (identical-content fixtures
   are how Phase C's regression escaped offline detection); a live canary pair is mandatory.
5. **Ignores outstanding issue `#231`.** Live answers already degrade to source-only when
   the fast route budget (`answerRouteBudgetMs.fast = 25_000` in
   `src/lib/rag/rag-route-budget.ts`) binds while retrieval is healthy. This is the single
   highest-yield answer-quality defect in the queue, and a hard prerequisite for longer
   answers: more output tokens means more truncation/timeout exposure, which converts
   directly into more source-only fallbacks. Track A1 sequences it first.
6. **Roles table presumes a team.** Product/privacy/application/worker/evaluation owners are
   one person here. Collapsed to: **owner** (clinical intent, privacy sign-off, release
   thresholds, canary approval) and **agent sessions** (implementation, gates, evidence).
7. **Follow-up assumptions were wrong in both directions.** Suggested follow-up questions do
   **not** exist (`src/lib/answer-follow-up.ts` only rewrites the user's own short
   follow-ups by prepending the prior question), while `relatedDocuments` **does** exist
   (`buildRelatedDocumentsSafe` in `rag.ts`, rendered under `trustCaps[trust].related` in
   `src/lib/answer-render-policy.ts`). Track A4 builds the missing surface on the existing one.

---

## 2. Current-state anchor (what the pipeline already does)

Read `docs/rag-behaviour/` first for the protected mechanics. The short version relevant to
this plan:

- **Flow:** `/api/answer` → `answerQuestionWithScopeUncoalesced` (`src/lib/rag/rag.ts`) →
  hybrid retrieval (vector + tsvector + trigram + aliases + table facts + index units) →
  `selectRetrievalEvidence` (`src/lib/retrieval-selection.ts`) → deterministic second stage
  (`src/lib/rag/rag-second-stage.ts`) → `chooseAnswerRoute` (`src/lib/rag/rag-routing.ts`) →
  fast/strong generation (reasoning-effort routing, not different models) → numeric
  verification, claim support, citation sanitisation → render policy trust ladder.
- **Answer shape today:** the `answer` field is prompted to 1–3 sentences (~35–75 words);
  `answerSections` carries 0–1 sections for simple facts, 2–5 for complex questions. The
  prompt (`answerInstructions`, `rag.ts:3150`) and the "Interpreted clinical task" block
  built by `buildAnswerInput` already carry `intent`, `query_class`, `answer_focus`,
  `answer_scope`, and the full `answer_plan.*` fields.
- **Budgets:** `unsupported 0 / extractive 12s / fast 25s / strong 35s`; a
  truncation self-heal retries with `strongRetryMaxOutputTokens`. Source-only fallback
  (`source_backed_review_fallback`) fires on quality-gate failure, ungrounded extractive
  fallback, or post-generation claim-support gaps — conservative by design.
- **Evals:** 36-case golden retrieval fixture (`scripts/fixtures/rag-retrieval-golden.json`,
  zero-tolerance), 44-case `ragEvalCases` + 30-case `answerQualityEvalCases`
  (`src/lib/rag/rag-eval-cases.ts`), ranking-candidate snapshot with lockstep pin and 30-day
  freshness, live canary pairs via the `eval-canary` repository dispatch only.

---

## 3. Track A — answer quality (sequenced first)

Goal: for any clinical question, the system should (a) answer it directly, (b) surface the
_related_ high-yield information a psychiatrist colleague would append unprompted — chosen by
question type, and (c) be moderately longer (~1.5×) where evidence supports it, without
raising the source-only fallback rate or weakening a single grounding gate.

### A1 — Budget headroom before length (prerequisite; resolves/mitigates `#231`)

**Problem.** Longer answers cost tokens and seconds; the fast route already times out into
source-only fallbacks on healthy retrieval. Increasing length before fixing this makes the
product worse (more fallbacks), not better.

**Work.**

- Instrument (allow-listed metadata only — stage, latency_ms, timeout, fallback_used,
  candidate_count; never query/answer text) the fast-route stages via the existing
  `answer-telemetry` path to attribute where the 25s goes: retrieval, context packing
  (`packContextForGeneration`), generation, verification.
- Candidate mitigations, in preference order: (1) raise `answerRouteBudgetMs.fast`
  modestly with evidence that p95 generation fits; (2) route length-heavy query classes
  (broad_summary, comparison) to the strong budget earlier via
  `shouldRetryWithStrongAfterFast` predicates; (3) trim context-pack latency. Do **not**
  reintroduce token streaming — the only admissible perceived-latency fix is progressive
  disclosure of already-verified units over the existing `progress` SSE event
  (refutation 6, ledger `#100`).
- **Files:** `src/lib/rag/rag-route-budget.ts`, `src/lib/rag/rag-routing.ts`,
  `src/lib/answer-telemetry.ts`, targeted tests beside each.
- **Gate:** offline 44-case + 30-case suites unchanged; live observation window showing
  fallback-rate non-inferiority; `RAG impact:` line (behaviour change → canary pair).

### A2 — Intent-conditioned answer composition ("related information")

**Design.** A small pure module, `src/lib/rag/answer-composition.ts`, mapping
(`RagQueryClass`, `ClinicalQueryIntent`) → a **composition menu**: which `answerSections`
kinds the model should attempt when — and only when — the retrieved evidence supports them.
Illustrative menu (tune during implementation):

| Question type                          | Related information to offer                                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `medication_dose_risk` / `drug_dosing` | monitoring schedule, contraindications/cautions, escalation & stop triggers, dose-adjustment populations (renal/hepatic/older adults), related documents |
| `table_threshold`                      | adjacent thresholds in the same scale, required actions per band, escalation pathway                                                                     |
| `comparison`                           | decision factors, per-source differences/conflicts, switching/washout considerations                                                                     |
| `broad_summary` / `protocol`           | weighted management map (risk → first-line → adjuncts → monitoring → special populations), documentation/forms, source gaps                              |
| `escalation_risk`                      | immediate actions, thresholds, who to contact/refer, documentation                                                                                       |
| `definition` / `document_lookup`       | stays narrow — zero or one section, exactly as today                                                                                                     |

**Mechanism (three small changes, no new pipeline stage):**

1. Serialise the selected menu into the "Interpreted clinical task" block in
   `buildAnswerInput` (one new line, e.g. `related_information_menu: monitoring, contraindications, escalation`).
2. Add one paragraph to `answerInstructions` §"Answer sections": attempt the listed kinds
   when the excerpts support them; omit silently when they don't; never pad.
3. Grounding contract unchanged: every related item carries `citation_chunk_ids` or is
   omitted. Verification (`applyNumericVerification`, `assessAndEnforceClaimSupport`) and the
   render trust ladder apply to related sections exactly as to the core answer, so failure
   still degrades conservatively.

The render side needs nothing new: `answerSections` and `relatedDocuments` blocks already
exist under `answer-render-policy.ts`; check `trustCaps` section limits accommodate the
larger menus at `medium`/`high` trust.

- **Files:** new `src/lib/rag/answer-composition.ts` (+ unit test), `src/lib/rag/rag.ts`
  (prompt + `buildAnswerInput`), possibly `src/lib/answer-render-policy.ts` caps.
- **Gate:** offline 30/30 + 44-case suites re-baselined; retrieval untouched → 36/36 stays
  trivially green; live canary pair before trusting (prompt changes alter answer behaviour);
  Clinical Governance Preflight in the PR body.

### A3 — Moderate length increase (~1.5×)

- Prompt targets in `answerInstructions`: answer field 35–75 → **~60–110 words** (2–4
  sentences); complex-question sections 2–5 → **3–6** where evidence supports. Keep the
  "narrow question → narrow answer" rule verbatim — a definition or single threshold must
  not bloat; the length increase applies to management/comparison/threshold questions where
  yield is real.
- Verify headroom: `OPENAI_MAX_OUTPUT_TOKENS` (16000) is ample; the binding constraint is
  route time, which is why A1 lands first. Check `trustCaps` and any verification heuristics
  that assume the current shape (quote-card counts, section caps).
- Bundle with A2 in one PR if the diff stays reviewable — both are prompt-surface changes
  sharing one canary pair; otherwise ship A2 first, A3 second with its own pair.
- **Files:** `src/lib/rag/rag.ts` (prompt), `src/lib/rag/rag-versioning.ts` (bump
  `ragAnswerPromptVersion` so the response cache and prompt cache key roll), eval baselines.

### A4 — Suggested follow-up questions (new surface)

- Deterministic-first generation (no extra provider call, no added latency): derive 2–4
  candidate next questions from `queryAnalysis` (medications, canonical terms), the
  composition menu of A2 (e.g. dosing answered → offer "monitoring for X", "contraindications
  for X"), and retrieved section headings. Template-based phrasing; only offer a suggestion
  whose subject actually appears in the retrieved evidence.
- Return on `RagAnswer` (new optional field), render near `relatedDocuments`, gated by the
  same trust ladder (suppress at `unsupported`/`low`). Clicking a suggestion submits through
  the existing composer path; `buildAnswerFollowUpQuery` already handles topic carry-over.
  Cross-mode deep links (prescribing, differentials, dsm) go through
  `src/lib/cross-mode-links.ts` / `src/lib/app-modes.ts` hrefs — never raw `<a>`.
- **Files:** new `src/lib/answer-follow-up-suggestions.ts` (+ test), `src/lib/types.ts`
  (`RagAnswer` field), `rag.ts` wiring, one render block, UI wiring per
  `docs/wiring-conventions.md`.
- **Gate:** additive field → `RAG impact: no retrieval behaviour change — additive answer
metadata` if generation prompt untouched; UI proof via `npm run ensure` + focused journey,
  `verify:phone-chrome` if composer chrome is affected.

**Track A sequencing:** A1 → (A2 + A3) → A4. Each PR: `npm run format` + commit,
`verify:pr-local`, offline eval re-baseline, canary pair where behaviour changes, ledger
append, one PR at a time (no bundling across RAG-impact boundaries).

---

## 4. Track B — evaluation & safety infrastructure (corrected PDF Orders 0–7)

Sequenced after Track A's A1–A3 unless a Track A canary surfaces a safety gap first. All
items are offline/lab work with no production behaviour change until their gate passes.

### B0 — Baseline, adversarial fixture contract, data-flow register

As PDF PR 0, corrected:

- Command is **`npm run check:rag:adversarial-fixtures`** (new script
  `scripts/check-rag-adversarial-fixtures.mjs`); the existing `check:rag:fixtures` is
  untouched.
- Fixtures at `scripts/fixtures/rag-adversarial-cases.v1.json` + schema; 20–30 synthetic
  cases in the PDF's 8 categories (injection, citation fabrication, unsupported claim,
  empty/conflicting evidence, scope/tenant, provider failure, adversarial metadata,
  cost/timeout abuse). Include PHI-like canary strings; validator rejects canary literals in
  any reportable output.
- Baseline record: commit SHA, 36/36 result, 30/30 + 44-case results, prompt version,
  `RAG_SEMANTIC_RERANK_ENABLED=false`, report key
  `{commit_sha, dataset_version, eval_config_version, model_version, embedding_version, index_version}`.
- Data-flow register in this directory (`data-flow-register.md`): each input/process/sink,
  retention, and whether de-identified data is permitted — including temp worker paths, CI
  artifacts, caches, provider logs.

### B1 — Telemetry gap assessment (no Phoenix)

As PDF PR 1: dashboard questions first (stage timeout rate, fallback rate, candidate-count
distribution, p50/p95 stage latency); map to existing Sentry/answer-telemetry fields; add
`RAG_TELEMETRY_EXTENDED` (typed in `src/lib/env.ts`, default `false`) only for proven gaps;
unit tests assert canaries never appear in emitted objects. Much of this is shared with
Track A1's instrumentation — build once. Phoenix decision record: **deferred**.

### B2 — Offline adversarial regression harness

As PDF PR 2: Promptfoo pinned as a dev dependency, custom offline provider around the
repository's own offline harness (`RAG_PROVIDER_MODE=offline`, fetch/network rejected),
deterministic assertion functions with their own tests, fed by B0 fixtures. New command
`eval:rag:adversarial:offline`, routed by `scripts/ci-change-scope.mjs` to RAG-surface PRs
only; fails closed on missing fixture, network attempt, or budget breach. If Promptfoo's
dependency footprint proves heavy, a plain Vitest harness over the same fixtures is an
acceptable substitute — the fixtures and assertions are the asset, not the runner.

### B3 — Docling lab benchmark (isolated)

As PDF PR 3, unchanged in substance: `eval/docling/` with hashed lockfile, sandboxed
(non-root, no egress, resource limits), 30–50 public/synthetic fixtures stratified by
document difficulty plus a hostile corpus; compare against the legacy extractor
(`src/lib/extractors/document.ts`, `worker/python/extract_pdf_assets.py`) on parse success,
resource bounds, table precision/recall, exact number/unit/comparator checks. **Do not touch
worker requirements, Dockerfile.worker, or the database.** Gate B: non-inferiority on all
safety/exactness measures + pre-agreed table-heavy improvement.

### B4 — Docling worker shadow mode (conditional on Gate B)

As PDF PR 4: `WORKER_DOCUMENT_EXTRACTOR_MODE=legacy|shadow` (typed, default `legacy`),
shadow runs after legacy success on a 1–5% cohort selected by `src/lib/index-quality.ts`
signals, aggregate metadata only, no chunks/embeddings/index writes, kill switch, one-step
rollback to `legacy`. Worker-reviewer subagent (`ingestion-worker-reviewer`) reviews the PR.

### B5 — Ragas calibration pilot (optional, offline)

As PDF PR 5: adapter reads existing evaluation JSON, egress denied, judge-model use requires
Gate A approval. Retained only if it flags failures the deterministic gates miss at agreed
precision; otherwise archived. Never a release gate.

### B6 — Local cross-encoder reranker benchmark (conditional, offline)

As PDF PR 6, with refutation constraints made explicit: candidates exported with
**differently-relevant** content per case; any serving proposal keeps its score contribution
strictly below `relevance.score` in every comparator chain; requires 36/36, zero per-case
regression, citation-support parity, latency/cost headroom, then a separate default-off
serving PR (`RAG_LOCAL_RERANK_ENABLED=false`) with its own canary pair. Coordinate with
issue `#001` — the existing ambiguity-band semantic reranker stays independent and off.

### B7 — DSPy lab (deferred, re-scoped)

Entry criterion unchanged (≥100 clinician-reviewed cases, 60/20/20 split). **Re-scoped:**
optimise only answer phrasing/section-composition prompts (Track A2/A3 surfaces) — not
query-intent classification, which exists, and never authorization, evidence gates,
citations, or abstention policy. Candidates ship as static reviewed prompt PRs behind
default-off flags.

### Gates A–F (retained from the PDF, collapsed roles)

- **A — data-flow/privacy:** register complete; canary strings absent from every sink;
  owner sign-off before any vendor/provider use.
- **B — Docling extraction:** non-inferior safety/exactness, improved table-heavy metric,
  no budget breach.
- **C — adversarial behaviour:** B2 suite green on the expected refusal/abstention/citation
  contract.
- **D — retrieval/ranking:** 36/36, zero per-case regression, p95 latency and cost in budget.
- **E — clinical quality:** owner's blinded review on representative sources — evidence,
  citations, harmful-advice, abstention. For Track A: before/after answer comparison on a
  fixed question set (the 30 `answerQualityEvalCases` plus ~10 owner-chosen live questions).
- **F — operations:** flag, one-step rollback, runbook, cost cap, redacted telemetry.

---

## 5. Sequencing summary

| Order | Item                                            | Depends on                      | Behaviour change?                      |
| ----- | ----------------------------------------------- | ------------------------------- | -------------------------------------- |
| 1     | A1 budget headroom (`#231`)                     | —                               | Yes → canary pair                      |
| 2     | A2 + A3 intent-conditioned composition + length | A1                              | Yes → canary pair + Gate E comparison  |
| 3     | A4 follow-up suggestions                        | A2                              | Additive (no pair if prompt untouched) |
| 4     | B0 baseline + adversarial fixtures              | — (can run parallel to Track A) | No                                     |
| 5     | B1 telemetry assessment                         | B0 (shares A1 instrumentation)  | No                                     |
| 6     | B2 adversarial harness                          | B0                              | No                                     |
| 7     | B3 Docling lab                                  | B0                              | No                                     |
| 8     | B4 Docling shadow                               | Gate B                          | Worker-only, shadow                    |
| 9     | B5/B6 Ragas/reranker                            | conditional                     | No until separately promoted           |
| 10    | B7 DSPy                                         | ≥100 labelled cases             | No until separately promoted           |

## 6. Verification commands (per PR, smallest first)

```bash
npm run format                      # and COMMIT the result before push
npm run test:focused -- --files <changed source + tests>
npm run check:rag:fixtures          # existing golden/snapshot validator
npm run eval:rag:offline            # offline RAG suite (Track A PRs)
npm run verify:pr-local -- --dry-run --files <paths>   # then run selected gate
npm run check:production-readiness  # domain changes (env flags, answer path)
```

Live canary pairs fire only via the `eval-canary` repository dispatch with explicit owner
approval per run; regression → single-commit revert + confirmation run.

## 7. Rollback map

| Change                     | Rollback                                                                |
| -------------------------- | ----------------------------------------------------------------------- |
| A1 budgets/routing         | revert commit; budgets are constants in `rag-route-budget.ts`           |
| A2/A3 prompt + composition | revert commit; `ragAnswerPromptVersion` bump isolates caches            |
| A4 suggestions             | additive field — revert or hide render block                            |
| B1 telemetry               | `RAG_TELEMETRY_EXTENDED=false`                                          |
| B4 shadow                  | `WORKER_DOCUMENT_EXTRACTOR_MODE=legacy`; no migration or reindex needed |
| B6 reranker                | `RAG_LOCAL_RERANK_ENABLED=false`                                        |

No item in this guide requires an irreversible action; index/database changes and any
cloud-vendor activation remain separate, explicit approval points.
