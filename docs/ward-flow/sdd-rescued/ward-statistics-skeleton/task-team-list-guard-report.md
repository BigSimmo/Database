# Task: community-team list guard — report

**Status:** DONE. **Commit:** `d4877f3f9a2fc94fc45a41a3459f6401f8d21623`

**Ran / passed:** 6 files ran, 90 tests passed (0 failed) on the restored source.
Discovered set (`ls tests/ward-community*.test.ts tests/ward-community*.test.tsx`):
`ward-community-corrected-claims.test.ts`, `ward-community-hub.dom.test.tsx`,
`ward-community-hub.test.ts`, `ward-community-index.dom.test.tsx`,
`ward-community-index.test.ts`, `ward-community-referral-survives.test.ts`.
`npx tsc -p tsconfig.typecheck.json --noEmit` — clean, no output.

## Where the test went and why

`tests/ward-community-hub.test.ts` — this is the file `ward-community-index.test.ts`'s own
header explicitly delegates the size pin to ("the exact-size pin is not in it yet"), and it
is where the toothless `toBeGreaterThan(1)` floor already lived (finding 9.7). Split the old
combined test in two: the existing `toEqual([...communityTeamOptions()])` line now carries a
comment saying plainly that it is not a size guard, and a new `it(...)` carries the guard.

## Derivation: register-derived, not pinned

`COMMUNITY_TEAM_PAGES`/`communityTeamOptions()` trace to `S2015_CATCHMENT_ROWS` +
`parseFollowUpClinicSet` (both exported from `ward-catchment.ts`). The new test reads those
directly and folds punctuation with its **own** normalization function — not a call to the
private `communityTeamKey` in `referral-destination-options.ts`, which is unexported anyway.
So the expected count is a real independent derivation, not the same expression as the
function under test: I verified it lands on exactly 65 (matching the module's own "71 raw
strings, 65 clinics" doc comment) with 0 missing keys against the current output, confirmed
via a throwaway scratch test before writing the real one, then deleted the scratch file.

Guard shape: `expect(actualNames.length).toBe(expectedKeys.size)` (exact, before any loop),
then a `for` loop using `expect.soft()` to check every expected key is covered.

## Two red-proof mutations, both reverted

**Mutation 1 — slice to 3** (`.slice(0, 3)` on the sorted result):

```
AssertionError: COMMUNITY_TEAM_PAGES length no longer matches the register's own clinic count: expected 3 to be 65
```

(collateral: the unrelated seeded-admission test also went red, as finding 9.7 predicted)

**Mutation 2 — partial truncation** (drop clinics whose merged spelling-count sums to 1;
landed on 65 → 44, not 65 → 43 as the triage report's variant did — same partial-truncation
shape, still non-trivial):

```
AssertionError: COMMUNITY_TEAM_PAGES length no longer matches the register's own clinic count: expected 44 to be 65
```

Restored, then `git diff` on `referral-destination-options.ts` showed no output — byte-identical
to HEAD.

## Coverage stated

The guard closes the gap: a truncation of `communityTeamOptions()`'s output — total or
partial — now fails `tests/ward-community-hub.test.ts` on its own, independent of any
coincidental collateral test.
