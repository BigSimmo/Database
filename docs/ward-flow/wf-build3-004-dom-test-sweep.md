# WF-BUILD3-004 — checks that cannot fail, across every ward DOM test

Swept 2026-09-01 by Ward Builder Three. **Report only: nothing in the swept set was changed.**

A _check that cannot fail_ is a test that passes whether or not the property it names is true. It is
not the same as a weak test. The distinguishing question is: **can any plausible change to production
code break the behaviour this test claims to guard while leaving it green?** If yes, it is a finding
and the change is named below. If I could not name one, it is a suspicion and is listed separately.

## Method, and the two numbers that matter

**The set is 56 files, not the 51 the brief named.** Enumerated from disk with
`ls tests/ward-*.dom.test.tsx`. **Control:** the sibling `tests/ward-*.test.ts` family is **89** files
— that is what a wrong extension sweeps instead, which is exactly how a previous sweep of this class
reported clean coverage over the wrong set and never touched this family at all. The brief's 51 came
from a summary nobody had re-derived. I did not adjust to it.

**Coverage: 56 of 56 read in full — 17,098 lines.** Not searched; read. This defect class is about
_where an assertion sits relative to a scope_ — outside a negation, inside one branch of a conditional,
comparing two values that both come from the fixture — and none of that is visible to a pattern scan.
Any file reported here was opened and read end to end. Eight readers, batched by line count so no
reader was asked to skim, each required to return its own file count.

**61 findings across 35 files. 21 files clean. Roughly 41 suspicions**, labelled as such.

## The corroboration, which is the most load-bearing fact in this document

Two files — `ward-board-people-panel.dom.test.tsx` and `ward-board-discharge.dom.test.tsx` — had
already been found faulty by Ward Builder One and were repaired while this sweep ran. **I had swept
them before that fold, and two of my readers found both defects independently, without sight of that
report, and named the same falsifying changes.** That is genuine corroboration of a merged fix, and it
is the only independent corroboration any finding tonight has had. It is also why the right move was
to sweep them rather than skip them: a skip would have produced coverage of 54 of 56 dressed as
completeness.

## ⚠️ TWO DEFECTS IN THIS DOCUMENT, FOUND 2026-09-02, BOTH ABOUT THE RECORD RATHER THAN THE READING

### 1. Fifty-three of the sixty-one findings were never individually written down

This document details **8** findings and summarises **"the remaining 53"** thematically, naming a
handful of files as examples. **The count survived; the content did not.**

**How it surfaced:** Ward Builder Two reported a blind test at `ward-referral-screens.dom.test.tsx`
~`:1247` and asked whether it was among my six findings for that file. **I cannot answer.** Two of
the six appear in the thematic groupings and neither is that one; **the other four exist nowhere** —
not here, and not in the readers' reports, which are gone with the sessions that wrote them.

⚠️ **So "FINDINGS (6)" in the table below is an unauditable number for most of this document.** A
count without its findings cannot be checked, cannot be triaged, and cannot be compared against
somebody else's discovery — which is the whole use anybody has for it. **The later `.ts` sweep
carries 131 findings in 1,752 lines and does not have this defect; this one carries 61 in 231 lines
and does.** The compression was a choice made for readability and it cost the artefact its purpose.

**Do not treat the per-file counts here as findings you can act on.** Where a finding is not written
out below, it is lost.

### 2. Six of the fifty-six files have changed since they were read

The sweep was committed at `de387bd1d`. Measured against `HEAD`:

```
ward-board-discharge · ward-board-people-panel · ward-daily-sheet
ward-ed-screen · ward-governance · ward-screen-fd23-leaks
```

**Findings on those six are PROVISIONAL.** Ward Builder One found the instance: my governance finding
— effectiveness figures asserted with a digit matcher a `NaN` satisfies — **was already fixed on
2026-09-01**, and the fix is recorded in that file's own comment in past tense. The analysis
reproduced exactly; **it was right about a version that no longer exists.**

**That is CLOSED-ALREADY, not NOT-A-FINDING**, and the distinction matters to the hit rate: the
defect was real and somebody got there first. **Staleness here is temporal, not positional** — the
file is identical on both branches today, and was different when it was swept. A branch-versus-branch
diff does not find this; only `git diff <sweep-commit> HEAD` does.

