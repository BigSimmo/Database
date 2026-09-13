# DOM vacuity audit — batch 2

Scope: hunt for tests that can pass whether or not the code is correct (misplaced negation,
vacuous `toContain`, literal-vs-component markup, loose null-tolerant queries, empty-collection
loops, zero-assertion tests, `.only`/`.skip`, floor-only assertions where an exact value is
knowable, swallowed assertions) across the 16 named rendered-markup test files.

All 16 files were read in full, line by line, not sampled.

## Per-file verdict

1. `tests/ward-flow-clock-consistency.dom.test.tsx` — clean
2. `tests/ward-flow-potential-chip-migration.dom.test.tsx` — clean
3. `tests/ward-flow-provider.dom.test.tsx` — clean
4. `tests/ward-flow-queue-selection.dom.test.tsx` — clean
5. `tests/ward-freshness.dom.test.tsx` — clean
6. `tests/ward-governance.dom.test.tsx` — clean
7. `tests/ward-handover.dom.test.tsx` — clean
8. `tests/ward-morning-page.dom.test.tsx` — clean
9. `tests/ward-morning-tour.dom.test.tsx` — clean
10. `tests/ward-morning-tour-paused.dom.test.tsx` — clean
11. `tests/ward-network-queue-count.dom.test.tsx` — clean
12. `tests/ward-network-referral-clocks.dom.test.tsx` — clean
13. `tests/ward-network-referral-placement.dom.test.tsx` — clean
14. `tests/ward-network-stage-filter.dom.test.tsx` — clean
15. `tests/ward-network-stage-strip.dom.test.tsx` — clean
16. `tests/ward-out-of-area-live-state.dom.test.tsx` — clean

No `it.only`/`describe.only`, no `it.skip`/`it.todo`, and no `it.fails()` were found in any of the
16 files (so no INTENTIONAL-tripwire classification was needed either).

## Observations

This batch reads as an unusually hardened suite — the opposite of the file that shipped the
misplaced-negation defect the brief describes. Recurring patterns worth naming because they are
exactly the defenses this hunt was checking for:

- **"Canary" / "non-vacuity floor" assertions are pervasive.** Nearly every test that depends on a
  fixture containing a specific shape (a movement that closed before arriving, a hospital with 2+
  wards, a referral whose region leaves a travel band empty, a stage holding some-but-not-all of
  the queue) asserts that precondition explicitly and by name, with a message explaining why the
  test would be meaningless without it. This is precisely what prevents the "empty collection,
  zero iterations, green test" class (hunt item 5) and the "floor where an exact value is knowable"
  class (item 8) from hiding.
- **Negations are paired with their positive control.** Several files (`ward-network-referral-
placement.dom.test.tsx` in particular, ~1150 lines) go further than a bare `.not.toMatch(...)`
  over a multi-alternative regex — they assert each alternative individually against a snippet
  designed to hit only that arm, then pin the regex's `.source.split("|")` against the exact list
  of controlled arms. That is a direct, disclosed defense against the "one arm of an alternation
  quietly stops matching and nobody notices" failure mode, which is structurally the same shape as
  the misplaced-negation defect this hunt is chasing (an assertion that looks like it covers
  something but has a silent gap).
- **`toContain`/`toHaveTextContent` calls are consistently scoped** (`within(...)`) to a specific
  test-id'd container rather than the whole document, and consistently checked against fixture-
  derived or independently-computed expected values rather than a fixed string that would also
  appear in chrome (item 2's danger).
- Two tests explicitly document a _previous_ vacuous version of themselves and why it was rewritten
  (`ward-freshness.dom.test.tsx`'s "Review Finding 7" alternation regex; `ward-morning-tour-paused
.dom.test.tsx`'s "the first version of this test could not fail"), which suggests this exact defect
  class has already been swept out of these particular files in a prior pass.

No finding met the bar (assertion outside its intended scope, or a concrete code change that would
leave the test green while breaking the protected behaviour). Nothing is reported as a finding.

## Result

Files read: 16/16. Findings: 0. Worst finding: none — this batch was clean; the misplaced-negation
defect described in the brief was not located in any of these 16 files.
