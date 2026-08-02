# RAG behaviour map (verified 2026-07-20)

Everything below was verified against live canary evidence (runs #49–#56) and direct source
inspection during the ADDENDUM-4 cycle. Line numbers drift with refactors — search by symbol.

## 1. Score imputation on the embedding-free text fast path

When a query resolves without embeddings (`strategy=text_fast_path` and friends), candidates
carry **imputed** primaries derived only from Postgres `text_rank`:

| Site               | Where                                                 | Formula (current, reviewed state)                                                                                                                   | Saturation                          |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| S1 text chunks     | SQL `match_document_chunks_text(_v2)`                 | `similarity = 0` (truthful contract — no fabricated cosine); `hybrid = least(0.5, 0.18 + least(text_rank,1)·0.3)`; honest signal in `lexical_score` | tr ≥ 1 → hybrid exactly 0.48        |
| S2 table facts     | `rag-candidate-sources.ts` (`runTableFacts` grouping) | `similarity = min(0.94, 0.62 + min(tr,1)·0.3)`; `hybrid = min(0.97, 0.66 + min(tr,1)·0.3)`                                                          | tr ≥ 1 → byte-identical 0.92 / 0.96 |
| S3 document lookup | `rag-candidate-sources.ts` (documentScore path)       | partial discrimination via `chunkScore·0.08`; doc rank clamps at 0.34, sim cap 0.92 reachable                                                       | high-tr + high-sim pools tie        |
| S4 memory cards    | `rag-candidate-sources.ts`                            | `sim = min(0.92, 0.58 + confidence·0.28)`                                                                                                           | equal-confidence cards tie          |

`text_rank` itself is unbounded above 1 (ts_rank_cd + title-weighted + trigram/term bonuses)
and the SQL orders by it — so the RPCs discriminate candidates that the `min(tr,1)` clamps then
collapse to byte-identical app-side primaries. **This saturation is why unrelated documents
matching the same terms tie exactly.**

## 2. What resolves ties (the comparator chains)

- **Selection** (`retrieval-selection.ts`): clamped score → lexicalScore → rerankScore →
  contentCoverageScore (#987) → chunkId. The clamped-score contract is sacred (measured
  golden doc-recall 1.0→0.76 when violated — the #118 lesson). Coverage is carried ONLY as a
  late tie-break, never added to score.
- **Release without second stage** (`released-search-order.ts`): hybrid → similarity →
  relevance.score → id.
- **Release with second stage**: releaseRankScore (= max(hybrid, finalScore + position
  adjustment)) → similarity → relevance.score → id. Position adjustments launder the selection
  order into release order, so for engaged pools the selection comparator is what matters.
- **rankClinicalResults** (`clinical-search.ts`): unbounded rankScore → similarity → id.

**The critical property: in all-saturated pools, hybrid AND similarity tie, so ordering falls
to `relevance.score` — the boost/title/subject-aware clinical rank. That fallback is doing
correct clinical work.** (Proven live: spreading similarity/hybrid above it caused the Phase C
regression — see `refuted-approaches.md`.)

## 3. Second-stage engagement (`shouldUseSecondStageRerank`)

- `table_threshold` / `medication_dose_risk`: engages on visual evidence OR `topScoresClose`
  (|top1−top2| ≤ 0.04) — saturated pools always engage.
- `comparison`: engages on overflow or closeness.
- Everything else: needs closeness AND visual evidence — plain lexical pools do NOT engage.

Live mapping (canary #54): engaged — clozapine, alcohol-ciwa-threshold; not engaged —
patient-safety-plan, opioid-withdrawal, flowchart-next-step. Fixes that only touch release-time
tie-breaks can never move engaged pools.

## 4. The gate/threshold ladder (why score bands matter)

All functional gates read `max(hybrid ?? similarity)` and live at ≤ 0.82: fast-path acceptance
0.62/0.64/0.66, coverage gates 0.48–0.62, answer routing 0.32/0.48/0.64/0.76, confidence bars
0.5/0.68, conflict/high-confidence 0.82. The bands (0.92, 0.94] (table-fact sim), (0.96, 0.97]
(table-fact hybrid) and (0.48, 0.5) (lexical hybrid) contain **no gates** — but they are NOT
free real estate for ordering keys (see §2's critical property).

## 5. Live case ↔ path map (canary #53/#54 evidence)

- Perfect rank-1 under current behaviour: 27+ of 36 cases.
- Known rank-depth headroom, all `text_fast_path`, all still PASSING their gates:
  flowchart-next-step rr 0.20, alcohol-ciwa-threshold 0.25 (second-stage-engaged),
  patient-safety-plan 0.33, opioid-withdrawal 0.33.
- `lithium-therapy-monitoring` rr was a hardcoded 0.00 until 2026-07-20 (no document
  expectation); now gated on `["Lithium"]` and measuring 1.0. Treat 2026-07-20 as an mrr@10
  baseline step (+~0.028 from de-noising).
- `irrelevant_source_rate@10` ≈ 0.108 is dominated by broad/vector cases pulling topically
  adjacent sibling guidelines — audit labels before treating as ranking debt
  (`docs/observability-slos.md` §3.1).

## 6. Eval measurement mechanics

- Golden gates are zero-tolerance top-5 per-case checks; `--fail-on-threshold` fails the run on
  any miss. The canary log's per-case lines + human summary are what humans and the
  failure-issue analyzer read; `--json-out` writes the machine artifact independently.
- `textContainsClinicalTerm` uses word-boundary matching (2026-07-20 upgrade): boundaries and
  internal separators accept any non-alphanumeric run, so punctuation-joined corpus tokens
  (`CIWA-Ar`, `treatment,`, `(opioid`, line-broken `ciwa- ar`) match their fixture terms. The
  change is a proven STRICT SUPERSET of the old whitespace matcher (artifact replay on canary
  #53: 1,126 comparisons, 0 lost matches, 7 gained — exactly the known blind-spot occurrences),
  so gates can only stay equal or become more satisfiable. Sanctioned aliases
  (`scripts/lib/clinical-aliases.ts`, the STRICT tier) remain the drift-absorption mechanism
  for genuinely different spellings; the WIDER captured-case tier in
  `src/lib/eval-document-matching.ts` must never be bulk-merged into the strict tier.
- Fixture and ranking snapshot move in lockstep (test-pinned); the snapshot carries
  `generatedAt` provenance with an active 30-day freshness gate; regenerate from the latest
  `eval-canary-output` artifact via `npm run build:ranking-snapshot`.
- Run-over-run trends: `npm run eval:trend -- <artifact.json...>`.
