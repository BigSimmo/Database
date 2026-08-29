# Ward Flow Phase 8 — what the mutation evidence actually proves, and what it does not

Recorded 2026-08-29 by the fix wave answering the Phase 8 whole-branch review, from that review's
findings plus the mutations the wave ran itself.

**Why this is a tracked repository document rather than phase scratch.** It records which of Phase
8's assertions have been shown capable of failing and which have never been tried. Kept only in the
phase's ignored working directory, the next person would inherit thirty proven assertions and an
unknown number of unproven ones with no way to tell them apart, and would reasonably read all of
them as guards. That is precisely the failure this phase spent its length removing from the test
layer, and it would have been shipped in the documentation layer instead.

It is not a to-do list and not an apology. It is a boundary: what the evidence covers, and where it
stops.

## The reason there is a limitation at all

A test runner stops at the first failing assertion in a case. Every assertion after it is skipped.

So when a mutation reddens a case that holds eight assertions, exactly ONE assertion has been
verified — the one that fired. The other seven were either never reached, or were reached and
passed. Both look identical in the log, and neither is evidence that they would fail if what they
guard were broken. A multi-assertion case therefore lends its whole colour to one assertion's
result, and the rest of the case inherits a credibility it has not earned.

That is the entire limitation. It is not a claim that the unproven assertions are fake — several
of them are floors whose logic is plain on the page. It is a statement that the evidence for them
is absence of evidence, and this phase has already found seven checks that could not fail while
looking exactly like checks that could.

Two smaller rules follow from the same mechanic, and both are honoured below:

- **Name the assertion that fired**, never just the case. A mutation record reading only "the case
  went red" is unusable, because it does not say which of the case's assertions was tested.
- **Two different mutations must not produce byte-identical failure lines.** Identical lines across
  different mutations are indistinguishable from a contaminated run.

---

## The class this phase kept finding, and the eighth instance

A "check that cannot fail" is an assertion that reports a clean result while testing less than it
claims — a regex arm with no control, a search that passes on finding any satisfying example, a
containment assertion an extended name still satisfies, a restore verification whose exit code is
constant. Phase 8 found seven of them. The fix wave found the eighth, and it is the most instructive
of the set because of where it was.

The whole-branch review — a pass whose explicit purpose was hunting this class — proposed closing
the hidden-column hole with `toHaveText([…])` alone, on the stated ground that "Playwright's text
assertions read visible text". They do not. `toHaveText` compares `textContent` unless told
otherwise, so a `th` carrying `display: none` still supplies its text. Measured, not reasoned: with
`style={{ display: "none" }}` applied to the discharges board's `Freshness` header, the array
assertion alone **passed** — reproducing, inside the replacement, the exact hole the replacement was
written to close.

**Three of the eight were found inside machinery built to prevent the class:** item 17's own
strengthening (whose first mutation did not bite, which is why the arms-equality pin exists), the
four restore-verification defects, and this one — a fix handed down by the review that was hunting
them. The lesson the phase keeps re-learning, in its sharpest form: **a recommended fix is a
hypothesis, not a result.** Reviewing for this class does not exempt the review's own output from
it, and the only thing that separates the two is running the mutation.

---

## Individually proven — reddened by a named mutation, with a quoted failure line

### Established before this wave (from the review's own reading of the 59 files in `mutation-runs/`)

