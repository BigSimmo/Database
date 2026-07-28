# #019 — Admission source dropped in the comparison fallback: root cause + reproducer

Ledger item **#019** ("Admission doc dropped after deterministic comparison packing"). This is a
diagnosis + reproducer only. The fix is a protected-surface behaviour change and needs a live
eval-canary pair before it is trusted (see `docs/rag-behaviour/`), so **no behaviour is changed here**.

## Symptom

For "Compare admission and discharge requirements" the answer omits the admission source even though
retrieval surfaces it. Reconfirmed in runs `30018289898` (baseline) and `30216191889` (scheduled):
retrieval stays 36/36 and returns `Admission of Community Patients (AKG).pdf`, but both
admission/discharge answer cases drop it. PR #1096 already proved deterministic answer ranking and
cross-document packing retain both sources, so ranking, aliases and comparator order are **not** the
cause. The loss is in the **answer composer**, not retrieval.

## Root cause (all `src/lib/rag/rag-extractive-answer.ts`)

The admission/discharge comparison query is in the source-bound allowlist
(`sourceBoundAdmissionDischargeComparisonQueries`, `:1588`), so `buildFactSynthesizedAnswer` (`:2315`)
calls `buildAdmissionDischargeComparisonAnswer` (`:2234`). That builder requires **one bound
requirement fact per side** from `sourceBoundComparisonFacts` (`:2180`):

- A side only binds when the retrieved chunk's sentence matches one of the **narrow** regexes in
  `admissionRequirementBindingPatterns` (`:1050`) / `dischargeRequirementBindingPatterns` (`:1068`) —
  e.g. admission binds only on "medical clearance … obtained", "prioritisation of beds",
  "high observation beds", a police-escort clause, or a specific inclusion-criteria clause.
- If retrieval surfaces the correct admission document but the specific chunk's requirement prose is
  phrased **outside** those regexes, `admissionFacts` is empty, the distinct-document `pair` is
  `null`, and the builder returns `null` (`:2253`).
- `buildFactSynthesizedAnswer` then returns the gap answer with **`citationChunkIds: []`** (`:2320`),
  so the retrieved admission source is dropped from the answer.

So the drop is triggered by the **brittleness of the requirement binders**, not by retrieval depth,
scores, or comparator ordering. The discharge side (whose binder happens to match its retrieved
prose) survives; the admission side does not.

## Reproducer

`tests/rag-admission-discharge-comparison-fallback.test.ts` (offline unit, node env):

- **drop (characterises current main):** two distinct, correctly-retrieved sources — admission prose
  outside the binders + a binder-matching discharge sentence → `buildAdmissionDischargeComparisonAnswer`
  returns `null`. Green because it asserts the current (buggy) `null`.
- **control:** identical inputs except the admission sentence now matches a binder ("medical clearance
  must be obtained …") → non-null answer citing **both** chunk ids. The only difference from the drop
  case is the admission sentence phrasing, proving the binder is the discriminator.
- **RED spec (`it.skip`):** the contract #019 must satisfy — a retrieved admission source is retained
  regardless of its exact requirement phrasing. Skipped so CI stays green; enable it as the acceptance
  test alongside the (canary-gated) fix.

Run:

```bash
npx vitest run tests/rag-admission-discharge-comparison-fallback.test.ts
```

A one-line test seam was added: `buildAdmissionDischargeComparisonAnswer` is now `export`ed
(`:2234`). Additive only — no logic or behaviour change.

## Fix direction (NOT done here — canary-gated)

The eventual fix must keep a retrieved-and-labelled admission source in the answer even when its
chunk sentence falls outside the narrow binders (e.g. fall back to a labelled source-bound sentence,
or retain the source as a citation without a bound requirement fact) — **without** loosening the
binders enough to admit non-requirement prose. Because this changes answer composition on a protected
surface, it requires a live eval-canary before/after pair (doc/content recall pinned 1.0, zero
per-case rr regressions) and explicit approval before it is trusted.
