# `noUncheckedIndexedAccess` — staged migration plan

**Status:** plan only — this document changes no code and does not touch `tsconfig.json`
**Ledger row:** `#211` (P2, task) · related `#212` (`as unknown as` casts), `#213` (empty catch handlers)
**Measured:** 2026-08-14 against `origin/main` at `d47aa6d`
**Source finding:** [`docs/review-findings-2026-08-02.md`](review-findings-2026-08-02.md) §6

`tsconfig.json` sets `strict: true` but not `noUncheckedIndexedAccess`. Without the flag,
`array[0]` is typed `T` even when the array is empty and `record[key]` is typed `V` even when
the key is absent, so every out-of-bounds read is invisible to the compiler and surfaces as a
runtime `undefined` — including on the answer path, where the failure lands in front of a
clinician.

Row `#211` carries an explicit **Stop:** do not flip the flag on `main` without a staged plan.
This is that plan.

---

## 1. Current measurement

Measured by extending `tsconfig.json` with `noUncheckedIndexedAccess: true` in a throwaway
config outside the repo tree and running `tsc --noEmit`. **1,445 errors across 269 files** —
up from the 1,266 recorded on 2026-08-02, because the flag is off and nothing stops new
unchecked indexing from landing. That drift rate is itself an argument for the ratchet in §3.

| Bucket                   | Errors | Share | Character                                                             |
| ------------------------ | -----: | ----: | --------------------------------------------------------------------- |
| `tests/**`               |    713 | 49.3% | Mechanical. A wrong guard fails a test, it does not reach production. |
| Mockups (design scratch) |    237 | 16.4% | Mechanical. 404s in production; already gate-exempt for wiring.       |
| `src/lib/**` (non-RAG)   |    211 | 14.6% | Mixed — contains the clinical hot spots.                              |
| `src/components/**`      |    167 | 11.6% | Mostly mechanical render-path indexing.                               |
| `scripts/**`             |     57 |  3.9% | Mechanical; tooling-plane, failures are loud and local.               |
| `src/lib/rag/**`         |     32 |  2.2% | **Protected surface.** See §5.                                        |
| `worker/**`              |     27 |  1.9% | Manual — ingestion runtime.                                           |
| `src/` other             |      1 |  0.1% | —                                                                     |

Two-thirds of the population (tests plus mockups, 950 errors) carries no production
consequence whatever. That is what makes staging worthwhile: the risky remainder is ~500
errors, not 1,445.

**Error shape:** `TS2532` "object is possibly undefined" (569) and `TS18048` "…is possibly
undefined" (455) together are 71% — these are the ones a guard fixes. `TS2345`/`TS2322`
(368) are `string | undefined` flowing into a parameter typed `string`, which more often
needs a real decision about what the absent case means.

**Heaviest files:** `tests/ui-smoke.spec.ts` (43), `src/lib/demo-data.ts` (42),
`src/components/master-document-flow-mockups.tsx` (41), `src/lib/answer-verification.ts` (41),
`tests/evidence.test.ts` (40), `tests/ui-phone-scroll-page-owned.spec.ts` (38),
`tests/clinical-search.test.ts` (28), `src/lib/rag/rag-extractive-answer.ts` (23),
`worker/main.ts` (23), `src/lib/evidence.ts` (19).

**To reproduce:** create a config outside the repo that extends `tsconfig.json`, adds
`"noUncheckedIndexedAccess": true`, and excludes `.next` (build artefacts produce unrelated
errors), then run `./node_modules/.bin/tsc --noEmit --project <that file>`. Do not add the
throwaway config to the repo — `docs:check-links` and the tsconfig gates both notice.

---

## 2. Why this cannot simply be split by directory

`noUncheckedIndexedAccess` is a whole-project compiler option. It cannot be enabled for one
directory: narrowing `include` does not help either, because TypeScript still loads and
reports errors in every transitively imported file, so a tests-only project pulls all of
`src/lib` in with it.

