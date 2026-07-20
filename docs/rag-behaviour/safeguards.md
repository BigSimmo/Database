# RAG ranking safeguards

The protection stack that keeps retrieval/ranking behaviour from being changed casually — by
any task, session, or agent. Added 2026-07-20 after the Phase C live regression proved that
offline-green + review-approved is not sufficient for this surface.

## Protected surfaces

Code and ground truth whose edits change (or re-measure) retrieval/ranking behaviour:

- `src/lib/rag/**` — the retrieval waterfall, candidate sources, release pipeline
- `src/lib/clinical-search.ts`, `src/lib/retrieval-selection.ts`,
  `src/lib/released-search-order.ts`, `src/lib/ranking-config.ts`, `src/lib/evidence.ts`,
  `src/lib/result-sort.ts`, `src/lib/answer-ranking.ts`, `src/lib/evidence-relevance.ts`,
  `src/lib/semantic-rerank.ts`, `src/lib/eval-document-matching.ts`
- `scripts/eval-retrieval.ts`, `scripts/lib/clinical-aliases.ts`,
  `scripts/lib/ranking-tuning.ts`, `scripts/lib/ranking-snapshot-builder.ts`,
  `scripts/build-ranking-snapshot.ts`, `scripts/tune-search-weights.ts`
- `scripts/fixtures/rag-retrieval-golden.json`,
  `scripts/fixtures/rag-ranking-candidate-snapshot.v1.json`
- The contract-pinning tests: `tests/rag-fast-path-ordering.test.ts`,
  `tests/ranking-tuning.test.ts`, `tests/retrieval-selection.test.ts`,
  `tests/rag-second-stage-ranking.test.ts`, `tests/eval-retrieval.test.ts`
- Retrieval RPCs in `supabase/schema.sql` / migrations (covered by the clinical-risk gate)

## Layer 1 — PR-body gate (enforced, blocking)

`scripts/pr-policy.mjs` classifies changed files; a PR touching a protected surface **fails the
PR-policy check** unless its body carries an explicit acknowledgment line:

```
RAG impact: <one of>
  RAG impact: no retrieval behaviour change — <why (docs/tests/tooling-only, refactor with
    byte-identical output, etc.)>
  RAG impact: behaviour change — canary pair <baseline run/link> -> <post run/link or
    "planned post-merge">
```

The line must state either **no behaviour change** (with a reason) or reference the **canary**
pair. This makes RAG impact a conscious declaration on every PR, from every session.

## Layer 2 — source-pin contract test (enforced, offline)

`tests/rag-imputation-contract.test.ts` pins the exact imputation formulas and the release
comparator key ORDER as source text. Any edit — including by a task that never read this folder
— goes red in unit tests with a failure message pointing here and to the process in
`refuted-approaches.md`. Updating the pins is allowed only alongside the full protocol
(design + differently-relevant fixtures + canary pair + user approval).

## Layer 3 — behaviour guards (pre-existing, standing)

- Zero-tolerance golden gates (36 cases, weekly scheduled canary + on-demand dispatch)
- Fast-path ordering suite (production-pipeline replays of the 2026-07-19 failure shapes)
- Snapshot gates: golden-regression quartet at production weights, full-snapshot high-risk
  hard-negative floor, fixture↔snapshot lockstep pin, 30-day freshness gate
- Clinical Governance Preflight (blocking) for all clinical-risk paths

## Layer 4 — process (agent memory)

`AGENTS.md` § "RAG ranking protection" mirrors these rules so every agent session loads them:
flag RAG impact before editing, canary pair for behaviour changes, never insert comparator
keys above relevance, read this folder first. The eval-canary pair protocol:

1. Baseline: latest green canary on current main (or one dispatch).
2. Change merges (or runs from a branch via the `ref` dispatch input).
3. Post: one dispatch; gates = recall 1.0/1.0, zero per-case rr regressions.
4. Regression → immediate single-commit revert + one confirmation dispatch.

Provider-backed dispatches always need explicit user approval (~$1–2 each).

## Rollback proof (2026-07-20)

The full cycle was exercised live: merge (#1004) → regression detected by canary #55 within
~35 minutes → revert (#1005) → restoration confirmed 36/36 (canary #56). Total main exposure
under the regression: eval traffic only.
