# Ward Flow Phase 8 — Distance and the state

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** the network gains a sense of how far each bed is from the person's home — as a band, never
a number, and never a ranking — so a coordinator can see how many options are close, how many are
not, and how many people are currently in a bed a long way from where they live.

**Architecture:** one new pure module owns the band; everything else wraps what already exists. A
band is a lookup on a pair (home region → hospital site), the candidate list is _grouped_ rather than
replaced, the ledger counts accepted referrals that have arrived, and the two proximity words the
system cannot back are renamed. Nothing is sorted, nothing is gated, and nothing is called best.

**Tech Stack:** TypeScript 6 strict, React 19, Next.js 16 App Router, CSS modules with `@theme`
tokens, Vitest, Playwright (project `chromium-mockups`).

**Spec:** `docs/superpowers/specs/2026-08-28-ward-flow-phase-8-distance-design.md`
**Settled decisions:** `docs/ward-flow-phase-8-decisions.md` (D8-1 … D8-7),
`docs/ward-flow-roadmap.md`
**Standing implementer rules:** `.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/DISPATCH-PREAMBLE.md`

---

## The rule the whole phase is built to

> **Any word implying proximity — nearest, closest, local, far, best — must be backed by a fact the
> system actually holds, and the thing on screen is the band, not the number.**

This is not hypothetical. A whole-branch review found a screen headed "Nearest candidates" offering a
patient sitting in one hospital's own emergency department a different hospital's bed first, in an
order that was simply the order the site table happens to list them, with nothing in the system
knowing where anything was. The heading is gone. The pressure that produced it is not, and this is
the phase that invites it back.

---

## Global Constraints

Every task's requirements implicitly include all of these. They are not background reading; each one
is here because something went wrong without it.

### Where you are

- **Run every command from this worktree.** Prefix each one with
  `cd /d/Worktrees/Database/pr-2390-fix &&`. The shell's working directory does not reliably persist
  and silently reverts to a different checkout. An implementer lost an hour running its tests against
  a checkout where its own test file did not exist.
- **Stage explicit paths.** `git add <path> <path>`, never `git add -A`. Other agents share this
  worktree.
- **Never run a wildcard revert.** `git checkout HEAD -- .`, `git restore .`, `git clean -fd` and
  anything else taking a directory rather than named paths are forbidden here, including inside a
  command you did not expect to have an effect. There is no reflog for a working tree, and this has
  already destroyed work once on this branch. **Never `git stash`** either — the stash stack is
  shared across every worktree on this machine.

### What must never be written down

- **No travel-time value appears in this plan, and no implementer may take one from a map, an
  atlas, a search, a recollection of Western Australia, or an estimate of their own.** The site table
  uses **real hospital names**, so a band printed beside one reads as a claim about that hospital,
  and nobody has checked one. See Task 1 for the authoring rule that replaces geography.
- **No kilometre figure anywhere** (D13) — not in code, copy, comment, test or fixture.
- **No figure, timeframe, threshold or duration from the Mental Health Act** may be cited,
  paraphrased or inferred anywhere. A plain `Voluntary` / `Involuntary` label is permitted and **is
  not a legal figure**. Nothing in Phase 8 needs one. If a figure seems needed, stop and report it.
- **No new fact about a person.** A referral carries exactly five: `ageBand`, `sex`,
  `secureBedNeeded`, `involuntaryBedNeeded`, `homeRegion`. `arrivedAt` and `localBedSought` (Task 2)
  are facts about the _referral_, not the person, and the structural privacy test must be extended to
  record them as deliberate. **No free text anywhere.**

### Things this branch learned the hard way

- **Matching never reads a bed release.** `ward-referrals.ts` must not import `ward-derivations.ts`,
  `ward-bed-availability.ts`, or anything naming `BedRelease`, `BedReleaseState`,
  `BedReleaseConfidence`, `BED_RELEASE_STATES`, `BED_RELEASE_CONFIDENCE_LEVELS`, `releaseBand`,
  `RELEASE_BANDS` or `capacityBreakdown`. `tests/ward-referral-matching.test.ts` walks the **whole
  transitive import graph** from `ward-eligibility.ts` and `ward-referrals.ts`, so a single new
  import three files away breaks it. That is exactly how a green hand-picked test subset shipped a
  red test on this branch.
- **Every new Phase 8 module joins that graph** the moment `ward-referrals.ts` imports it. Keep
  `ward-distance.ts` and `ward-travel-bands.ts` importing nothing but types from `ward-model.ts`.
- **The morning page computes no figure of its own.** Nothing in this phase may change that; every
  number a screen shows comes from a named function in a derivation module.
- **Any new exported declaration in `ward-model.ts` that writes a number down** — a constant, an
  object property, a function body, an enum member — must have a real entry in
  `MODEL_CONSTANT_PROVENANCE` in `tests/ward-legal-figure-guard.test.ts`, naming a human and a date.
  **Phase 8 should need none:** put every new constant in `ward-distance.ts`, and express the
  out-of-area threshold as a list of band names, not a number.
- **Naming trap in the same guard (Part 3).** It flags any SCREAMING_SNAKE identifier anywhere in the
  ward directory that carries **both** a legal token (`FORM`, `STATUTORY`, `LEGAL`, `MHA`, `ACT`,
  `DETENTION`, `EXAMINATION`, **`REFERRAL`**) **and** a duration token (`MINUTES`, `MINS`, `HOURS`,
  `DAYS`, `EXPIRY`, `DEADLINE`, `WINDOW`, `LIMIT`, `TIMEOUT`, `DUE`). A phase about hour-named bands
  and a referral arrival clock walks straight into this: `REFERRAL_ARRIVAL_WINDOW`,
  `REFERRAL_TRAVEL_HOURS` and friends all trip it. `TRAVEL_BANDS`, `SYNTHETIC_TRAVEL_BANDS` and
  `OUT_OF_AREA_BANDS` are clean. Lower-case string _values_ like `"three_hours_or_more"` are not
  identifiers and are not scanned.
- **One spelling of a shared label.** `urgencyTierLabel` in `ward-priority.ts` is the pattern: three
  screens each held their own copy and two of them disagreed. Every band label, group heading and
  mandated sentence in this phase is exported **once** from `ward-distance.ts` and imported. Never a
  second local copy, and never a hand-written list parallel to `TRAVEL_BANDS`.
- **Every new production route needs registration at six fail-closed sites**, and
  `.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/check-registration.sh` runs all of them.
  Run that script; do not hand-pick. A hand-picked subset shipped a red test twice on this branch.
- **A Playwright spec absent from `playwright.config.ts`'s two hand-maintained regexes silently
  never runs**, which is indistinguishable from passing. Prefer extending
  `tests/ui-ward-referrals.spec.ts` over creating a new spec file (see Task 10).
- **Design tokens, not raw CSS literals.** `check:design-system-contract` ratchets them. Production
  tap targets are `min-h-12` (48 px) and must never be lowered to `min-h-11` — that reintroduces a
  known `ui-smoke` flake.
- **Every `<button>` must do something** — a handler, a submit inside a form, or navigation.
  `eslint-rules/require-button-wiring.mjs` fails the build otherwise. Never blanket-disable it.
- **Ward Flow is a sandbox.** No new link may point anywhere in the clinical application.

### Running tests and proving they mean something

- **Take the shared lease.** `GATE_RECEIPTS=refresh node scripts/run-vitest.mjs run <files> --reporter dot`.
  Never bare `npx vitest`. `GATE_RECEIPTS=refresh` is mandatory — a memoised run can exit 0 having
  printed no test-count line at all, which proves nothing ran.
- **A refusal reading "capacity is full" or "heavyweight command is active" means BLOCKED, retry** —
  never a test failure. Retry from **one** background job looping with `sleep 20`; foreground `sleep`
  is blocked. Do not poll and do not set up Monitor subscriptions.
