# Ward Flow Phase 8 — Distance and the state

**Status:** design, written 2026-08-28. Implementation plan follows separately.

**One sentence:** the network gets a sense of how far each bed is from the person's home — as a
band, never a number, and never a ranking — so a coordinator can see how many options are close,
how many are not, and how many people are currently in a bed a long way from where they live.

**Inputs, not outputs.** The seven decisions D8-1 to D8-7 in `docs/ward-flow-phase-8-decisions.md`
are settled and are used verbatim. Roadmap decisions 4, 5, 8, 9, 10, 11, 12, 13, 14 and 16 are
settled and are not reopened. Phase 7's settled rules — matching shows candidates, a human decides;
matching never asks what stage a bed is in — bind this phase too. Nothing below re-argues any of
them; this document only works out what they imply.

**Where this document could not follow the settled decisions exactly, it says so out loud** in
"Where the settled decisions did not reach", near the end. Three of them could not be specified as
written, and smoothing that over would have produced a tidier document and a worse one.

---

## Read this first: the rule the whole phase is built to

> **Any word implying proximity — nearest, closest, local, far, best — must be backed by a fact the
> system actually holds, and the thing on screen is the band, not the number. A kilometre figure may
> sit beside a band; it may never order a list or label a bed.**

This is not a precaution against a hypothetical mistake. It has already happened here. A
whole-branch review found a screen headed "Nearest candidates" offering a patient sitting in Sir
Charles Gairdner's own emergency department a Royal Perth bed first and their own hospital's bed
second. The list was in no order at all — it was the order the hospitals happen to appear in the
table — and nothing in the system knew where anything was. The heading is gone; the pressure that
produced it is not, and Phase 8 is the phase that invites it back.

Two traces of the same pressure are still on screen today, and both are Phase 8's to close: a bed
can be declined for being "out of catchment" while the system holds no catchment for anybody (D10
below), and a candidate bed on the movement shortlist carries a label reading **"Best"** that is
really about which health service the patient's emergency department belongs to (D8 below).

---

## Read this second: the facts nobody has

Six real-world, clinical or legal facts are unknown to everyone who has worked on this. They are
listed in `docs/ward-flow-phase-8-9-questions.md` section 3. **This specification answers none of
them, and must not answer any of them by implication.** Each one below says what it blocks and what
Phase 8 builds instead.

| Unknown fact                                                             | What it blocks                         | What Phase 8 does instead                                                                                        |
| ------------------------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| How psychiatric patients actually move around WA by air                  | Any air pathway, any air transport job | D8-4: air is a travel-time band and nothing more                                                                 |
| Whether a country service looks for a local bed first                    | A required local-first step            | D9: the step is offered on every referral and required on none                                                   |
| Whether named escalation levels are in real use                          | Phase 9's escalation board             | Nothing — that is Phase 9's problem, not Phase 8's                                                               |
| Whether "out of area" is already a defined term with a defined threshold | Owning the threshold                   | D6: the screen states in plain words that the prototype invented its own                                         |
| The four-stage bed model (`predicted → confirmed → blocked → released`)  | Nothing in this phase, by design       | D12: Phase 8 asks only whether a bed is free now, with one named exception                                       |
| **Which travel-time band each country hospital falls into**              | Every band value in the whole phase    | D2: bands are synthetic fixture data, labelled synthetic on screen, and **this document supplies no band value** |

**The last one is load-bearing and deserves its own paragraph.** The site table uses **real hospital
names** — Royal Perth, Sir Charles Gairdner, Fiona Stanley, Broome, Kununurra. Anything this
prototype prints beside one of those names reads as a claim about that hospital. A travel time would
be the first figure in this system claiming to describe the real world, and nobody has checked one.
So no band value appears in this specification, in any example in it, or in any comment in it: the
mechanism is specified and the values are left to a fixture that says on every screen that it
invented them. An implementer reading this document will find nothing here telling them how far
anywhere is from anywhere.

---

## What already exists — extend it, do not build beside it

Phase 5's binding lesson was that a parallel concept is worse than an awkward extension. Nearly
everything Phase 8 needs already exists.

| Already built                                                                          | Where                         | How Phase 8 uses it                                                                 |
| -------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| `Referral.homeRegion`, membership-checked against `HOME_REGIONS` (ten WA regions)      | `ward-model.ts`               | **The "from" end of every measurement in this phase.** Built in Phase 7 fix round B |
| `referralCandidates(referral, units, now)` — every unit, never truncated, never sorted | `ward-referrals.ts`           | Wrapped by the grouping (D3). Never replaced, never re-implemented                  |
| `referralEligibility(referral, unit, now)` and its gate list                           | `ward-eligibility.ts`         | Untouched. Distance is **not** a gate — see D3                                      |
| `matchReason(candidate)` — the single human reason a unit cannot take this referral    | `ward-referrals.ts`           | Untouched. It is already the "why not here?" answer                                 |
| `networkHasCohort(referral, units)` — the structural-gap check                         | `ward-referrals.ts`           | The precedent the failure wording follows                                           |
| Five country sites, already in the table with service `WACHS`                          | `ward-sites.ts`               | Roadmap 14's "country sites on it at all" is **already met**; nothing to add        |
| `REFERRAL_DECLINE_REASONS`, a fixed list, membership-checked in the reducer            | `ward-model.ts`               | One member renamed (D10)                                                            |
| `WardNetworkWorkspace` and its left/right `columnServices` layout                      | `ward-management-network.tsx` | Reworked into the placement tool (D11)                                              |
| `ReferralMatchView`, one row per unit in the site table's order                        | `referral-match.tsx`          | Gains group headings and a band on each row. Row order inside a group does not move |

**`referralCandidates` is the important one.** It already returns every unit in the network,
including all five country units, each with the single reason it cannot take this referral. That is
already the whole-state "why not here?" artefact roadmap additional item 2 asks for. Phase 8 does
not build it; Phase 8 groups it (D7).

