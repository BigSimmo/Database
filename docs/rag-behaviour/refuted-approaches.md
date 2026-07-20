# Refuted ranking-improvement approaches (2026-07-20)

Two approaches to the fast-path rank-depth headroom were implemented, live-tested, and refuted
in one evening. They are recorded here so no future task re-attempts them in the same shape.
Full audit trail: `docs/branch-review-ledger.md` (2026-07-20 rows), PRs #1003–#1006.

## Refutation 1 — per-class feature-weight tuning (Phase B): live no-op

- **Shape:** offline tuner on the provenance-stamped ranking snapshot recommended three
  constrained per-class `featureFusion` nudges (document_lookup titleSectionRelevance→0.9,
  table_threshold clinicalEvidence→0.95, comparison hybridRelevance→0.95; proxy comparison-mrr
  0.833→1.0). Staged live via the `rag_ranking_config` dispatch input — no code defaults
  touched.
- **Live pair (#53 baseline vs #54 tuned, override proven active in the run log):**
  mrr@10 0.8922 → 0.8921; irrelevant@10 0.1083 → 0.1083; every headroom case byte-identical.
- **Why it failed:** the 5-candidate linear proxy space saturates — the proxy's predicted gains
  were already realized live, and the real headroom lives in saturated-tie structure that
  feature weights cannot express.
- **Standing consequence:** tuner recommendations are hypotheses only; adoption requires a live
  pair with measured gain (none → not adopted; nothing was rolled back because staging is
  per-run).

## Refutation 2 — saturation-tail spread of comparator keys (Phase C): live regression

- **Shape:** a pure, monotone, set-independent tail spreading tied imputed primaries inside
  "dead" score bands — table-fact `similarity` into (0.92, 0.94), lexical-chunk `hybrid` into
  (0.48, 0.5). Passed a red-proven discriminating test, tie-conservation guard, 121/121
  targeted offline tests, full-suite, AND an adversarial code review (APPROVE-WITH-NITS —
  the envelope math was correct: no gate crossed).
- **Live pair (#54 baseline vs #55 on the merged change):** FAILED 3/36 — doc_recall
  1.0 → 0.9167, mrr@10 0.8921 → 0.8138; patient-property rr 1.00 → 0.11, schizophrenia-overview
  1.00 → 0.14, patient-safety-plan 0.33 → 0.14. Reverted within the hour (#1005); restoration
  confirmed by canary #56.
- **Why it failed:** hybrid (S1) and similarity (S2) sort ABOVE `relevance.score` in the
  release comparators. Spreading them — even inside gate-free value bands — moved tie
  resolution from the boost/title/subject-aware relevance rank to raw ts_rank order.
  Lexically-loud chunks leapfrogged title-boosted correct documents: the #118 burial mechanism,
  reproduced live. The "arbitrary" ties were not arbitrary — relevance was already resolving
  them correctly.
- **Why offline missed it:** the discriminating fixtures used identical-content candidates
  (every key tied), which structurally cannot expose an ordering flip between
  differently-relevant candidates. The adversarial review audited values and gates, not the
  comparator _precedence_ semantics.

## Binding constraints for any third attempt

1. **Position:** a text-rank discriminator may only be inserted strictly BELOW
   `relevance.score` in the release comparators (i.e. between relevance and the id fallback),
   or as a bounded term INSIDE the relevance rank itself — never as/above a primary key.
2. **Fixtures:** the discriminating offline test must use differently-relevant candidates
   (different boosts/titles/coverage) and prove the OLD code orders them correctly by
   relevance while the id-fallback case improves — identical-content fixtures are disallowed
   as sole proof.
3. **Live pair:** dedicated baseline + post canary with doc/content recall pinned at 1.0 and
   zero per-case rr regressions; any regression = immediate single-commit revert (both
   directions proven cheap tonight).
4. **Approval:** separate explicit user approval; provider-backed runs are never automatic.
5. **Honest sizing:** the prize is rank depth on 3–4 already-passing cases (~0.03–0.08 mrr).
   Weigh against the demonstrated regression risk before attempting at all.

## Related follow-up plans (documented, not yet implemented)

- **Word-boundary content matcher:** `textContainsClinicalTerm` misses ordinary prose
  punctuation (`treatment,` `(opioid` `ptsd.[35]`) — 4 live occurrences found in top-5
  previews. A matcher-wide change to word-boundary semantics is a measurement-layer behaviour
  shift: own PR, full 36-case impact audit offline (artifact replay), then one canary confirm.
- **irrelevant@10 labeling audit:** before any ranking work aimed at the 0.108 rate, audit the
  broad/vector cases' top-10 for under-labeled relevant siblings (the alias-tier lesson); the
  fix may be sanctioned labels, not ranking.
- **Phase E (answer-side quality):** untouched by this cycle; requires its own approval and
  spend (~$2–5/run) per the master plan.
