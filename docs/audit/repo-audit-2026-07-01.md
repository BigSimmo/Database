# Repository Audit — Clinical KB Database

**Date:** 2026-07-01
**Branch:** `claude/cool-wiles-12aade` (worktree)
**Method:** Multi-agent audit — 19 review lanes (dimension × subsystem) using the `code-review` method, each finding adversarially verified by an independent skeptic, deduped, then a completeness-critic gap-fill round. 80 agents, ~5M tokens.
**Scope:** Risk-first, full coverage. Deep line-level review of RAG, ingestion, search/retrieval, privacy/auth, source governance, Supabase/DB, worker, and API surface; lighter sweep of UI, scripts, tests/config/deps.

## Result summary

|                                        | Count                                                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Total findings (post-verification)** | **41**                                                                                                         |
| CONFIRMED                              | 37                                                                                                             |
| PLAUSIBLE                              | 4                                                                                                              |
| By severity                            | High **4**, Medium **17**, Low **20**                                                                          |
| By category                            | correctness 17 · data-integrity 8 · privacy/clinical 6 · quality/simplification 6 · performance 2 · security 2 |
| Flagged safe-cleanup by finders        | 17 (only 2 are _truly_ no-behavior-change — see Auto-fixes)                                                    |

Finders raised more; the numbers above are what **survived adversarial verification**. Verifiers also corrected several severities/categories (e.g. the perceptual-hash and edge-function-secret findings were downgraded from High; the sanitizer finding was re-categorised to data-integrity).

The dominant theme is **clinical-safety / data-integrity in the answer path**: several places where a correct clinical number, threshold, or freshness signal is silently dropped, mis-attributed, or has its "unreliable — verify against source" caveat stripped before it reaches the clinician. These outrank the two (defence-in-depth) security findings.

---

## High severity (4) — clinical answer correctness

### H1 · Numeric faithfulness gate blanks correct answers whose numbers live in synopsis/image text

`src/lib/answer-verification.ts:90` · correctness · CONFIRMED · safe_cleanup=false

- **Defect:** `sourceTextForResult()` builds the numeric-verification corpus from `content / adjacent_context / section_heading / table_facts / memory_cards / index_unit` but omits `result.retrieval_synopsis` and image text (`tableTextSnippet`, `accessibleTableMarkdown`) — even though `buildRagSourceBlock` (`rag.ts:5610-5647`) _shows both_ to the model.
- **Failure:** For a `medication_dose_risk`/`table_threshold` query whose evidence is a visual/table chunk, the real dose/threshold (e.g. `12.5 mg`, `ANC 2.0 x10^9/L`) exists only in `retrieval_synopsis`/image text. The model copies it faithfully, but `verifyAnswerNumbers` marks it unverified; `applyNumericVerification` (`rag.ts:5798-5808`) then discards the whole correct answer and returns a generic "review the source passages" non-answer.
- **Fix:** Include `retrieval_synopsis` + image text in `sourceTextForResult`, mirroring `sourceTextForQuoteVerification` (`rag.ts:880-897`), so the verifier scans the same corpus the model was given.

### H2 · Sanitizer drops clinical threshold sentences misclassified as source-title fragments

`src/lib/source-text-sanitizer.ts:230` (pattern at `:29-30`) · data-integrity · CONFIRMED · safe_cleanup=false

- **Defect:** `clinicalProseUsefulness()` discards any sentence starting near a title keyword (`Guideline/Procedure/Protocol/Policy/Appendix/Scale`) that lacks a concrete-action verb — the `sourceTitleFragmentPattern` regex greedily consumes up to 180 trailing chars (`…Scale\b[^.;]{0,180}`).
- **Failure (reproduced by the agent running the real function):** input _"Assess the patient on admission. The Glasgow Coma Scale ranges from 3 to 15 with 8 or below indicating severe head injury. Document the score."_ → returns _"Assess the patient on admission. Document the score."_ The GCS threshold sentence is silently removed and the truncated text still wins at `rag-answer-text.ts:150` (`usefulness.text || finalText`).
- **Fix:** Don't drop a fragment on title/noise grounds when it contains a clinical numeric/threshold token; anchor `sourceTitleFragmentPattern` so it can't swallow trailing clinical prose.

### H3 · Freshness/validation penalties are silently discarded from the final score

`src/lib/retrieval-selection.ts:473` · privacy/clinical · CONFIRMED · safe_cleanup=false