---

## Scope

**In:**

1. A travel-time band between a person's home region and a hospital site, as synthetic fixture data.
2. Grouping the match view's candidate list by that band.
3. The out-of-area ledger: who is currently in a far bed, and for how long.
4. The country pathway's optional recorded step.
5. The network diagram reworked into a placement tool.
6. Closing the two proximity claims the system cannot back: the `out_of_catchment` decline reason
   and the "Best" label.

**Out, and deliberately so:** kilometre figures of any kind (D13); anything about air transport
beyond the band (D8-4); a required local-first step (D9); a distance gate that could exclude a bed
from the candidate list (D3); ranking or sorting by travel time (D8-2); any change to the four
referral-matching dimensions; any new fact about a person; escalation tiers, ownership clocks,
waiting-time equity, notifications, the retrospective view and the navigation regrouping (all Phase
9); the statutory clock board (roadmap 16); and the referral-to-movement bridge Phase 7 deliberately
left unbuilt (Phase 7 D14) — except that D5 names the one small piece of it the ledger cannot do
without, and says what it costs.

---

## Decisions

### D1 — A travel-time band is a fact about a **pair**, and one named function owns it

A band is not a property of a hospital and it is not a property of a ward. "Three hours away" is
meaningless until you say three hours from where. The measurement Phase 8 needs runs from a
referral's `homeRegion` to the **site** a candidate unit belongs to.

So the band lives in neither `Site` nor `Unit`. It is a lookup on a pair, in a new module
`src/components/ward-management/ward-distance.ts`, with exactly one entry point:

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
```

**Why a named function in a module rather than a value computed on a row.** No screen in this
project computes a figure of its own; every number a screen shows comes from a derivation with a
name, and that is what lets a test pin it and a reader find it. A band computed inline in a
component is a band that can disagree with itself between two screens, which is the exact defect
class Phase 5 shipped and caught by screenshot.

**Why keyed on the site, not the unit.** Every unit at Bentley Health Service is the same distance
from anywhere as every other unit at Bentley Health Service. Putting the band on `Unit` would let
two wards in one building disagree about where their own building is.

**Why the band is never taken from `Referral.originSiteCode`.** `originSiteCode` is the hospital the
referral came from, not where the person lives. Measuring from it would be the "Nearest candidates"
mistake in a new coat: it would call a city bed close for someone driven into a city emergency
department from a long way away. `homeRegion` exists to make that impossible, and this decision is
what spends it.

**`TRAVEL_BANDS` carries a runtime array, not only a union type**, matching `COHORTS`, `SEXES`,
`SEX_DESIGNATIONS`, `REFERRAL_SOURCES` and every other list of this shape in `ward-model.ts`. Every
picker, group heading and label map derives from that array, never from a hand-written copy — the
same fix review finding I3 already forced twice during Phase 7.

**Cost to reverse:** one module and its callers. Nothing is stored, so nothing has to be migrated.

### D2 — Band values are synthetic fixture data, this document supplies none, and the screen says so

This implements D8-7, and it is the decision the rest of the phase stands on.

The values live in `src/components/ward-management/ward-travel-bands.ts` — beside the site table in
spirit, separate from it in fact, so the geography fixture has one reason to change and the bed
fixture has another:

```ts
/** SYNTHETIC. Every band below is invented, exactly like every bed number in `ward-sites.ts`.
 *  Nobody has measured or checked the real travel time between any WA region and any hospital in
 *  this table. Not every pair is recorded, and an unrecorded pair is `undefined` — never a
 *  default, never the nearest band, never "unknown means far". */
export const SYNTHETIC_TRAVEL_BANDS: Readonly<Record<string /* site code */, Partial<Record<HomeRegion, TravelBand>>>>;
```

**The table may be incomplete, and that is deliberate.** Ten home regions across seventeen sites is
one hundred and seventy pairs. Requiring all of them would push whoever seeds it toward filling gaps
from a map, which is the one thing the unanswered question forbids. A missing pair is a first-class
answer — see D3's not-recorded group and the failure-behaviour section — so the fixture can be as
sparse as its author is confident, and sparseness costs honesty nothing.

**The exact on-screen wording, which must ship and is not optional.** Wherever a band is shown — the
match view, the ledger, the placement diagram — this sentence appears once on that screen, in the
same register as the prototype's standing synthetic banner:

> **Travel times on this screen are invented, like every bed number in this prototype. Nobody has
> measured or checked how far any of these hospitals is from anywhere, and no distance shown here
> should be relied on.**

**Why this is honest and estimating would not be.** The prototype already says everywhere that its
numbers are invented, and a band arriving the same way as the bed counts inherits that statement. A
band presented as geography would not: it would be the first figure in this system claiming to
describe the real world, printed beside a real hospital's real name, with nothing behind it.

**Two things must never happen**, and both belong in a review checklist rather than only here: a
kilometre figure derived from a band (D13), and a band rendered anywhere without that sentence on
the same screen.

**Cost to reverse:** when the real bands are checked, the fixture values are replaced and the
sentence is rewritten. Nothing else moves — the grouping and the ledger group and count; they do not
measure.

### D3 — Grouping wraps `referralCandidates`; it never replaces it, and distance is never a gate

`referralCandidates` returns every unit in the network, in the site table's fixed order, never
truncated, never sorted, never ranked. Phase 7's D10 is explicit about why, and Phase 8 does not
weaken it by a single row.

The grouping is a **pure rearrangement of that same list**, in a new function beside it in
`ward-referrals.ts`:

```ts
export type TravelBandGroup = {
  band: TravelBand | "not_recorded";
  candidates: ReferralCandidate[];
};

