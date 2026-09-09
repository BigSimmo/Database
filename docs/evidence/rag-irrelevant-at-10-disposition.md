# RAG irrelevant-at-10 labeling disposition & browser matrix evidence — 2026-08-27

This document records the human review disposition and scheduled browser matrix verification for ledger issue `#023` (P2), completing the evaluation-label audit follow-up from `#084` and [docs/evidence/rag-reliability-evidence-2026-07-27.md](rag-reliability-evidence-2026-07-27.md).

## 1. Scheduled browser matrix verification

- **Workflow:** `.github/workflows/ci.yml` (`release-browser-matrix` job).
- **Decoupling:** `release-browser-matrix` depends on static checks, build, and UI smoke rather than `pr-required` (PR #1083 / `codex/reconcile-browser-matrix`). A blocking scheduled dependency audit cannot skip Firefox or WebKit.
- **Concurrency:** Pushes to `main` and scheduled runs use per-run concurrency groups, preventing main merge churn from cancelling long-running matrix runs mid-flight.
- **Cross-browser status:** WebKit touch-points stubbing (`Navigator.prototype.maxTouchPoints` normalized to 0 in headless runners) and client-only chunk hydration wait stabilization resolved earlier race conditions. Firefox and WebKit test suites execute and pass reliably across all matrix shards.

## 2. Irrelevant-at-10 fixture set audit & diagnostic grades

With `#084` landed on `main`, `scripts/eval-retrieval.ts` persists `relevanceGrade` and `matchedDeclaredSignals` for each top-10 candidate result, making per-rank grading fully deterministic and reproducible:

- **Total cases in golden eval:** 36
- **Total top-10 graded rows:** 338
- **Total grade-0 rows:** 33
- **Irrelevant-at-10 rate:** `0.0917` (stable across baseline `30018289898`, scheduled run `30216191889`, and `output/rag-retrieval-post-exact-head.json`).
- **Required-signal coverage:** `1.0`
- **Document recall@5 / Content recall@5:** `1.0` / `1.0`
- **MRR@10 / Content MRR@10:** `0.8921` / `0.9406`
- **nDCG@10:** `0.9308`

## 3. Human review decisions across the 12 non-zero cases

The 12 cases exhibiting non-zero irrelevant-at-10 rates were audited using the persisted `#084` diagnostic grades and snippet previews:

1. **Tail row classification:** The 33 grade-0 items in the top-10 positions represent:
   - General administrative/policy fragments (e.g. governance guidelines, template headers)
   - Distant condition overviews from multi-topic reference manuals
   - Out-of-scope regional service contact listings
2. **Under-labeling check:** None of the grade-0 results were found to be missing or under-labeled clinical target documents. The expected clinical source documents and relevant chunks were correctly retrieved in top positions (ranks 1–3) with full required-signal coverage (`1.0`).
3. **Ranking stability:** The semantic reranking and hybrid scoring correctly prioritize high-signal clinical answers; the tail occurrences at ranks 7–10 do not displace necessary evidence.

## 4. Final governance disposition

- **Decision:** **Retain fixture annotations and ranking thresholds unchanged.**
- **Rationale:** The irrelevant-at-10 rate of `0.0917` serves as an active evaluation-label audit baseline and safety metric per [docs/observability-slos.md](../observability-slos.md) §3.1. Relaxing labels or artificially modifying ranking weights to force irrelevant-at-10 to zero would risk overfitting retrieval to the fixture set and masking real out-of-domain tail behavior.
- **Reference:** [docs/rag-behaviour/refuted-approaches.md](../rag-behaviour/refuted-approaches.md) § "Related follow-up plans", [docs/evidence/rag-reliability-evidence-2026-07-27.md](rag-reliability-evidence-2026-07-27.md).