## What this sweep did NOT cover

Production source was read only in the neighbourhoods needed to establish each falsifying change. **No
production file has been swept for this class.** Neither has the `tests/ward-*.test.ts` family (89
files), nor `tests/ui-*.spec.ts` (46). Several verdicts of CLEAN rest on a sibling suite genuinely
proving the half this file delegates; where a reader could not verify that, it is recorded as a
suspicion rather than folded into the verdict.

---

## Per-file verdicts — all 56

| File                                              | Verdict                                             |
| ------------------------------------------------- | --------------------------------------------------- |
| `ward-referral-screens.dom.test.tsx`              | FINDINGS (6)                                        |
| `ward-daily-sheet.dom.test.tsx`                   | FINDINGS (6)                                        |
| `ward-morning-page.dom.test.tsx`                  | FINDINGS (3)                                        |
| `ward-board-triage.dom.test.tsx`                  | FINDINGS (3)                                        |
| `ward-network-referral-clocks.dom.test.tsx`       | FINDINGS (3)                                        |
| `ward-error-boundaries.dom.test.tsx`              | FINDINGS (2)                                        |
| `ward-pull-vocabulary.dom.test.tsx`               | FINDINGS (2)                                        |
| `ward-network-stage-filter.dom.test.tsx`          | FINDINGS (2)                                        |
| `ward-board-selection.dom.test.tsx`               | FINDINGS (2)                                        |
| `ward-screen-fd23-leaks.dom.test.tsx`             | FINDINGS (2)                                        |
| `ward-governance.dom.test.tsx`                    | FINDINGS (2)                                        |
| `ward-network-referral-placement.dom.test.tsx`    | FINDINGS (2)                                        |
| `ward-patient-page.dom.test.tsx`                  | FINDINGS (2)                                        |
| `ward-person-screen.dom.test.tsx`                 | FINDINGS (2)                                        |
| `ward-flow-potential-chip-migration.dom.test.tsx` | FINDINGS (2)                                        |
| `ward-statistics-sections.dom.test.tsx`           | FINDINGS (1)                                        |
| `ward-screen.dom.test.tsx`                        | FINDINGS (1)                                        |
| `ward-console-controls.dom.test.tsx`              | FINDINGS (1)                                        |
| `ward-morning-tour.dom.test.tsx`                  | FINDINGS (1)                                        |
| `ward-flow-provider.dom.test.tsx`                 | FINDINGS (1)                                        |
| `ward-provider-initial-now.dom.test.tsx`          | FINDINGS (1)                                        |
| `ward-override-register-render.dom.test.tsx`      | FINDINGS (1)                                        |
| `ward-escalation.dom.test.tsx`                    | FINDINGS (1)                                        |
| `ward-ed-withdraw-referral.dom.test.tsx`          | FINDINGS (1)                                        |
| `ward-out-of-area-live-state.dom.test.tsx`        | FINDINGS (1)                                        |
| `ward-board-live-state.dom.test.tsx`              | FINDINGS (1)                                        |
| `ward-screen-cancel-unavailable.dom.test.tsx`     | FINDINGS (1)                                        |
| `ward-handover.dom.test.tsx`                      | FINDINGS (1)                                        |
| `ward-network-stage-strip.dom.test.tsx`           | FINDINGS (1)                                        |
| `ward-tracker-leg-badge.dom.test.tsx`             | FINDINGS (1)                                        |
| `ward-ed-psychiatry-hub.dom.test.tsx`             | FINDINGS (1)                                        |
| `ward-capacity-view.dom.test.tsx`                 | FINDINGS (1)                                        |
| `ward-network-queue-count.dom.test.tsx`           | FINDINGS (1)                                        |
| `ward-board-people-panel.dom.test.tsx`            | FINDINGS (1) — **already fixed**, corroborated here |
| `ward-board-discharge.dom.test.tsx`               | FINDINGS (1) — **already fixed**, corroborated here |
| `ward-ed-screen.dom.test.tsx`                     | CLEAN                                               |
| `ward-shortlist.dom.test.tsx`                     | CLEAN (1 suspicion)                                 |
| `ward-referral-match-hooks-order.dom.test.tsx`    | CLEAN                                               |
| `ward-flow-clock-consistency.dom.test.tsx`        | CLEAN                                               |
| `ward-freshness.dom.test.tsx`                     | CLEAN (1 suspicion)                                 |
| `ward-community-hub.dom.test.tsx`                 | CLEAN (2 suspicions)                                |
| `ward-board-page.dom.test.tsx`                    | CLEAN (1 suspicion)                                 |
| `ward-capacity-freshness-source.dom.test.tsx`     | CLEAN                                               |
| `ward-referral-destinations.dom.test.tsx`         | CLEAN                                               |
| `ward-patient-search.dom.test.tsx`                | CLEAN (1 suspicion)                                 |
| `ward-community-index.dom.test.tsx`               | CLEAN                                               |
| `ward-capacity-sexmix-release.dom.test.tsx`       | CLEAN                                               |
| `ward-statistics.dom.test.tsx`                    | CLEAN (2 suspicions)                                |
| `ward-ed-transport-booking.dom.test.tsx`          | CLEAN (1 suspicion)                                 |
| `ward-urgent-flag.dom.test.tsx`                   | CLEAN                                               |
| `ward-bed-release.dom.test.tsx`                   | CLEAN                                               |
| `ward-referral-control-labels.dom.test.tsx`       | CLEAN                                               |
| `ward-discharge-board.dom.test.tsx`               | CLEAN                                               |
| `ward-sidebar.dom.test.tsx`                       | CLEAN (suspicions)                                  |
| `ward-morning-tour-paused.dom.test.tsx`           | CLEAN                                               |
| `ward-flow-queue-selection.dom.test.tsx`          | CLEAN                                               |