So the flag itself flips exactly once, in the final PR. Everything before that is remediation
performed against the measurement, verified by a ratchet rather than by `npm run typecheck`.

---

## 3. The ratchet

Stage 1 adds a baseline file plus a check, in the shape this repo already uses for
`scripts/design-system-contract-baseline.json` (`metrics` + `debtByPath`) and
`bundle-budget.json`:

(Paths below are proposed, not existing — they are written without a directory prefix so the
`docs:check-links` and `docs:check-scripts` gates do not read them as stale references.)

- A baseline file `no-unchecked-indexed-access-baseline.json` under `scripts/` —
  `{ measuredOn, total, debtByPath }` mapping each file still permitted to have errors to its
  current count.
- A checker `check-no-unchecked-indexed-access.mjs` under `scripts/` — runs `tsc` with the flag
  against a generated config, then fails when a file **absent** from `debtByPath` has any
  error, or when a listed file's count **rises**. Falling counts are fine; the baseline is
  refreshed as stages land.
- A `package.json` entry named `check:no-unchecked-indexed-access`, run per stage and by the
  final PR.

This makes the migration monotonic: a stage cannot be undone by the next week's merges, and
new code cannot add debt while the migration is in flight — which is precisely what let the
count drift from 1,266 to 1,445.

**Do not** add this to `verify:cheap:internal` while the migration is in flight. A full `tsc`
run is not a cheap gate, and `scripts/check-gate-manifest.mjs` would additionally require a
matching `static-pr` step in `.github/workflows/ci.yml`. Run it per stage; consider promoting
it only after stage 6, when the flag is on and `npm run typecheck` covers it anyway.

---

## 4. Stages

One PR per stage, in this order. Cheapest and most consequence-free first, so the mechanical
bulk lands before anyone has to think hard.

### Stage 1 · Ratchet only — `MECHANICAL`

- **Outcome:** the debt is measured, pinned, and cannot grow.
- **Files:** the checker and baseline named in §3, plus `package.json` and
  `docs/scripts-index.md`.
- **Risk:** none — no product file changes.
- **Verification:** the new `check:no-unchecked-indexed-access` entry passes at the baseline; a
  deliberately introduced `arr[0]` in a clean file makes it fail.

### Stage 2 · `tests/**` — 713 errors — `MECHANICAL`

- **Outcome:** roughly half the population gone, with no production surface touched.
- **Approach:** use a non-null assertion `!` only where a nearby assertion deliberately proves
  the invariant (`const rows = parse(x); expect(rows).toHaveLength(3)`). Do not make this a
  blanket replacement: `expect(rows[0]?.id).toBe(…)` fails with `undefined` when `rows` is
  empty, unless `undefined` is the expected value. Choose optional access or an explicit guard
  when that better expresses the intended test.
- **Risk:** low, but real. Reviewers check that each assertion still states its intended empty
  case and that `!` is backed by a local invariant.
- **Verification:** `npm run test`; the Playwright specs in this bucket
  (`tests/ui-smoke.spec.ts`, `tests/ui-phone-scroll-page-owned.spec.ts`) are compiled by
  `typecheck` but only executed by `npm run verify:ui`, so typecheck is the gate that matters
  for them.

### Stage 3 · Mockups — 237 errors — `MECHANICAL`

- **Outcome:** design scratch off the books.
- **Files:** `src/app/mockups/**`, `*-mockups.tsx`.
- **Risk:** none. These 404 in production. Note they are still compiled and still weighed by
  `check:bundle-budget` against the `mockups` baseline — "gate-exempt" does not mean "free".
- **Verification:** `npm run typecheck`, `npm run check:bundle-budget`.

### Stage 4 · `scripts/**` and `src/components/**` — 224 errors — `MECHANICAL`, spot-reviewed

- **Outcome:** the tooling plane and the render path.
- **Approach:** `??` with a sensible empty default in render code; a thrown error in scripts,
  where failing loudly is correct and silence is not.
