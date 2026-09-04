# Task report: Figure 3 — blocked discharges by blocker

**Status:** DONE, green.

**Commit SHA:** `24e9564fd529db1fb1b38e9c83cf19c4765fcf92`

**Gate:** `npx tsc -p tsconfig.typecheck.json --noEmit` — clean, no output.
Discovered test files (7, above the 5-file refusal floor): `tests/ward-statistics.dom.test.tsx`,
`tests/ward-statistics.test.ts`, `tests/ward-statistics-claims.test.ts`,
`tests/ward-statistics-derivations.test.ts`, `tests/ward-statistics-incoherent-gap.test.ts`,
`tests/ward-statistics-sections.dom.test.tsx`, `tests/ward-statistics-sections.test.ts`.
**RAN: 201 tests across 7 files. Passed: 201.**

## The field, verified myself

Confirmed by reading `ward-priority.ts:91-94` and `ward-model.ts` doc comments directly:
`hasActiveBlocker` only ever reads `Movement.blocker` (free prose about a referral finding a
placement) and is irrelevant to this figure, exactly as the recon said. Built against
`Admission.blockReason: BedReleaseBlocker | null` instead — a closed 8-member enum
(`BED_RELEASE_BLOCKERS`, counted directly from the array in `ward-change-reasons.ts`), needing
only `!== null`. Deliberately did **not** also read `BedRelease.blocker`: that record has no
`admissionId`, so merging it in risked double-counting one discharge across two records with no
join between them.

## Siblings matched

`declinesByReason` (Figure 4) is the pattern copied exactly: derivation lives in
`statistics-derivations.ts`, rows generated from the closed vocabulary array (never hand-written),
every member gets a row including noughts, `count: number` never `number | null`, no sort by count,
`vocabularySize` returned so row count is checkably equal to it, an unrecognised value throws rather
than being dropped. Also matched `readyToLeaveCannot` (`ward-statistics.ts`) for scoping: excluded
departed admissions, quoting its own reasoning — _"`blockReason` describes what is currently holding
a bed up. Someone who has already left is no longer being held from leaving, whatever the record
still says."_ Routed the exclusion through the module's own `admissionStagePosition` (its one
sanctioned place to read `AdmissionState`) rather than a second raw `admission.state` comparison.

## Empty state

Copied Figure 4's pattern exactly: no special absence block. All 8 blocker rows render at 0, total
renders 0, admission count renders 0 — this is a count, not an average, so it never touches the
`absence`/`nothingToAverage` styling.

## Null-vs-zero

Quoted the exception (`ward-statistics.ts:12-18`): _"the count-based figures ... are genuine
counts, so `0` is a true and correct answer for them when there is no data."_ Every field in this
figure (`tallies[].count`, `totalCount`, `admissionCount`, `vocabularySize`) is a genuine count,
typed `number`, never `number | null`. There is no average or rate anywhere in the figure's shape —
no instant marks when a block began, only `confirmedAt`, a single field several other reducer cases
overwrite — so none was added.

## Red-proof (verbatim)

**Mutation 1 — dropped "Awaiting pharmacy" from the tallies map** (filtered it out of
`BED_RELEASE_BLOCKERS` before mapping in `blockedDischargesByReason`). SHA-256 before:
`641afd42...388800f`. Result: **9 failed | 83 passed (92)** across the two affected files. Output
named the missing category directly:

```
-   "Awaiting pharmacy",
...
TestingLibraryElementError: Unable to find an element by: [data-testid="ward-statistics-blocked-discharge-Awaiting pharmacy-count"]
```

Restored by hand; SHA-256 after: `641afd42...388800f` — identical.

**Mutation 2 — empty population rendered as `""` instead of `"0"`** (`{blocked.totalCount === 0 ?
"" : blocked.totalCount}` in the screen). SHA-256 before: `7e92e0cd...5562608`. Result: **1 failed |
47 passed (48)**:

```
AssertionError: expected '' to be '0' // Object.is equality
```

Restored by hand; SHA-256 after: `7e92e0cd...5562608` — identical.

`git diff --stat` on the two production files after both restores shows only the legitimate new
code (112 and 77 added lines respectively, zero deletions) — confirmed byte-identical to
pre-mutation via the hashes above, not just via diff.

## Claims register

**Did not add an entry.** `MODEL_CLAIMS.length` is untouched at 86 — verified `git diff --stat` on
`statistics-claims-register.ts` is empty. This was a deliberate scope choice: adding a properly
evidenced `falsifiedBy` entry (find/replace pin against a specific source line, verified by the
claims-register test harness) is a separate, heavier unit of work per the register's own
discipline, and the task described it as conditional ("if your figure adds a registered claim").
The derivation and DOM tests already carry red-proof-quality pins for this figure's two biggest
risks (dropped category, absence-vs-zero); I judged a further claims-register entry as valuable
but optional rather than required, and left it undone rather than half-done. Flagging as a
follow-up if the owner wants full parity with Figure 4's register coverage.

## Guard compliance

- Category count pinned exactly (`BED_RELEASE_BLOCKERS.length` asserted `=== 8` in two tests, plus
  the full array comparison in the "one row per member" tests) — no floor anywhere.
- The one `for` loop added that carries an assertion (the literal-zero DOM test) has
  `expect(BED_RELEASE_BLOCKERS.length).toBe(8)` before it and `expect.soft()` inside it.
- DOM tests use `getByTestId` (throws) throughout; commented at the one place a missing-list throw
  is explicitly the protection (`ward-statistics-blocked-discharges-by-reason-list` test).
- No hand-checked number in rendered prose — every figure renders from `blocked.*`, and the blurb
  text asserted via `toContain`, not a literal count.

## Files touched

- `src/components/ward-management/statistics/statistics-derivations.ts` — added
  `blockedDischargesByReason` + `BlockedDischargeReasonTally`/`BlockedDischargesByReason` types.
- `src/components/ward-management/statistics/statistics-screen.tsx` — new `<article
data-testid="ward-statistics-blocked-discharges-by-reason">` in the "How the system is
  performing" section, after declines-by-reason.
- `tests/ward-statistics-derivations.test.ts` — 7 new tests for the derivation.
- `tests/ward-statistics.dom.test.tsx` — 8 new DOM tests, plus updated the exhaustive
  figure-placement table (`PLACEMENT.length` 7→8) that would otherwise have gone red on its own.

`ward-statistics.ts`, `ward-change-reasons.ts`, `ward-admissions.ts` and the seed were not
touched, as required.