- **Read the exit status AND the decisive output line.** Quote real numbers. Exit 0 with no
  `Tests N passed` line is not a pass.
- **Mutation-test every new test.** Break what it guards, run it, watch it go **red**, quote the
  failure line, restore. `.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/mutate.sh` does
  the whole cycle including a byte-identical restore check. A test never watched to fail is not
  evidence and will be treated as none. **If one of your own tests does not catch its mutation,
  report that** rather than adjusting the mutation to fit.
- **Never weaken, delete or loosen an assertion** to make something pass, and never add a catch-all
  branch or widen a matcher to absorb a widened union.
- **Before committing:** `npm run format:changed`, then
  `rm -rf node_modules/.cache/eslint && npm run lint`, then `npm run typecheck`. Formatting is in
  none of test, typecheck or lint.
- **Before reporting the ward suite green**, run
  `.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/check-ward-suite.sh`, which discovers
  every ward test file from disk rather than trusting a remembered list.

### Provider boundary

**Local and offline only.** Never run `verify:release`, any `eval:*` script,
`check:supabase-project`, `test:live`, or anything touching OpenAI, Supabase, hosted CI or a live
database. Never push and never open a pull request.

---

## File structure

| File                                                                                                                | Responsibility                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ward-management/ward-distance.ts`                                                                   | **New.** `TRAVEL_BANDS`, `TravelBand`, `travelBand`, `unitTravelBand`, the band labels, the out-of-area band list, the two mandated sentences. |
| `src/components/ward-management/ward-travel-bands.ts`                                                               | **New.** `SYNTHETIC_TRAVEL_BANDS` — the invented fixture, and nothing else.                                                                    |
| `src/components/ward-management/ward-referrals.ts`                                                                  | Gains `groupCandidatesByTravelBand` and `outOfAreaLedger`. Still imports no release model.                                                     |
| `src/components/ward-management/ward-model.ts`                                                                      | `Referral` gains `arrivedAt?` and `localBedSought?`; `out_of_catchment` renamed.                                                               |
| `src/components/ward-management/ward-flow-events.ts`                                                                | Two new events and their `EVENT_ROLE` entries.                                                                                                 |
| `src/components/ward-management/ward-flow-reducer.ts`                                                               | Their two transitions, guards and `Rejection`s.                                                                                                |
| `src/components/ward-management/ward-movements.ts`                                                                  | Band-exercising seeds on the `referrals` fixture; RF-004's renamed decline reason.                                                             |
| `src/components/ward-management/referrals/referral-match.tsx`                                                       | Group headings, per-row bands, the synthetic sentence, the optional local-bed control.                                                         |
| `src/components/ward-management/referrals/referrals.module.css`                                                     | Their styles, phone-first.                                                                                                                     |
| `src/components/ward-management/out-of-area/out-of-area-board.tsx`                                                  | **New.** The ledger screen.                                                                                                                    |
| `src/components/ward-management/out-of-area/out-of-area.module.css`                                                 | **New.**                                                                                                                                       |
| `src/app/mockups/ward-flow/out-of-area/page.tsx`                                                                    | **New.** Its route.                                                                                                                            |
| `src/components/ward-management/ward-nav.ts`                                                                        | Its nav entry.                                                                                                                                 |
| `src/components/ward-management/ward-management-network.tsx`                                                        | The placement tool (four tasks).                                                                                                               |
| `src/components/ward-management/ward-management-console.tsx`                                                        | The second decline-reason label map.                                                                                                           |
| `tests/ward-travel-bands.test.ts`                                                                                   | **New.** The band module and its fixture.                                                                                                      |
| `tests/ward-travel-grouping.test.ts`                                                                                | **New.** Grouping and the ledger.                                                                                                              |
| `tests/ward-referral-matching.test.ts`                                                                              | The D12 contract extension.                                                                                                                    |
| `tests/ward-referral-model.test.ts`, `tests/ward-referral-reducer.test.ts`, `tests/ward-legal-figure-guard.test.ts` | Model, events, legal-figure sweep.                                                                                                             |
| `tests/ward-referral-screens.dom.test.tsx`                                                                          | Match view and the ledger screen.                                                                                                              |
| `tests/ward-landmarks.test.ts`, `tests/ward-nav.test.ts`, `data/repo-awareness-snapshot.json`                       | Registration.                                                                                                                                  |
| `tests/ui-ward-referrals.spec.ts`, `tests/ui-ward-management.spec.ts`                                               | The Chromium journey, and the assertion the "Best" rename breaks.                                                                              |

---

## Task 1: The band, and the fixture that must not become geography

**Why this exists.** A band is a fact about a _pair_ — "three hours away" is meaningless until you
say three hours from where. It belongs to neither the hospital nor the ward, so it lives in its own
module with exactly one entry point, and every screen that shows a band gets it from that function
rather than working one out. A band computed inline in a component is a band that can disagree with
itself between two screens, which is the exact defect Phase 5 shipped and caught by screenshot.

**Files:**

- Create: `src/components/ward-management/ward-distance.ts`
- Create: `src/components/ward-management/ward-travel-bands.ts`
- Test: `tests/ward-travel-bands.test.ts` (create)

**Interfaces produced — later tasks consume these exact names:**

```ts
export const TRAVEL_BANDS = [
  "under_an_hour",
  "one_to_three_hours",
  "three_hours_or_more",
  "air_transport_only",
] as const;
export type TravelBand = (typeof TRAVEL_BANDS)[number];

/** The band from a person's home region to a hospital site, or `undefined` when the synthetic
 *  fixture records none for that pair. NEVER falls back to a band. */
export function travelBand(homeRegion: HomeRegion, siteCode: string): TravelBand | undefined;

/** The same fact for a candidate unit, resolving the unit's site for the caller. */
export function unitTravelBand(referral: Referral, unit: Unit): TravelBand | undefined;

/** The one spelling of every band, and of the not-recorded group. Derived from TRAVEL_BANDS. */
export const TRAVEL_BAND_LABELS: Record<TravelBand, string>;
export const NOT_RECORDED_LABEL: string; // "Travel time not recorded"

/** D6's invented threshold, as a list of band names — never a number, so it needs no provenance
 *  entry and can never be read as a measured figure. */
export const OUT_OF_AREA_BANDS: readonly TravelBand[]; // three_hours_or_more, air_transport_only
```

`TRAVEL_BANDS` carries a **runtime array**, not only a union type, matching `COHORTS`, `SEXES`,
`SEX_DESIGNATIONS`, `REFERRAL_SOURCES` and every other list of this shape. Every picker, group
heading and label map derives from that array, never from a hand-written copy — the same review
finding that had to be forced twice during Phase 7.

`ward-distance.ts` also exports the two sentences that must ship verbatim, so no screen can paraphrase
one and no reviewer has to compare three copies:

```ts
export const SYNTHETIC_TRAVEL_TIMES_NOTICE =
  "Travel times on this screen are invented, like every bed number in this prototype. Nobody has " +
  "measured or checked how far any of these hospitals is from anywhere, and no distance shown here " +
  "should be relied on.";

export const INVENTED_OUT_OF_AREA_THRESHOLD_NOTICE =
  "Out of area here means three hours or more from home, or reachable only by air. This prototype " +
  "invented that line. Nobody has checked whether Western Australian mental health services already " +
  'define "out of area", and if they do, their definition replaces this one.';