/** Always returns exactly five groups, in `TRAVEL_BANDS` order followed by `not_recorded`.
 *  Every candidate appears in exactly one group, and the order within a group is the order the
 *  candidates arrived in. */
export function groupCandidatesByTravelBand(referral: Referral, candidates: ReferralCandidate[]): TravelBandGroup[];
```

Three properties, each of which is a test:

1. **Nothing is lost.** The number of candidates across the five groups equals the number that went
   in. A unit whose band is missing is not dropped; it is in the not-recorded group.
2. **Nothing is reordered inside a group.** Within a band, the site table's order, exactly as today.
3. **Nothing is labelled best.** No group is called "recommended", "nearest" or "best". Groups are
   named for what they are and nothing more.

**Distance groups the list and never gates it.** `referralEligibility` is not touched. There is no
`travel_time` gate, no band that excludes a bed, and no band that makes a bed ineligible. A bed three
hours away that accepts this referral still says "Accepts this referral" and still carries its Accept
button. Distance shapes how the list is read; it never shapes who is in it.

**An empty group renders as a heading and a plain line**, never as an omitted section:

> **Under an hour** — No unit in this band.

Omitting the group would hide the single most useful thing the grouping produces. "There is nothing
within an hour" is the answer a coordinator came for; a missing heading reads as a rendering fault.

**When the referral's home region is one the fixture does not cover at all**, every unit lands in the
not-recorded group, the four band headings each show their empty line, and one sentence at the top of
the list states it once rather than seventeen times:

> **Travel time not recorded** — This prototype holds no travel time between this person's home
> region and these sites. That is a gap in the invented data, not a statement that these beds are
> far away.

**Cost to reverse:** one function and one wrapper element in one component. The underlying list is
unchanged, which is the whole point of wrapping rather than replacing.

### D4 — Band order is a presentation order, and "air transport only" is a mode, not a longer time

The four bands render in roadmap decision 11's own listed order: under an hour, one to three hours,
three hours or more, air transport only. That order is the owner's and is not re-derived here.

**But nothing in this phase may describe air transport as "furthest".** Air transport only is a
statement about how you get there, not about how long it takes; a flight can be shorter than a drive.
The group is headed **"Air transport only"** and carries no comparative word — not "furthest", not
"most remote", not "hardest to reach". This prototype knows nothing about how psychiatric patients
actually move around Western Australia by air, and a comparative adjective is the quiet way of
claiming it does.

**Cost to reverse:** wording.

### D5 — The out-of-area ledger, and the record its clock hangs on

D8-3 settles what out of area means and when the clock starts. It does not settle which record the
clock hangs on, and **that record does not currently exist.** This decision closes the gap rather
than stepping over it.

**The gap, stated plainly.** The only record carrying `homeRegion` is `Referral`, and a referral
never arrives anywhere — Phase 7's D14 deliberately does not turn an accepted referral into a
movement. The only record that arrives is `Movement`, and `Movement` carries no home region. So as
the code stands, "how long has this person been in a bed far from home" is not answerable by
anything.

**Three ways to close it, and the one this specification takes:**

| Way                                                                | What it costs                                                                                                                                                                                 |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add `homeRegion` to `Movement`                                     | **A governance decision, not an implementation one** — it widens the permitted facts about a person onto a second record. Only the product owner may take it, exactly as he took P8-1         |
| Build Phase 7's referral-to-movement bridge                        | Real modelling work, entangled with where a person physically is and what legal status a community referral starts with. Phase 7 held it back on purpose and Phase 8 should not smuggle it in |
| **Record arrival against the accepted referral itself** ← this one | One optional field, one event, one role gate                                                                                                                                                  |

```ts
// on Referral, beside `decidedAt` — a fact about the referral, never about the person
arrivedAt?: Instant;
```

plus a `REFERRAL_ARRIVED` event, gated to the roles that would know (`coordinator` and `ward`), with
the membership and refusal discipline every other referral event already has.

**Why this one.** It carries no new fact about a person — an arrival time is operational, in the same
family as `raisedAt` and `decidedAt` — so the permitted-facts list is untouched and the structural
privacy test does not widen. It honours D8-3's clock exactly as written rather than substituting
acceptance time and hoping nobody notices the difference. And it uses a seam Phase 7 left open rather
than a bridge Phase 7 deliberately closed: recording that a person arrived is not the same as
constructing the movement they arrived into.

**What the ledger counts:**

```ts
export type OutOfAreaEntry = {
  referral: Referral;
  unit: Unit;
  band: TravelBand; // only "three_hours_or_more" or "air_transport_only" ever appear
  sinceArrival: number; // minutes, from `arrivedAt`
};

