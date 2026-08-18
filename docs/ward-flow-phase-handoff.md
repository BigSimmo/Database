# Ward Flow — phase handoff

Durable record of decisions taken while executing the Ward Flow phase plans. The
subagent-driven-development ledger lives in `.superpowers/sdd/<plan>/progress.md`, which is
git-ignored scratch and does **not** survive a session. Anything a later session needs is
copied here.

**Read order for a fresh session:** this file, then
[`docs/superpowers/specs/2026-08-18-ward-flow-metro-patient-flow-design.md`](./superpowers/specs/2026-08-18-ward-flow-metro-patient-flow-design.md),
then the plan for the phase being executed.

---

## Where the build is

Branch `codex/ward-management-design`, worktree
`C:/Users/joshs/.codex/worktrees/ward-management-design/Database`. Nothing pushed. No PR.

| Phase                                      | Plan                                                                                                       | State                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1 — the model                              | [`plans/2026-08-18-ward-flow-phase-1-model.md`](./superpowers/plans/2026-08-18-ward-flow-phase-1-model.md) | Tasks 1–5 complete; Task 6 in fix rounds; 7–8 queued |
| 2 — coordinator screen                     | not written                                                                                                | Next to plan                                         |
| 3 — ED, ward and transport officer screens | not written                                                                                                |                                                      |
| 4 — specialist boards and escalation       | not written                                                                                                |                                                      |

Phase boundaries are in §18 of the spec.

## What Phase 1 replaced

One 736-line `synthetic-fixtures.ts` became five focused modules plus a derivations module:

| Module                | Holds                                                                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ward-clock.ts`       | `Instant` (minutes since midnight), `minutesUntil`, `clockState`, `formatRemaining` (countdown), `formatElapsed` (elapsed). The **only** module permitted to read the wall clock. |
| `ward-model.ts`       | Domain types only. Seven stages, six decline reasons, `PARALLEL_REFERRAL_CAP = 3`.                                                                                                |
| `ward-eligibility.ts` | Eight gates returning structured verdicts: `authorisation`, `cohort`, `security`, `sex_mix`, `specialling`, `prior_decline`, `capacity_freshness`, `allocatable_bed`.             |
| `ward-sites.ts`       | 17 sites, 8 emergency departments, 22 units. `NOW_ANCHOR = 10 * 60 + 42`.                                                                                                         |
| `ward-movements.ts`   | 48 movements (18 hand-authored, 30 generated deterministically), 6 bed releases.                                                                                                  |
| `ward-derivations.ts` | Shared pure UI derivations. No React, no `"use client"`.                                                                                                                          |

The eight ED ids are `arm-ed`, `fsh-ed`, `jhc-ed`, `peel-ed`, `rgh-ed`, `rph-ed`, `scgh-ed`,
`sjgm-ed`. Anything referencing an id outside `ward-sites.ts` is a defect — the lookups return
`undefined` by design and no longer substitute a different record.

## Rulings taken on the owner's behalf

Each names what it costs if it turns out to be wrong.

**1. `speciallingCapacity`, not `spellingCapacity`.** The Phase 1 plan carried a typo and told a
later task to fix it. Overruled: written correctly from Task 2, so the type, the gate, the
fixtures and three test files never carried it. _Cost if wrong: a rename diff._

**2. Movement origins draw only from the eight defined emergency departments,** and the
hand-authored movements together cover all eight. The plan's generator satisfies the
"exactly 8 distinct origins" assertion on its own, but nothing stopped a hand-authored movement
inventing a ninth. _Cost if wrong: an immediately failing assertion._

**3. The plan's "Expected: PASS (9 tests)" for Task 3 is an arithmetic error in the plan.** Its
own test block defines eight. Accepted eight; the reviewer confirmed byte-for-byte that no test
was dropped. _Cost if wrong: none — the plan contradicted itself._

**4. The conservative-failure test keeps its runtime assertion; only the `@ts-expect-error`
mechanism was replaced** with an explicit `undefined as unknown as LegalStatus` cast. The test
proves real fail-safe behaviour the spec demands; only the type suppression was wrong.
_Cost if wrong: the intent is documented slightly less loudly._

**5. The Task 5 report claims a ruling that was never made** — that hand-authored movements need
not individually cover all eight EDs. Ruling 2 says the opposite. Resolved as moot: the reviewer
confirmed the 18 hand-authored movements do cover all eight before the generator runs. Recorded
so the misstatement is not treated as precedent. _Cost if wrong: none._

**6. The shared derivations were extracted to `ward-derivations.ts`.** Fourteen pure functions
had been placed inside a 991-line `"use client"` component that two other view files imported
from and eight production routes reached transitively. Accepted the reviewer's position over the
implementer's placement. _Cost if wrong: one mechanical move, three import blocks._ Note: I
predicted the extraction would be strictly smaller. It was not — the commit grew by +92 net
because six bug fixes rode along. The extraction itself was a 1:1 relocation.

## Deferred findings that later phases must not inherit blindly

**`WF-009` is framed as an exhausted search but is not one.** Its blocker reads "No secure adult
bed available across the network", yet it declines only three of the seven adult-secure units —
`brm-adult-secure`, `fsh-adult-secure`, `rgh-adult-secure` and `sjgs-adult-secure` are untouched
and would pass the cohort and security gates. **Phase 4's escalation screen reads this record as
a network-wide exhausted search.** Either decline the remaining units explicitly or soften the
blocker text before building that screen.

**Test ids are unit-level, not site-level.** `ward-hospital-FSH` became
`ward-unit-fsh-adult-secure`, because a site can hold up to two units and the old id had to pick
one silently. Any later spec referencing the old ids needs updating.

**Smaller items, recorded but not blocking:** `formatInstant` has no guard for a negative
`Instant`; `clockState` boundary values (0, 59/60, 179/180) are untested; the `DECLINE_REASONS`
test uses `toContain`, so an accidental extra member would pass; the `cohort` and `security` gate
detail strings read identically on pass and fail; `inboxAction` is string-coupled to id prefixes
constructed in another module; the "Exception rules" list advertises a stale-capacity rule
`buildActionInbox` never emits.

## Process lessons worth carrying into Phase 2

**Verify the implementer's typecheck claim every task.** Task 3 reported `tsc --noEmit` clean
when it was not, and the repo stayed red across two tasks before Task 4's implementer surfaced
it. An implementer's report is a claim, including the boring parts.

**Passing tests did not catch a bug on every screen.** `elapsedLabel` fed a past timestamp to a
countdown formatter, so all 48 movements rendered "N overdue" at seven call sites — one of them a
column headed _Wait_. Forty-three tests were green and three reviews had passed. Tests do not
catch things that are plausible but false; looking at the screen does. **Build a screenshot pass
into every screen task in Phases 2–4.**

**A regression test nobody has watched fail is not yet a regression test.** The first attempt at
covering the elapsed bug tested the formatter directly and never called the function that had
been wrong, leaving the actual regression site uncovered.

**`npm run lint` can exit 0 without running,** printing `DATABASE_HEAVY_RUN_ADMISSION_BUSY` when
another heavyweight command holds the lock. Read the output, never the exit code.

**The pre-commit hook regenerates documentation and stops for review.** It will block a commit
until `docs/site-map.md` and `docs/codebase-index.md` are current and staged. It is slow — allow
it minutes rather than killing it.

## Suggested process calibration for Phases 2–4

Phase 1 was the cheapest of the four and still ran to roughly a million tokens on its migration
task alone. Phases 2–4 are all screens. Suggested:

- Full subagent-driven development for anything touching the model or the eligibility gates.
- A single review seat for screen-only tasks carrying no logic.
- Batched dispatches for mechanical route files — four thin route components are one dispatch.
- A screenshot pass per screen task, reviewed by the owner, not only by a subagent.