| #   | Assertion                                                             | Mutation                              | Failure line it landed on                                                         |
| --- | --------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | overview set-equality vs `allUnits()`                                 | `task9-M1-drop-unrouted-units`        | "the overview's unit nodes are not exactly the units in the network"              |
| 2   | overview absolute order pin (`rendered` vs `modelOrder`)              | `task9-M5-sort-by-free-beds`          | "the overview's units are not in the model's own order, column by column"         |
| 3   | "the overview is not reachable once a referral has taken the diagram" | `task9-M2-referral-never-deselects`   | that message, `expected null not to be null`                                      |
| 4   | routing-does-not-arrange invariance                                   | `task9-M3-sort-routed-first`          | "selecting a different movement rearranged the overview"                          |
| 5   | second-clock **source** guard                                         | `task9-M4-second-clock`               | "the network diagram has a clock of its own…"                                     |
| 6   | F5 `EVENT_ROLE` anchor                                                | `F5-a` (fourth demo-only event)       | `- "REWIND_CLOCK"` missing from the controlled arms                               |
| 7   | F5 `wallClockNow.name` anchor                                         | `F5-b` (rename behind a compat alias) | expected […] to include `'wardWallClockReading'`                                  |
| 8   | band counts inside the group header                                   | `task-8-r1-mutation-c`                | Unable to find `[data-testid="ward-network-band-counts-under_an_hour"]`           |
| 9   | the no-disclosure ratchet                                             | `task-8-r1-mutation-e`                | "a disclosure element is back on the diagram…"                                    |
| 10  | the invented-times "exactly once" count                               | `task-8-r1-mutation-d`                | expected […] to have a length of 1 but got 2                                      |
| 11  | F2's band/heading agreement                                           | `A-1`                                 | Expected substring: "Reachable only by air"                                       |
| 12  | F4 discharges containment                                             | `A-2` (`min-width` back to `44rem`)   | "Freshness (right edge 811 vs scroller 606)"                                      |
| 13  | F3 ledger row floor                                                   | `B-1`                                 | "the ledger renders no row under `ward-out-of-area-row-`…"                        |
| 14  | F4 scroller floor                                                     | `B-2`                                 | that message                                                                      |
| 15  | F3 two-layout cross-check                                             | `C-1`                                 | "the ledger's phone cards and its table are not showing the same people"          |
| 16  | F4 per-table cells floor                                              | `C-2`                                 | "…at 641px renders no cells to measure"                                           |
| 17  | F3 band-subset check                                                  | `D`                                   | "…listing somebody whose travel band is not one this prototype calls out of area" |

### Added by this fix wave — the three the review named as most deserving a mutation

The review singled these out: the composite arms-equality pin because it exists solely to close a
mutation that did not bite and had never itself been reddened (59 mutation-run files grepped for
its message returned zero hits), and the two whole-screen comparative sweeps because they are the
only automated enforcement of the no-comparative-word rule on that screen. All three are now
proven. Each mutation was applied to the committed blob and restored from it, verified with
`git diff --quiet HEAD -- <path>` reading exit 0.

| #   | Assertion                                                                  | Mutation                                                                                                                                                                                                                                       | Failure line it landed on                                                                                                                                                             |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 18  | second-clock composite arms-equality pin (`guardArms` vs `controlledArms`) | `RESET_SCENARIO` → `RESET_SCENARIOX` inside the `secondClock` composite only                                                                                                                                                                   | "the second-clock guard's arms are no longer exactly the arms controlled above… guard carries [ADVANCE_CLOCK, RESET_SCENARIOX, …], controls cover [ADVANCE_CLOCK, RESET_SCENARIO, …]" |
| 19  | whole-screen comparative sweep, **bands view**                             | `ward-management-network.tsx`: legend title "Legend" → "Legend, closest first" (outside `ward-network-band-arrangement`, so the narrower arrangement sweep could not take the hit first)                                                       | "a comparative proximity word is on this screen"                                                                                                                                      |
| 20  | whole-screen comparative sweep, **movement view**                          | `ward-management-network.tsx`: "Route for selected movement" → "Route for the closest selected movement", a legend entry that renders only when no referral is selected, so the bands-view sweep passes and only the movement-view sweep fires | "a comparative proximity word is on the movement view of this screen"                                                                                                                 |

### Added by this fix wave — its own new assertions (W1, W2, W3)

Every assertion this wave added was reddened before it was believed. Component mutations were
applied to committed blobs and restored from them.