export function outOfAreaLedger(
  referrals: Referral[],
  units: Unit[],
  now: Instant,
): { entries: OutOfAreaEntry[]; notBanded: number };
```

Every accepted referral with an `arrivedAt`, whose band from `homeRegion` to the accepting unit's
site is three hours or more, or air transport only. The clock runs from `arrivedAt`, per D8-3.

**`notBanded` is not optional and must reach the screen.** A referral whose band the fixture does not
record is **not counted as out of area** — an unknown band never becomes a figure — and is also not
silently dropped, because a count that quietly excludes what it could not classify is a count that
will be quoted as complete. Both numbers appear together:

> 4 people are recorded as being in a bed far from home. 2 more could not be placed in a band
> because this prototype holds no travel time for their home region.

**One honest limitation the screen must carry.** This prototype has no record of anyone leaving a
bed, so nobody ever leaves this ledger during a demo run. The figure is what the fixture and this
session's own actions hold, not a live statewide count; say that in the screen's own words rather
than leaving a reader to assume otherwise. The smallest later fix is a departure record — one field
and one event — but it is not this phase's, because "left the bed" and "was discharged" are different
facts and only the owner knows which one is wanted.

**Cost to reverse:** the field and event are additive, and removing them is a narrowing, which is
cheap. Choosing one of the other two ways instead changes only where the ledger's data comes from —
what it counts and how it says it are unchanged.

### D6 — The invented threshold is stated on screen, in these exact words

D8-3 makes this mandatory rather than advisory, for the reason roadmap decision 10 already gives for
escalation numbers: a threshold that looks official and is not is the kind of figure that gets quoted
back at you in a meeting.

Nobody has established whether "out of area" is already a defined term with a defined threshold in
Western Australian mental health. If it is, the threshold is not ours and we adopt theirs. Until that
is answered, this sentence appears on the out-of-area ledger in full — not abbreviated, not behind a
tooltip, not in a footnote below the fold:

> **Out of area here means three hours or more from home, or reachable only by air. This prototype
> invented that line. Nobody has checked whether Western Australian mental health services already
> define "out of area", and if they do, their definition replaces this one.**

The threshold itself is one exported constant, so adopting a real definition later is one edit and
one line of copy rather than a search through components.

**Cost to reverse:** one constant and one sentence. That is exactly why it is one constant and one
sentence.

### D7 — "Why not here?" across the state is the match view widened, not a second screen

Roadmap additional item 2 — for one patient, every unit and the single reason it cannot take them —
is **already built** for referrals. `referralCandidates` returns all seventeen units including all
five country units; `matchReason` gives each its single human reason; `ReferralMatchView` renders
every row. Nothing about it is metro-only.

So Phase 8 does not build a whole-state "why not here?" screen. It adds the bands and the group
headings to the screen that already answers the question, and the roadmap item is then done.

**Why not a second screen.** A second screen would compute the same verdicts a second time, and two
surfaces answering one question is how a prototype comes to give two answers — the defect Phase 5
shipped and caught by screenshot, and the reason Phase 7's D4 refuses to let two similarly named
gates be collapsed. There is no question the second screen would answer that the first does not.

**What is genuinely not delivered, and is not delivered by this phase either.** The _movement_ path —
the coordinator's shortlist panel and the network diagram — still shows a shortlist of three via
`eligibleCandidatesAmong`, not every unit. That is a different screen with a different job, and
widening it is not free: three-of-seventeen is a deliberate shortlist, not a truncation bug. Phase 8
leaves it and says so, rather than quietly implying the roadmap item covers both paths.

**Cost to reverse:** none — nothing is built to reverse.

### D8 — The "Best" label on the movement shortlist is renamed

`originServiceFit` in `ward-management-network.tsx` labels a candidate unit **"Best"** when its health
service matches the health service of the emergency department the patient presented to. The
function's own doc comment already explains at length that this is not catchment. The label does not:
on screen, "Best" reads as the system's opinion about which bed this person should have.

Under this phase's standing rule that is not survivable, and it is a two-word fix. The label becomes
**"Same health service"**, and its counterpart becomes **"Different health service"** — both of which
state the fact the function actually computes. The tones may stay as they are; a colour is not a
claim in the way a word is.

**Why this is Phase 8's and not a tidy-up for later.** Phase 8 is the phase that puts distance on the
screen. A phase that adds honest bands beside an existing dishonest superlative has made the screen
worse, because the superlative now looks as though it was checked too.

**Cost to reverse:** two strings.

### D9 — The country pathway records an optional step, and no screen implies it is owed

This implements D8-6, and the difficulty is the whole decision. An optional thing on a form is not
optional in practice: a blank field reads as unfinished, an unticked box reads as a task, and a "Not
recorded" line reads as an omission. Any of those would assert that a local-first step exists and was
skipped — which is precisely what nobody knows (section 3, question 2).

**The mechanism, and every part of it is load-bearing:**

1. **It is not a field on the intake form.** Nothing is added to `referral-intake.tsx`. A form field
   is the one shape guaranteed to read as owed.
2. **It is an action, taken from the match view, that creates a record only when taken.** One
   control: _Record that a local bed was sought and none was suitable_. The coordinator asserts a
   fact they hold; the screen asserts nothing and asks nothing.
3. **Absence renders as nothing at all.** No "Not recorded", no empty checkbox, no grey placeholder,
   no warning icon, no amber row. A referral without the record looks exactly like a referral that
   never needed one, because it may be one.
4. **It is offered on every referral, not only country ones.** This is the part doing the real work.
   Offering it only on country referrals would assert that looking locally first is a country thing —
   the unanswered question, answered by a screen layout. Offering it everywhere asserts nothing about
   anybody's practice, and it also settles D8-6's other half: a country referral follows the same
   path as a metro one, and nothing on screen says otherwise.
5. **No figure anywhere counts what is missing.** The ledger may report how many out-of-area
   placements _have_ the record; it may never report how many lack it, and no screen may show a
   completeness percentage. "12 of 40 referrals are missing this step" manufactures the obligation in
   a single line of copy.

The record carries no free text:

```ts
// on Referral
localBedSought?: { at: Instant; by: string };   // `by` is a role, never a person
```

with a `RECORD_LOCAL_BED_SOUGHT` event, role-gated like every other referral event, and no note field
— for the same reason the referral decline has none.

**Why this and not D8-6's rejected alternatives.** Recording nothing gives up the one thing the ledger
is actually about: whether a nearer option was ever available. Requiring the step asserts that the
local-first practice exists. The optional form keeps the first and asserts neither.

**Cost to reverse:** if country services do always look locally first, the step is promoted from
optional to required — one validation and one screen state. If they do not, the field and its event
are dropped.

### D10 — `out_of_catchment` is renamed: not backed by home region, and not removed

`REFERRAL_DECLINE_REASONS` contains `out_of_catchment`, and a bed can be declined for it today while
the system holds no catchment for anybody. Now that `homeRegion` exists, three things could happen to
it.

**Not backed by home region.** A catchment is a service's boundary — which service is answerable for
a person. A home region is where a person lives. They are not the same fact, and the two vocabularies
in this codebase do not even align: `HOME_REGIONS` holds ten Western Australian regions, while
`HealthService` holds North Metro, South Metro, East Metro, WACHS and Private. Mapping one onto the
other would be inventing an administrative fact, which is the thing this phase exists to stop. And
`homeRegion`'s own doc comment says what it was added for: so a later phase can ask how far from home
someone was placed. Not to define a catchment.

**Not removed either.** "This request belongs to another service" is a real administrative answer a
coordinator can give and can know. The defect is not that the answer is wrong; it is that the **label
implies the system checked something it did not**. Removing it would push coordinators onto a reason
that means something else, which is worse than a bad label.

**So: renamed.** `out_of_catchment` becomes `belongs_to_another_service`, labelled **"Belongs to
another service"**. It stays distinct from `referred_elsewhere` ("this referral has already gone
somewhere else"), and it names an administrative assertion by the coordinator rather than an apparent
system finding.

**What the rename costs, in full, because a union member is never free:**

- The picker in `referral-match.tsx` derives from `REFERRAL_DECLINE_REASONS` itself, so it costs
  nothing.
- Two label maps are typed `Record<ReferralDeclineReason, string>` — in `referral-match.tsx` and
  `ward-management-console.tsx` — so both **fail to compile** until updated. That is the compiler
  doing the work, and it is why this is a safe rename rather than a risky one.
- The seeded fixture uses it: referral RF-004 in `ward-movements.ts` carries
  `declineReason: "out_of_catchment"`, and its own comment describes it. Both change.
- Any test naming the string changes with them.

**Explicitly out of scope, with the reason stated so nobody assumes it was missed:** `DECLINE_REASONS`
— the movement-side list — has its own `out_of_catchment` member with the same problem. It is a
different list, on a different event, for a different decision (a ward declining a specific patient,
not a service declining a referral), and Phase 7's D8 is explicit that the two lists must not be
collapsed. Renaming both in one change would put that collapse one careless edit away. Fix it in its
own change, with its own reason.

**Cost to reverse:** a second rename, at the same price.

### D11 — The network diagram becomes a placement tool, and it is four tasks, not one

This implements D8-5, and it is the largest piece of work in the phase by a wide margin. **It should
not be attempted as one task.** Today's `WardNetworkWorkspace` is 585 lines, is driven by a `Movement`
rather than a `Referral`, reads bed-release state through `capacityBreakdown` and `unitCapacity`,
computes its own shortlist of three, and carries the "Best" label D8 renames. Making it a
referral-driven placement tool touches all of that.

**How roadmap decision 14's six commitments compose when placement is the primary job.** All six are
settled and none is dropped; this only decides which wins where they compete for the same picture.

| Commitment                                           | How it composes under a placement job                                                                                                                     |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overlay of which sites can take the selected patient | **Wins.** It is the whole job. Driven by `referralEligibility` for the selected referral, showing every site, with the single reason for each that cannot |
| Country sites present at all                         | **Already met** — five WACHS sites are in the table and in the diagram's left column today                                                                |
| Clickable navigation                                 | Kept as it is. Independent of everything else here                                                                                                        |
| Line weight by flow                                  | Kept, and subordinate — it decorates the picture, it does not arrange it                                                                                  |
| A time control                                       | Kept, driving the same `now` every other Ward Flow screen uses. It must not become a second clock                                                         |
| **Roughly geographic layout**                        | **This is where the settled commitments collide with the facts nobody has.** See below                                                                    |

**The geographic layout cannot be delivered as promised, and pretending otherwise would be the phase's
worst failure.** A roughly geographic layout requires knowing roughly where these hospitals are.
Nobody has checked that — it is section 3's sixth question — and a layout that positions real hospital
names on something shaped like Western Australia asserts far more than a band does, because a picture
is read as a map whatever the caption says.

So the layout is **arranged by band relative to the selected referral's home region**: the
under-an-hour group nearest the selected patient, then one to three hours, then three or more, then
air transport only, then not recorded. It is a picture of the fixture's invented bands, it carries
D2's synthetic sentence, and it is never called a map.

This is **less than roadmap decision 14 promised, and the reason is the missing fact, not a design
preference.** When the real bands are checked, the same layout becomes as geographic as the checked
data allows, with no structural change. If the owner would rather have a genuinely geographic layout,
what unblocks it is checked geography from him, not more design.

**The four tasks, in order, each independently reviewable:**

1. Rename the "Best" label (D8) — small, self-contained, and it makes everything after it safe to look
   at.
2. Add referral selection alongside movement selection, driven by `referralCandidates` and
   `referralEligibility`, showing every unit rather than a shortlist of three.
3. Add the band arrangement and the group labels, reusing `groupCandidatesByTravelBand` (D3) rather
   than a second grouping.
4. Reconcile the whole-network overview into the secondary mode it now is.

**Cost to reverse:** the layout, not the data. Every fact the diagram draws comes from the site table,
`referralCandidates` and the band fixture, none of which is changed by how it is drawn.

### D12 — Phase 8 never asks what stage a bed is in, with exactly one named exception

Phase 7 protected itself from the unvalidated four-stage bed model (`predicted → confirmed → blocked →
released`) by never once asking what stage a bed is in: `referralEligibility` reads `allocatable`,
`empty` and nothing else, and a contract test enforces it. The questions document instructs that this
be **written into Phase 8's specification as a rule, not left as a hope**. Here it is.

**Every new derivation in this phase asks only whether a bed is free now.** `travelBand`,
`unitTravelBand`, `groupCandidatesByTravelBand` and `outOfAreaLedger` read a home region, a site code,
an accepted unit and an arrival time. None reads a `BedRelease`, a release state, a band or a
confidence, and the Phase 7 contract test extends to cover all four.

**The one exception, named exactly, because a rule with an unstated exception is worse than no rule.**
`WardNetworkWorkspace` already renders bed-state chips for every unit — Ready, Held, Confirmed,
Predicted, Blocked — through `capacityBreakdown` and `unitCapacity`. Two of those five, Confirmed and
Predicted, come straight from the four-stage model. That exposure exists today, and D11 does not
remove it.

So: **if the four-stage model turns out to be wrong, everything in Phase 8 is unaffected except two
chips on one diagram.** D11 must not add a new read of release state — the placement overlay is driven
by `referralEligibility`, which does not look — and an implementer who finds themselves reaching for
`capacityBreakdown` in new placement code has left the rule and should stop.

**Cost to reverse:** not for reversal. This is what keeps the phase cheap to correct.

### D13 — No kilometre figure, anywhere in this phase

Roadmap decision 11 settled that distance is "travel-time bands **plus kilometres**". D8-7 forbids "a
kilometre figure derived from these bands". Taken together they mean Phase 8 ships the bands and not
the kilometres — because the only kilometre figure available would be one derived from an invented
band, or one estimated from a map, and both are forbidden.

**So Phase 8 delivers half of roadmap decision 11, deliberately, and it is the half that matters.**
The roadmap's own reasoning says why: "three hours from home" is a fact a clinician can weigh and
"247 km" is not. The kilometre half was the lesser one, and it is the one that needs a checked fact.

When real distances are checked, a kilometre figure may sit beside a band — never ordering a list,
never labelling a bed. Until then no kilometre figure appears in code, copy, comment, test or fixture.

**Cost to reverse:** adding a checked figure later is additive.

### D14 — No Mental Health Act figure, anywhere, and a plain label is not one

Unchanged and absolute, restated here because a phase about thresholds and clocks is where it is most
easily broken. No figure, timeframe, threshold or duration from the Mental Health Act may be cited,
paraphrased or inferred — not in code, copy, comment, test or fixture. A plain **Voluntary** /
**Involuntary** label is permitted and **is not a legal figure**.

Nothing in Phase 8 needs one. The out-of-area threshold in D6 is a prototype invention, is labelled as
one on screen, and has nothing to do with the Act. The arrival clock in D5 counts elapsed time since a
recorded arrival, and has no deadline, no target, no colour change at a threshold and no countdown.

`tests/ward-legal-figure-guard.test.ts` switches exhaustively over every event type, so the two new
events in this phase (`REFERRAL_ARRIVED`, `RECORD_LOCAL_BED_SOUGHT`) **refuse to compile** until that
test is extended. Extend it in the same change and prove it non-vacuous.

**Cost to reverse:** not for reversal.

---

## Data flow

A coordinator opens a queued referral → `referralCandidates` produces every unit with its verdict,
exactly as today → `groupCandidatesByTravelBand` rearranges that same list into five groups using
`unitTravelBand`, which reads the referral's `homeRegion` and the unit's site code from the synthetic
band fixture → the match view renders five headings, each group in the site table's order, each row
with its band and its accept-or-reason, and the synthetic-travel-times sentence once → the coordinator
accepts, declines, or leaves it queued, exactly as today → later, an arrival is recorded against the
accepted referral → the out-of-area ledger reads accepted referrals with an arrival, bands each
against its accepting unit's site, counts those three hours or more or air transport only, and
reports separately how many it could not band.

No screen computes its own band, its own group, or its own out-of-area verdict.

---

## Failure behaviour

Everything degrades toward saying less rather than guessing more. Every line below is a test.

- **A band the fixture does not record** → `travelBand` returns `undefined`. The unit renders in the
  **not-recorded** group with its band shown as "Travel time not recorded". It **never** falls back to
  a band, never sorts into "under an hour", and never renders as blank — a blank cell in a distance
  column is read as "close".
- **A referral whose home region the fixture does not cover at all** → every unit lands in the
  not-recorded group; all four band headings render with their empty line; one sentence at the top
  states the gap once. The candidate list is complete and every unit is still choosable.
- **An unknown or malformed home region** → cannot reach here: `RECEIVE_REFERRAL` membership-checks
  `homeRegion` against `HOME_REGIONS` and refuses with a visible `Rejection`. If one somehow exists in
  a hand-authored fixture, `travelBand` returns `undefined` and it degrades as above.
- **No unit anywhere accepts this referral** → unchanged from Phase 7: the screen says so explicitly
  and lists every unit's reason. Under grouping the groups still render with their counts, so a
  coordinator can see that nothing is close _and_ nothing is far — never an empty list, which reads as
  a rendering failure.
- **An age band with no unit anywhere in the network** → unchanged from Phase 7: says that
  specifically, and says it **before** any distance wording, because a structural gap is not a
  distance problem and must never be dressed as one.
- **An out-of-area ledger entry whose band is unrecorded** → not counted as out of area, not silently
  dropped, and reported in `notBanded` on the same screen as the count.
- **An accepted referral with no arrival recorded** → not in the ledger, and not reported as missing
  anything. It has not arrived as far as this prototype knows, and saying more would invent the
  arrival.
- **A referral accepted at a unit that no longer resolves** → the existing Phase 7 wording already
  handles this ("Accepted, but no synthetic unit matches …"); the ledger skips it rather than banding
  it against a guess.
- **A role attempting `REFERRAL_ARRIVED` or `RECORD_LOCAL_BED_SOUGHT` without holding it** → a visible
  `Rejection`, never a silent no-op, following every other referral event.

---

## Verification

No gate skipped, no assertion deleted, no test loosened, no tolerance lowered. Every new test is
mutation-tested — break what it guards, watch it go red with the failure line quoted, restore.

**The five tests that matter most, each with its reasoning written on it:**

1. **Grouping loses nothing.** The candidates going into `groupCandidatesByTravelBand` and the
   candidates across its five groups are the same set, for a fixture where at least one unit has no
   recorded band. Mutate the function to drop unbanded units and watch it go red.
2. **Grouping reorders nothing inside a band.** Two units in one band appear in the site table's
   order. Mutate to a sort and watch it go red. This is the guard for the phase's defining hazard —
   grouping quietly becoming ranking.
3. **An unrecorded band is never a band.** `travelBand` returns `undefined` for an unrecorded pair and
   no caller substitutes a default. Mutate to return the nearest band and watch it go red.
4. **An unrecorded band is never counted as out of area.** A referral whose band is missing does not
   appear in `entries` and does appear in `notBanded`. Mutate the out-of-area test to treat `undefined`
   as out of area and watch it go red.
5. **Distance is not a gate.** `referralEligibility`'s gate list is unchanged by this phase, and a unit
   in the three-hours-or-more band that passes every gate still reports as accepting. Mutate by adding
   a travel gate and watch it go red.

**Also, each mutation-tested:** the `REFERRAL_ARRIVED` and `RECORD_LOCAL_BED_SOUGHT` role gates and
their refusal branches; the renamed decline reason as a membership check rather than a truthiness
test; the ledger's clock measuring from `arrivedAt` rather than `decidedAt`.

**Extend the Phase 7 D15 contract test** so no new Phase 8 derivation reads a `BedRelease`, a release
state, a band or a confidence (D12).

**Extend the structural privacy test** to `Referral`'s new fields, asserting the type's field set
rather than fixture content, so the two additions are recorded as deliberate and a future
`homeAddress` still fails at the type level.

**Extend the legal-figure sweep** to both new events, and prove it non-vacuous by emptying a candidate
list and watching the traversal assertion name the event that stopped being reached.

**Seeded fixture must open on the awkward cases:** at least one home-region/site pair with **no**
recorded band, so the not-recorded group is exercised by default rather than only in a test; at least
one home region with no bands recorded at all; at least two units in one band, so the no-reordering
test has something to catch; at least one accepted referral with an arrival recorded whose band puts
it out of area, so the ledger has a real entry — which referral that is follows from whatever bands
the fixture's author records, and this document does not choose it; at least one accepted referral
with an arrival whose band is unrecorded, so `notBanded` is exercised; and at least one accepted
referral with no arrival recorded at all.

**Screenshots at 390 / 820 / 1440, looked at rather than assumed.** Five group headings plus a
seventeen-row list is a phone-layout problem, and the empty-group lines are exactly the kind of thing
that reads correctly in a test and looks broken on a 390px screen. Check the match view at 390 first.

**Browser proof — spend it deliberately.** One Chromium journey: open a referral, see the five groups
with the synthetic-travel-times sentence, accept at a far unit, record its arrival, and see it appear
on the out-of-area ledger with the invented-threshold sentence. Prove it can fail before trusting it.
Read both the exit status and the "N passed" line: `75` means blocked by the run coordinator and
should be retried; any other non-zero means red; exit 0 with no result line means nothing ran.

**Not run, and why:** `verify:release`, every `eval:*` script, `check:supabase-project` and `test:live`
are provider-backed and forbidden by the standing constraints.

---

## Success criteria

1. A coordinator can see, for one referral, how many suitable beds are close and how many are not —
   without any bed being hidden, reordered within its band, or labelled best.
2. Every travel time on every screen carries the sentence saying the prototype invented it.
3. The out-of-area ledger states that its threshold is invented, in full, on the screen that uses it.
4. A referral whose band is unknown is visible, is not counted, and is reported as uncounted.
5. No kilometre figure exists anywhere in the phase.
6. The optional local-bed step can be recorded, and no screen anywhere implies it is owed.
7. No word implying proximity appears on any screen without a fact behind it.
8. If the four bed states turn out to be wrong, nothing in this phase changes except two chips on the
   network diagram (D12).

---

## Risks

- **Grouping quietly becoming ranking.** The phase's defining hazard, and it will not arrive as a
  decision — it will arrive as a small helpful sort inside a group, or a group promoted to the top
  because it is the useful one. D3's three properties and their tests are the mitigation.
- **An unrecorded band read as "close".** A blank distance cell is read as near, not as unknown. The
  not-recorded group and its explicit wording are the mitigation, and the fixture must keep at least
  one genuinely unrecorded pair so the path is exercised by default.
- **The band fixture being filled in from a map.** The most likely way this phase ends up asserting
  something false, and it will look like diligence when it happens. The fixture's own doc comment and
  D2's on-screen sentence are the mitigation; a reviewer should treat a suspiciously complete band
  table as a finding, not as thoroughness.
- **The ledger's count being read as a live statewide figure.** It counts a fixture plus one demo
  session, and nobody ever leaves it. D5's screen wording is the mitigation and it is thin — this is
  the figure most likely to be quoted in a room.
- **The optional step drifting into an expectation.** One "Not recorded" line, one completeness
  percentage, or one amber row is all it takes. D9's five rules exist because each of them is a real
  thing somebody would add for good reasons.
- **The network diagram attempted as one task.** It is 585 lines, movement-driven, and carries the
  phase's only four-stage-model exposure. D11's four-task split is the mitigation.
- **`REFERRAL_ARRIVED` becoming the referral-to-movement bridge by accretion.** It is one timestamp.
  The moment it acquires a location, a legal status or a stage, Phase 7's D14 has been reversed by
  accident rather than by decision.

---

## Assumptions, and what each would cost to reverse

| Decision                        | Status                                                                      | Reversal cost                                                                         |
| ------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| D1 (band is a pair)             | Design judgement, following `homeRegion`'s stated purpose                   | Cheap — one module and its callers; nothing is stored                                 |
| D2 (bands synthetic)            | **D8-7, settled**                                                           | Cheap — fixture values and one sentence, when the real bands are checked              |
| D3 (grouping wraps)             | **D8-2, settled**                                                           | Cheap — one function and one wrapper element                                          |
| D4 (band order is presentation) | Design judgement, from roadmap 11's own listed order                        | Wording                                                                               |
| D5 (`Referral.arrivedAt`)       | **Design judgement filling a gap D8-3 leaves open** — see below             | Additive; switching to a `Movement` home region is a governance decision, not a build |
| D6 (invented threshold stated)  | **D8-3, settled, and mandatory**                                            | One constant and one sentence                                                         |
| D7 (no second screen)           | Design judgement, following Phase 5's parallel-concept lesson               | None — nothing is built                                                               |
| D8 ("Best" renamed)             | Design judgement, forced by this phase's standing rule                      | Two strings                                                                           |
| D9 (optional step)              | **D8-6, settled** — the five rules implementing it are design judgement     | Promotion to required is one validation and one screen state                          |
| D10 (decline reason renamed)    | Design judgement                                                            | A second rename, at the same price                                                    |
| D11 (placement tool)            | **D8-5, settled** — the four-task split and the layout are design judgement | The layout, not the data                                                              |
| D12 (never asks bed stage)      | Phase 7's D15, extended as the questions document instructs                 | **Not for reversal** — it is what keeps the phase cheap to correct                    |
| D13 (no kilometres)             | **D8-7 plus roadmap 11**, which pull against each other — see below         | Additive later                                                                        |
| D14 (no legal figure)           | Absolute constraint                                                         | Not for reversal                                                                      |
| **The travel-band values**      | **INVENTED, and labelled invented**                                         | Fixture values only                                                                   |
| **The out-of-area threshold**   | **INVENTED, and labelled invented**                                         | One constant                                                                          |
| **The four bed states**         | **UNVALIDATED**                                                             | Nothing in this phase changes except two chips on the network diagram (D12)           |

---

## What is NOT proven

Stated plainly, because the value of this project is that it does not blur this line.

- **No travel-time band in this prototype has been checked against reality.** Not one. They are
  invented data with real hospital names beside them, which is why D2 exists.
- **The out-of-area threshold is invented**, and may be wrong in the specific way that matters: WA
  mental health may already define the term.
- **Nothing here knows how psychiatric patients move around Western Australia by air.** "Air transport
  only" is a band label and carries no claim beyond that.
- **Nothing here knows whether country services look for a local bed first.** D9 is built around that
  gap rather than across it.
- **Whether grouping by band is what a coordinator actually wants** has not been tested with a
  coordinator. It is a reasoned choice, not a validated one.
- **Whether the ten `HOME_REGIONS` match how services actually think about where someone is from** is
  unchecked. They are real WA region names, which is not the same as being the right grouping.
- **The four-stage bed model remains unvalidated**, and Phase 8 is constructed so that being wrong
  about it costs this phase almost nothing (D12). Phase 8 holds Phase 7's property: it asks only
  whether a bed is free now. The single part that does not is named in D12 — two chips on the network
  diagram, an exposure that already exists and that D11 must not widen.
- **A pre-existing comment in `ward-movements.ts`** describes a seeded referral as being "hundreds of
  kilometres from home" and calls its shape "a real shape for WA's rural mental health system". Both
  are real-world claims nobody in this project has checked, sitting in a code comment. This phase's
  own rule would not permit them, and they should be reworded when that file is next touched — flagged
  rather than fixed here, because it is not this phase's file to change.

---

## Where the settled decisions did not reach

Three places where D8-1 to D8-7 could not be specified exactly as written. None of them reopens a
decision; each names something a decision assumed and the code does not hold.

1. **D8-3's clock has no record to hang on.** It says the clock starts when the person arrives in the
   far bed. Nothing in the system records a referral arriving anywhere: `Referral` carries `homeRegion`
   but never arrives, and `Movement` arrives but carries no `homeRegion`. D5 closes this with the
   cheapest of three options and names the other two. **If the owner would rather widen `Movement`
   with a home region, that is his decision to take and not this specification's.**
2. **Roadmap 11 and D8-7 pull against each other on kilometres.** Roadmap 11 settled "travel-time bands
   **plus kilometres**"; D8-7 forbids a kilometre figure derived from the bands, and nobody has a
   checked distance. Phase 8 therefore ships the bands and not the kilometres. D13 records that as a
   deliberate, stated deferral rather than an oversight.
3. **Roadmap 14's "roughly geographic layout" needs the fact section 3 question 6 is about.** A layout
   shaped like Western Australia, with real hospital names on it, asserts more than a band does — a
   picture is read as a map whatever its caption says. D11 substitutes a band-relative arrangement,
   says plainly that it is less than the roadmap promised, and says what would unblock the real thing:
   checked geography from the owner, not more design.

**One smaller thing worth the owner's eye.** P8-1's option B described home region as "North Metro,
East Metro, South Metro, or country" — the same coarse grouping already on every screen. What was
actually built is the ten Western Australian regions (`HOME_REGIONS`), which is finer and does not line
up with the five values in `HealthService`. Nothing in Phase 8 breaks because of it, and D10 turns it
to good use as one reason a home region cannot stand in for a catchment. But the two vocabularies now
coexist, and if the owner meant the coarser one, changing it is cheaper now than after the band fixture
has been authored against ten regions.

---

## Open questions for the product owner

None blocks implementation; the first two change what gets built next.

1. **Which record should the out-of-area clock hang on** — the accepted referral (D5's choice, cheap
   and additive), or `Movement` widened with a home region (a governance decision only he can take)?
2. **Is the coarse home-region grouping he described in P8-1 the one he wants**, or are the ten WA
   regions now built the right shape?
3. **Should there be a record of someone leaving an out-of-area bed?** Without one, nobody ever leaves
   the ledger during a demo run. "Left the bed" and "was discharged" are different facts and only he
   knows which is wanted.
