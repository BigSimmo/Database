# RAG Hybrid Retrieval — Findings & To-Do (2026-07-01)

Living list of issues found while fixing the live-only hybrid-RPC schema drift and optimising the
online RAG. Grouped by priority. Anything marked ✅ is done + validated this workstream; ⏳ is the
outstanding backlog. See also the master plan
(`C:\Users\joshs\.claude\plans\please-review-the-current-synthetic-pinwheel.md`) for RC IDs and
`docs/search-rag-master-plan.md`.

---

## ✅ Completed this workstream

- **All four hybrid retrieval RPCs de-drifted, fixed, and hardened** (RC16). Each had been converted
  live-only `language sql`→`plpgsql` (to set `hnsw.ef_search`), which shadowed the `RETURNS TABLE`
  output params → `42702 column reference "id" is ambiguous` → RPC threw → app swallowed the error
  and silently ran on lexical + pure-vector fallbacks. Fixed + validated on live:
  - `match_document_chunks_hybrid` — migration `20260701010000` (content-tsv candidate filter kills
    the cross-table-OR seq-scan; 130s→~4s).
  - `match_document_index_units_hybrid` — text-candidate-gated, vector distance only for the bounded
    set (~0.6s). Migration `20260701020000`.
  - `match_document_embedding_fields_hybrid` — UNION of HNSW `vector_hits` + GIN `text_hits`, scores
    only the small combined id set; replaces the 215k-row vector/text OR seq-scan (~0.25–0.7s).
    Migration `20260701020000`.
  - `match_document_memory_cards_hybrid_v2` — plpgsql→sql only (it already had the good separate
    vector/text CTE shape); ef_search=100 still applied by the outer plpgsql wrapper. ~0.25–0.35s.
    Migration `20260701020000`.
  - Grants reconciled: every function locked to `service_role` (revoked `public`/`anon`/`authenticated`).
- **Full-stack eval after all four fixes** (`eval:retrieval:quality`, 10 golden cases, live):
  `content_recall@5 = 1.0`, `top_k_hit_rate = 1.0`, `document_recall@5 = 0.9`, `mrr@10 = 0.767`,
  median 1.5s, p90 8.6s. Hybrid path is fully alive; one golden case regressed on doc-ranking only
  (see P1 below).
- Naturalness: minimal/values-only **bolding**, v15 synthesis prompt for **flattened-table run-ons**,
  and the deterministic `separateSettingRunOns` safety-net — all validated on real answers.
- Offline / source-only fallback (Workstream F core): `RAG_PROVIDER_MODE=auto|openai|offline`,
  embedding-free retrieval, fail-closed on weak evidence, `answerQualityTier` labels + UI disclosure,
  `insufficient_quota` split from rate-limit.

---

## P0 — correctness / observability ✅ DONE (2026-07-01)

1. ✅ **App silently swallows hybrid-RPC failures — FIXED.** Added `recordHybridRpcError` in
   `src/lib/rag.ts` (structured `logger.error("hybrid_rpc_failed", …)` + new
   `SearchTelemetry.hybrid_rpc_errors` map surfaced in `rag_retrieval_logs`), threaded through
   `searchEmbeddingFieldCandidates` / `searchIndexUnitCandidates` / the chunks call, and a matching
   `logger.error` at the memory-card call in `src/lib/deep-memory.ts`. A dead hybrid layer now logs +
   shows in telemetry instead of returning `[]` silently. Typecheck + 676 tests green.
2. ✅ **`search_schema_health()` execution smoke — DONE.** Migration
   `20260701030000_schema_health_hybrid_execution_smoke.sql` invokes each of the four hybrid RPCs with
   a zero vector + probe query in a per-RPC exception block and reports `<rpc>.execution:<sqlstate>` in
   `missing`. **Proven:** re-introducing the plpgsql ambiguity in a rollback tx made the check report
   `match_document_memory_cards_hybrid.execution:42702`; live is `ok:true`. Flows automatically into
   `check:indexing` and `setup-status` (both read `ok`/`missing`).