```

**`unitTravelBand` reads `unit.siteCode` directly** — `Unit` already carries it. Do **not** import
`ward-sites.ts` to resolve it; keeping this module's imports to types from `ward-model.ts` is what
keeps it safe inside the D12 import graph (Task 3).

**The band is NEVER taken from `Referral.originSiteCode`.** That is the hospital the referral came
from, not where the person lives. Measuring from it is the "Nearest candidates" mistake in a new
coat: it would call a city bed close for someone driven into a city emergency department from a long
way away. `homeRegion` exists to make that impossible, and this is the decision that spends it.

### The authoring rule for the fixture — read this twice

`SYNTHETIC_TRAVEL_BANDS` is invented data sitting beside real hospital names. The single most likely
way this phase asserts something false is that a diligent implementer, asked to invent a plausible
band for a named hospital, quietly consults a map — and it will look like thoroughness when it
happens.

**So the values are chosen to exercise the code, not to describe Western Australia.** Concretely:

1. **Do not consult a map, an atlas, a search, or your own recollection of WA distances.** Do not
   reason from which hospitals "sound remote". If you catch yourself weighing whether a value is
   realistic, you have left the rule.
2. **Choose pairs so that the awkward paths are exercised by default**, which is what the spec's own
   verification section requires:
   - at least one home-region/site pair with **no** recorded band, so the not-recorded group is live
     in the seeded data rather than only in a test;
   - **at least one home region that a seeded referral actually uses with no bands recorded at all**,
     so the whole-region gap wording renders;
   - at least two units **in one band**, so Task 3's no-reordering test has something to catch;
   - at least one pair in each of the four bands, so no band heading is dead.
3. **The table is deliberately incomplete.** Ten home regions across every site in the table is a
   large number of pairs; requiring all of them is exactly what would push an author toward filling
   gaps from a map. A missing pair is a first-class answer.
4. **The doc comment states, in the file, that the values were chosen for coverage and not for
   geography**, alongside the standing "SYNTHETIC" statement:

   ```ts
   /** SYNTHETIC. Every band below is invented, exactly like every bed number in `ward-sites.ts`.
    *  Nobody has measured or checked the real travel time between any WA region and any hospital in
    *  this table, and no value here was chosen to resemble one — the pairs recorded were chosen to
    *  exercise the four bands, the sparse case and the whole-region gap. Not every pair is recorded,
    *  and an unrecorded pair is `undefined` — never a default, never the nearest band, never
    *  "unknown means far". */
   ```

5. **A reviewer should treat a suspiciously complete band table as a finding, not as thoroughness.**

**Uncertainty, stated plainly:** this rule is the strongest mitigation available, and it is not a
proof. Recording _any_ band for a real region and a real hospital is, at some level, a printed
statement about that pair. D8-7 settles that the synthetic label is the answer; the authoring rule
above is what stops it becoming a checked-looking one. See "Where the specification cannot be
implemented as written", item 1.

**Tests (each mutation-tested):**

- `travelBand` returns `undefined` for an unrecorded pair. **Mutation:** make it fall back to
  `TRAVEL_BANDS[0]`; watch red.
- `unitTravelBand` reads the unit's site, not the referral's origin site. **Mutation:** key it on
  `referral.originSiteCode`; watch red. Author this test against a referral whose home region and
  origin site differ, or it proves nothing.
- `TRAVEL_BAND_LABELS` has an entry for every member of `TRAVEL_BANDS` and no others, derived from
  the array. **Mutation:** delete one entry; watch red (a compile failure counts, and say so).
- **No band label contains a comparative word.** Assert that no label matches
  `/furthest|most remote|hardest|nearest|closest|best|worst/i`, with the reasoning written on the
  test: air transport only is a statement about _how you get there_, not about how long it takes — a
  flight can be shorter than a drive, and this prototype knows nothing about how psychiatric patients
  actually move around WA by air. **Mutation:** rename the air band label to include "furthest";
  watch red.
- `OUT_OF_AREA_BANDS` contains no numeric literal anywhere in the module and is a subset of
  `TRAVEL_BANDS`.
- The fixture satisfies the four coverage properties in the authoring rule, asserted **structurally**
  (counts and gaps), never by naming an expected band for a named hospital.

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run and watch fail** (background retry job)
- [ ] **Step 3: Implement the module and the fixture, under the authoring rule above**
- [ ] **Step 4: Mutation-test each of the five above; quote every failure line; restore**
- [ ] **Step 5: Run, watch pass, format, lint, typecheck, commit**

---

## Task 2: The arrival record and the optional local-bed record

> **SUPERSEDED IN PART, 2026-08-29 — read this before starting Task 2.**
>
> **`Referral.arrivedAt` and the `REFERRAL_ARRIVED` event were built, then REMOVED on 2026-08-29.
> Do not build them again.** Every instruction below about an arrival field, an arrival event, its
> role gate, its reducer guards or its seeds is superseded, including the unchecked mutation-test
> box that names the `REFERRAL_ARRIVED` role gate. **Those boxes are not to-dos. Leave them
> unchecked and do not act on them.**
>
> **What replaces it.** A parallel workstream built `Admission`
> (`src/components/ward-management/ward-admissions.ts`) — the one record of a person occupying a
> bed. It records the same arrival, and unlike an accepted referral it also records the person
> LEAVING (`state: "left"`, `leftAt`). The out-of-area ledger reads admissions, and excludes
> anybody not currently holding a bed.
>
> **Why, and it is a defect rather than a preference.** The referral-based ledger had no exit. A
> referral never stops being accepted, so somebody discharged weeks ago stayed on the ledger
> permanently with their elapsed time still climbing.
>
> **What is NOT superseded: the second record, `localBedSought` and `RECORD_LOCAL_BED_SOUGHT`,
> answering D8-6.** It answers a different question, no admission records it, and it is untouched
> and still wanted. Everything in this section about it stands exactly as written.
>
> Decision provenance and reversal cost: `docs/ward-flow-phase-8-decisions.md`, D8-9.
>
> The original text below is left in place deliberately. It is the record of what was planned and
> why, and deleting it would lose the reasoning that produced the field in the first place.

**Why this exists.** D8-3 says the out-of-area clock starts when the person **arrives** in the far
bed. Nothing in the system records a referral arriving anywhere: `Referral` carries `homeRegion` but
never arrives, and `Movement` arrives but carries no home region. Without this task the ledger cannot
be built at all. The chosen closure is the cheapest of three — one optional field, one event, one
role gate — and it adds no new fact about a person, because an arrival time is operational, in the
same family as `raisedAt` and `decidedAt`.

The second record answers D8-6. Nobody knows whether country services look for a local bed first, so
the step exists as something a coordinator **may record if it happened** and never as a stage the
pathway requires.

**Files:**

- Modify: `src/components/ward-management/ward-model.ts`
- Modify: `src/components/ward-management/ward-flow-events.ts`
- Modify: `src/components/ward-management/ward-flow-reducer.ts`
- Modify: `src/components/ward-management/ward-movements.ts` (seeds)
- Modify: `tests/ward-legal-figure-guard.test.ts` (it refuses to compile until you do)
- Modify: `tests/ward-referral-model.test.ts` (structural privacy test)
- Test: `tests/ward-referral-reducer.test.ts`

**Interfaces:**

```ts
// on Referral, beside `decidedAt` — facts about the referral, never about the person
arrivedAt?: Instant;
localBedSought?: { at: Instant; by: string }; // `by` is a ROLE, never a person. No note field.
```

| Event                     | Role                  | Effect                                          |
| ------------------------- | --------------------- | ----------------------------------------------- |
| `REFERRAL_ARRIVED`        | `coordinator`, `ward` | Sets `arrivedAt` on an **accepted** referral.   |
| `RECORD_LOCAL_BED_SOUGHT` | `coordinator`         | Sets `localBedSought` on a **queued** referral. |

**`RECORD_LOCAL_BED_SOUGHT`'s role is a plan judgement, not a spec ruling** — the spec says only
"role-gated like every other referral event", and the control sits on the coordinator's match view.
Flag it in your report; the owner may want `community` as well.

**Guards, each of which gets a test:**

- A role that does not hold the event produces a visible `Rejection`, never a silent no-op.
- `REFERRAL_ARRIVED` on a referral that is not `"accepted"` is refused, naming the state.
- `REFERRAL_ARRIVED` on a referral that already has an `arrivedAt` is refused — a one-shot
  transition, same discipline as `ACCEPT_REFERRAL`'s already-decided guard.
- `RECORD_LOCAL_BED_SOUGHT` twice is refused the same way.
- An unknown `referralId` is refused, not defaulted.
- **`REFERRAL_ARRIVED` creates no `Movement`, sets no location, no legal status and no stage.**
  Assert this explicitly. It is one timestamp; the moment it acquires any of those, Phase 7's D14 has
  been reversed by accident rather than by decision, and that is this task's named risk.

**Extend the structural privacy test** to `Referral`'s two new fields, asserting the **type's field
set** rather than fixture content, so the additions are recorded as deliberate and a future
`homeAddress` still fails at the type level.

**Extend the legal-figure sweep** to both events. `tests/ward-legal-figure-guard.test.ts` switches
exhaustively over every event type, so it will not compile until you do. **Prove it non-vacuous:**
empty one candidate list and watch the traversal assertion name the event that stopped being reached.

**Seeds.** Add `arrivedAt` to some of the already-accepted referrals so the ledger has real content.
The spec requires: at least one accepted referral with an arrival whose band puts it out of area, at
least one accepted referral with an arrival whose band is **unrecorded**, and at least one accepted
referral with **no arrival at all**. Which referral is which follows from whatever bands Task 1's
author recorded — **this plan does not choose it, and neither may you choose a band to make a
particular referral out of area.** Read the fixture, then seed to fit it.

- [ ] **Step 1: Write the failing tests** (both role gates and their refusal branches, the
      one-shot guards, the no-`Movement` assertion, the widened privacy test)
- [ ] **Step 2: Run and watch fail**
- [ ] **Step 3: Implement; extend the legal-figure guard in the same change**
- [ ] **Step 4: Mutation-test** — make the `REFERRAL_ARRIVED` role gate accept every role and watch
      red; drop the already-arrived guard and watch red; add a `notes: string` field to `Referral`
      and watch the privacy test go red; empty a candidate list in the legal-figure guard and watch
      the traversal assertion name the unreached event. Quote all four, restore.
- [ ] **Step 5: Run, watch pass, format, lint, typecheck, commit**

---

## Task 3: Grouping and the ledger — two derivations, and the contract that covers them

> **SUPERSEDED IN PART, 2026-08-29 — the ledger half only.** `outOfAreaLedger` takes `Admission[]`,
> not accepted referrals: `Referral.arrivedAt` no longer exists. Every reference below to an
> accepted referral with an `arrivedAt`, and the `sinceArrival` note reading "minutes, from
> `arrivedAt`", now means the ADMISSION's `arrivedAt`. The clock still runs from the arrival, and
> the entry now carries the admission in place of the referral. A person no longer holding a bed is
> excluded — that exclusion is the whole reason for the change. **The grouping half of this task,
> the ranking hazard it exists to close, and the D12/D15 contract extension are unchanged.** See
> Task 2's note above and `docs/ward-flow-phase-8-decisions.md` D8-9.

**Why this exists.** The phase's defining hazard is grouping quietly becoming ranking, and it will
not arrive as a decision — it will arrive as a small helpful sort inside a group, or a group promoted
to the top because it is the useful one. Putting both derivations in one pure module with three
pinned properties is what makes that a test failure rather than a review argument.

**Files:**

- Modify: `src/components/ward-management/ward-referrals.ts`
- Modify: `tests/ward-referral-matching.test.ts` (the D12 contract extension)
- Test: `tests/ward-travel-grouping.test.ts` (create)

**Both derivations go in `ward-referrals.ts`, deliberately.** That file is already an entry point of
the transitive import-graph contract test, so putting them there means the D12 rule — _no Phase 8
derivation reads a bed release, a release state, a band or a confidence_ — covers all four new
functions automatically. A new `ward-out-of-area.ts` outside that graph would leave the D12 claim
vacuous while looking tidier.

**Interfaces:**

```ts
export type TravelBandGroup = { band: TravelBand | "not_recorded"; candidates: ReferralCandidate[] };