- **Defect:** `annotateResultWithSelection` writes back `Math.max(originalScore, candidate.score)` as `hybrid_score`, so any net-negative `resultBoost` (outdated −0.24, review*due −0.12, unverified −0.08, poor-extraction −0.12) never lowers the score consumers see — the floor is meant to let intent "rescue" \_raise* a score, but it also blocks all penalties.
- **Failure:** An `outdated` chunk with base 0.70 → ~0.46 after penalties gets floored back to 0.70. `evaluateEvidenceCoverageGate` (`rag.ts:3233`, gate ~0.6) then treats the stale guideline as strong and presents it with high confidence instead of demoting it.
- **Fix:** Don't floor at the original when `resultBoost` is negative — persist the clamped boosted score so freshness/validation penalties reach coverage gating.

### H4 · Ward-note / clipboard table export bypasses the low-confidence safeguard

`src/lib/ward-output.ts:601` · privacy/clinical · CONFIRMED · safe_cleanup=false

- **Defect:** `clinicalTableToTextRows` renders threshold tables straight from raw card rows (`parseMarkdownTable`) and never calls `normalizeAccessibleTable`, so the on-screen "Table structure could not be confidently reconstructed — verify values against the source document" caveat (`AccessibleTable` / `accessible-table-normalization.ts`) is dropped from the copied ward note.
- **Failure:** A clozapine monitoring table flagged `lowConfidence` on screen is copied via `formatWardNote`/`formatAnswerForClipboard` with no caveat; a clinician pastes a mis-paired dose grid into the record and trusts it.
- **Fix:** Route ward-output tables through `normalizeAccessibleTable` (conservativeClinical) and emit the same caveat line when `lowConfidence`.

---

## Medium severity (17)

**Answer/retrieval correctness**