- **Risk:** low. The component work can change rendered output if a `??` default differs from
  what the old `undefined` produced — check any empty-state or list-rendering change.
- **Verification:** `npm run typecheck`, `npm run test`, and `npm run verify:ui` only if a
  component's rendered output actually changed.

### Stage 5 · `worker/**` and `src/lib/**` non-clinical — `MANUAL`

- **Outcome:** ingestion and the general library.
- **Approach:** `worker/main.ts:901-942` repeatedly indexes `preparedImage`/`image` arrays and
  passes the results to functions typed `ExtractedImage`. A shorter-than-expected array throws
  today; the fix is a real guard that skips or fails the job, not a `!` that preserves the
  throw. `src/lib/demo-data.ts` (42) is the largest single file and is genuinely mechanical —
  it is synthetic fixture data.
- **Risk:** medium. Ingestion is a background worker; a wrong guard turns a loud crash into a
  silently skipped image.
- **Verification:** `npm run typecheck`, `npm run test`, plus `npm run check:production-readiness`
  (ingestion is a domain change under AGENTS.md).

### Stage 6 · Clinical hot spots, then flip the flag — `MANUAL, HIGHEST CARE`

- **Files:** `src/lib/answer-verification.ts` (41), `src/lib/rag/rag-extractive-answer.ts` (23),
  `src/lib/evidence.ts` (19), `src/lib/document-summary-formatting.ts` (16), and the remaining
  `src/lib/rag/**`.
- **Approach:** every site individually. `rag-extractive-answer.ts` is the deterministic
  source-only fallback used _when generation has already failed its quality gate_ — an
  out-of-bounds throw there means the fallback fails too, and the user gets nothing instead of
  a cited answer. `answer-verification.ts` indexes into arrays that may be empty while deciding
  whether an answer is safe to show; a `!` that converts a type error into a runtime throw
  crashes the verification gate itself. Neither file wants `!` anywhere.
- **Then:** set `"noUncheckedIndexedAccess": true` in `tsconfig.json`, delete the baseline and
  its check, and remove the `check:no-unchecked-indexed-access` entry.
- **Verification:** `npm run typecheck`, `npm run test`, `npm run check:production-readiness`,
  and the RAG requirements in §5.

---

## 5. The RAG carve-out

Stage 6 touches `src/lib/rag/**`, which is a protected ranking surface under AGENTS.md.
Three obligations apply and none is optional:

1. **Flag the task to the user before editing anything under `src/lib/rag/**`** — including a
   change this mechanical.
2. The PR body needs an explicit `RAG impact:` line or `scripts/pr-policy.mjs` blocks the
   merge. A guard that only adds a narrowing check should be able to state
   `RAG impact: no retrieval behaviour change — adds undefined guards without touching
comparator order, scoring, or selection`, but that claim has to be **true**: read
   `docs/rag-behaviour/` first and confirm no comparator key, clamped-score contract, or
   selection threshold moved.
3. If any guard does change ordering or selection — for example a `?? 0` default that alters a
   sort — it is a behaviour change and needs a live eval-canary pair. That is provider-backed
   (~$1–2) and needs explicit user approval.

Splitting `src/lib/rag/**` into its own final PR, after the rest of stage 6, keeps the
governance requirement off the other files.

---

## 6. Tracking

Progress lives in ledger row `#211`, updated with `npm run issues:update` after each stage
lands (never by hand-editing `docs/outstanding-issues.md`). Record the stage number, the PR,
and the new total from the baseline file, so a later reader can tell how far the migration got
without re-running `tsc`.

Do not close `#211` until the flag is on in `tsconfig.json` and the baseline file is gone.
A partially-migrated repo with the flag still off has none of the protection and all of the
churn, so an abandoned migration is worse than an unstarted one.

**Stop:** do not flip the flag on `main` ahead of stage 6, and do not silence a stage by adding
files back to the baseline — the baseline only ever shrinks.