/** Always exactly five groups, in TRAVEL_BANDS order followed by not_recorded. Every candidate in
 *  exactly one group; order within a group is the order the candidates arrived in. */
export function groupCandidatesByTravelBand(referral: Referral, candidates: ReferralCandidate[]): TravelBandGroup[];

export type OutOfAreaEntry = {
  referral: Referral;
  unit: Unit;
  band: TravelBand; // only an OUT_OF_AREA_BANDS member ever appears
  sinceArrival: number; // minutes, from `arrivedAt`
};

export function outOfAreaLedger(
  referrals: Referral[],
  units: Unit[],
  now: Instant,
): { entries: OutOfAreaEntry[]; notBanded: number };
```

**Three properties of the grouping, each of which is a test:**

1. **Nothing is lost.** The candidates across the five groups are the same set that went in, for a
   fixture where at least one unit has no recorded band.
2. **Nothing is reordered inside a group.** Two units in one band appear in the site table's order.
3. **Nothing is labelled best.** No group is called "recommended", "nearest" or "best".

**Distance groups the list and never gates it.** `ward-eligibility.ts` is not touched. There is no
`travel_time` gate, no band that excludes a bed, no band that makes a bed ineligible. A bed three
hours away that accepts this referral still says "Accepts this referral" and still carries its Accept
button.

**A caveat the signature cannot enforce, so a test must.** `groupCandidatesByTravelBand` takes a list
someone else computed; it will happily group a truncated one. Add a contract test that the match
view's grouped total equals the full unit count, not merely that grouping preserves its own input.

**The ledger:**

- Every accepted referral with an `arrivedAt` whose band from `homeRegion` to the **accepting unit's
  site** is a member of `OUT_OF_AREA_BANDS`. The clock runs from `arrivedAt`, per D8-3 — **never**
  from `decidedAt`.
- A referral whose band the fixture does not record is **not counted as out of area** and **not
  silently dropped**: it increments `notBanded`. An unknown band never becomes a figure, and a count
  that quietly excludes what it could not classify is a count that will be quoted as complete.
- An accepted referral with **no** arrival is in neither number, and is not reported as missing
  anything — it has not arrived as far as this prototype knows.
- An accepted referral whose `acceptedUnitId` resolves to no unit is skipped rather than banded
  against a guess.
- **`notBanded` and `entries.length` do not share a denominator.** They are two counts of two
  different things, and neither task nor screen may present them as parts of a whole.

**The D12 contract extension, and how to keep it honest.** `tests/ward-referral-matching.test.ts`
already walks the import graph from `ward-eligibility.ts` and `ward-referrals.ts`. Adding
`ward-distance.ts` and `ward-travel-bands.ts` to the graph is automatic — **but a coverage claim you
cannot see is not a coverage claim.** Add an explicit assertion that both file paths are **members of
the collected graph**, so a future refactor that moves a derivation out of the graph fails here
rather than silently narrowing the contract.

**Tests, each mutation-tested:**

| Test                                    | Mutation to watch go red                                     |
| --------------------------------------- | ------------------------------------------------------------ |
| Grouping loses nothing                  | Drop unbanded candidates from the result                     |
| Grouping reorders nothing inside a band | Add a sort inside a group                                    |
| Always five groups, empty ones included | Omit a group with no candidates                              |
| An unrecorded band is never counted     | Treat `undefined` as out of area in `outOfAreaLedger`        |
| The clock runs from `arrivedAt`         | Measure from `decidedAt`                                     |
| Distance is not a gate                  | Add a `travel_time` gate to `referralEligibility`            |
| The graph covers the two new modules    | Remove `ward-distance.ts` from `ward-referrals.ts`'s imports |

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run and watch fail**
- [ ] **Step 3: Implement both derivations in `ward-referrals.ts`**
- [ ] **Step 4: Mutation-test all seven; quote every failure line; restore**
- [ ] **Step 5: Run, watch pass, format, lint, typecheck, commit**

---

## Task 4: The match view — groups, bands, and a step that is never owed

**Why this exists.** This is the screen a coordinator is actually looking at when the decision is
taken, so it is where the grouping has to read correctly and where the invented-travel-times sentence
has to be visible without scrolling past it. It is also where the optional local-bed step is offered,
because that is where the coordinator already is.

**Files:**

- Modify: `src/components/ward-management/referrals/referral-match.tsx`
- Modify: `src/components/ward-management/referrals/referrals.module.css`
- Modify: `tests/ward-referral-screens.dom.test.tsx`

**What it renders:**

- Five group headings, in `TRAVEL_BANDS` order followed by not-recorded, each labelled from
  `TRAVEL_BAND_LABELS` / `NOT_RECORDED_LABEL`. **No comparative word on any of them.**
- Every unit still renders, in the site table's order within its group, with its existing
  accept-or-single-reason row unchanged, plus its band.
- **An empty group renders as a heading and a plain line**, never as an omitted section:
  `**Under an hour** — No unit in this band.` Omitting it hides the single most useful thing the
  grouping produces: "there is nothing within an hour" is the answer the coordinator came for, and a
  missing heading reads as a rendering fault.
- **When every candidate lands in the not-recorded group**, one sentence at the top of the list
  states it once rather than once per row:

  > **Travel time not recorded** — This prototype holds no travel time between this person's home
  > region and these sites. That is a gap in the invented data, not a statement that these beds are
  > far away.

  Derive that condition from the grouping's own output — every candidate in `not_recorded` — not from
  a second lookup into the fixture. Two sources for one fact is how a screen ends up giving two
  answers.

- **`SYNTHETIC_TRAVEL_TIMES_NOTICE`, once, on this screen**, imported from `ward-distance.ts`, never
  retyped. A band rendered anywhere without that sentence on the same screen is a defect.
- **An unrecorded band never renders as blank.** A blank cell in a distance column is read as
  "close".
- The existing structural-gap banner ("no _X_ unit exists in this network") still renders **before**
  any distance wording. A structural gap is not a distance problem and must never be dressed as one.

**The optional local-bed step — five rules, every one load-bearing:**

1. **Not a field on the intake form.** Nothing is added to `referral-intake.tsx`. A form field is the
   one shape guaranteed to read as owed.
2. **One control on this screen:** _Record that a local bed was sought and none was suitable_. It
   creates a record only when taken.
3. **Absence renders as nothing at all.** No "Not recorded", no empty checkbox, no grey placeholder,
   no warning icon, no amber row. A referral without the record looks exactly like a referral that
   never needed one, because it may be one.
4. **Offered on every referral, not only country ones.** Offering it only on country referrals would
   assert that looking locally first is a country thing — the unanswered question, answered by a
   screen layout.
5. **No figure anywhere counts what is missing.** No completeness percentage, no "12 of 40 referrals
   are missing this step", on this screen or any other.

After the record exists, the screen may state it plainly (that a local bed was sought and none was
suitable, and when). No free text, ever.

**Stable selectors:** `ward-referral-match-band-group-<band>`, `ward-referral-match-band-<unitId>`,
`ward-referral-match-local-bed-sought`, `ward-referral-match-synthetic-notice`.

**Tests, each mutation-tested:**

- All five headings render, including empty ones, on a referral whose bands leave a group empty.
  **Mutation:** hide empty groups; watch red.
- A unit with no recorded band renders under not-recorded with the words, not blank. **Mutation:**
  render an empty string for `undefined`; watch red.
- The synthetic notice renders exactly once. **Mutation:** delete it; watch red.
- A referral with no `localBedSought` renders **no** trace of the step's absence: assert the absence
  of every one of "Not recorded", a checkbox, and a warning role in that region. **Mutation:** add a
  "Not recorded" line; watch red. This is the test that stops the optional step drifting into an
  expectation, and it is the easiest one in the phase to write vacuously — make sure it fails.
- The control is present on a metro-region referral as well as a country-region one. **Mutation:**
  gate it on home region; watch red.
- Row order within a band is unchanged from the site table's order.

- [ ] Steps 1–5 as in Task 1

---

## Task 5: The out-of-area ledger screen

**Why this exists.** This is the "one with teeth" — how many people are currently in a bed a long way
from where they live, and for how long. It is also the figure most likely to be quoted in a room, so
the screen has to say what it is not, in full, on the screen itself.

**Files:**

- Create: `src/components/ward-management/out-of-area/out-of-area-board.tsx`
- Create: `src/components/ward-management/out-of-area/out-of-area.module.css`
- Create: `src/app/mockups/ward-flow/out-of-area/page.tsx`
- Modify: `src/components/ward-management/ward-nav.ts`
- Modify: `tests/ward-referral-screens.dom.test.tsx`
- Registration: `tests/ward-landmarks.test.ts`, `data/repo-awareness-snapshot.json`, and whatever
  `check-registration.sh` reports

**Its own route is a plan judgement.** The spec calls the ledger "a screen" and requires wording "on
the screen that uses it", but does not say where it lives. A board under
`/mockups/ward-flow/out-of-area`, in `WARD_NAV`'s `board` group beside Handover, Escalation,
Discharges, Morning and Referrals, matches every sibling of its kind. Report it as a judgement so the
owner can move it.

**What it must carry, all of it non-optional:**

- The entries: person's home region, the accepting unit, the band, and how long since arrival. **No
  countdown, no target, no deadline, no colour change at a threshold** — it is elapsed time and
  nothing else.
- **Both numbers together**, worded so neither reads as a share of the other:

  > _N_ people are recorded as being in a bed far from home. _M_ more could not be placed in a band
  > because this prototype holds no travel time for their home region.

- **`INVENTED_OUT_OF_AREA_THRESHOLD_NOTICE` in full** — not abbreviated, not behind a tooltip, not in
  a footnote below the fold. A threshold that looks official and is not is the kind of figure that
  gets quoted back at you in a meeting.
- **`SYNTHETIC_TRAVEL_TIMES_NOTICE`**, because bands are shown here.
- **The honest limitation, in the screen's own words:** this prototype has no record of anyone
  leaving a bed, so nobody ever leaves this ledger during a demo run. The figure is what the fixture
  and this session's own actions hold, not a live statewide count.
- The standing "not a medical device" prose banner, matching the six screens that already carry one.
- Empty state: when nothing is out of area, say so plainly — never an empty region.

**Tests, each mutation-tested:**

- Both sentences render in full. **Mutation:** truncate the threshold sentence to its first clause;
  watch red (assert on the whole string, or this test is decorative).
- The `notBanded` count renders even when it is the only non-zero number. **Mutation:** render it
  only when `entries.length > 0`; watch red.
- No element presents `entries.length` and `notBanded` as a fraction or percentage.
- The "nobody ever leaves this ledger" sentence renders. **Mutation:** delete it; watch red.

**Registration.** Run
`.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/check-registration.sh` and quote the
decisive line from each of the five gates plus the Playwright spec comparison. Regenerate the
snapshot with `npm run snapshot:repo-awareness` — never hand-edit it. Internal navigation uses
`<Link>`, never a raw `<a href="/…">`. **Do not hand-pick a subset of the gates**; the sixth
(`tests/ward-landmarks.test.ts`'s `RENDERABLE_ROUTES`) is the one that was missed in Phase 6 and left
a red test on the branch.

- [ ] Steps 1–5 as in Task 1, with the registration script run and quoted before the commit

---

## Task 6: Close the two proximity claims the system cannot back

**Why this exists.** Phase 8 is the phase that puts distance on the screen. A phase that adds honest
bands beside an existing dishonest superlative has made the screen _worse_, because the superlative
now looks as though it was checked too. Both fixes are compiler-driven and cheap; both are here
before anything else touches the diagram.

**Files:**

- Modify: `src/components/ward-management/ward-model.ts` (`REFERRAL_DECLINE_REASONS`)
- Modify: `src/components/ward-management/referrals/referral-match.tsx` (label map)
- Modify: `src/components/ward-management/ward-management-console.tsx` (label map)
- Modify: `src/components/ward-management/ward-movements.ts` (RF-004 and its comment)
- Modify: `src/components/ward-management/ward-management-network.tsx` (`originServiceFit`)
- Modify: `tests/ward-referral-model.test.ts`, `tests/ward-flow-reducer.test.ts`,
  `tests/ward-morning-rollup.test.ts`, `tests/ward-referral-screens.dom.test.tsx`,
  **`tests/ui-ward-management.spec.ts`**

**(a) `out_of_catchment` → `belongs_to_another_service`,** labelled **"Belongs to another service"**.

A bed can be declined for being "out of catchment" today while the system holds no catchment for
anybody. The reason is **not removed** — "this request belongs to another service" is a real
administrative answer a coordinator can give and can know; removing it would push coordinators onto a
reason that means something else. The defect is that the _label_ implies the system checked
something it did not. And it is **not backed by home region**: a catchment is a service's boundary,
a home region is where a person lives, and the two vocabularies do not even align (ten WA regions
against five health services). Mapping one onto the other would invent an administrative fact.

The rename is safe because the compiler does the work: both label maps are typed
`Record<ReferralDeclineReason, string>` and **fail to compile** until updated. The picker in
`referral-match.tsx` derives from `REFERRAL_DECLINE_REASONS` itself and costs nothing.

**Explicitly out of scope, stated so nobody assumes it was missed:** `DECLINE_REASONS` — the
movement-side list — has its own `out_of_catchment` member with the same problem. It is a different
list, on a different event, for a different decision, and Phase 7's D8 is explicit that the two lists
must not be collapsed. Renaming both in one change would put that collapse one careless edit away.
`tests/ward-model-phase3.test.ts` asserts `DECLINE_REASONS` still contains `out_of_catchment`; that
test must stay green and untouched, and its staying green _is_ the proof the two lists were not
collapsed.

**(b) "Best" → "Same health service", "Escalation" → "Different health service."**

`originServiceFit` in `ward-management-network.tsx` labels a candidate **"Best"** when its health
service matches the health service of the emergency department the patient presented to. The
function's own doc comment already explains at length that this is not catchment; the label does not.
On screen, "Best" reads as the system's opinion about which bed this person should have. Both new
labels state the fact the function actually computes. The tones may stay as they are — a colour is
not a claim in the way a word is.

**This breaks a Chromium assertion.** `tests/ui-ward-management.spec.ts` asserts
`getByRole("row", { name: /Same health service as origin/ })` contains **"Escalation"**. That
assertion goes red and must be updated to the new label. It is only reachable through Playwright, so
it will not appear in any Vitest run — update it in this task rather than discovering it in Task 10.
Consider whether the row header "Same health service as origin" should stay as it is now that the
cells answer it in the same words; the cell labels are settled, the header is not, and leaving it
alone is the safe default.

**Tests, each mutation-tested:**

- `REFERRAL_DECLINE_REASONS` contains `belongs_to_another_service` and not `out_of_catchment`, and
  still contains `referred_elsewhere` as a distinct member. **Mutation:** collapse the two into one;
  watch red.
- The reducer's decline guard remains a **membership check**, not a truthiness test. **Mutation:**
  replace it with `!event.reason`; watch red.
- `DECLINE_REASONS` is unchanged (the existing Phase 3 test, run and quoted).
- `originServiceFit` returns neither "Best" nor any word from
  `/best|nearest|closest|optimal|recommended/i`. **Mutation:** restore "Best"; watch red.

- [ ] Steps 1–5 as in Task 1, and run `tests/ui-ward-management.spec.ts` (or defer it to Task 10 and
      say so explicitly in your report — do not report it as passing unrun)

---

## Task 7: The network diagram becomes referral-driven (D11, step 2)

**Why this exists.** D8-5 makes the diagram a placement tool first: pick a patient, see which sites
can take them, and why the rest cannot. It is also the answer to "why not here?" across the state, so
one picture does two jobs. It is 585 lines, movement-driven, and carries the phase's only exposure to
the unvalidated four-stage bed model — which is why the spec splits it into four tasks and why
attempting it as one is on the risk list.

**Files:**

- Modify: `src/components/ward-management/ward-management-network.tsx`
- Modify: `src/components/ward-management/ward-management-network.module.css`
- Test: `tests/ward-referral-screens.dom.test.tsx` or a focused new DOM test

**What it builds.** Referral selection **alongside** the existing movement selection. When a referral
is selected, the overlay is driven by `referralCandidates` and `referralEligibility` for that
referral and shows **every unit** with the single reason for each that cannot take it — not a
shortlist of three.

**What it must not do:**

- **Do not add a new read of release state.** The placement overlay is driven by
  `referralEligibility`, which does not look. An implementer reaching for `capacityBreakdown` or
  `unitCapacity` in new placement code has left D12 and should stop. The existing Confirmed/Predicted
  chips stay exactly as they are — that exposure already exists, and this task must not widen it.
- **Do not widen the movement path's shortlist.** The movement shortlist stays three of many via
  `eligibleCandidatesAmong`. Three-of-many is a deliberate shortlist, not a truncation bug, and
  widening it is a different decision on a different screen.
- **Do not build a second "why not here?" screen.** The match view already answers it for referrals;
  this is the same question drawn differently, from the same functions.

**Tests, mutation-tested:** with a referral selected, the number of unit nodes carrying a verdict
equals the full unit count, not three. **Mutation:** truncate to three; watch red. And: no new import
of the release model appears in this component beyond what is already there — assert the file's
import statements against the same identifier set the D12 contract test uses.

- [ ] Steps 1–5 as in Task 1

---

## Task 8: The band arrangement on the diagram (D11, step 3)

**Why this exists.** Roadmap 14 promised a "roughly geographic layout". That needs knowing roughly
where these hospitals are, which nobody has checked, and **a picture is read as a map whatever its
caption says** — so a layout positioning real hospital names on something shaped like Western
Australia would assert far more than a band does. The substitute arranges by band relative to the
selected referral's home region: a picture of the fixture's invented bands, never called a map.

**This is less than the roadmap promised, and the reason is the missing fact, not a design
preference.** When real bands are checked, the same layout becomes as geographic as the checked data
allows with no structural change. State that on the screen and in your report.

**Files:** `ward-management-network.tsx`, its module CSS, its DOM test.

**What it builds.** Groups arranged under-an-hour nearest the selected patient, then one to three
hours, then three or more, then air transport only, then not recorded — **reusing
`groupCandidatesByTravelBand` from Task 3**, never a second grouping. Labels from
`TRAVEL_BAND_LABELS`. `SYNTHETIC_TRAVEL_TIMES_NOTICE` on the screen, once.

**The spec does not say what the layout does while a _movement_ is selected, and this plan fills the
gap:** a movement carries no home region, so **no band arrangement is drawn at all in movement mode**
— the existing service-column layout stands. Any arrangement without a home region behind it would be
a proximity claim with no fact, which is the thing this phase exists to stop. Report this as a plan
judgement; the owner may prefer something else.

**Tests, mutation-tested:** the arrangement is present with a referral selected and absent with a
movement selected. **Mutation:** arrange by band in movement mode using the origin site; watch red —
and note in the test's own comment that this is the "Nearest candidates" mistake in a new coat.
Second test: the diagram's grouping comes from `groupCandidatesByTravelBand` and matches the match
view's grouping for the same referral. **Mutation:** sort the diagram's groups differently; watch red.

- [ ] Steps 1–5 as in Task 1

---

## Task 9: The whole-network overview becomes the secondary mode (D11, step 4)

**Why this exists.** Once placement is the primary job, the overview is what is left over, and
leaving both competing for the same picture is how a screen ends up doing neither well. Roadmap 14's
other four commitments — country sites present (already met), clickable navigation, line weight by
flow, and a time control — all survive here; they are kept and subordinate.

**Files:** `ward-management-network.tsx`, its module CSS, its DOM test, and `tests/ui-ward-management.spec.ts`
if a selector moves.

**What it must not do:**

- **The time control must not become a second clock.** It drives the same `now` every other Ward Flow
  screen uses.
- Line weight decorates the picture; it does not arrange it.
- Clickable navigation is unchanged.

**Tests, mutation-tested:** the overview is still reachable and still renders every unit.
**Mutation:** drop the units with no route drawn to them; watch red — a unit disappearing from the
overview because nothing routed to it is exactly the kind of quiet omission that reads as "no such
bed".

- [ ] Steps 1–5 as in Task 1

---

## Task 10: The verification pass — look at every screen

**This is the task that has historically found the real defects.** Phase 4, Phase 5 and Phase 7 each
shipped defects invisible to more than ten thousand passing tests, caught only by looking at the
screen. On this branch, green tests once missed a wrong value on every screen at once. **Do not treat
this task as a formality, and do not report the phase done without it.**

- [ ] `npm run ensure`; use the URL it prints; confirm project identity at `/api/local-project-id`.
      **Never assume `localhost:3000`.**
- [ ] Run `.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/check-ward-suite.sh` — it
      discovers every ward test file from disk. Quote the `Tests N passed` line and the exit code.
      **Do not name suites by hand;** that has shipped a red test twice on this branch.
- [ ] Run `check-registration.sh` and quote all six results plus the Playwright spec comparison.
- [ ] Capture and **look at** the match view, the out-of-area ledger and the network diagram at
      **390, 820 and 1440**, using
      `.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/capture.mjs`. **390 first** — five
      group headings plus one row for every unit in the network is a phone-layout problem, and
      empty-group lines are exactly the kind of thing that reads correctly in a test and looks broken
      on a 390 px screen.
      Report body overflow, `h1` count, duplicate test ids and console errors for each.
- [ ] **Read every band on one screen at once** and confirm no two places describe the same pair with
      different words, and that no heading, badge or tooltip anywhere contains a comparative
      proximity word.
- [ ] **Confirm by eye** that the invented-travel-times sentence is visible on every screen that
      shows a band, and that the invented-threshold sentence is visible in full on the ledger without
      scrolling on a phone.
- [ ] **Confirm by eye** that a referral with no `localBedSought` shows nothing at all about the step
      — no placeholder, no icon, no grey row.
- [ ] **One Chromium journey**, added to the existing `tests/ui-ward-referrals.spec.ts` rather than a
      new spec file — a new `ui-ward-*.spec.ts` must be added to **both** hand-maintained regexes in
      `playwright.config.ts` **and** the regex in `scripts/ci-change-scope.mjs`, and a spec absent
      from them silently never runs. The journey: open a referral, see the five groups with the
      synthetic sentence, accept at a far unit, record its arrival, and see it on the out-of-area
      ledger with the invented-threshold sentence. **Prove it can fail before trusting it:** mutate
      the page, run, quote the red line, restore, quote green.
- [ ] Also run `tests/ui-ward-management.spec.ts` — Task 6 changed an assertion in it that no Vitest
      run can reach.
- [ ] Read the exit status **and** the "N passed" line. `75` with a
      `DATABASE_HEAVY_RUN_ADMISSION_BUSY` marker means blocked, retry later; any other non-zero is
      red; exit 0 with no result line means nothing ran.
- [ ] **Report honestly per item: proven by test, proven by screenshot, or not proven.**

**Not run, and why:** `verify:release`, every `eval:*` script, `check:supabase-project` and
`test:live` are provider-backed and forbidden by the standing constraints.

---

## Dependency order and what is genuinely parallel

**The chain:** Task 1 → Task 2 → Task 3 → { Task 4, Task 5 } → Task 10.
Task 6 is independent of all of them and can be done at any point, but must land **before** Tasks 7–9
touch the diagram, so the "Best" label is gone before anyone looks at that screen again. Tasks 7 → 8
→ 9 are strictly serial (each edits the same 585-line component), and Task 8 additionally needs Task
3's grouping function. Task 10 is last and needs everything.

**Genuinely parallel work:** Tasks 4 and 5 are independent of each other in _content_ — different
components, different tests — and Task 6 is independent of both.

**But only one implementer at a time can commit here.** The pre-commit hook inspects the **whole
working tree**, not the staged set, so two agents sharing this worktree cannot commit independently
even when their edited files are disjoint: the first to finish is blocked by the second's
in-progress work. That is expected — retry on a slow cadence, never bypass it, and never touch or
revert another agent's files. A read-only reviewer may run concurrently because it never commits.

**Dispatch one implementer at a time.** The expensive checks — the full unit suite, lint, format,
build, browser and screenshots — run **once at the end**, because the heavyweight lock is
machine-wide and other sessions queue behind it.

---

## Blocked on an owner answer

**No task in this plan is hard-blocked, and saying otherwise would be padding.** The specification was
deliberately built _around_ the six facts nobody has rather than across them: air transport is a band
and nothing more, the local-first step is optional, the threshold is labelled invented, the bed stages
are never asked about, and the band values are synthetic by settled decision D8-7. That is the whole
reason the phase can proceed.

Four things nevertheless depend on the owner, and three of them change what gets built:

| #   | Question for the owner                                                                                                                                                                                                                                       | What it affects                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Which record should the out-of-area clock hang on** — the accepted referral (this plan's Task 2), or `Movement` widened with a home region? Widening `Movement` is a governance decision of the same class as D8-1 and is not the specification's to take. | **Tasks 2, 3 and 5.** If the owner chooses `Movement`, the field, the event and the ledger's data source are rebuilt. The ledger's counts and wording are unchanged either way. |
| 2   | **Does he want to supply checked travel-time bands**, or authorise invented ones under Task 1's authoring rule?                                                                                                                                              | **Task 1 Step 3.** Recommended: get a one-line confirmation before authoring the fixture. This is the phase's highest-risk step and the confirmation is nearly free.            |
| 3   | **Is the coarse home-region grouping he described in P8-1** ("North Metro, East Metro, South Metro, or country") the one he wants, or are the ten WA regions now built the right shape?                                                                      | **Task 1's fixture shape.** Changing it is cheaper _before_ the band fixture is authored against ten regions than after.                                                        |
| 4   | **Should there be a record of someone leaving an out-of-area bed?**                                                                                                                                                                                          | **Nothing in this plan** — Task 5 states the limitation on screen instead. "Left the bed" and "was discharged" are different facts and only he knows which is wanted.           |

Two smaller judgements this plan took, flagged so he can overturn them cheaply: the ledger's route
(`/mockups/ward-flow/out-of-area`, Task 5) and `RECORD_LOCAL_BED_SOUGHT`'s role (`coordinator` only,
Task 2).

---

## Where the specification cannot be implemented as written

Recorded rather than smoothed over. None of these reopens a settled decision.

**1. The band fixture cannot exercise the required paths without recording a band for a real region
and a real hospital.** The verification section requires at least one accepted, arrived referral
whose band puts it out of area. Satisfying that means recording a far band for a specific
(real WA region, real named hospital) pair — which is, at some level, a printed statement about that
pair, sitting beside a name nobody has checked. D8-7 settles that the synthetic label is the answer,
and Task 1's authoring rule (choose pairs for coverage, never consult a map, say so in the file) is
the strongest additional mitigation available. **It is a mitigation, not a proof, and this plan does
not claim otherwise.** The cheapest real fix is the owner supplying checked bands; the second
cheapest is his explicit sign-off on invented ones.

**2. The band arrangement has no defined behaviour while a movement is selected.**
`WardNetworkWorkspace` is movement-driven; D11 adds referral selection _alongside_ movement selection
and defines the arrangement only relative to a referral's `homeRegion`. A `Movement` has none. This
plan fills the gap by drawing no band arrangement in movement mode (Task 8) and flags it as a
judgement.

**3. The ledger's location is unspecified.** The spec calls it "a screen" and mandates wording "on
the screen that uses it", but never says where it lives. Task 5 gives it its own board route and
says so.

**4. `RECORD_LOCAL_BED_SOUGHT`'s role is unspecified.** "Role-gated like every other referral event"
does not name the role. Task 2 chooses `coordinator` and flags it.

**5. The D8 rename breaks a Chromium assertion no Vitest run can reach.**
`tests/ui-ward-management.spec.ts` asserts the string "Escalation" in the shortlist's health-service
row. Task 6 renames that label, so the assertion must move with it. Not a specification defect —
just a consequence the spec does not mention and that a session could easily discover only at the
very end.

**6. `groupCandidatesByTravelBand`'s signature cannot guarantee completeness.** It takes a candidate
list someone else computed and will happily group a truncated one; "nothing is lost" is a property
relative to its own input, not a guarantee that every unit reached it. Task 3 adds a separate
contract test at the call site. Worth knowing, because the spec's property 1 reads stronger than the
function can actually be.

**7. A pre-existing comment in `ward-movements.ts` violates this phase's own rule.** It describes a
seeded referral as being "hundreds of kilometres from home" and calls its shape "a real shape for
WA's rural mental health system" — two unchecked real-world claims in a code comment, which is
exactly how a deleted legal figure entered this codebase. The spec flags it rather than fixing it,
because it is not that phase's file to change. **Tasks 2 and 6 both edit `ward-movements.ts`**, so
the file _is_ being touched: raise it with the controller then rather than silently rewording a
comment nobody asked you to touch.

---

## Self-review

Before reporting DONE, each implementer confirms in its report:

- Every new test was mutation-tested, with the quoted failure line, and every mutation was restored
  byte-identically.
- **No travel-time value was taken from a map, a search, or a recollection of Western Australia**,
  and the fixture's own doc comment says the pairs were chosen for coverage rather than geography.
- No kilometre figure appears in code, copy, comment, test or fixture.
- No Mental Health Act figure appears anywhere.
- No new fact about a person; no free text anywhere.
- Nothing sorts, ranks, truncates or hides a candidate; no group or label carries a comparative
  proximity word.
- No new derivation read a `BedRelease`, a release state, a band or a confidence, and the import-graph
  contract test names the two new modules as members of the graph it walked.
- Every band label and mandated sentence came from the single export in `ward-distance.ts`.
- Every `<button>` has a handler, a submit or navigation; no raw CSS literals; tap targets `min-h-12`.
- Every command ran from `/d/Worktrees/Database/pr-2390-fix`, through the proper wrappers, with both
  the exit status and the decisive output line read and quoted.

---

## CONTROLLER ADDENDUM, 2026-08-28 — the owner answered your finding 1

Your plan named the phase's most likely governance error and described it exactly right: a synthetic
label is a mitigation, not a proof, and an implementer who checks the real distances would be turning
a placeholder into an unverified real-world claim **while feeling diligent about it**. That went to
the product owner as a one-line question. His answer:

> **"Invent simple placeholders for now easy to change later."**

Recorded as **D8-8 (OWNER)** in `docs/ward-flow-phase-8-decisions.md`. It answers what D8-7 left
open. Task 1 proceeds — it is not blocked and never was.

**The binding half is "easy to change later", and it is not automatic.** Task 1 must satisfy all
four of these, and Task 10's verification pass must confirm them:

1. **One table, one file, nothing derived.** Every band lives in a single fixture table keyed by home
   region and site. No band is computed, cached, inlined into a component, duplicated into a test
   fixture, or written into a doc comment. Replacing that file's values must be the entire change.
2. **No test asserts a specific band for a specific place.** Tests assert the mechanism — grouping
   preserves every unit, an unknown band degrades conservatively, the ledger counts what it says.
   A test pinning "Broome is three hours or more" would make the owner's future correction a test
   failure, which is exactly how a placeholder hardens into a fact nobody dares touch.
3. **Values chosen to exercise the code, never to resemble geography.** Your own rule, adopted
   verbatim: pick pairs that produce all four bands, the sparse-region case and the whole-region gap;
   **do not open a map**; say so in the fixture's own doc comment.
4. **The screen keeps saying the bands are invented** — visible to a reader, not only in a comment.

Your other six findings are ruled on as follows:

- **Finding 2 (no band arrangement while a movement is selected): accepted, and it is the right
  call.** Any arrangement without a home region is the "Nearest candidates" mistake in a new coat,
  which is the same reasoning D8-2 already rests on. Keep it, and keep your note that it was your
  judgement rather than the spec's.
- **Findings 3 and 4 (the ledger's route, and `RECORD_LOCAL_BED_SOUGHT`'s role): accepted as
  chosen and flagged.**
- **Finding 5 (the "Best" rename breaks a Chromium assertion no Vitest run reaches): good catch, and
  exactly the class that shipped a red test on this branch twice.** Keep it pulled into Task 6.
- **Finding 6 (`groupCandidatesByTravelBand` cannot guarantee completeness from its signature):
  accepted; keep the separate call-site contract test.**
- **Finding 7 is a stale read, not a finding.** Fix round C's F8 already removed the "hundreds of
  kilometres from home" comment from `ward-movements.ts`. Verified at HEAD: the replacement states
  field values only — `homeRegion` "Kimberley", `originSiteCode` "BRM", accepted unit at service
  "South Metro" — and says explicitly that no distance is stated or implied. Nothing to do.
- **The unit count:** 17 sites, 23 units. You were right to avoid repeating the spec's figure. The
  stale `22` in a Playwright assertion was fixed at `15158573c`.

---

## Carried into Task 10 from Phase 7 — two things nobody has looked at

Both were flagged honestly by the tasks that built them rather than discovered later, and both are
the class of defect that has reached a rendered screen in every phase of this project so far while
every test stayed green. **Task 10 must cover them; they are not optional additions.**

1. **The "beds being made ready" section has never been seen at any breakpoint.** It was proven by
   jsdom and typecheck only. Render it at 390, 820 and 1440 and look at it. Confirm in particular
   that a bed carrying a preparation note is still visibly **offered** and still counted — the note
   is informational and must never read as though the bed were unavailable, which is the owner's own
   clinical ruling (the pull of the next patient takes hours anyway).

2. **The print ink on the new bed-model and list copy has never been measured.** The page _count_
   was measured and is one A4 page; the ink was not. Measure **every painted leaf of text** in both
   colour schemes — that is the method that found four defects where reading the selector list found
   one, and the referral screens needed a whole print block added for exactly this reason.

## Also carried: three wording observations, and only one is actionable

Shipped verbatim, correctly, because the wording rule forbids an agent tidying a clinical list.
Recorded here so they are not silently "fixed" by someone who does not know the rule:

- **"Awaiting accommodation" appears in both List 1 and List 2. Leave it.** In List 1 the discharge
  is decided and there is nowhere to go; in List 2 the decision cannot be made until accommodation is
  sorted. Different situations, and the column disambiguates. A second phrase for the same
  real-world thing would be worse than the overlap.
- **List 1's "Awaiting receiving-service acceptance" and List 2's "Awaiting a community team to
  accept" may or may not be the same thing.** Put to the owner 2026-08-29; **awaiting his answer.**
  The session's view is that they differ — a receiving service is another inpatient unit taking the
  patient over, a community team accepting them is follow-up after discharge — in which case both
  belong and only List 2's phrasing needs tightening for register. **Do not resolve this by
  guessing.**
- **List 1 mixes registers internally** ("Awaiting clean" beside "Awaiting family or carer
  arrangement"). **Leave it.** Each entry is clear on its own; padding the short ones for symmetry
  makes them worse to read, and tidiness is not a reason to touch clinical wording.
