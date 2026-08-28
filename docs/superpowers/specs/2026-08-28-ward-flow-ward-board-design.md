# Ward Flow — The ward board

**Written 2026-08-28.** The binding specification for the ward board: one page per inpatient
unit, showing every bed as a bed, who is leaving and when, and where they are going. It replaces
today's ward screen rather than sitting beside it.

Designed in conversation with the product owner on 2026-08-28. Every decision below carries the
answer he gave and the reasoning that produced it. Where this file and someone's recollection
disagree, this file wins. Where this file and a later, more detailed specification disagree, the
later one wins.

**Where it sits.** After Phase 7 (the front door) and before the roadmap's Phase 8 (distance and
the state). It is deliberately not numbered: Phase 8 already names different work, and renumbering
a roadmap mid-flight is how a plan stops being followed. The roadmap needs one line added saying
this comes first — an owner call recorded in "Open questions" below.

---

## Read this before anything below

### 1. The foundation is still not validated — and has already changed once

`predicted → confirmed → released`, with **blocked as a flag rather than a stage** — the model of how
a bed comes free — has still never been put to a ward clinician. `docs/ward-flow-clinician-check.md`
is the one-page summary waiting to go out.

**It was four stages when this spec was first written.** The owner revised it on 2026-08-28, while
this design was still on paper. That revision cost this design nothing, which is the design goal
working exactly as intended: D4 makes a date the ward itself sets the single primary fact and derives
the release stages from it, so a change to the stages breaks one derivation module and nothing else —
not the board, not the daily sheet, not the statistics. It must survive review, because it has now
been tested once for real.

### 2. REVISED 2026-08-28 — Phase 7 is finished; Phase 8 is what is in flight