3. ✅ **Remaining live-only drift reconciled — DONE.** Migration
   `20260701040000_drop_dead_drifted_hybrid_variants.sql` drops the six dead, drifted plpgsql shadow
   variants (`_chunks_hybrid_review_v1`, `_embedding_fields_hybrid_v2`, `_embedding_fields_rrf`,
   `_embedding_fields_vector`, `_index_units_hybrid_v3`, `_memory_cards_hybrid_v3`) + the one eval
   helper (`eval_memory_retrieval_v2_v3`) that referenced v3 — all verified zero callers (app,
   scripts, migrations, live function bodies). Live now has exactly the 4 real RPCs + the memory_cards
   `_v2` delegate + its plpgsql wrapper, matching the migration-defined set.

## P1 — retrieval ranking quality

4. 🔍 **Answer-path ranking investigated (2026-07-01) — healthy; low mrr is a sibling-doc artifact,
   NOT a defect.** Probed every low-`rr@10` golden case. In each, the docs ranked above the pinned
   one are **legitimate siblings** the corpus genuinely contains: several _Safety Planning_ guidelines
   (KEMH/RKPG/AKG), multiple hospital versions of _Active Community Patients in ED_, multiple
   opioid-pharmacotherapy guidelines, and the two agitation guidelines. Recall stays 1.0 and the model
   gets correct context; forcing the pinned doc to #1 over equally-valid siblings would be overfitting.
   **So items 1/6 (query-class weighting to raise mrr) are deprioritized** — chasing that metric on
   this corpus optimizes for the golden's arbitrary single-doc pin, not answer quality.
   - Secondary observation: **`finalScore` saturates at the `clamp` ceiling of 1.0**
     (`clinical-search.ts:1362`) — base + the ~40 stacked boosts routinely exceed 1.0, so many strong
     matches tie at 1.0 and order by an arbitrary `document_id` tiebreak. It doesn't hurt these cases
     (the tied docs are all relevant), but it wastes the boost engineering. If ever revisited, break
     ties by the _pre-clamp_ score rather than raising the ceiling (downstream gates assume [0,1]).
   - The second-stage rerank (which uses unclamped scoring + a strong dose-amount/title boost) rarely
     fires for document_lookup/broad_summary (`shouldUseSecondStageRerank` needs `topScoresClose &&
hasVisualEvidence`, `rag.ts:548`). Widening it (RC10) could restore discrimination among the
     1.0-tied group, but since the tied docs are valid siblings the payoff is marginal and unvalidatable
     on the current golden set — do it only alongside a chunk-level "best-passage-first" eval metric.
5. ⏸️ **`ef_search` policy inconsistent — BLOCKED, deferred.** Attempted `ALTER FUNCTION … SET
hnsw.ef_search='100'` on the three sql functions; **hosted Supabase denies it (`42501 permission
denied to set parameter`)** — the RC11 blocker. The only method hosted allows is the plpgsql-wrapper
   - runtime `PERFORM set_config('hnsw.ef_search','100',true)` pattern (what memory_cards uses; measured
     latency-neutral: chunks 76→79ms warm). Deferred: the recall gain is unquantified (golden already 1.0)
     and there's no hard-query eval set to justify adding three plpgsql wrappers. Revisit once an
     expanded/hard eval set exists (see P2.8).
