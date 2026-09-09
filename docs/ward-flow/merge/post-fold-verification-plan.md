# Post-fold verification — two checks that cannot be run before the fold, and exactly how to run them

Written 2026-09-02 by Ward Builder One, at the owner's decision to wait for the fold rather than
buy a tree tonight. ⚠️ **This exists so the post-fold run is EXECUTION, not re-derivation** — if the
session holding this context is lost, everything needed is here.

---

## Why both are blocked, and why waiting is better than a tree

| Check                                       | Needs                                                                    | My tree has                | Verdict |
| ------------------------------------------- | ------------------------------------------------------------------------ | -------------------------- | ------- |
| Mutation-test the derived override guard    | `tests/ward-override-surfaces.test.ts` + 4 `overrideReason` declarations | file ABSENT, 1 declaration | blocked |
| Observe the ED decline options in a browser | Ward Builder Two's 7-reason list                                         | 6 reasons, no catch-all    | blocked |

⚠️ **RUNNING EITHER IN THIS TREE WOULD BE THE CONTAMINATED-MUTATION TRAP AT ENVIRONMENT SCALE.**
The guard would go red on arrival for uninteresting reasons and then go red for every mutation,
which **looks exactly like the guard working** and proves nothing. That is the same failure as the
`submitReferral` mutation earlier tonight, one level up.

**Waiting is not merely cheaper, it is better.** After the fold both live in a tree everybody shares:
independence costs nothing instead of being purchased, and both get tested **as they will actually
ship** rather than as they exist on one branch. ⚠️ **The thing being avoided is a fold gate reading
as covered while the only tree that can execute the check belongs to the chat that wrote it.**

---

## CHECK 1 — the derived override guard

**Eligibility:** I did not design it and have contributed nothing to it. ⚠️ **Disclosed seam: I have
now read its doc comments closely, so I know where it CLAIMS to be strong.** Ward Lead ruled this
acceptable and turned it into the method — _a guard's self-description is a hypothesis; run the
claims as claims._

**Standing constraints (Ward Lead's, adopted verbatim):**

- ⚠️ **Every red is a named test quoted from the runner's output, or it does not count.** Do not read
  outcomes off any summary line — Ward Builder Three found its own reporting probe mislabelling a
  mutation outcome as _"cross-check fired: NO"_ when the data showed it fired.
- **One mutation at a time. Never two guards in series** — that is how a false positive was placed as
  urgent work earlier tonight.
- **Byte-identical restore verified by `sha256sum` after each.** Reverse the edit; do not reach for
  `git checkout --`, which is blocked or silent depending on whether the file is tracked.
- ⚠️ **Do not mutate inside a span-cited region.** A claims-register check compares whitespace-collapsed
  spans and does NOT strip comments, so adding or removing a comment moves the span without moving the
  code — and the red that follows is not about the mutation.

### The order, and it matters

**1. BREAK THE PARSE FIRST.** Make `ward-flow-events.ts` unparseable to the guard's AST walk.
`deriveWardFlowEventMembers()` **fails OPEN to an empty array** by design. The question is whether the
anti-vacuity assertions really catch that, or whether an empty set quietly satisfies everything.
⚠️ **This is the failure mode that matters, and Three already found one of its own kind** — an emptied
source table left an equality assertion passing on `0 === 0`, caught only by a separate floor guard.
Its words: _"two things agreeing prove nothing when both have collapsed."_
**Expect red at:** `overridableEventTypes.length` `toBeGreaterThan(0)` (:377) and
`toBeGreaterThanOrEqual(3)` (:381). Name whichever actually fires.

**2. Then each anti-vacuity claim separately**, confirming each is caught by a NAMED test and not by a
count:

| #   | Mutate                                                      | The claim under test                    | Expected red                                          |
| --- | ----------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------- |
| 2a  | Remove one union member's `overrideReason`                  | the derived set tracks the source       | set-equality vs `EXPECTED_OVERRIDABLE_EVENTS`         |
| 2b  | Empty `ALLOWED_SURFACES_WITHOUT_OVERRIDE_REASON`            | an empty allowlist cannot pass for free | `Object.keys(...).length` `toBeGreaterThan(0)` (:496) |
| 2c  | Add an allowlist key for a file that has no violating site  | a stale entry cannot outlive its gap    | the `stale` `toEqual([])` assertion (95637ba44)       |
| 2d  | Add an overridable-event dispatch OUTSIDE `ward-management` | the guard's scope is still honest       | the outside-scope assertion (adb7eb248)               |
| 2e  | Add a second construction site to any pinned surface        | per-surface counts are real             | the `counts` `toEqual({...})` object (:574-581)       |

⚠️ **For each: confirm the mutated line actually EXECUTES.** A green result means either the guard is
blind **or the mutation never ran**, and those are indistinguishable from where you stand. That is the
rule this whole exercise exists to apply.

---

## CHECK 2 — the ED decline options, in a real browser

**Everything checkable without a browser is ALREADY CONFIRMED** against Ward Builder Two's branch,
with a control proving the search discriminates:

```
7 reasons − 4 bed-shaped exclusions = exactly 3, in array order, plus the placeholder:
  "Choose a reason"                    ed-screen.tsx:1178
  "Belongs to another service"         ward-referrals.ts:579
  "Referred elsewhere"                 ward-referrals.ts:580
  "Another reason — needs follow-up"   ward-referrals.ts:612
```

`.filter()` preserves array order and `toHaveText([])` is order-sensitive, so the predicted order holds.

⚠️ **WHAT THE BROWSER STILL ADDS, and it is not nothing:** that the component genuinely renders what
the source says. An RSC boundary or a conditional wrapper is invisible to source reading and has
produced two defects on this stack before.

⚠️ **REPORT WHAT THE SCREEN SHOWS BEFORE REPORTING WHETHER THE ASSERTION PASSES.** The assertion is an
exact SET: if the derivation yields four with one different label, or five because something slipped
the exclusion, it fails in a way that **reads as the catch-all being wrong when the catch-all is fine.**

⚠️ **TRAP, hit once already:** grepping for the label finds `"Another reason — see the coordinator"`
three lines away — a REJECTED draft named inside a comment. It looks exactly like the answer.

**Command:** `npm run ensure` first, then the roles spec on `chromium-mockups`. Quote the count seen.

---

## The unit trap, recorded because it caught me four times in one evening

⚠️ **Every independent count I made tonight that disagreed with somebody was MY count measuring the
wrong unit:**

| I counted                           | The claim counted            |
| ----------------------------------- | ---------------------------- |
| total `overrideReason` declarations | declarations each side ADDED |
| string occurrences of an event name | AST construction sites       |
| rows containing the word "TESTED"   | the Method column's value    |
| decline REASONS                     | rendered `<option>` elements |

**Not one was caught by being careful. Every one was caught because the number disagreed with
something I had already read.** ⚠️ **Before computing a count to check somebody's claim, establish
what UNIT the claim counts.** The instrument is right far less often than the arithmetic.