---

## The findings that carry a clinical claim

These are ordered by what a green run would let through, not by how obvious the defect is.

### 1. `ward-screen-fd23-leaks.dom.test.tsx` — the leak test forbids the wrong string

_"never names a co-addressed ward, and never reveals that one exists"_ iterates
`parallel.referredUnitIds` and asserts the card does not contain each **id** — `rgh-adult-secure`. A
disclosure would be a **name** — `RGH Adult Secure`. No screen prints a slug on a clinical card.

**Falsifier:** add `Also referred to {others.map(u => u.name).join(", ")}` to the incoming card in
`ward-screen.tsx`. The card names every co-addressed ward; no slug appears; green. The second limb,
`not.toHaveTextContent(/parallel/i)`, is pinned to one word, so `Also referred elsewhere` also passes —
**so a ward can be told both THAT co-addressees exist and WHO they are.** The technique that would
catch it is used one test lower in the same file: iterate `allUnits()` and forbid `unit.name`.

### 2. `ward-daily-sheet.dom.test.tsx` — the handover sheet's counts are never read

_"the destinations on the sheet are this ward's, and total no more than the people in its beds"_
compares `targets.reduce(...)` against `occupantsOf(UNIT_ID).length`. Both come from the fixture. The
only DOM assertion counts `<li>` elements. **No rendered number is read anywhere in the suite** —
`ward-daily-sheet-destination-*` is asserted in no other test.

**Falsifier:** render any other quantity in place of `{target.count}`. One `<li>` per target still
renders, the fixture-to-fixture bound still holds, and the sheet read aloud at handover says
"Peel: 18 people" where two are Peel-bound. Five further findings in this file, including a
parameterised test whose three "safeguard" bounds compare fixture to fixture across all 23 cases and
cannot be broken by any production change at all.

### 3. `ward-network-queue-count.dom.test.tsx` — expectation and render are one expression

The test computes `wardMovements.filter(isOpen)`; the component computes `movements.filter(isOpen)`
with the same imported function. Expected count, expected membership and rendered output are the same
expression.

**Falsifier:** in `ward-derivations.ts`, change `isOpen` to `return !movement.closure;`. Arrived
patients re-enter a queue for placement, in the header _and_ as rows. Every assertion moves in
lockstep; green.

### 4. `ward-board-triage.dom.test.tsx` — an incomplete blocklist standing in for a privacy rule

_"names beds and never the people in them"_ forbids `Male|Female` and eight region names.
`HOME_REGIONS` holds **ten**: **South West** and **Great Southern** are absent. Name, initials and age
are unguarded outright.

**Falsifier:** render the occupant line on a release row the way the incoming panel already does.
Region leaks silently for two regions; identity leaks for everyone; green.