6. **RC5–RC13 ranking tuning** — partially addressed / re-scoped after the item-4 investigation:
   - ✅ **Same-document crowding (RC7)** — the `/api/search` results panel cap was lowered
     `maxPerDocument 4→3` (`app/api/search/route.ts`, backfill-protected so result count is unchanged).
     Note: this only affects the **panel**; the answer-retrieval path (`searchChunksWithTelemetry`) has
     no per-doc cap and doesn't need one — the comparison gate already enforces ≥2 distinct docs, and
     single-topic queries _should_ be able to draw multiple chunks from the best document.
   - ⏳ **Synthetic text similarity (RC9)** `least(0.95, 0.56 + text_rank*0.39)` still feeds coverage
     gates that assume a real cosine — gate text-only paths on `text_rank`/`rrf` instead. (Cleanest
     remaining ranking-correctness item.)
   - ⏳ **Source-strength as a filter not just a penalty (RC8)**; **threshold floors (RC5)**;
     **rerank trigger (RC10)** — see item 4's note (marginal without a chunk-level eval metric).
   - ⏳ **Differentials flowchart-action boost (dropped in the PR #120 merge).** The codex/RAG_FIX
     branch carried a `hasRiskFlowchartActionSignal` boost in `retrieval-selection.ts` (+0.18 for
     risk-flowchart action text, +0.05 metadata-conditional, −0.14 for flowcharts without action
     signals) tuned for differentials-mode queries against the pre-optimization scoring. It was
     dropped when merging main's relevance-first selection because its metadata-conditional part
     violates the "governance must not reorder selection" contract and it was never measured against
     the golden retrieval eval. If differentials-mode retrieval quality needs a lift, re-propose the
     action-signal part (without the metadata condition) through the golden eval; the original code
     is in PR #120 history (`git show 635485998^1:src/lib/retrieval-selection.ts`).
   - Higher-value redirect than mrr-chasing: **item 9 (enrichment/reindex — the OCR extraction drops
     letters, e.g. "score"→"core", "psychosis"→"p ycho i ", which hurts both lexical matching and the
     readability of quoted answer text)** and **item 10 (DB-backed synonyms/typos)**.

## P2 — latency, eval coverage, data

7. ⏳ **p90 retrieval ~8.6s on hybrid cases.** Multiple sequential Supabase RPC round-trips per query
   (embedding + chunks + table_facts + embedding_fields + index_units + memory_cards + rerank). Some of
   this is local-machine→remote-DB network latency (prod is co-located), but consider firing the
   independent layer RPCs in parallel and/or trimming layers that don't move recall.
8. ✅ **Golden eval set expanded 10 → 23 (2026-07-01).** Added 12 verified cases built from real
   corpus content (condition guidelines — bipolar, alcohol, opioid, schizophrenia, insomnia, suicide,
   depression — which the original EMHS-only set lacked) across broad_summary/comparison/
   medication_dose_risk, plus the CIWA table_threshold case (8b regression guard). All queries
   pre-classified so `expectedQueryClass` matches; expectations anchored on clean title/filename
   substrings + robust content OR-groups. Agitation sibling accepted via a `clinicalDocumentAliases`
   entry (both agitation guidelines are correct sources), so `agitation-im-po-options` now passes.
   **New baseline (all green): 23 cases, document_recall@5=1.0, content_recall@5=1.0,
   top_k_hit_rate=1.0, mrr@10=0.74, median 1.1s / p90 4.4s, failed_cases=0.** A single case is now
   ~4.3% (was 10%). Still to add later: offline/degraded cases (measure source-only quality) and
   `rag_query_misses` queries.

   **Two real bugs the expansion surfaced — both now FIXED:**
   - **8a. ✅ `medication_dose_risk` over-triggered on "risk" — FIXED.** Bare `risk|urgent|escalat*`
     were removed from `medicationDoseRiskPattern` in `clinical-search.ts` (with no medication/dose
     signal they misrouted topical queries into the dose plan). "What does the guideline say about
     suicide risk mitigation?" now classifies `document_lookup` and retrieves the Suicide risk
     mitigation doc at ranks #1–4 (was buried, docRecall 0.0). Regression guard added to
     `tests/clinical-search.test.ts`; all legit medication_dose_risk cases unchanged.
   - **8b. ✅ FTS over-conjunction — FIXED.** Root cause: `websearch_to_tsquery` ANDs every term, so
     the 7-term query "ciwa score threshold drug treatment alcohol withdrawal" matched **0** chunks
     even though the answer chunk exists ("CIWA-Ar score <10 or GMAWS <2 do not require drug
     treatment"); only generic `table_facts` (BGL/infusion "threshold/level" matches) filled in. Added
     `relaxVariantToOrQuery` + an OR-relaxation fallback in `searchTextChunkCandidates` (`rag.ts`):
     when the strict AND variants return nothing, retry once with a term-OR query — `ts_rank_cd` still
     ranks chunks matching more terms highest, so topical docs surface on top (verified: Alcohol
     withdrawal docs now fill top-5, `text_candidates` 0→48) without flooding, and it never displaces a
     working precise match. Unit tests in `tests/retrieval-query-variants.test.ts` + the
     `alcohol-ciwa-threshold` golden case guard it. **This is a general recall win, not just CIWA** —
     any long multi-term query previously risked silent 0-match FTS.

9. ⚠️ **OCR "dropped-s" defect — real but NOT reliably heuristically-detectable; guard attempted then
   REVERTED (2026-07-01). Honest post-mortem below.**
   - **What's true:** real dropped-'s' corruption exists in some table-derived index units
     ("psychosocial"→"p ycho ocial", "1st mood stabiliser"→"1 t mood tabili er"). The **raw
     `document_chunks` (answer context) are clean** — 0 docs below 0.025 s-ratio — so **generated
     answer text is not degraded**; the defect only touches structured _table_ units (OCR'd from
     images), and the intact numbers survive ("CIWA-Ar **core** <10" keeps the "<10").
   - **The detection is the hard part — every heuristic false-positives.** First tried an s-ratio
     detector (`'s'`/letter < 0.03): it flagged 772 units but **only 135 were real (82% false
     positives)** — clean low-'s' clinical prose ("Withholding warfarin and commencing enoxaparin …
     INR < 1.5") trips it. Switched to a fragmentation signal (orphan 1–2 char tokens): it then
     false-positived on legitimate short table cells (risk-matrix "A/B/C"), "e.g."/"i.e." → "e","g",
     and ordinals "1st"/"2nd" → "st","nd". Each refinement (lowercase-only orphans, common-word
     exclusions) removed some FPs and revealed others. **Conclusion: simple token heuristics cannot
     separate real corruption from legitimate structured/abbreviated clinical text.**
   - **Guard reverted.** The `buildUnit` guard (append clean source-chunk text when corruption is
     detected) was removed along with `hasSuspectedOcrDropout` — it would fire on thousands of
     false-positive units, appending chunk text broadly with a precision cost, for a modest benefit.
     Shipping an unreliable heuristic into live clinical retrieval isn't justified.
   - **Broad backfill (task B) NOT run.** A validation run on ~50 stale images (via
     `backfill-visual-intelligence`, embeddings-only) actually **raised** the (mis)count, which is what
     exposed the detector's false positives. Those images were legitimately refreshed (they were
     version-stale anyway); a few units carry harmless appended source-chunk context from the
     since-reverted guard — will normalize on the next reindex. No further docs were processed.
   - **If ever pursued (low priority, modest impact):** reliable detection needs a **dictionary/
     spellcheck approach** ("fraction of tokens that aren't valid English/clinical words") or fixing
     the **upstream table-OCR** step — not a token heuristic. Neither is warranted by the impact.
     Remaining true enrichment items: confirm `20260627000000_retrieval_hnsw_ef_search.sql` on live; run
     `enrich:backfill` / `tags:backfill` for any genuinely missing synopsis/labels.
10. 🔧 **Query understanding (RC6/E) — pg_trgm typo correction started (2026-07-01).**
    - **Data-driven promotion is blocked:** `rag_query_misses` (71 rows) are privacy-redacted hashes
      with empty `candidate_aliases`, so the plan's "promote real misses to aliases" path can't run.
      Usable infra: `rag_aliases` (64 rows) + trigram indexes on `rag_aliases.alias`, `documents.title`,
      `document_labels.label`.
    - ✅ **pg_trgm term corrector** — migration `20260701060000_clinical_query_term_trgm_correction.sql`
      adds `correct_clinical_query_terms(text, min_sim)`: trigram-matches each query token against a
      vocabulary (rag_aliases aliases+canonicals + indexed document-title words) and replaces confident
      near-misses. Guards against false positives: only length ≥ 4 tokens, only same-length-or-longer
      matches (blocks morphological shortenings like "treated"→"treat", "symptoms"→"symptom"),
      min_sim 0.45. Validated: clozapin→clozapine, agitaton→agitation, schizophrenai→schizophrenia,
      bipoler→bipolar, withdrawl→withdrawal, lithiun→lithium; clean queries unchanged. ~85ms.
    - ✅ **Wired as a text-search fallback** in `searchTextChunkCandidates` (`rag.ts`): when strict AND
      variants return nothing, correct the query and retry (strictly, then OR-relaxed) _before_ the 8b
      OR-relaxation, so a typo like "clozapin monitoring" resolves to clozapine rather than OR-matching
      generic "monitoring" docs. Verified end-to-end: "clozapin anc threshold"→Clozapine docs, "dischage
      planning"→Discharge Planning. Golden set unchanged (23/23, no regression); 682 tests pass.
    - ✅ **Correction before the unsupported short-circuit (2026-07-01).** `searchChunksWithTelemetry`
      (`rag.ts:4986`) now, when a query would short-circuit as unsupported, trigram-corrects it and —
      if it changed — re-runs the whole retrieval once on the corrected text (guarded by an internal
      `typoCorrected` flag; only fires for would-be-unsupported queries so no hot-path cost). Rescues
      typo queries whose corrected form is a _supported_ class (e.g. a typo'd clozapine/dose query
      → table_threshold). Golden 23/23 unchanged, 682 tests pass.
    - ⚠️ **Pre-existing bug surfaced (NEW, finding #11):** unsupported-classified queries retrieve
      **nondeterministically** — the _same_ query in the _same_ process alternates
      `unsupported_short_circuit` (0 results) vs `text_fast_path`/`hybrid` (real results), e.g.
      "anorexia management" (no typo). Classification is pure and all caches honour `skipCache`, so the
      variance is elsewhere in the unsupported-query path (candidate: alias fetch/expansion or an async
      step) — needs runtime instrumentation to pin. It masks the benefit above (a typo query whose
      corrected form is ALSO borderline-unsupported, like "schizophrenai management", inherits the
      flakiness). Confined to unsupported queries (golden set never hits it), so it never affected the
      committed metrics. High-priority to fix — it means some valid clinical topics ("bipolar disorder",
      "anorexia management") intermittently return nothing.
    - ⏳ Still hard-coded (lower priority now the trigram path exists): moving `synonymGroups` /
      `domainAliasGroups` / `medicationAliasGroups` into `rag_aliases`; generalising the special-case
      rewrites off `RagQueryClass`.

## P2 — offline/fallback remainder (Workstream F)

11. ⏳ Global **AI-status indicator** + health probe (is OpenAI reachable/degraded).
12. ⏳ **Answer cache for true offline reuse** (`rag_response_cache` `cache_kind='answer'`), marked "cached".
13. ⏳ Tag the **auto-degrade generation-failure** fallback (`buildGenerationFallbackAnswer` returns
    before the labelling wrapper, so it isn't stamped `source_only`).
14. ⏳ Playwright assertion for the `source-only-disclosure` badge (needs the running app).

## P2 — naturalness residual

15. ⏳ One flattened-table run-on still slips through (TPR / postural-BP line). Mostly handled by v15 +
    `separateSettingRunOns`; extend the deterministic separator or the prompt if it recurs.

## Security (do outside this repo)

16. ⏳ **ROTATE all secrets** pasted in plaintext this session: OpenAI key, Supabase `service_role`
    JWT + legacy JWT secret, DB password, E2E password. `.env.local` is gitignored, but the values
    were exposed in chat.

## Follow-ups filed 2026-07-06 (universal-search workstream)

17. 🔶 **Alias promotion pipeline is blocked by privacy redaction — PARTIALLY UNBLOCKED
    (2026-07-06).** Weak-search misses now store `queryVocabularyAliasesForStorage(query)` as
    `candidate_aliases` when raw retention is off: only canonical terms from the curated
    clinical vocabulary that the query MATCHED are persisted (output text comes from the fixed
    vocabulary table, never the raw query, so RET-H4 holds). Remaining: terms OUTSIDE the
    curated vocabulary still cannot be captured without a privacy review; promotion tooling
    from `candidate_aliases` → `rag_aliases` is still manual.
18. ⏳ **`document_index_units` vector recall** — no HNSW index (dropped 2026-07-02) and hosted
    Supabase denies `ALTER FUNCTION … SET hnsw.ef_search` for the `language sql` hybrid RPCs, so
    only `match_document_memory_cards_hybrid` pins `ef_search=100`. Concrete measurement plan
    (needs live keys, ~1 hour): run `eval:retrieval:quality` twice with `--force-embedding`
    (bypasses lexical fast paths, exercising vectors directly) — once as-is and once after
    `create index concurrently` on `document_index_units.embedding` in a Supabase branch — and
    compare doc-recall@5 + p90 latency. If recall gain < 1 case, close as not-worth-4.4GB. The
    ef_search half can be retested via the plpgsql-wrapper trick that memory_cards already uses
    (wrap the `language sql` RPC in a plpgsql shim that SETs it).
19. ✅ **Demo fallback can mask live retrieval failures in non-prod — DONE (2026-07-06).**
    `nonProductionSupabaseDemoFallbackReason` (the shared choke point for /api/search,
    /api/answer, and /api/answer/stream) now emits a loud `console.warn` naming the env vars to
    check whenever the non-prod demo fallback fires; behaviour and the
    `X-Clinical-KB-Fallback` header are unchanged. A visible dev-mode banner remains optional.
20. ✅ **Automated guard for governance-weighting regressions — ALREADY COVERED.** A keys-free
    structural test exists: `tests/retrieval-selection.test.ts` ("keeps relevance ordering and
    does not let source-governance metadata reorder selection") asserts a higher-relevance
    `review_due`/`unverified` source outranks a lower-relevance `current`/`reviewed` one. The
    manual golden-eval checklist remains the live backstop; no further action.
21. 🔶 **Recalibrate gates for synthetic text-only similarity (RC9 residual) — DATA NOW
    FLOWING (2026-07-06).** `synthetic_similarity_count` and `text_or_relaxation_used` are now
    persisted into `rag_retrieval_logs.metadata` (they were computed but dropped by the
    telemetry whitelist in /api/search). Once ~2 weeks of live rows exist, recalibrate
    `evaluateEvidenceCoverageGate` / text-fast-path thresholds against real cosine
    distributions: query `metadata->>'synthetic_similarity_count'` joined to `is_miss` to see
    how often synthetic scores cross the 0.58/0.62 gates on misses vs hits.
22. ⏳ **Registry-to-corpus embedding (universal search Phase 5).** Medications/services/forms/
    differentials are federated into `/api/search/universal` but are not retrieval-corpus
    entities, so Answer mode cannot cite them. Concrete implementation spec (in order):
    1. Flag `RAG_REGISTRY_CORPUS_EMBEDDING` (default off) in `src/lib/env.ts`.
    2. Ingestion script `scripts/embed-registry-records.ts`: map each registry record to a
       synthetic "document" (`metadata.source_kind = 'registry_record'`, title = record title,
       one chunk per record from the record's search text, embedded with the standard
       `text-embedding-3-small` path) so the existing chunk pipeline/RPCs need no schema change.
    3. Re-embed on registry edit: hook `ensureRegistrySeeded` / record-update routes to enqueue
       re-embedding for the changed slug only.
    4. Answer-surface labelling: `sourceGovernanceWarnings` must label registry-backed
       citations distinctly (registry records are curated summaries, not source documents).
    5. Gates before enabling anywhere real: `eval:retrieval:quality` 23/23 with the flag ON,
       plus invented-term controls ("florbizone syndrome management") still refusing — registry
       rows must not become a fabrication surface for unsupported topics.
23. ⏳ **Finding #11 full fix (RAG optimisation Phase 2)** — the classifier-verdict memo (shipped
    2026-07-06) makes zero-result behaviour deterministic per query but does not close the gap:
    the deterministic analyzer still cannot tell in-corpus topics from out-of-corpus ones.
    Phase-2 spec stands (corpus-grounded relevance: IDF/corpus-frequency weighting of query
    terms + data-driven vocabulary), with the added prerequisite that item 17's vocabulary
    capture now supplies real miss data to seed the vocabulary from.
24. ⏳ **OCR dropped-letter corruption in table index units** — no reliable detector exists (82%
    false positives; guard reverted). Next viable angle: dictionary-based repair at INGESTION
    (compare table-cell tokens against the document's own clean chunk text — "p ycho ocial"
    aligns to "psychosocial" within the same page's raw text) rather than heuristic detection at
    query time. Scope to `worker/` table extraction; requires the Python OCR stack to test.
25. ⏳ **Retrieval latency p90 ~8.6s (local)** — remaining sequential layers after the 2026-07-01
    parallelisation. Cheapest next step (measure first): overlap `embedTextWithTelemetry` with
    the text fast path unconditionally (today preload only fires when `shouldPreloadEmbedding`),
    and collapse the repeated `attachDocumentRankingMetadata` calls to one batched fetch per
    request. Both are perf-only; gate with the golden eval unchanged + p90 from
    `rag_retrieval_logs` before/after.