| #   | Assertion                                    | Mutation                                                                        | Failure line it landed on                                                                                                 |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 21  | W2 comparative control-list length floor     | drop the `preferred` entry from `COMPARATIVE_ARMS`                              | "the comparative control list no longer covers every arm: expected […] to have a length of 9 but got 8"                   |
| 22  | W2 per-arm control loop                      | `{ arm: /optimal/ }` → `/optimall/`                                             | "the comparative-word pattern's optimall arm matches nothing: expected 'the optimal placement' to match /optimall/"       |
| 23  | W2 comparative arms-equality pin             | `closest` → `clossest` in the composite                                         | "the comparative-word guard's arms are no longer exactly the arms controlled above… guard carries [nearest, clossest, …]" |
| 24  | W2 comparative arms-equality pin, second arm | `hardest to reach` → `hardest to raech` in the composite                        | the same assertion with a different, non-identical line: "guard carries [… hardest to raech …]"                           |
| 25  | W1 ledger header array pin                   | delete `<th scope="col">Since arrival</th>` from `out-of-area-board.tsx`        | "the out-of-area ledger's table no longer carries exactly these four columns, in this order"                              |
| 26  | W1 ledger per-header visibility              | `style={{ display: "none" }}` on the same header                                | "the out-of-area ledger's \`Since arrival\` column is in the document but not on the screen — Received: hidden"           |
| 27  | W1 discharges header array pin               | delete `<th scope="col">Freshness</th>` from `discharge-board.tsx`              | "the discharges board's table no longer carries exactly these six columns, in this order"                                 |
| 28  | W1 discharges per-header visibility          | `style={{ display: "none" }}` on the same header                                | "the discharges board's \`Freshness\` column is in the document but not on the screen — Received: hidden"                 |
| 29  | W3 print card-reset membership               | delete `.bandGroup` from the card-reset selector list in `referrals.module.css` | "no print-scoped rule for .bandGroup — its dark-theme background would survive onto the printed sheet"                    |
| 30  | W3 print CanvasText membership               | delete `.bandLabel` from the CanvasText selector list                           | ".bandLabel is not covered by any \`color: CanvasText\` rule…: expected […] to include '.bandLabel'"                      |

Rows 25–28 are two assertions per table rather than one because the fix the review recommended did
not hold when it was run. That is the eighth check-that-cannot-fail, described in full above; the
per-header `toBeVisible` loop exists only because the mutation was executed instead of assumed.

---

## Not individually proven — known to pass, not known to be able to fail

None of the below has ever been observed to fail. Each has only ever sat inside a case that went
red at an EARLIER assertion, or was the last assertion under a mutation. Listed so that nobody
reads their green as proof, and so a later wave knows exactly what is left to buy.

**In "renders every unit in the network"** — `M1` stops at the set equality, which precedes four of
these; `M5` passes through all of them to reach the order pin:

- `units.length > 3`
- the `[data-layout="services"]` presence check
- `rendered.toHaveLength(units.length)`
- `modelOrder.toHaveLength(units.length)`
- both routed-split floors: `routed.length > 0` and `routed.length < units.length`

**In "stays reachable"** — `M1` reddens its first assertion, `M2` its fourth; the last two have
never failed:

- the `[data-layout="bands"]` check
- the "both pictures at once" check
- both come-back-whole assertions

**In "routing decorates and never arranges":**

- `queueRows.length > 1`
- `secondOrder not null`

**In the clock test** (the composite arms-equality pin has now moved to the proven list above; these
have not):

- the `before !== ""` floor
- the "did not follow the one Ward Flow clock" behavioural check
- the original positive control (`"const ownClock = Date.now();"`)
- the `SECOND_CLOCK_ARMS` length floor
- all six per-arm control assertions

**In "keeps every band heading and both its counts in the group's own header":**

- the `REGION_WITH_AN_EMPTY_BAND` precondition
- the group-count check
- the `/in this band/` text match
- the `bandHeadingFor` presence check
- the `emptyGroups > 0` floor

**In the Playwright far-acceptance journey** — every assertion after the point each recorded
mutation lands; `B-1`, `C-1` and `D` all land before them:

- the whole-sentence `INVENTED_OUT_OF_AREA_THRESHOLD_NOTICE` check
- the `Accepted at ${acceptedUnitName}` cross-check
- the two `toHaveCount(0)` absence pins
- the provenance-sentence check

---

## The bounded statement

Of roughly forty-five assertions this branch added, **thirty are now individually reddened** by a
named mutation with a quoted, non-identical failure line — the seventeen the review established,
the three it named as most deserving one, and the ten this fix wave added and proved. The rest,
listed above, have been observed to pass under at least one mutation but have never been observed
to fail.

That is not evidence they are fake. It is the absence of evidence that they are not, and on this
branch that distinction has already mattered seven times.

**What we still do not know, stated as not knowing rather than estimated:** whether any assertion in
the "not individually proven" list would fail if what it guards were broken. Nobody has tried. No
number is offered for how many of them are sound, because there is no basis for one — the honest
output here is the list, not a proportion.
