# Task: name the constant gap on screen, not only in a comment

Worktree: D:/Worktrees/Database/ward-builder-community-route (Ward Builder, `claude/ward-builder-community-route`).
Base: `e4a46590c`, tree clean.

## The defect, found by looking at the rendered page

At http://localhost:3911/mockups/ward-flow/statistics the arrival figure reads:

> **5h 00m** — average, across 261 admissions carrying both instants.
> Shortest 5h 00m, longest 5h 00m. The range is shown beside the average on purpose:
> where the two ends meet, every measured gap is identical, and an average alone would
> read as though it had spread behind it.

**All 261 gaps are identical because the seed makes them identical.** Verified in
`ward-admissions-seed.ts`: `const PULL_TO_ARRIVAL_MINUTES = 5 * 60;` (line 70), and every
one of the three places that writes both instants derives one from the other by that single
constant — lines 232, 264, 318 (`pulledAt: arrivedAt - PULL_TO_ARRIVAL_MINUTES`).

So the headline is not a measurement of how long beds take to fill. **It re-reports one
seeded constant, 261 times.** A coordinator reads "average 5h 00m across 261 admissions"
as a property of the service.

**This is the SAME defect class as CRITICAL 1 last round, in a different figure.** The
knowledge exists — the code comment at `statistics-screen.tsx:248-252` says outright "a
seeded population can carry the same gap for everybody" — but it lives in a comment, where
no reader on the page can reach it. The on-screen sentence explains the _display choice_
("the range is shown on purpose") and never names the _cause_.

Every other gap on this page names its cause and says whose change would fix it: the
readiness figure names `BedRelease.preparing` as a boolean and calls it a bed-model change;
the referral-to-bed figure names the minted id and calls it a fixture change; declines names
both model locations and calls it an owner ruling. **This figure is the only one that shows
the reader the symptom and withholds the cause.**

## What to change

`src/components/ward-management/statistics/statistics-screen.tsx` — the range paragraph
(around lines 258-267) — and its tests. Nothing else.

Add a sentence, in the voice the rest of the page already uses, that says plainly: when the
two ends meet, the figure is reporting a single seeded constant rather than a measured
spread, and the fix is on the fixture side where the instants are written, not on this page.

**It MUST be conditional on `shortestMinutes === longestMinutes`.** If somebody later gives
the fixture real variety, the sentence has to disappear on its own rather than sit there
being false. That is the same self-invalidating property the referral-to-bed paragraph
already has ("the paragraph above stops being true in a way anybody can see") — match it.

Do NOT name the constant's value (`5 * 60`) or the number of admissions in the copy; both
are seed facts that will change under you. Describe the shape, not the figure.

## Constraints, all hard

- **Do not touch `ward-admissions-seed.ts` or anything outside `statistics/`.** The seed is
  Ward Lead's file and a rename is in flight across ~50 files there. Read it, never write it.
- Do not change `pullToArrival` in `statistics-derivations.ts` unless you need a boolean the
  screen cannot already compute — and say so if you do. `shortestMinutes` and
  `longestMinutes` are already on the returned object.
- Design tokens only, no hex. The existing `styles.figureNote` is the right class.
- Keep every existing `data-testid` exactly as it is. Add one for the new sentence.

## The gate

```
npx vitest run tests/ward-statistics.dom.test.tsx tests/ward-statistics-derivations.test.ts
npx tsc -p tsconfig.typecheck.json --noEmit
```

40 tests pass at `e4a46590c`. Your tests must ADD to that, and one of them must prove the
**negative**: with a spread present, the new sentence is absent. A test that only proves it
appears is half a test — the constant-gap world is the one the fixture happens to be in
today, so an unconditional sentence would pass it.

Commit your own work when the gate is green. Do not commit anything you did not write.
If you reach a decision this brief does not cover, stop and hand it back.
