# RAG reliability evidence — 2026-07-27

This record captures the final local/live evidence for the 2026-07-27 RAG reliability work. Raw eval
artifacts remain under the gitignored `output/` directory; this file records their paths and the metrics
needed to audit the backlog dispositions.

## Protected retrieval canary

- Artifact: `output/rag-retrieval-post-final.json`
- Cases: 36
- Document recall@5: 1.0
- Content recall@5: 1.0
- Hit@K: 1.0
- MRR@10: 0.8921 (unchanged)
- Content MRR@10: 0.9406 (baseline 0.9389)
- nDCG@10: 0.9308 (baseline 0.9276)
- Irrelevant-at-10 rate: 0.0917 (unchanged)
- Required-signal coverage: 1.0
- Failed cases: 0
- Per-case document/content reciprocal-rank regressions: 0

The only protected retrieval change selects document-lookup chunks using the already-ranked expanded
clinical query rather than reverting to the raw user wording. This preserves FBC/WBC/ANC and
withhold/stop aliases between document selection and chunk selection. Ranking scores, comparator order,
clamps and semantic reranking were not changed.

## Final 44-case answer gate

- Artifact: `output/rag-quality-final9/retrieval-quality-2026-07-27T21-19-19-573Z.json`
- Diagnostic dump: `output/rag-quality-final9-cases.json`
- Cases: 44
- Supported: 30/30 substantive and grounded
- Unsupported: 14/14 correct
- Citation failure rate: 0
- Numeric-grounding failure rate: 0
- Source-backed review fallbacks: 0
- Route-ceiling failures: 0
- Comparison extractive fallbacks: 2, both passed with distinct attributed sources
- p95 latency: 7,494 ms
- Provider use: 1 model case, 2 request IDs
- Cost: unavailable because pricing-rate telemetry was not configured; no exact dollar value is claimed
- Blocking threshold failures: none

The immediately preceding `final8` run had the same perfect content metrics but one transient hosted
retrieval tail: active-community ED took 15,760 ms against the 12,000 ms extractive ceiling. An isolated
repeat passed at 8,100 ms and the final 44-case run passed at 9,610 ms. No latency ceiling was weakened.

## Targeted live confirmations

- Community home visits: two same-document AKG citations, substantive extractive answer, zero provider
  calls, 4,812 ms.
- Best Practice Prescription: two same-document AKG citations, substantive extractive answer, zero
  provider calls, 1,560 ms.
- Clozapine typo threshold: one complete NMHS red-range row, substantive extractive answer, zero
  provider calls, 3,160 ms.
- Clozapine ANC/FBC threshold: one complete NMHS red-range row, expected-file citation, zero provider
  calls, 4,375 ms.
- Discharge summary: source-backed extractive recovery, zero review fallback, 8,831 ms on the final
  targeted probe.

## Deliberate boundaries

- The prepared BMJ attestation migration was not applied to hosted Supabase. Qualified human review,
  deliberate hosted apply/attestation and warning-rate remeasurement remain `#022`. Until that apply,
  existing owner-scoped reviews keep using the legacy RPC and v2-only public/attestation requests fail
  explicitly with `503 source_review_v2_unavailable`.
- Firefox/WebKit scheduled evidence and human disposition of irrelevant-at-10 labels remain `#023`.
- ADHD corpus/table accessibility and metabolic schedule evidence remain the two open parts of `#018`.
- No commit, push, deployment, ranking-score change, grounding relaxation, citation-gate relaxation or
  production-data write was performed as part of this evidence run.