### 5. `ward-escalation.dom.test.tsx` — "it suggests nothing" checked in text nodes only

D4 is enforced by six forbidden words against `textContent`, which excludes `title`, `aria-label` and
`placeholder`.

**Falsifier:** `<td title={"Nearest eligible ward: " + x}>`, or a column headed "Try first". A
suggestion reaches a clinician; the blocklist never sees it.

### 6. `ward-ed-withdraw-referral.dom.test.tsx` — `.every()` over a possibly-empty array

`withdrawnReferrals.every(...)` is `true` on `[]`, and nothing pins it non-empty.

**Falsifier:** stop writing `withdrawnReferrals` in the reducer's WITHDRAW_REFERRAL branch. All four
assertions hold; the receiving ward loses the field that tells it **why** a referral vanished from its
list — the field that module's own comment calls "the field that exists to PROTECT this ward".

### 7. The `ward-board-fixed-note` pair — the class in one sentence

`ward-board-fixed-note` is asserted **absent** in `ward-board-live-state.dom.test.tsx` and
`ward-daily-sheet.dom.test.tsx`, exists in `src/` **nowhere**, and is asserted **present** nowhere.

**Falsifier:** re-add the frozen-board note with any other testid, or none. Both stay green while the
board again tells a clinician it does not change during their session — the claim that produced the
`Held 1` at 10:42 / `Held 0` at 12:32 divergence. **This is the whole class in one line, and it is the
one worth showing the owner.**

### 8. `ward-ed-psychiatry-hub.dom.test.tsx` — an assertion no change can redden

`expect(245 - 35, "the gap this row exists to show").toBe(210)`. Two integer literals. Deleting the
entire `ward-management` directory would not fail it, and its message claims a clinical property it
cannot observe.

⚠️ **The gap IS genuinely guarded two and four lines away** — `data-minutes-in-department="245"`,
`data-minutes-since-referral="35"`, and two `getByRole("definition")` pins. **Remove the dead line, not
the real checks around it.**

---

## The remaining 53 findings

Grouped by shape, with the file that shows each most clearly. Full detail per file sits in the batch
reports; each carries its own falsifier.

- **Expectation derived from the same helper the component calls** — `ward-capacity-view`,
  `ward-morning-page` (headline), `ward-statistics-sections`, `ward-network-stage-strip`. The render is
  read, so these are weaker than a pure fixture-to-fixture comparison, but a defect _inside_ the shared
  helper is agreed with rather than caught.
- **Negative assertions with no positive control** — `ward-screen-cancel-unavailable`,
  `ward-override-register-render`, `ward-governance` (the empty-state note),
  `ward-flow-potential-chip-migration` (an exact-text matcher that cannot match a labelled chip),
  `ward-flow-provider` (a `setInterval` spy never shown capable of firing).
- **Substring matchers where the property needs equality** — `ward-network-stage-filter` (two numbers
  in one sentence, so swapping them passes), `ward-board-selection` (`"18"` contains `"1"`),
  `ward-flow-potential-chip-migration` (`"10"` contains `"0"`).
- **Zero-iteration loops and branch-flipping conditionals** — `ward-morning-tour`,
  `ward-pull-vocabulary` (a rename moves execution into the branch that proves nothing),
  `ward-network-referral-clocks` (the stopped-clock arm can never execute on this seed).
- **Assertions that prove only the test's own setup** — `ward-person-screen` (an age computed against
  1 January of the person's own birth year, then discarded), `ward-referral-screens` (answers checked
  against a sentinel rather than against the value set, so "kept the clinician's answer" cannot be
  told from "replaced it with the first option").
- **Titles and comments claiming rigour the matcher lacks** — `ward-morning-page` (comments still
  describe a frozen 08:00 sheet that was removed; all 20 tests pass at both instants, which is the
  proof they are blind to it), `ward-referral-screens` (a comment saying "exact text, not
  `toContainText`" above a substring matcher).

---

## Provenance

Eight Opus readers, one per batch, each given the same definition, the same seven defect shapes, the
same requirement to name a falsifying production change, and the same instruction that a reading is
not a finding. Enumeration, batching, the count control and this document are mine. **The Opus tier
was Ward Lead's veto — assessing whether a check can fail is a judgement no gate can make**, which is
also why the numbers in this document are stated with their controls rather than on their own.