Phase 7 completed (its Chromium journey, the morning page's people-waiting figure) and Phase 8 began,
all while this design sat waiting. **Thirty commits landed between this spec being written and being
revised**, and five changed things it depends on:

| Landed | Consequence here |
| ------ | ---------------- |
| The bed model became **three stages plus a flag** | D4 rewritten; `blocked` is never a state on this board |
| `BedRelease.confidence` → **`waitingOn`** (`BED_RELEASE_WAITING_ON`) | Any `confidence` reference in this design is stale |
| **`BED_RELEASE_BLOCKERS` owner-approved at eight entries** | D9's draft withdrawn; this board defines no list of its own |
| **`BED_PREPARATION_NOTES` filled** | A new tile caption — and a trap, see D7 |
| Phase 8's **travel bands, home region, out-of-area definition** | D12's arrows may carry a band, under Phase 8's rules |

**The sequencing constraint has not gone away, it has moved.** No task may begin while another
session is building in this worktree — the pre-commit hook inspects the whole working tree, so two
agents cannot commit independently even with disjoint files. Phase 8 is that session now.

**Re-read the model in the source before writing code against it.** This design has been overtaken
once already. Check `BED_RELEASE_STATES`, `BED_RELEASE_WAITING_ON`, `BED_RELEASE_BLOCKERS` and
`BED_PREPARATION_NOTES` directly rather than trusting the quotations here.

### 3. This extends Phase 7's referral, it does not fork it

Phase 7 built a referral with three outcomes — `queued`, `accepted`, `declined`, held by the
coordinator. The ward's waitlist (D3) is a **ward-side** fact that sits between accepted and
pulled. It must extend that record. A second, parallel notion of "the ward said yes" is the exact
defect class this repository produces most reliably.

---

## Why this page

The prototype can say a ward has 20 beds, 3 empty and 2 held. It cannot say there is a person in
one of them, or how long they have been there, or when the bed comes back. Every screen follows a
person **to** the ward door and stops.

That gap costs three things:

1. **Bed flow is a two-sided equation and only one side is built.** Discharge is where beds come
   from. Today it is a number a ward types in, disconnected from any person.
2. **The ward has no reason to keep the board accurate.** Every existing ward-facing control feeds
   somebody else's screen. A ward that maintains its own board gets its own board.
3. **The most important number in psychiatric bed flow is missing entirely** — people who are ready
   to leave and cannot (D9).

---

## What already exists — extend it, do not build beside it

| Exists                                                                       | How this work uses it                                                                                              |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `Unit` — beds, empty, allocatable, held, blocked, `sexMix`, `speciallingCapacity`, four bed dimensions | The board renders from it. `sexMix` becomes derived rather than hand-maintained (D5)                     |
| `Movement` — a person travelling to a ward, ending at `arrived`                | The movement's arrival is what creates an admission (D2)                                                          |
| `Referral` (Phase 7) — the front door, five person-facts, three outcomes       | The left column's referral side. Extended with the ward waitlist (D3)                                             |
| `BedRelease` — **three stages** (`predicted`/`confirmed`/`released`), `expectedAt`, `waitingOn`, and `blocker` as a FLAG | Derived from the discharge date (D4). Not written by hand any more |
| `LeaveBed` — a bed whose occupant is on approved leave, usable or not          | A tile state on the board. Unchanged                                                                              |
| `eligibility()` / matching (Phase 7)                                           | Powers "select a referral and the beds answer" (D13). No new matching logic                                       |
| `WardFreshness` + refresh-requested                                            | The daily-confirm staleness signal (D10). Same mechanism, new trigger                                             |
| `UnwindRecord`                                                                 | Undo (D17). Same discipline                                                                                        |
| `capacityBreakdown()` / `ward-morning-rollup.ts`                               | Untouched arithmetic. The board must never compute a bed figure of its own                                        |

---

## Scope

**In:** the ward board page; the admission record; the ward waitlist and the pull; the discharge
date and everything derived from it; the daily confirm sheet; the ward's referral answering; leaving
and where to; the blocked-discharge figure; a statistics strip per ward and one statewide statistics
page; the community-team table.

**Out, deliberately:** diagnosis (D5); distance, travel-time bands and any proximity claim (roadmap
11, Phase 8's work); bed numbering and ward geography (D6); anything that predicts, scores, ranks or
recommends (D20); free text of any kind, anywhere (D5); notifications that send or chase (roadmap 9).

---

## Decisions

### D1 — The admission is a new record, and it is the first person inside a bed

The prototype gains `Admission`: a person occupying, or committed to, one bed in one unit. It is a
first-class record with its own lifecycle, not a field on `Movement` and not a count on `Unit`.

Why its own record: a movement ends when someone arrives, and a unit's counts are aggregates. Both
the day count and the discharge date belong to one occupancy, and an occupancy outlives the movement
that produced it.

### D2 — Four states, and the bed is lost at the pull, not the arrival

Answered by the owner on 2026-08-28, and it corrected the assumption in the first draft:

> "Once the patient is pulled by the ward, the patient fills the bed. So they can be accepted but
> waitlisted. When they are pulled, even if onsite awaiting transport, this is when they count as
> bed lost as this is when the bed is essentially given away."

| State           | The bed is | The person is                      |
| --------------- | ---------- | ---------------------------------- |
| `waitlisted`    | free       | accepted by this ward, elsewhere   |
| `pulled`        | **gone**   | still elsewhere, awaiting transport |
| `occupied`      | gone       | in the bed                          |
| `left`          | free       | gone                               |

**The rule this makes:** a ward's available-bed count drops at the pull. Verified against the
existing model — `held` is already excluded from `availableNow`, so this stays consistent with the
morning page's arithmetic rather than contradicting it.

**A pulled-but-empty bed carries its own visible clock** ("empty 3 hours"). The pull removes a bed
from the state's supply, so it must cost something visible; otherwise a pull becomes a quiet way to
reserve a bed. That timer is also the transport-delay statistic (D16).

**A failed pull** — deterioration, transport failure, the person placed elsewhere, refusal — is
released by the ward with a reason from a fixed list, and the release is recorded, never silently
lost. Repeated failed pulls at one site is a signal about transport, not about that ward. The bed
returns to available immediately. It never expires on a timer: that would need an invented number,
and a bed could reappear while the patient is genuinely still on their way.

### D3 — The ward's waitlist is ordered and the ward controls it

A ward accepts people onto a numbered list and can reorder it. The next bed goes to whoever is at
the top unless the ward moves someone up.

Why ordered rather than system-sorted: it makes the ward's own reasoning visible to the coordinator
without an argument, and it is the honest version of what happens on a whiteboard today.

**Two consequences that must travel with it:**

1. **A person can be on several waitlists at once.** `PARALLEL_REFERRAL_CAP` is 3. A referral must
   therefore show every waitlist it is on and its position on each — otherwise someone sits in an
   emergency department looking placed while being nowhere. Without this, a waitlist is a way to
   lose people.
2. **A pull withdraws the person from every other waitlist automatically**, using the same
   withdrawal the referral model already performs when a unit accepts.

### D4 — One discharge date, and everything is derived from it

The ward sets **one expected discharge date per admission**. From it the system derives the bed's
predicted release, the discharge board, the arrows, the tile outline, and the morning page's
forward-looking figures.

Owner's decision, given the alternative of two facts side by side: one fact, entered once, so no two
screens can show different dates and there is one thing to update.

**How it maps onto the bed model — REVISED 2026-08-28, after this spec was first written.** The
owner replaced the four-stage model with **three stages plus a flag** while this design sat waiting
on Phase 7. This spec now targets the new model:

| Ward says                   | Bed release becomes                                    |
| --------------------------- | ------------------------------------------------------ |
| a date is set               | `predicted`, carrying `waitingOn`                      |
| confirmed as going          | `confirmed`, carrying `waitingOn`                      |
| ready to leave, cannot (D9) | **a `blocker` flag on the predicted OR confirmed release** |
| gone                        | `released`                                             |

**`blocked` is no longer a stage and must never be treated as one.** It is a flag
(`blocker` + `blockedBy`, a role) sitting on a release that stays predicted or confirmed. The defect
that forced this is exactly the one this board could reintroduce: `capacityBreakdown` sorted today's
releases into confirmed or predicted *by state*, so a release in state `blocked` matched neither
branch and was counted **nowhere** — marking a confirmed discharge blocked dropped the ward's
confirmed count with nothing saying why, so the figures improved at the moment the ward got stuck.

Two rules follow, and both are load-bearing on this board:

1. **A blocked-but-confirmed bed keeps counting as confirmed.** Blocking never removes a bed from a
   count.
2. **The "ready to leave, cannot" headline (D9) is a cross-cut, never a bucket taken out of the
   others.** It counts releases carrying a blocker, and those same releases are still counted in
   confirmed or predicted. A board that subtracts it has reintroduced the defect.

**`confidence` is gone.** A predicted release no longer says how *certain* the ward is; it says what
it is **waiting on** — `BED_RELEASE_WAITING_ON`, a fact rather than a judgement, because two wards'
"likely" do not mean the same thing and a coordinator can neither compare nor add them. Any code in
this design referring to `confidence` is stale and must read `waitingOn`.

Nothing about the stages is invented or changed by this board. They stop being typed and start being
derived — which is exactly what makes the model cheap to correct, and it has now been corrected once
while this design was still on paper, at a cost of zero to this design.

**How many times a date has moved is counted and shown** ("moved 4 times"). It is a ward-level fact
with nothing about the person in it, and it is the difference between a prediction a coordinator
plans against and one they discount. It is also, by itself, the roadmap's "ward prediction track
record" (additional item 1), delivered here rather than in Phase 9.

### D5 — What an admission carries, and what it must never carry

**Facts about the person:** `homeRegion` (a region from the existing fixed list, never an address),
`sex`.

**Facts about the occupancy:** the unit, `pulledAt`, `arrivedAt`, the expected discharge date, how
many times it has moved, who set it and when, blocked state and reason (D9), leaving destination
(D8), and the referral it came from.

**Absolutely excluded, and this has not moved:** name, date of birth, record number, address,
diagnosis, narrative history, treatment, and **free text anywhere**. `tests/` must assert this
structurally against the type's own field set, the same discipline `Referral` and `BedRelease`
already hold to, so a future field named `notes`, `diagnosis`, `dob` or `patientId` fails a test
rather than being discouraged by convention.

**Diagnosis: OUT, by owner decision on 2026-08-28.** He was shown what it would cost — the exclusion
rule would change from absolute to conditional, and a conditional rule is one later sessions push
against — and chose to keep the rule intact. The board is laid out so that the space exists and
adding it later costs one field. **Do not add it without a recorded owner decision.**

**`sex` on an admission is a small, deliberate widening, and it is flagged.** A unit already records
`sexMix` as counts, so the system already knows the sex of every occupant in aggregate; carrying it
per-admission means the board could show which tile is which. Two things justify it: sex designation
and sex mix are the commonest real reason a bed is not a bed (D11), and it removes a hand-maintained
count in favour of a derived one — this repository's single most reliable source of silent failure.
**The owner was told the alternative** (keep sex as a ward-level count only, at the cost of the
sex-mix column no longer refreshing automatically) and has not overruled it. If he does, the fallback
is a one-module change.

### D6 — Beds are tiles, not numbered beds

The board draws the right number of beds and fills them in a stable order. It makes no claim about
which physical bed anyone is in.

Owner's decision. Real ward bed numbering is idiosyncratic and is one more thing that can be wrong on
a board. Everything the page needs — days occupied, colours, arrows, the sex-mix arithmetic — works
without it. **Consequence, stated honestly:** the board can say nothing about where a bed physically
is, or about sides of a ward.

### D7 — The tile carries three signals, on three different channels

| Channel     | Fact                                                                      |
| ----------- | ------------------------------------------------------------------------- |
| **Fill**    | how long the person has been there, in the owner's four bands             |
| **Outline** | past their own expected discharge date                                    |
| **Number**  | days, written out                                                         |

**The owner's stay bands, used verbatim:** under 1 week · 1–4 weeks · 1–3 months · over 3 months.
These are his, not derived from anything, and the page must label them as bands he set.

Two rules that are not negotiable:

1. **Four shades of one hue, not four colours.** With the outline that is two colours on the board
   and no more. It survives printing and colour-blindness.
2. **Colour never carries a fact alone.** Every colour has the same fact beside it in words or
   numbers. The day count on the tile is what makes the fill decorative rather than load-bearing.

Tile states beyond occupied: ready; pulled-but-empty (with its clock, D2); on leave (existing
`LeaveBed`, usable or not); **being made ready**; and occupied-and-blocked.

**Two traps here, both introduced by changes that landed after this spec was first written.**

1. **A bed being made ready is still available.** `BED_PREPARATION_NOTES` ("Being cleaned",
   "Awaiting maintenance or repair") is a note *on an available bed*: it is still offered, still
   counts in `availableNow`, and still appears in every figure. The obvious implementation — a
   distinct tile state that reads as unavailable — silently removes beds from the state's supply.
   The note is a caption on a ready bed, not a state instead of ready.
2. **Blocked is a flag, not a tile state of its own.** The person is still in the bed and the bed is
   still occupied; the blocker sits on their pending release. A tile shows occupied *and* carries
   the blocker; it never shows blocked instead of occupied.

### D8 — Leaving records where to, and only real departures free a bed statewide

Not everyone who leaves a ward goes home. A transfer to another psychiatric ward moves the person;
**it does not give the state a bed.** As first drafted this design would have counted one, which is a
correctness defect, not a missing feature.

Leaving therefore records a destination from a short fixed list, and only genuine departures from the
inpatient system count towards statewide supply. A ward-to-ward transfer must net to zero at state
level while still freeing the sending ward's bed.

### D9 — Ready to leave and cannot: a headline figure, on an owner-supplied list

Beds occupied by people who no longer need them is the number that changes conversations in
psychiatric bed flow. It is a headline figure on every ward board and on the statewide page — not a
footnote.

**ANSWERED, 2026-08-28 — and the draft this spec first carried is withdrawn.** While this design
waited on Phase 7, the owner approved the reason list directly, in a different conversation. It
shipped as `BED_RELEASE_BLOCKERS` in `ward-change-reasons.ts` and now has eight entries:

> Awaiting clean · Awaiting pharmacy · Awaiting placement confirmation · Awaiting service
> coordination · Awaiting accommodation · Awaiting transport · Awaiting receiving-service acceptance
> · **Awaiting family or carer arrangement**

**This board uses that list and does not define its own.** The ten-item draft this spec originally
proposed is superseded — a second, parallel vocabulary for the same fact is the exact defect class
this project produces most reliably, and it would let a ward and a coordinator name the same
obstacle two different ways.

Two things about the eighth entry that must not be re-argued. It **deliberately overturns** a
principled Phase 5 exclusion (family availability was barred as "describes the person, not the
bed"). The owner's reasoning is recorded in the code and it is sound: excluding it never stopped the
delay happening, it made the ward record "Awaiting service coordination" instead — and **a wrong
reason is worse than a blunt one.** Guardianship and financial arrangements stay excluded.

**The discipline every entry holds to,** and which any future addition must also meet: each reason
names what the **system** is waiting for, never anything about the patient.

### D10 — One daily confirmation, and missing it makes the ward visibly stale

The ward opens one sheet. Every patient's discharge date is already filled in from yesterday. The
ward changes only what moved and presses one button: **nothing has changed**. Most days that button
is pressed without touching anything.

**Miss a day and the ward's figures stop claiming to be current** — on its own board, on the
coordinator's, and on the morning page. Nothing is hidden and nothing is blocked; it simply stops
asserting freshness. This is the only mechanism that reliably keeps a shared board accurate, and the
prototype already has exactly this machinery for bed counts (`WardFreshness`, `staleAfterMinutes`,
refresh-requested). The coordinator may additionally mark a ward refresh-requested, as today.

**The one place friction is added deliberately:** *nothing has changed* cannot be pressed over a date
that has already passed. Without this rule a ward presses that button for three weeks while every
date sits quietly in the past and the board becomes fiction. Stale rows must be touched; every other
row is untouched by definition.

**Frictionless requirements, all of them testable:**

- Keyboard-only. One column, tab down it, type. No calendar picker opened seventeen times.
- Dates accept shorthand: `+7`, `fri`, `next tue`.
- Three actions on a patient, not a form: **going today** · **date changed** · **stuck**.
- **Never ask the ward for anything the system can work out.** The community team comes from the home
  region; the bed's predicted release comes from the date; the sex mix comes from who is in the beds.
  If a ward is typing it, something upstream has failed.

### D11 — The layout, and one number at the top

The page mirrors the coordinator's home page — list on the left, picture in the middle, detail on the
right — with the flow running left-to-right **out** of the ward instead of **in**.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ BTY Adult Secure · Bentley Health Service          ✓ Confirmed today 07:42    │
│                                                                               │
│   3 beds you can fill today                                                   │
│   Only 1 will take a man. Only 1 can be watched one-to-one.                   │
│   Since yesterday: 2 discharged, 1 pulled, 3 dates moved.                     │
├────────────┬──────────────────────────────────────────────┬───────────────────┤
│ ◉Referrals │             17 beds                          │  SELECTED         │
│ ○Discharges│                                              │                   │
│            │   ▩ ▩ ▩ ▩ ▩ ▩ ▩ ▩                            │  Day 34           │
│ waitlist   │   ▩ ▩ ▩ ▩ ▩ ▨ ▨ ◍  ──╮                       │  Home: Peel       │
│  1. …      │   □ □ □                ╰──▶ Perth Metro (2)  │  Due out: Thu     │
│  2. …      │                     ╭─────▶ Peel (1)         │  9 days past      │
│ ─────────  │                                              │  Moved 4 times    │
│ new: 3     │   ▩ occupied ◍ pulled, empty ▨ leave □ ready │  Team: Peel CMHT  │
├────────────┴──────────────────────────────────────────────┴───────────────────┤
│ This ward: average stay · dates met · empty-bed time · waitlist wait          │
└───────────────────────────────────────────────────────────────────────────────┘
```

**One headline number, then the sentence that qualifies it.** Five figures across the top is what the
morning page uses for the whole state and it is too much for one ward. "3 beds you can fill today"
followed by *"only 1 will take a man, only 1 can be watched one-to-one"* is the single most valuable
line on the page: sex designation and observation capacity are the commonest reasons a bed is not a
bed, and both are already in the model.

**The right panel is never blank.** With nothing selected it answers the question people walk in
with: next bed, when, and who is top of the waitlist.

**The left column toggles** between referrals (people awaiting this ward's answer, plus the ordered
waitlist) and discharges (everyone leaving soon, soonest first, with anyone already past their date
at the top). It remembers which side was last used.

**Statistics sit at the foot, not the top.** Trend numbers above a live operational board is how a
simple page stops being simple.

### D12 — Arrows only for people approaching discharge

An arrow appears once someone has a discharge date within roughly a week, and thickens as it nears.
Typically three to six arrows on a 20-bed ward, not twenty. It reads as "this is where the next few
beds are going", which is the question the right-hand side exists to answer.

**Added 2026-08-28, after Phase 8 landed travel bands.** An arrow may now carry the travel band
between this ward and that region, and a discharge counts as out of area at three hours or more, or
air transport only. Three constraints travel with that, all of them Phase 8's own:

- **The bands are invented placeholders** and are labelled as such on screen. They are built to be
  trivially replaceable when real ones arrive.
- **Distance groups the list; it never sorts it.** An arrow may be grouped or captioned by band. A
  band must never order the beds, rank a discharge, or label one as better than another.
- **No word implying proximity** — nearest, closest, local, far, best — unless a fact the system
  actually holds backs it. This board holds a home region and a synthetic band, and nothing else.

### D13 — Select a referral and the beds answer

Selecting a person in the left column lights up the beds that could take them, and every bed that
could not says why — wrong age group, sex designation, cannot hold them involuntarily, nobody free to
watch them.

**No new matching logic.** It reuses Phase 7's `eligibility()` and produces the same gate list, so the
ward and the coordinator can never give different answers about the same person. It also delivers the
roadmap's "why not here?" (additional item 2) at ward level, ahead of Phase 8, for no extra data.

### D14 — Community team names are invented, one per region

A synthetic team name for each of the ten existing home regions, under the standing banner that says
every name and number here is invented. Same rule the site table already follows.

The system holds no real map from a region to a service and inventing one would assert something
about real services. If the owner later supplies real teams, swapping them is under an hour — the
same shape as the youth unit at Bentley, where a real fact he held replaced an invention.

### D15 — The pull states when the ward can receive

When a ward pulls someone it says when it can receive them, in one tap from a short fixed list. It is
the most useful thing transport can be told, it costs the ward one choice at a moment they are
already acting, and it stops an ambulance arriving at a ward that cannot take a handover.

**The options are owner-pending** for the same reason as D9 — how a service actually runs is a fact
he holds. Until he supplies them the field is not built. It is scheduled late and costs one array.

### D16 — Statistics: a strip per ward, one statewide page

Ward strip (at the foot of its own board) and a new statewide page comparing wards on the same
figures. The ward sees itself; the coordinator sees everyone; and a ward that produces the numbers
gets something back for producing them.

| Figure                        | Derived from                              |
| ----------------------------- | ----------------------------------------- |
| Average length of stay        | `arrivedAt` to leaving                    |
| Empty-bed time                | `pulledAt` to `arrivedAt` (D2) — new     |
| Discharge dates met           | date moved count and outcome (D4)         |
| Waitlist wait                 | accepted to pulled (D3)                   |
| Ready to leave, cannot        | blocked admissions (D9)                   |
| Long stays                    | occupancies over 3 months (D7)            |

All are ward-level. None carries anything about a person. **Empty-bed time is a number nobody
currently has** and is the transport delay, measured.

### D17 — Undo, never "are you sure"

Pull the wrong person, mark the wrong discharge: one click puts it back, and the fact that it
happened is kept, using the existing `UnwindRecord` discipline. **No confirmation dialogs anywhere on
this page.** Every dialog is friction paid on every correct action to protect against a rare wrong
one.

### D18 — Phone: the beds become a list

Ward rounds happen walking around. On a phone the grid becomes one scrollable list ordered by longest
stay first, same data, same actions. The repository's phone-chrome contract applies unchanged —
`docs/search-chrome-behaviour.md` governs, and this page owns no second composer.

### D19 — The printed page is the ward's handover sheet

It prints on one A4 sheet, like the morning page, and is designed for that job: who came in, who is
going, who is stuck, who is overdue. The board then earns its keep twice a day whether or not anyone
opens the app.

### D20 — The board replaces today's ward screen, and both roles use it

One page per ward. Everything today's ward screen does folds into it: answering a referral happens
from the left column, updating a discharge happens by clicking a bed. Nothing is lost and there is
one place to look and one place to edit.

A ward sees editable controls on its own ward and a read-only view of every other. The existing role
switcher makes this cheap.

**What is refused, permanently, and why — so a later session does not reopen it:**

| Refused                                        | Why                                                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| Any free-text field                            | One becomes the whole product within a month, and it is the rule keeping real data out    |
| Risk or acuity scores                          | Invented numbers that look clinical                                                       |
| Predicting length of stay, suggesting discharges | The ward sets a date; the system never guesses one. Showing and recommending are different products |
| Target lengths of stay per ward                | A threshold nobody agreed to, used to judge people                                        |
| Alerts that chase                              | Things go stale visibly. Nothing sends, nothing nags (roadmap 9)                          |
| Configurable layouts                            | Two wards arranging it differently quote different numbers at each other (roadmap 13)     |

---

## Failure behaviour

Conservative in every case, matching the rest of the prototype:

- **An unresolvable unit, referral or admission renders as absent, never as a substituted record.**
- **A missing discharge date renders as "no date set", never as "not yet due" and never as a
  fallback number.** Same discipline as `LegalForm.dueAt`.
- **A ward that has not confirmed today shows as not confirmed.** Never as confirmed, never blank.
- **A pulled bed with no arrival stays pulled.** It never silently frees itself.
- **An admission whose home region is not in the fixed list shows no team and no arrow**, rather
  than guessing a region or a team.
- **A blocked admission with an unrecognised reason shows as blocked with the reason unavailable**,
  never as unblocked.

## Verification

Local and offline only. No provider-backed command, ever.

- **Unit tests** for: the four-state lifecycle and the bed-lost-at-pull rule; the derivation of bed
  releases from a date; the statewide netting of ward-to-ward transfers (D8); stay banding; the
  daily-confirm staleness rule including the passed-date refusal; waitlist ordering and
  cross-waitlist withdrawal; the statistics.
- **Structural privacy tests** asserting `Admission`'s exact field set, as `Referral` and
  `BedRelease` already do.
- **DOM tests** for the board, the left toggle, the daily sheet's keyboard path, and undo.
- **A browser journey**: referral arrives → ward waitlists → ward pulls → bed shows pulled-and-empty
  → arrival → date set → date moves → discharge → bed returns.
- **Every new test is mutation-tested.** Break what it guards, watch it go red, quote the failure
  line, restore byte-identically. Seventeen tests across Phases 6 and 7 passed while the behaviour
  they named was broken. This is not optional.
- **Look at the rendered page** at 390, 820 and 1440 plus print, for every screen. Every defect that
  actually reached the screen in this project was found by looking, never by a test.
- **A reliability gate at the end**: local production build, full offline unit suite, lint, typecheck,
  formatting. The build specifically — a wrong Server/Client boundary and a missing icon entry are
  both invisible to tests.

## Success criteria

1. A ward's daily update takes under a minute on a 20-bed ward, keyboard only.
2. The bed count drops at the pull, and the morning page agrees with the board.
3. A ward-to-ward transfer nets to zero at state level.
4. No screen shows a discharge date that disagrees with another screen.
5. Selecting a referral explains every bed that cannot take them.
6. The page prints on exactly one A4 sheet.
7. No free text exists anywhere in the new records, asserted structurally.

## Risks

| Risk                                                                  | Mitigation                                                                            |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Replacing today's ward screen loses a control someone relied on        | Enumerate every existing control and where it went, before deleting anything            |
| The board becomes busy — three signals, arrows, statistics, a toggle   | One headline number; two colours; statistics at the foot; arrows only near discharge     |
| Sex on an admission is a governance widening                           | Flagged in D5 with the fallback named; owner may overrule at one module's cost           |
| The owner-pending lists (D9, D15) get filled in by an agent            | Both scheduled late; drafts labelled as drafts; no invented list may ship                |
| Deriving releases from a date breaks Phase 5's arithmetic              | The board computes no bed figure of its own; every figure comes from `capacityBreakdown` |
| Phase 7 and this work collide in the same four files                   | Hard sequencing constraint, stated at the top                                            |

## Assumptions, and what each would cost to reverse

| Assumption                                                     | If wrong                                                        |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| The bed is lost at the pull, not the arrival                    | Owner-supplied on 2026-08-28. Reversal: one predicate            |
| A ward controls its own waitlist order                          | Reversal: replace a manual order with a sort. One module          |
| One discharge date is enough; wards do not need two             | Reversal: a second field and a second column. Moderate            |
| The four stay bands are the right ones                          | Owner-supplied. Reversal: four numbers                            |
| Anonymous tiles are sufficient                                  | Reversal: add bed identity. Moderate — touches placement          |
| Invented community team names are acceptable                    | Reversal: swap the table. Under an hour                           |
| Diagnosis stays out                                             | Reversal: one field, by owner decision only                       |

## Open questions for the product owner

1. ~~The blocked-discharge reason list (D9)~~ — **ANSWERED 2026-08-28.** The owner approved it in a
   separate conversation and it shipped as the eight-entry `BED_RELEASE_BLOCKERS`. This board uses
   that list and defines none of its own. See D9.
2. **The receiving-time options at the pull (D15)** — still outstanding, not drafted; the field is
   not built until he supplies them.
3. **`sex` on an admission (D5)** — flagged as a small widening with the fallback named. Silence is
   being read as acceptance; he may overrule at one module's cost.
4. **The roadmap needs one line** placing this work relative to Phase 8. Phase 8 is now well under
   way and has landed travel bands, the home-region decision and an out-of-area definition, so this
   board is no longer "before Phase 8" as first written — it now runs **alongside or after** it and
   consumes its bands rather than preceding them. The owner decides the order.
5. **Still owed:** the bed model has never been checked by a ward clinician. It has now been revised
   once (four stages to three plus a flag) on the owner's own decision, which is evidence the design
   goal is working — the revision cost this design nothing, because it was still on paper. The
   clinician check remains the cheapest, highest-value validation available.

---

## Decisions taken during the build, 2026-08-29

Both arose because an implementer refused to invent something and flagged the gap instead. Both were
put to the owner and answered the same day. Recorded here rather than in chat, because the recurring
failure in this project is a decision that lived only in a conversation.

### DB-1 — The waiting clock starts when the referral was raised

"How long do people wait for a bed at this ward" measures from **`Referral.raisedAt`** — the moment
the person was first referred anywhere — not from when this ward accepted them onto its list.

Owner's choice, and it needs **no new field**: that instant is already recorded. It measures the
whole wait, including the part before any ward had said yes, which is usually the part that matters.

**What must travel with it:** `ward-statistics.ts` currently returns `null` for this figure because
it is given only `Admission[]`, which carries no waitlist-start instant. Its signature must widen to
take the referrals as well. That is a real change to a module already built and tested — it is not
a hole to be filled by adding a field to `Admission`.

The honest cost of this choice, stated because a later reader will ask: the figure includes delay a
ward could not have prevented, so it must never be presented as that ward's own performance. It is
the patient's wait, not the ward's score.

### DB-2 — Confirming a discharge is a separate, deliberate act

A discharge date is a **plan**. Confirming is a **decision**. They are different facts and the
record now holds both.

`Admission` gains `dischargeConfirmedAt: Instant | null` and `dischargeConfirmedBy: string | null`
(a **role**, never a personal name — roadmap decision 8). The permitted-field list therefore moves
deliberately, and `tests/ward-admission-model.test.ts`'s structural assertion must be widened on
purpose, not incidentally — the same discipline `Referral` held to when it went from three fields to
five.

**This is not a widening of what is held about a person.** It is a fact about the ward's own
decision, in the same category as `dischargeDateSetBy`. The governance rule that makes a widening a
governance decision covers facts about the patient; this is not one.

**What it unblocks:** D4's `confirmed` stage was unreachable. An implementer building the release
derivation found it could only ever emit `predicted` or `released`, because nothing on the record
distinguished a plan from a decision — and it **declined to invent a proxy** (a date within some
window, or a move count) on the grounds that it would render a decision nobody made. That was the
right call and it is why this field exists. `derivedBedReleases` must now emit `confirmed` from this
field and from nothing else.

**Still not approved:** every derived prediction currently reports its `waitingOn` as
`"Nothing outstanding"`, the most conservative value available. Nobody has reviewed that default.

### DB-3 — The ward states its sex-acceptance numbers daily; the system does not derive them

**D11's headline sentence was specified against a model that cannot produce it, and building it proved
so.** The spec's example reads "Only 1 will take a man". `Unit.sexDesignation` is a single value for
the **whole unit**, so sex acceptance is all-or-nothing and the only reachable output was "**None**
will take a man". The situation the line existed to surface — *three beds free, but they are all in
the male bay* — was not expressible at all.

Three options were put to the owner: a ward-stated daily number, per-bed designations, or leaving the
whole-ward property alone. **He chose the ward-stated number.**

The reasoning is worth keeping: the charge nurse knows this and the system never will. Bay
arrangements shift, and a per-bed designation that is stale on the board is worse than no designation
at all — the same argument that keeps this prototype's bed numbers out of the model (D6).

**What the ward states, once a day, on the sheet it already opens:** of its free beds, how many will
accept a woman and how many will accept a man. **These two numbers overlap** — an undesignated bed
counts in both — so they are two independent counts, not a split of one total. Neither may exceed the
free-bed count, and that must be validated rather than assumed.

**Where it lives — and this matters for parallel work.** It does NOT go on `Unit`, which lives in
`ward-model.ts` and belongs to the Phase 8 session. It goes in a new record of its own, the ward's
**daily return**: the unit, the two counts, `confirmedAt`, and `confirmedBy` (a role). That record is
also the natural home for D10's daily-confirm freshness, which until now had no place to live.

**The honest cost, stated because it cuts against a principle held everywhere else here.** This is a
**typed** number, not a derived one, and this design has otherwise been removing typed numbers
wherever it can (DB-2's `derivedSexMix` replaces exactly such a count). Two guards make that
acceptable rather than a quiet regression:

1. **It is validated against a derived figure** — neither count may exceed the free-bed total, which
   the system does know.
2. **It goes stale like everything else on the daily sheet** (D10). A ward that has not confirmed
   today has numbers that stop claiming to be current, on its own board and on the coordinator's.

`acceptingBedCounts` (`ward-board-derivations.ts`) already exists and derives from
`Unit.sexDesignation`. It must be reworked to read the daily return, falling back to the whole-ward
designation only when no return has been made — and saying so, never silently substituting one for
the other.