- **M1** `src/lib/rag.ts:647` · `deriveConfidence` takes `max(similarity)` over **all** retrieved chunks, not the cited ones — an uncited high-similarity chunk inflates a weakly-cited answer to high confidence. CONFIRMED.
- **M2** `src/lib/clinical-search.ts:760` · `classifyQueryIntent` uses `containsAny` (substring, not word-boundary) on short tokens (`im`, `po`, `table`, `flow`) → `"time limit"` trips dosing, `"notable"` trips image focus, perturbing ranking (+0.09 dosing / −0.04 image). CONFIRMED.
- **M3** `src/lib/clinical-search.ts:768` · escalation substring match (`review`, `risk`, `rapid`) cancels a legitimate dosing signal — `"clozapine dose review schedule"` loses its dosing boost. CONFIRMED.
- **M4** `src/lib/document-index-units.ts:290` · `fallbackVisualUnitType` tests the flowchart regex (matches bare `yes`/`no`) before the table branch → sparse tables containing "No"/"Yes" are typed `flowchart_step`, degrading typed retrieval. CONFIRMED.
- **M5** `src/lib/document-organization.ts:1337` · reference-collection fallback guarded on `candidates.length === 0`, but an unconfirmed 0.58 tag candidate stays in `candidates` while being dropped from `confirmedCandidates` → doc mis-classified `site=null/needs_review`. CONFIRMED.
- **M6** `src/lib/document-organization.ts:1242` · `evidenceText` omits `title`/`file_name`, so a site named only in the title (e.g. "Sir Charles Gairdner Hospital …") is never detected. CONFIRMED.
- **M7** `src/lib/document-organization.ts:262` · BMJ reference_collection matches the ubiquitous phrase `best practice` (OR'd with `bmj`) → any doc saying "best practice" is falsely attributed to "BMJ Best Practice" @0.92 — a false provenance claim in a governance context. CONFIRMED.
- **M8** `src/lib/ward-output.ts:606` · when `rows` is null but `columns`+`markdown` present, the parsed markdown **header row is re-emitted as the first data row** (no `slice(1)`). CONFIRMED.

**Data integrity**

- **M9** `src/app/api/documents/[id]/route.ts:503` · DELETE active-job guard checks only `status='processing'`, missing `pending`; a just-queued reindex racing a delete orphans freshly-uploaded storage objects. Reindex routes correctly use `checkIngestionMutationSafety` (`in ['pending','processing']`). CONFIRMED.
- **M10** `src/components/ClinicalDashboard.tsx:6533` · `executeSearch`/`applySearchResult` have no request-token/abort guard → out-of-order responses can show query A's answer under query B's question (bootstrap auto-search + user submit). CONFIRMED.
- **M11** `src/lib/deep-memory.ts:644` · `upsertDocumentDeepMemory` deletes memory cards/sections/index-units **non-atomically** before rebuild; an OpenAI/insert failure after the deletes wipes memory while metadata still advertises the old version → silent retrieval degradation until full reindex. CONFIRMED.
- **M12** `src/lib/image-filtering.ts:349` · 16-bit (4-hex) `lightweightPerceptualHash` collapses distinct same-dimension clinical images into one visual family → one of two different threshold tables silently dropped from the index. CONFIRMED (downgraded from High).
- **M13** `supabase/migrations/20260628000000_atomic_reindex_generation_commit.sql:120` · `commit_document_index_generation` deletes NULL-generation (legacy) artifact rows, which retrieval treats as committed/visible; a transient artifact-write failure that still commits `status='indexed'` permanently loses the previously-good legacy artifacts. CONFIRMED.

**Privacy / clinical**

- **M14** `src/lib/chunking.ts:12` · `lineNoisePatterns[0]` matches unanchored `p N`/`page N` anywhere in a line and `removePageNoise` drops the whole line → clinical lines like "refer to p 3 for dosing" are deleted before indexing. CONFIRMED.
- **M15** `src/lib/query-privacy.ts:8` · redacted mode stores an **unsalted SHA-256** of the normalized query as the placeholder and `query_hash`; short low-entropy clinical queries are dictionary-reversible and cross-row correlatable. Fix: HMAC with a server-side secret. CONFIRMED.
- **M16** `src/lib/ward-output.ts:611` · header/body cell-count mismatch — a ragged row with more cells than columns emits misaligned markdown, pairing the wrong threshold with the wrong action in the copied note. CONFIRMED.

**Correctness (added 2026-07-02 — omitted from the first draft of this report; the workflow produced 17 Medium findings but only 16 were listed)**

- **M17** `src/lib/chunking.ts:320` · `chunkTextBySentence` makes no forward progress when `CHUNK_OVERLAP >= CHUNK_SIZE` (both pass env validation independently): `readableOverlapStart` returns a start ≤ the previous start and the `while` loop spins forever, hanging the ingestion worker on that document. CONFIRMED (reproduced by trace).

---

## Low severity (20)

**Correctness**

- **L1** `scripts/purge-query-logs.ts:25` · unknown flag silently consumes the next arg (typo'd `--owner-emial` swallows the email, then purges the env-configured owner's logs). CONFIRMED.
- **L2** `scripts/recover-ingestion-queue.ts:49` · typo'd `--limit` → NaN → silently defaults to 20 (mutates up to 20 jobs instead of the intended cap). CONFIRMED.
- **L3** `src/lib/evidence-relevance.ts:347` · aggregate `nearby` branch uses `|| results.length > 0` (always true) → the `none` verdict is dead; zero-term-match sets are labelled `nearby`, overstating evidence in governance/telemetry. CONFIRMED.
- **L4** `src/lib/retrieval-selection.ts:463` · boosted score clamped low (`Math.max(0, …)`) but not to an upper bound of 1 → `hybrid_score` can exceed 1.0 into telemetry/consumers. CONFIRMED.
- **L5** `src/lib/validation/form-data.ts:9` · no-op ternary `typeof value === "string" ? value : value` — a File `title`/`description` part isn't coerced to null and makes the whole `/api/upload` 400. CONFIRMED.
- **L6** `src/lib/visual-intelligence.ts:401` · deterministic fallback keeps only a hardcoded drug allowlist (clozapine|lithium|…), silently discarding e.g. quetiapine/sertraline extracted by the clinical vocabulary. CONFIRMED.
- **L7** `supabase/functions/indexing-v3-agent/index.ts:437` · non-retryable OpenAI 4xx (bad model / revoked key) is retried `OPENAI_MAX_RETRIES` times instead of failing fast. CONFIRMED.

**Data integrity**

- **L8** `src/lib/deep-memory.ts:865` · committed-generation filter fails open (`if (documentsError) return true`) — a transient documents-table error during a staged reindex can expose superseded-generation cards. PLAUSIBLE (narrow race).
- **L9** `worker/main.ts:1406` · `imageCount` (→ `p_image_count`) counts searchable-only rows, excluding audit-retained images that were still inserted; reconciliation tooling may see a mismatch. PLAUSIBLE (likely intentional).

**Performance**

- **L10** `src/app/api/search/route.ts:666` · `buildEvidenceRelevance` runs ≥2× and `buildVisualEvidence` ≥3× per search over the full result set, and the smart-panel relevance is then overwritten — wasted CPU on the hot path. CONFIRMED.
- **L11** `worker/main.ts:997` · each image is `readFile`'d up to 3× per ingestion (hash, caption cache-miss, upload) → 3× disk I/O + peak memory. CONFIRMED.

**Privacy / clinical**

- **L12** `src/lib/privacy.ts:6` · `redactLogValue` returns non-string values unchanged, so an error whose `details`/`code`/`hint` is an object is logged verbatim (potential URL/email/PHI leak). CONFIRMED.

**Quality / simplification**

- **L13** `next.config.ts:31` · CSP `connect-src` lists both the explicit Supabase host and `https://*.supabase.co` (redundant). CONFIRMED. → **auto-fixed** (see below).
- **L14** `src/lib/answer-ranking.ts:~324` (reported as `answer-formatting.ts:327`) · `capBoldSegments` lets newly-bolded tokens that collide with pre-existing bold text bypass the max-segment cap. CONFIRMED.
- **L15** `src/lib/cross-document-synthesis.ts:195` · dead ternary `queryClass === "comparison" ? 2 : 2`. CONFIRMED. → **auto-fixed**.
- **L16** `src/lib/document-tags.ts:264` · dead `return false` special-cases (default is already `return false`) — behaviorally dead, misleads about protection a future rule would bypass. CONFIRMED. (left as recommendation — encodes intent)
- **L17** `src/lib/ingestion.ts:7` · unreachable page-number-duplicate retry clause (`isPartialIndexWriteConflict` short-circuits first). CONFIRMED. (left as recommendation — needs an intent decision)
- **L18** `supabase/migrations/20260630090000_audit_logs_service_role_policy.sql:10` · re-declares the identical `audit logs service role all` policy already created in `20260629110000_audit_logs.sql` — drift risk on replay. CONFIRMED. (do **not** edit an applied migration; recommendation only)

**Security (defence-in-depth)**

- **L19** `next.config.ts:7` · production CSP allows `script-src 'unsafe-inline'` with no nonce/hash. PLAUSIBLE — factually true, but the app has **zero** `dangerouslySetInnerHTML` sinks (React auto-escapes doc text + LLM answers), so no active XSS path today. Recommend nonce-based CSP as hardening.
- **L20** `supabase/functions/indexing-v3-agent/index.ts:186` · agent secret compared with non-constant-time `!==` on a `verify_jwt=false` function. PLAUSIBLE — timing weakness is real, remote byte-by-byte recovery over TLS jitter is not realistically demonstrable. Recommend a timing-safe compare.

---

## Coverage

19 lanes reviewed; the completeness critic surfaced 6 gaps, all filled:

| Area                | Lanes                                                                                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deep (risk-bearing) | rag-engine, rag-routing, search-retrieval, clinical-search, ingestion-core, index-units, worker, enrichment, visual, privacy-auth, governance-safety, supabase-db, openai, api-surface, deep-memory-polish, security-sweep |
| Light sweep         | ui-components, scripts-cli, tests-config-deps                                                                                                                                                                              |
| Gap-fill (critic)   | clinical-output-rendering, document-mutation-reindex-correctness, deep-memory-logic, database-migrations-rls-rpc, request-primitives-rate-limit                                                                            |

Clean lanes (no surviving findings): `supabase-db` client setup (no service-role-key leakage to the browser bundle found). The gap round is where H4, M8, M9, M11, M13, M16, L5, L8, L18 were caught — i.e. clinical-output rendering and mutation-race correctness were under-covered by the first pass.

## Corroborated pre-existing debts

- **eslint↔lockfile drift** (lockfile pins eslint 10.4.1 vs `eslint-config-next` needing eslint 9) — confirmed in `docs/redesign/04-deferred.md`; risks a clean-`npm ci` CI lint break. **Not** auto-fixed (dependency/lockfile change needs your sign-off).
- Embedding-dimension/schema sync has no runtime guard (relates to M-class ingestion risks).
- RLS multi-user integration test (RET-H4) still missing; HNSW `ef_search` migration remains a no-op.

---

## Remediation — 2026-07-02 (all findings actioned)

Following user approval, every finding was reviewed and fixed (or explicitly dispositioned) on the
working tree of `claude/cool-wiles-12aade` (uncommitted, nothing pushed). 42 files changed
(+844/−156), including 14 new regression tests.

### Fixed (behavioral)

| ID        | File                                                                | Fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1        | `src/lib/answer-verification.ts`                                    | verification corpus now includes `retrieval_synopsis` + image table text (mirrors `sourceTextForQuoteVerification`); 2 regression tests                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| H2        | `src/lib/source-text-sanitizer.ts`                                  | new `clinicalThresholdSignalPattern` rescue — threshold-bearing fragments are never dropped by title/noise heuristics; GCS regression test + bare-integer noise still dropped                                                                                                                                                                                                                                                                                                                                                                                                                      |
| H3+L4     | `src/lib/retrieval-selection.ts`                                    | **SUPERSEDED by PR #118 on main** (merged 2026-07-02, after this audit's base commit): the golden retrieval eval measured that source-governance metadata weighting in selection buries correct documents on the partially-enriched corpus (doc-recall@5 1.0→0.76), so #118 **removed the penalties entirely** and clamped the candidate score — resolving both H3's premise and L4. This branch's `retrieval-selection.ts` + its contract test are now aligned **verbatim** with origin/main's #118 version (any deviation requires re-running `npm run eval:retrieval:quality`, 23/23 required). |
| H4+M8+M16 | `src/lib/ward-output.ts`                                            | copied tables routed through `normalizeAccessibleTable` (conservativeClinical) with the on-screen low-confidence caveat; markdown header no longer duplicated as a data row; ragged rows padded/merged; 3 regression tests                                                                                                                                                                                                                                                                                                                                                                         |
| M1        | `src/lib/rag.ts`                                                    | `deriveConfidence` takes the citation array and scopes strongest-similarity to cited chunks (4 call sites)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| M2+M3     | `src/lib/clinical-search.ts`                                        | word-boundary signal matching (short acronyms whole-word); explicit dose terms survive escalation cancellation; 5 regression assertions                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| M4        | `src/lib/document-index-units.ts`                                   | bare `yes`/`no` only counts as flowchart evidence when the image is not structurally a table                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| M5+M6+M7  | `src/lib/document-organization.ts`                                  | fallbacks gate on confirmed candidates; title/file_name in the evidence haystack (bracket segments stripped so `(FSH)` tags still can't self-confirm — pinned by an existing test); BMJ requires the `bmj` token; 2 regression tests                                                                                                                                                                                                                                                                                                                                                               |
| M9        | `src/app/api/documents/[id]/route.ts`                               | DELETE blocks on `pending` OR `processing` jobs (parameterized regression test)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| M10       | `src/components/ClinicalDashboard.tsx`                              | request-id ref guard — only the latest search commits answer/error/loading state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| M11+L8    | `src/lib/deep-memory.ts`                                            | all embeddings computed BEFORE deleting old memory (failure window no longer spans OpenAI); fallback committed-generation filter fails closed on lookup error (test updated to pin fail-closed)                                                                                                                                                                                                                                                                                                                                                                                                    |
| M12       | `src/lib/image-filtering.ts`                                        | perceptual hash upgraded ph1 (16-bit) → ph2 (192-bit; threshold + quantized-level bits); version bump prevents legacy aliasing                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| M13       | `supabase/migrations/20260702000000_…` + `schema.sql`               | **new** migration: `commit_document_index_generation` purges legacy NULL-generation rows only when replacement rows exist in the same table. **Not yet applied to the live DB** — apply via the normal migration flow                                                                                                                                                                                                                                                                                                                                                                              |
| M14       | `src/lib/chunking.ts`                                               | page-noise pattern anchored to the whole line; inline "p 3" references survive (regression test)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| M15       | `src/lib/query-privacy.ts`, `env.ts`, `.env.example`                | HMAC-SHA256 keyed hash when `RAG_QUERY_HASH_SECRET` (new, optional, min 16 chars) is set; legacy digest kept when unset for continuity — **set the secret in any environment logging real queries**                                                                                                                                                                                                                                                                                                                                                                                                |
| M17       | `src/lib/chunking.ts`                                               | strict forward-progress guard in `chunkTextBySentence` (regression test at overlap == chunkSize)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| L1/L2     | `scripts/purge-query-logs.ts`, `scripts/recover-ingestion-queue.ts` | unknown flags and malformed numeric flags now throw instead of silently misbehaving                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| L3        | `src/lib/evidence-relevance.ts`                                     | aggregate `none` verdict reachable — nearby requires matched terms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| L6        | `src/lib/visual-intelligence.ts`                                    | fallback medications derived from the vocabulary's medication category, not a hardcoded allowlist                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| L7+L20    | `supabase/functions/indexing-v3-agent/index.ts`                     | non-retryable 4xx fails fast; timing-safe (hashed) secret comparison; Deno typecheck passes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| L10       | `src/app/api/search/route.ts`, `src/lib/evidence.ts`                | relevance/visual evidence computed once per request and shared with the smart panel (both call sites)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| L12       | `src/lib/privacy.ts`                                                | non-string error fields serialized and redacted instead of passing through verbatim                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| L14       | `src/lib/answer-ranking.ts`                                         | bold cap counts per-occurrence free passes; new tokens can't tunnel past the cap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| L16/L17   | `src/lib/document-tags.ts`, `src/lib/ingestion.ts`                  | dead/misleading branches removed with intent documented                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

### Dispositioned without behavior change (with rationale)

| ID      | Disposition                                                                                                                                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| L5      | The audit's recommended fix (coerce File→null) was **wrong**: `tests/api-validation-contract.test.ts` pins that non-string multipart metadata must 400 before any storage/DB write. The no-op ternary was replaced by a pass-through with the contract documented. |
| L9      | `image_count` = searchable-only is intentional (retrieval filters `searchable=true`); the verifier found no consumer reconciling against it. No change.                                                                                                            |
| L11     | Triple `readFile` is a deliberate peak-memory trade-off (holding hundreds of multi-MB buffers is worse than re-reading); documented at the site.                                                                                                                   |
| L18     | Both audit_logs policy migrations are already applied — editing applied migrations creates replay drift. Consolidate only if migrations are ever squashed.                                                                                                         |
| L19     | CSP `unsafe-inline` hardening (nonce-based CSP) deferred: no XSS sink exists today (zero `dangerouslySetInnerHTML`), and a nonce migration needs dedicated UI verification. Tracked as accepted risk.                                                              |
| L13/L15 | Applied earlier as the safe auto-fix pass (CSP host dedup; dead ternary).                                                                                                                                                                                          |

### Adversarial diff-review round (2026-07-02)

Five parallel review agents then audited the fix diff itself. They confirmed the bulk of the
changes sound and surfaced **12 follow-up findings — all fixed** in the same working tree:

| # | Finding (introduced/incomplete) | Resolution |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| R1 | **HIGH** — H3's un-floored penalties **compounded** across the pipeline's 2–3 selection passes (`baseScore` re-read the penalized `hybrid_score`) | resolved by discarding the H3 change and aligning `retrieval-selection.ts` verbatim with PR #118 (relevance-first, no metadata penalties — see H3 row). Residual note: POSITIVE intent boosts still compound mildly across passes on main's design (pre-existing, eval-validated); a `preSelectionScore` idempotency fix was prototyped and withdrawn — reintroduce only gated on the golden eval. |
| R2 | M2's whole-word `mg`/`mcg` no longer matched digit-attached doses ("10mg"), and could re-cancel dosing via M3 | `(?:\b                                                                                                                                                                                                                                                                                                                                                                                             | \d)` digit-adjacent allowance (regression test "clozapine 100mg…") |
| R3 | L3's aggregate `none` could contradict per-source "nearby" chips for purely-semantic matches and trip the danger governance banner | aggregate `nearby` also granted when relevance score ≥ 0.5 |
| R4 | H1 incomplete — rich-mode prompts show table-fact **metadata** snippets (`accessible_table_markdown`/`table_text_snippet`/`cells`) not covered by the corpus | included in both `tableFactText` (verification) and `tableFactQuoteText` (quotes) |
| R5 | H2's rescued noisy fragments inflated `provenanceScore` past 0.42, flipping `useful` false and blanking text that previously survived | provenance computed over baseline-kept fragments only; thresholds count toward `clinicalSignalScore` |
| R6 | `x10` threshold branch matched "Rx100"/"0x10" | lookbehind guard `(?<![a-z0-9])` |
| R7 | H4 parity gap — on-screen `AccessibleTable` still passed `columns` for markdown-parsed rows (M8 live on screen; screen/clipboard could disagree on headers and the caveat) | same header-source rule applied in `AccessibleTable.tsx` |
| R8 | section gating (raw shape) vs emission (normalize) disagreement could emit a dangling "Thresholds" heading | `sectionOutputLines` skips heading when items and normalized tables are both empty |
| R9 | M10 guard missed in-flight progress updates (retry/keyword/stream messages) — stale request could repaint the banner | guarded `onProgress` threaded through `runWithRetries`/`requestAnswer` |
| R10 | M6's bracket-strip guard didn't cover `source_path`, which echoes the file name — `(FSH)` tags could still self-confirm | `source_path` bracket segments stripped too |
| R11 | M13's guard is structurally vacuous for the 3 chunk-anchored tables (`source_chunk_id ON DELETE CASCADE` follows the replaced legacy chunks) | guarantee scope stated precisely in migration + schema.sql (full protection: images, memory cards, sections — cascade is required, orphaned artifacts would be unreachable) |
| R12 | M13 incomplete — the worker's client-side fallback (`deleteStaleIndexGenerationRows`, used when the RPC is missing) still deleted NULL-generation rows unconditionally | fallback now checks for replacement rows per table before purging legacy rows, mirroring the RPC |
| R13 | L2 incomplete — `recover-ingestion-queue` still silently ignored typo'd flag _names_ (the audit's original scenario) and missing/empty values | strict token walk: unknown flags and missing values throw |

Also confirmed sound by the reviewers (no action): env-parse fail-fast for a short hash secret, no
client-bundle secret leak, HMAC-switch dedup continuity, `deriveConfidence` call-site coverage,
deep-memory section-id mapping after the reorder, edge-function auth call sites, ph2 consumer
compatibility, CSP wildcard coverage, hooks-rules compliance of the new ref, and the M5/M7/L14/L16
changes.

### Verification (2026-07-02, after the diff-review round)

- `typecheck` — **PASS** (`tsc --noEmit`).
- `test` — **PASS**: 703 passed, 2 skipped (86 files passed, 1 skipped) — includes 15 new regression tests; 3 pre-existing tests updated where they pinned the buggy behavior (delete-guard message, fail-open memory filter, ph1 format).
- `check:edge:functions` — **PASS** (Deno typecheck of the modified edge function).
- `lint` — **still cannot run**: `node_modules/eslint` is missing in this worktree (pre-existing eslint 9/10 lockfile-drift environment gap, unrelated to these fixes). Restore with `npm ci` / resolve the pin before relying on the lint gate.

### Migration note

`20260702000000_commit_generation_preserve_legacy_artifacts.sql` is committed to the repo tree but
**has not been applied** to the live Supabase project (`sjrfecxgysukkwxsowpy`). Apply it through the
normal migration workflow and run `npm run reindex:health` + `npm run check:indexing` afterwards.

### Branch divergence note

This branch (`claude/cool-wiles-12aade`) is based at `f5eb4cdc2` (PR #110); origin/main has since
merged PRs #111–#118, including #118's measured relevance-first retrieval-selection change.
`src/lib/retrieval-selection.ts` and its governance contract test were aligned verbatim with
origin/main to avoid semantic/textual merge conflicts, but the remaining fixes in this tree were
authored against the #110 base — expect ordinary merge reconciliation for any other files PRs
#111–#118 touched (e.g. `search_schema_health` was reconciled by #117). Re-run the unit suite after
merging.

Everything else — including the other 15 finder-flagged "safe_cleanup" items — **changes behavior** (they're bug fixes, not pure cleanups) or touches applied migrations, so per the agreed policy they are left as **reviewed recommendations** above, not auto-applied. In particular, all High/Medium clinical-safety fixes require your review.

## Recommended fix order

1. **H1–H4** (clinical answer correctness) — these can surface wrong or blanked clinical info; fix first.
2. **M9, M11, M13** (mutation-race / non-atomic / legacy-artifact data loss) — risk of permanent data loss.
3. **M2, M3, M4, M1** (ranking/confidence correctness), then **M5–M8** (classification/provenance).
4. **M15** (keyed query hash) and **L12** (log redaction) — privacy hardening.
5. Low-severity correctness (L1–L7) and the two security hardening items (L19, L20) as capacity allows.
