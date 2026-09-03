# A check that only runs because the seed happens not to reach it

Found 2026-09-01 by a read-only sweep over the 51 `tests/ward-*.dom.test.tsx` files, and
deliberately **ruled OUT** as a defect. It is written up anyway, because the reason it is safe today
is not a property of the test — it is a property of the fixture, and nothing connects the two.

**This is not a defect right now. Do not "fix" it.** It is a trigger to watch for.

## The shape

`tests/ward-pull-vocabulary.dom.test.tsx`, _"names nobody accepted, pulled or en route when the unit
has no such patient"_ (around line 123), branches on a `queryByText(...)`:

- The **`else`** arm (placeholder found) carries the meaningful assertion — that the screen never
  says `/held/i` for a unit with nobody accepted, pulled or en route. That is the whole point of the
  test.
- The **`if`** arm asserts `toContain("Accepted, pulled or en route here")` — a heading that renders
  **unconditionally on every render of this screen**. That arm alone proves nothing.

So the test is worth exactly as much as the probability that the `else` arm is the one that runs.

## Why it is safe today, and only today

The unit under test is `bty-youth`, and it is deterministically empty:

- `ward-movements.ts` (around lines 717-724 and 800) generates `routineMovements` with a cohort of
  `"Older adult"` or `"Adult"` — **never `"Youth"`** — so no generated accepted/pulled/moving
  movement can land at `bty-youth`.
- No hand-authored seeded movement targets `bty-youth` either (checked across the seeded block).

Both halves have to stay true. Neither is stated anywhere near the test.

## The trigger

**The day anybody seeds an accepted, pulled or en-route movement at `bty-youth`** — or widens the
movement generator's cohorts to include Youth — the `if` arm starts running, the `/held/i` check
stops being exercised, and **the test stays green while guarding nothing.** No test fails. No gate
notices. The only signal is this file.

## What to do about it

Two options, and the second is better:

1. When you touch the seed or the generator's cohorts, come back here and re-check which arm runs.
   This relies on somebody remembering, which is the mechanism that failed.
2. **Make the arm non-optional.** Assert first that the unit is empty (the precondition the test
   depends on), then run the `/held/i` check unconditionally. The branch then cannot silently
   disappear — if the fixture changes, the precondition assertion fails and names the reason,
   instead of the check quietly ceasing to exist.

Option 2 is the same "prove the precondition, then assert" pattern the statistics tests already use
as a vacuity guard.

## Why this is written down at all

A negative result normally evaporates — the sweep says "clean", the reasoning that made it clean is
in a scratch file nobody reads, and the fixture fact it rested on changes six weeks later with
nothing connecting the two events. **A check that is safe by coincidence is worth recording
precisely because it is not a finding**, since no future audit will re-derive the coincidence and
none of them will go red.

Related in kind: [`silent-transforms.md`](silent-transforms.md) — both are cases where the absence
of a failure signal is not evidence of safety.
