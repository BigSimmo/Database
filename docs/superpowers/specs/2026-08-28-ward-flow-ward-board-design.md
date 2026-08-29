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

| Landed                                                               | Consequence here                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------- |
| The bed model became **three stages plus a flag**                    | D4 rewritten; `blocked` is never a state on this board      |
| `BedRelease.confidence` → **`waitingOn`** (`BED_RELEASE_WAITING_ON`) | Any `confidence` reference in this design is stale          |
| **`BED_RELEASE_BLOCKERS` owner-approved at eight entries**           | D9's draft withdrawn; this board defines no list of its own |
| **`BED_PREPARATION_NOTES` filled**                                   | A new tile caption — and a trap, see D7                     |
| Phase 8's **travel bands, home region, out-of-area definition**      | D12's arrows may carry a band, under Phase 8's rules        |

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

| Exists                                                                                                                   | How this work uses it                                                                |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `Unit` — beds, empty, allocatable, held, blocked, `sexMix`, `speciallingCapacity`, four bed dimensions                   | The board renders from it. `sexMix` becomes derived rather than hand-maintained (D5) |
| `Movement` — a person travelling to a ward, ending at `arrived`                                                          | The movement's arrival is what creates an admission (D2)                             |
| `Referral` (Phase 7) — the front door, five person-facts, three outcomes                                                 | The left column's referral side. Extended with the ward waitlist (D3)                |
| `BedRelease` — **three stages** (`predicted`/`confirmed`/`released`), `expectedAt`, `waitingOn`, and `blocker` as a FLAG | Derived from the discharge date (D4). Not written by hand any more                   |
| `LeaveBed` — a bed whose occupant is on approved leave, usable or not                                                    | A tile state on the board. Unchanged                                                 |
| `eligibility()` / matching (Phase 7)                                                                                     | Powers "select a referral and the beds answer" (D13). No new matching logic          |
| `WardFreshness` + refresh-requested                                                                                      | The daily-confirm staleness signal (D10). Same mechanism, new trigger                |
| `UnwindRecord`                                                                                                           | Undo (D17). Same discipline                                                          |
| `capacityBreakdown()` / `ward-morning-rollup.ts`                                                                         | Untouched arithmetic. The board must never compute a bed figure of its own           |

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

| State        | The bed is | The person is                       |
| ------------ | ---------- | ----------------------------------- |
| `waitlisted` | free       | accepted by this ward, elsewhere    |
| `pulled`     | **gone**   | still elsewhere, awaiting transport |
| `occupied`   | gone       | in the bed                          |
| `left`       | free       | gone                                |

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

| Ward says                   | Bed release becomes                                        |
| --------------------------- | ---------------------------------------------------------- |
| a date is set               | `predicted`, carrying `waitingOn`                          |
| confirmed as going          | `confirmed`, carrying `waitingOn`                          |
| ready to leave, cannot (D9) | **a `blocker` flag on the predicted OR confirmed release** |
| gone                        | `released`                                                 |

**`blocked` is no longer a stage and must never be treated as one.** It is a flag
(`blocker` + `blockedBy`, a role) sitting on a release that stays predicted or confirmed. The defect
that forced this is exactly the one this board could reintroduce: `capacityBreakdown` sorted today's
releases into confirmed or predicted _by state_, so a release in state `blocked` matched neither
branch and was counted **nowhere** — marking a confirmed discharge blocked dropped the ward's
confirmed count with nothing saying why, so the figures improved at the moment the ward got stuck.

Two rules follow, and both are load-bearing on this board:

1. **A blocked-but-confirmed bed keeps counting as confirmed.** Blocking never removes a bed from a
   count.
2. **The "ready to leave, cannot" headline (D9) is a cross-cut, never a bucket taken out of the
   others.** It counts releases carrying a blocker, and those same releases are still counted in
   confirmed or predicted. A board that subtracts it has reintroduced the defect.

**`confidence` is gone.** A predicted release no longer says how _certain_ the ward is; it says what
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
sex-mix column no longer refreshing automatically) and **explicitly approved carrying it on
2026-08-29** — put to him as a direct question, answered yes, with the removal of a hand-maintained
count named as the reason. This is no longer inferred consent. If he ever reverses it, the fallback
is a one-module change.

### D6 — Beds are tiles, not numbered beds

The board draws the right number of beds and fills them in a stable order. It makes no claim about
which physical bed anyone is in.

Owner's decision. Real ward bed numbering is idiosyncratic and is one more thing that can be wrong on
a board. Everything the page needs — days occupied, colours, arrows, the sex-mix arithmetic — works
without it. **Consequence, stated honestly:** the board can say nothing about where a bed physically
is, or about sides of a ward.

### D7 — The tile carries three signals, on three different channels

| Channel     | Fact                                                          |
| ----------- | ------------------------------------------------------------- |
| **Fill**    | how long the person has been there, in the owner's four bands |
| **Outline** | past their own expected discharge date                        |
| **Number**  | days, written out                                             |

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
   "Awaiting maintenance or repair") is a note _on an available bed_: it is still offered, still
   counts in `availableNow`, and still appears in every figure. The obvious implementation — a
   distinct tile state that reads as unavailable — silently removes beds from the state's supply.
   The note is a caption on a ready bed, not a state instead of ready.
2. **Blocked is a flag, not a tile state of its own.** The person is still in the bed and the bed is
   still occupied; the blocker sits on their pending release. A tile shows occupied _and_ carries
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

**The one place friction is added deliberately:** _nothing has changed_ cannot be pressed over a date
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
followed by _"only 1 will take a man, only 1 can be watched one-to-one"_ is the single most valuable
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

| Figure                 | Derived from                         |
| ---------------------- | ------------------------------------ |
| Average length of stay | `arrivedAt` to leaving               |
| Empty-bed time         | `pulledAt` to `arrivedAt` (D2) — new |
| Discharge dates met    | date moved count and outcome (D4)    |
| Waitlist wait          | accepted to pulled (D3)              |
| Ready to leave, cannot | blocked admissions (D9)              |
| Long stays             | occupancies over 3 months (D7)       |

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

| Refused                                          | Why                                                                                                 |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Any free-text field                              | One becomes the whole product within a month, and it is the rule keeping real data out              |
| Risk or acuity scores                            | Invented numbers that look clinical                                                                 |
| Predicting length of stay, suggesting discharges | The ward sets a date; the system never guesses one. Showing and recommending are different products |
| Target lengths of stay per ward                  | A threshold nobody agreed to, used to judge people                                                  |
| Alerts that chase                                | Things go stale visibly. Nothing sends, nothing nags (roadmap 9)                                    |
| Configurable layouts                             | Two wards arranging it differently quote different numbers at each other (roadmap 13)               |

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

| Risk                                                                 | Mitigation                                                                               |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Replacing today's ward screen loses a control someone relied on      | Enumerate every existing control and where it went, before deleting anything             |
| The board becomes busy — three signals, arrows, statistics, a toggle | One headline number; two colours; statistics at the foot; arrows only near discharge     |
| Sex on an admission is a governance widening                         | Flagged in D5 with the fallback named; owner may overrule at one module's cost           |
| The owner-pending lists (D9, D15) get filled in by an agent          | Both scheduled late; drafts labelled as drafts; no invented list may ship                |
| Deriving releases from a date breaks Phase 5's arithmetic            | The board computes no bed figure of its own; every figure comes from `capacityBreakdown` |
| Phase 7 and this work collide in the same four files                 | Hard sequencing constraint, stated at the top                                            |

## Assumptions, and what each would cost to reverse

| Assumption                                          | If wrong                                                 |
| --------------------------------------------------- | -------------------------------------------------------- |
| The bed is lost at the pull, not the arrival        | Owner-supplied on 2026-08-28. Reversal: one predicate    |
| A ward controls its own waitlist order              | Reversal: replace a manual order with a sort. One module |
| One discharge date is enough; wards do not need two | Reversal: a second field and a second column. Moderate   |
| The four stay bands are the right ones              | Owner-supplied. Reversal: four numbers                   |
| Anonymous tiles are sufficient                      | Reversal: add bed identity. Moderate — touches placement |
| Invented community team names are acceptable        | Reversal: swap the table. Under an hour                  |
| Diagnosis stays out                                 | Reversal: one field, by owner decision only              |

## Open questions for the product owner

1. ~~The blocked-discharge reason list (D9)~~ — **ANSWERED 2026-08-28.** The owner approved it in a
   separate conversation and it shipped as the eight-entry `BED_RELEASE_BLOCKERS`. This board uses
   that list and defines none of its own. See D9.
2. **The receiving-time options at the pull (D15)** — still outstanding, not drafted; the field is
   not built until he supplies them.
3. ~~**`sex` on an admission (D5)**~~ — **ANSWERED 2026-08-29.** Explicitly approved, not inferred.
   Recorded here late: this page continued to say "silence is being read as acceptance" for several
   hours after he had answered, and another session reading it correctly re-raised a settled decision
   as an open governance question. **A stale document is not a neutral document** — it actively
   manufactures work and re-opens things the owner has closed.
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
will take a man". The situation the line existed to surface — _three beds free, but they are all in
the male bay_ — was not expressible at all.

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

---

## Build-phase decisions, 2026-08-29

Taken with the owner after the calculation layer was finished and before any screen was built.

### DB-4 — How the screens get built (approved: 1, 2, 3; declined: 4)

**Something ugly on screen in the first hour.** One ward, real seeded data, no styling — before any
component is built properly. The calculation layer reached 109 tests with nothing anyone could look
at; that shape was correct for work running beside another session and must not carry into the
screens. Every defect that ever reached a page in this project was found by rendering it and looking,
never by a test.

**The daily sheet is built FIRST among the screens, not in the middle** where the plan had it.
Everything on the board depends on wards actually updating it, so if it is not genuinely under a
minute for a twenty-bed ward the board is decoration. **Time it with a stopwatch against the seeded
fixture**, early, while it is cheap to change — not in principle, and not at the end.

**The print layout is built alongside the screen, not after it.** Phase 6 shipped a sheet that
promised one page and printed five, and it was found at the end. Page count is checked with the
capture tool at every step.

**DECLINED for now: the blocked-discharge figure on the morning page.** It was offered as the number
that changes conversations, on the page people print. The owner left it. That page is deliberately
fixed and has already gained one figure this programme; a third is a real decision and he has not
made it. The figure stays on the ward board and the statistics page. **Do not add it to the morning
page without a recorded decision.**

### DB-5 — "What moved since I last looked" (approved, and the owner singled it out)

A coordinator opening twenty wards does not want twenty boards; they want the handful of things that
changed. Entirely derived — no new record, nothing extra for a ward to enter.

It is NOT the same as the board's own "since yesterday" line, which is one ward orienting its own
staff. This is the coordinator's cross-ward view: which wards have new discharges, new pulls, newly
blocked beds, or dates that slipped, since that coordinator last looked.

**Note the constraint that shapes it:** "since I last looked" is per-person state, and this prototype
holds no per-person state and no accounts. So it is scoped to the session, or to a chosen point
(since the morning handover, since yesterday) — never to a stored per-user timestamp. Choosing the
simpler of those is preferable to inventing a user model.

### DB-6 — The transport officer screen answers one question

**The owner's scope, and it narrows what was previously assumed:**

> "The transport officer only is about letting them update when they are about to start a job and
> also see when a patient can be picked up or dropped off to the ward."

That is the whole screen. It is a **task surface, not an information surface**, and the distinction
matters: an earlier recommendation put the empty-bed-time statistic here as a prompt. **That was
wrong and is withdrawn.** Empty-bed time is a flow measure for the coordinator and the statistics
page; an officer with a van does not need a management figure, they need to know which job they can
start.

**The one question the screen answers: which of my jobs can I start right now, and if not, why not.**

Two windows govern every job, and they come from opposite ends:

| Window       | Stated by                                            | Meaning                           |
| ------------ | ---------------------------------------------------- | --------------------------------- |
| **Pickup**   | the origin (emergency department or site)            | when the person can be collected  |
| **Drop-off** | the receiving ward, **at the moment it pulls** (D15) | when the ward can take a handover |

**A job is startable when both windows are open.** That derived fact is the screen's entire content,
and it is what closes the failure this exists to prevent: an ambulance arriving at a ward that cannot
take a handover.

Three groups, in this order: **can start now** · **not yet** · **in progress**. A row in "not yet"
must say **which window is shut and until when** — an officer told only "not yet" will ring the ward,
which is the phone call the screen exists to remove.

Actions are the transitions the model already carries (`TransportJob`: `acceptedAt`, `enRouteAt`,
`collectedAt`, `arrivedAt`). The officer's primary act is **starting** a job; the rest follow. One tap
each, no forms, and undo rather than confirmation dialogs (D17).

**What this screen must NOT become:** a bed board, a statistics page, or a place where an officer is
shown how long beds have been empty. Every one of those is someone else's screen, and this one has a
person standing next to a vehicle.

**Dependency:** the drop-off window requires D15's receiving-time list, still owner-pending. Until it
arrives the screen can be built showing pickup only, with the drop-off column stated as not yet
recorded — never blank, and never implying the ward has said "any time".

### DB-7 — A rolling 24 hours, not "before tonight" (OWNER, 2026-08-29)

> "you operate on 24 hour 24/7 clock as patients can be moved at any time."

The horizon for "is this discharge near enough to count" becomes **a rolling 24 hours from now**,
replacing the fixed end-of-evening cutoff.

**The original reasoning survives:** beyond roughly a day a discharge prediction is a guess, so a
horizon is right. What was wrong was its shape. A cutoff at a fixed time of day **shrinks as the day
goes on** — fourteen hours at the 08:00 handover, two hours at 22:00 — which is an artefact of the
clock rather than a statement about how far ahead anyone can predict. Patients move at 3am.

**The excluded count stays.** It is the safety valve that shows when the horizon is too short, and it
is more useful under a rolling window, not less.

**WHERE THIS ACTUALLY LANDS, checked rather than assumed.** It was relayed as a change to the ward
board. It is not. Neither `ward-discharge-dates.ts` nor `ward-board-derivations.ts` carries an
end-of-day cutoff — the arrow horizon is already rolling, and the discharge-date module explicitly
defers all bucketing rather than repeating it. The shrinking window is **one comparison in
`ward-bed-availability.ts`** (`release.expectedAt > EVENING_SHIFT_END_MINUTES`), a shared,
pre-existing file that predates both current branches.

**So this is not a tidy-up. `capacityBreakdown` feeds the morning page**, and the morning page is
fixed, printable, and the artefact the whole programme exists to put in front of colleagues. Widening
the window **raises its predicted-discharge figure** — not because any ward improved, but because the
window grew.

**The owner was told that explicitly and confirmed: one clock everywhere, and the morning page moves
with it.** Two screens counting the same thing differently is the failure he has refused at every
other decision point, and it is not worth avoiding here.

**Required with it:** the change and its date are stated on the morning page the first time it shows
the new figures, so nobody reads a widened window as a service that suddenly got better at
discharging. A figure that jumps with no explanation is how a number gets quoted in a meeting and
then disbelieved.

**Sequencing:** do this at the fold, deliberately, with the morning page's figures re-derived and
looked at — not squeezed into either branch mid-phase. It touches a shared file and a printed page.

### DB-8 — The leave-bed usable flag is multi-role, and an override is recorded (OWNER, 2026-08-29)

> "the wards decide if leave bed is usable but also can be overridden by coordinator or treatment
> team as well, all have control."

Whether a bed whose occupant is on leave can be filled is set by the ward, and **the coordinator and
the treatment team may override it**. All three roles have control.

**This modifies one previously settled rule and leaves the rest standing.** "Only the ward may move a
bed between stages; the coordinator sees and does not change" **still holds for the stages**. It is
the leave-bed usable flag alone that becomes multi-role.

**An override is RECORDED as an override** — the current answer, plus the fact that it was overridden,
by which **role** (never a person) and when. Owner's decision, put to him rather than assumed.

The reason, and it is the same one this design has applied everywhere: **two roles disagreeing about
whether a bed someone is returning to can be filled is a real clinical fact**, and a silent
replacement destroys it. A ward that opens its own board and finds a decision it did not make, with
nothing saying who made it, is a ward that stops maintaining the board — which costs more than the
override was worth.

**Unchanged and no longer open:** a role and a timestamp are enough provenance to trust a figure; and
leave beds stay counted separately and are **never** mixed into the available figure.

### DB-9 — The three approved lists are liable to change (OWNER, 2026-08-29)

Recorded, not acted on. The owner has agreed the three lists as they stand but expects them to become
more specific and to gain or lose entries. **"Leave as is for now."**

The verbatim rule is **unchanged**: no agent may tidy, shorten, reorder or remove an entry. This
records only that a revision is anticipated — consistent with the predicted-discharge list already
being flagged as the one most needing a clinician's own words.

### DB-10 — The printed morning sheet is current at the moment it is printed (OWNER, 2026-08-29)

**Printing takes the live picture and leads with the time it was taken.** The on-screen fixed view
stays frozen at the 08:00 handover, because that is what a handover meeting wants.

**This narrows Phase 6's D5 and D6 rather than reversing them.** D3 settled that the morning page is "fixed at
the morning handover, with a live view one click away", and the reasoning was that a page which holds
still can be printed, pinned up and argued over. Both views already exist (`MorningView = "fixed" |
"live"`). What changes is only which one the **print path** takes.

**The original reasoning survives, because a printed sheet still holds still — it is paper.** Nothing
moves once it leaves the printer. The oddity being removed is that a sheet printed at 15:00 currently
shows the morning's numbers, which is a stale artefact rather than a stable one.

**What is genuinely lost, and the safeguard that covers it.** Today everyone who prints gets the
_same_ sheet. Under this change, someone printing at 08:14 and someone printing at 15:22 hold sheets
with different figures and could disagree without knowing why — which is precisely the failure D3
existed to prevent.

**The timestamp is that safeguard, and it only works if it is prominent.** It goes in the **heading**,
not the footer, and it is read as part of the title rather than as provenance small print. Two sheets
saying `08:14` and `15:22` are then visibly two moments rather than two competing claims. **A
small-print timestamp does not discharge this requirement** — if it can be missed, the safeguard is
not present and P6-D6's concern returns in full.

**It must carry the DATE as well as the time, and the reason is this decision's own argument turned
back on it.** The case for printing live is that a printed sheet still holds still, because it is
paper. Paper also **persists past the day it was printed**. A sheet stamped `15:22` and pinned to a
wall is read again at 09:00 the next morning, and at that moment the stamp distinguishes nothing — it
reads as "today at 15:22", which has not happened yet. Two sheets an hour apart are visibly two
moments; two sheets a day apart, stamped with time only, are indistinguishable. That is P6-D5's failure
returning through the single door a time-only stamp leaves open. **Date and time, both in the
heading.**

**It supersedes the change notice DB-7 required.** DB-7 asked for a line on the page explaining that
the 24-hour window had widened, so a jumped figure would not read as wards discharging better. With
every sheet stamped with its own moment, a sheet from before and a sheet from after are visibly
different snapshots and the widening shows as what it is. **Build DB-10 and the notice is not needed;
build DB-7 alone and it still is.**

**Sequencing: at the fold, together with DB-7, and looked at once.** Both touch the same page —
`morning-page.tsx` and `ward-bed-availability.ts` — which is owned by the Phase 8 branch, so neither
can be built before the merge. Doing them as one piece of work with a single visual pass is cheaper
than twice, and this is a change whose whole risk is what a person reads off a sheet rather than what
a test asserts.

### DB-11 — The frozen view is dropped. Everything is live, on screen and on paper (OWNER, 2026-08-29)

**This reverses Phase 6's D5 and D6 outright, and it was chosen with the cost stated.** Not narrowed, not
qualified — the fixed 08:00 view goes, and the page is live everywhere.

**What P6-D5 and P6-D6 were protecting, so nobody restores the frozen view later believing it was
lost by accident:** a page that
holds still can be printed, pinned up and argued over, and the numbers do not move while a handover is
discussing them. That concern was real and remains real. **The owner was shown it as the explicit cost
of this option and took it anyway.** Do not reinstate the freeze without a recorded decision from him.

**Why the trade is defensible.** Freezing solved a problem the timestamp also solves, and solved it by
introducing a second one. A frozen sheet printed at 15:00 showing the morning's figures is stale, and
staleness on a bed board is the failure mode this whole programme exists to prevent — nothing
predicted, held or on leave may ever read as available now, and a figure eight hours old is the same
class of untruth. One live picture, stamped with the moment it was taken, cannot disagree with itself.

**What must travel with it:**

1. **The stamp is now load-bearing on screen too, not only on paper.** A live figure with no visible
   "as at" is indistinguishable from a stale one — the same reason the printed stamp carries date and
   time. It updates as the figures do.
2. **This is a deletion, and the dead-code discipline applies.** `MorningView`, `FrozenMorning`,
   `morningHandoverInstant`, and Phase 6's frozen-view tests are all removed, not orphaned. Run
   `npm run check:dead-code-candidate` and enumerate every removed symbol — Phase 6 built that view
   carefully, including its null propagation when handover has not yet happened, and its tests must be
   deleted deliberately rather than left passing against nothing.
3. **`MORNING_HANDOVER_MINUTES` may survive its view.** Check whether anything else reads 08:00 before
   removing it; the discharge and capacity surfaces may.
4. **The page's name is now wrong, and that is a separate decision.** It is reached at `/morning` and
   called the morning page, but it is no longer pinned to the morning — it is the live bed-state page.
   Flagged, not renamed: a route rename touches nav, reachability and the site map, and it is not
   worth bundling into this. **Owner decision when convenient.**

**Sequencing: at the fold, with DB-7 and DB-10, one visual pass covering all three.** They touch the
same page and the same file, and the risk in every one of them is what a person reads off a sheet
rather than what a test asserts.

### DB-12 — "Live" is not the wall clock, and the stamp must read the same instant the figures do

**A correction to DB-10 and DB-11's safeguard, found by the Phase 8 session before either was built.**

Every Ward Flow screen takes its `now` from the shared provider, **not from the system clock**, and a
demo time control moves it. So a "live" page is not live in the ordinary sense — it is **as at
whatever the control says.**

**The failure this creates lands exactly where the safeguard was placed.** If the stamp reads the wall
clock while the figures read the provider, the sheet asserts a moment that is not the moment being
shown — in the heading, which DB-10 deliberately made the load-bearing element. Someone scrubs the
control to the evening, prints, and holds a sheet stamped with the real time and figures from a
different one. **A stamp that can lie is worse than no stamp**, because DB-11 removed the freeze on
the strength of it.

**The rule: the stamp reads the same instant the figures read.** One line, and invisible to every test
that does not move the control — which is most of them. **A test must move the time control and assert
the stamp moved with it.** Without that test this is a one-character regression away at any point.

This is also why the demo control must never become a second clock: two notions of "now" on one page
is the same defect one layer down.

### DB-13 — The dead-code gate will probably refuse DB-11's deletion. Do not tune it.

`npm run check:dead-code-candidate` fails closed on precisely this shape, and DB-11 hits at least
three of its refusal conditions: `MorningView` and `FrozenMorning` will be **named in a Phase 6
plan/spec whose task boxes are unchecked**, they are **pinned by committed tests** (the frozen-view
tests, by definition), and they may appear as **string literals** somewhere under `src`/`tests`.

**The refusal is correct behaviour, not an obstacle.** A cleanup sweep in this repo targeted ~1,644
lines on a "nothing imports it" basis and was walked back seven times; four survivors had zero
importers and were all alive.

**Do not tune the threshold or the refusal list to make this diff pass.** The honest route when it
refuses is a recorded decision — _this symbol is deliberately dead because the owner reversed D3 on
2026-08-29_ — not a gate change. Run it **early**, not at the end, and `git fetch --deepen=2000`
first: on a shallow clone it can date nothing and its judgement is weaker than it looks.

### DB-14 — The receiving-time options (OWNER-APPROVED, 2026-08-29)

When a ward pulls a patient it states, in one tap, when it can take the handover. The transport
officer sees it as the drop-off window (DB-6).

```
Any time
Business hours only
Not overnight
After the afternoon handover
Tomorrow, not today
```

**Provenance, stated precisely because it differs from the other approved lists.** These five were
**drafted by this session and approved by the owner**, not supplied by him in his own words — unlike
`BED_RELEASE_BLOCKERS`, `BED_RELEASE_WAITING_ON` and `BED_PREPARATION_NOTES`, which are his. He was
offered the alternative of writing them himself and chose the drafts.

**What that changes and what it does not.** The verbatim rule applies exactly as it does to the other
three: no agent may tidy, shorten, reorder or remove an entry. But the confidence behind these five is
lower — they are a plausible vocabulary rather than an observed one, and **the first clinician or
coordinator to read them is likely to correct at least one.** Expect that rather than defending them.

**Implementation:** a fixed runtime array with a membership check, like every other vocabulary here.
The field is set at the pull and nowhere else. Until a ward has stated one, the officer's drop-off
column reads **"not yet recorded"** — never blank, and never implying the ward said "any time"
(DB-6). Silence and a stated window are different facts, the same distinction DB-2 draws for
"Nothing outstanding".

**This closes the last owner-pending item on the ward board.** The two remaining open items are the
clinician check (held at his instruction until this phase closes) and the roadmap's ordering line.

---

### CORRECTION, 2026-08-29 — DB-10 and DB-11 cited the wrong decision, and the error was dangerous

**DB-10 and DB-11 said they narrowed and then reversed "Phase 6's D3". They do not touch D3 at all.**
Corrected above. Found by a third session reading all three; verified here against the Phase 6 spec
before accepting.

**What D3 actually says, quoted:**

> ### D3 — Five figures, one vocabulary, and the exclusion count stated aloud
>
> **Available now · Confirmed today · Predicted today · Held · Leave (usable)**
> Never summed, never combined, never relabelled.

**That is a clinical-safety rule about not misrepresenting bed availability, and DB-11 said it was
reversed outright.** An implementer following DB-11 literally would have been authorised to sum,
combine or relabel the bed figures — the precise misrepresentation this prototype exists to prevent.
Nothing had been built from it yet; the damage was potential.

**What the two decisions actually reach:**

- **P6-D5** — _"Fixed at the morning handover" means frozen to a named instant, not frozen to
  page-open._ Chosen so that "everyone who opens it that day sees the identical page." **DB-11
  reverses this.**
- **P6-D6** — _The live view is one click away, and cannot be mistaken for the fixed one_, and it
  "never prints without saying which view it is." **DB-11 removes the two-view control; DB-10's
  print stamp is the surviving descendant of D6's last clause** and must be read as inheriting it.

**D3 is untouched and stays in force.** The five figures, their order, their words, never summed,
never combined, never relabelled — at service, hospital and unit level.

**How the error happened, because it will otherwise recur.** I cited from a memory of what a decision
was _about_ rather than from its text, and never opened the Phase 6 spec while writing three
decisions that claimed to modify it. The reader's rule catches this at zero cost:

> **Quote the prior decision's own words when reversing one. If those words are not in the decision
> you cited, you cited the wrong one.**

Every ward-flow spec numbers its decisions `D1…Dn` independently, so `D4` through `D9` each name five
different decisions across the phases. **Cite by namespaced id — `P6-D5`, never a bare `D3`.**

### DB-10's on-screen half is SUPERSEDED by DB-11

DB-10 opens by saying the on-screen fixed view stays frozen at 08:00. **DB-11 then removes the frozen
view entirely.** DB-10 carried no superseded marker, and DB-11 mentioned it only in a sequencing line.

**Someone implementing the print work reads DB-10 first**, because it is the one with "printed sheet"
in its title, and would build a frozen view DB-11 deletes.

**Live half of DB-10 — still in force:** printing takes the live picture; the stamp carries **date and
time** in the **heading**, not the footer; a small-print stamp does not discharge the requirement; and
per DB-12 the stamp reads the same instant the figures read, never the wall clock.

**Superseded by DB-11:** every sentence about an on-screen fixed view, a 08:00 freeze, or a two-view
control. There is one view and it is live.

### DB-15 — The override free-text box goes, and four reasons replace it

**Two things, and only the first is urgent.**

**1. Remove the free-text box. It is making a false claim.** `shortlist-panel.tsx` holds the
coordinator's override reason in component state (`useState("")`), passes it to `setOverrideRecord`
— also component state — and **never to any dispatch**. It is discarded when another patient is
selected. Meanwhile `ward-management-modes.tsx:859` tells the reader:

> "Users can select an alternative, **record an override reason** and see which gate changed the
> ordering."

**It is not recorded.** The contrast that settles it as an omission rather than a design choice:
`RELEASE_HOLD` and `CANCEL_TRANSPORT`, on the same screen, both pass their `reason` through to the
reducer. Only the override does not. So a governance-facing description asserts the system keeps
something it throws away — and it is simultaneously the last free-text field on a referral surface.

**2. Four reasons replace it, not five.** Two sessions independently proposed a fixed list; one
named five. **Each was tested against the model rather than accepted:**

| Reason                                              | Backed by                                |
| --------------------------------------------------- | ---------------------------------------- |
| An agreed mismatch — more restrictive than required | `restrictionNotice`                      |
| Clinical urgency                                    | `URGENCY_LEVELS`                         |
| Out-of-date bed information                         | capacity freshness (`staleAfterMinutes`) |
| Closer to home                                      | `homeRegion`, and Phase 8's travel bands |
| ~~Continuity with a previous admission~~            | **NOTHING.** Dropped                     |

**Why the fifth is dropped rather than kept as a human's stated reason.** It is real practice and it
is not invented clinical vocabulary — but the model holds **no concept of a previous admission at
all**: `Admission` links to the referral that produced it and to nothing before it, and no
readmission, prior-stay or admission-history field exists anywhere in `ward-management`.

The precedent is this project's own and it is decisive: **a bed could be declined "out of catchment"
while the system held no catchment for anybody**, and that was treated as a defect worth closing
rather than an acceptable human-stated reason. A reason nobody can check, display, or count is the
same shape. Offering it would mean a coordinator recording something the prototype can never show
back.

**It is cheap to add later, and the owner may want it.** Give `Admission` a link to a prior
occupancy and the reason becomes backed; the list is a fixed array and gains one entry. Recorded as
a gap rather than a refusal.

**What is kept either way:** who overrode, as a **role**, and when. Per DB-8 and P5-D8 that is
sufficient provenance, and no optional note is added alongside the picker — an optional free-text
field is the same field with a softer name.

**Scope:** `shortlist-panel.tsx` and `ward-management-modes.tsx` both belong to the other branch.
This decision is recorded here and implemented at the fold, not by this session.

### DB-15 SUPERSEDED — the owner confirmed FIVE reasons, 2026-08-29

**His list, verbatim:**

```
Receiving team agreed despite the mismatch
Clinical urgency outweighs it
Bed information known to be out of date
Continuity with a previous admission
Closer to home or family
```

**The four-reason version above is superseded by this and is recorded, not deleted**, because the
reasoning it carries is still the test any future addition must pass.

**Confirmed with him directly rather than taken from a relay.** The relay contradicted an instruction
he had given in the other conversation an hour earlier ("go ahead with your recommendations", where
the recommendation was four), and a peer message is not owner approval — the discipline this
programme established today, when the Phase 8 session refused a relay of mine on exactly that basis
and was right to.

**The objection I raised is overruled, and stays on the record.** Nothing in the model holds a
previous admission, so _"continuity with a previous admission"_ is a reason the system can never
check, count, or display evidence for — unlike the other four, each of which is backed
(`restrictionNotice`, `URGENCY_LEVELS`, capacity freshness, `homeRegion`). **He knows it is a real
clinical reason and the model does not.** That is his call to make and it is the right way round:
the model's silence is a gap in the model, not evidence about practice.

**The gap stays cheap to close.** Give `Admission` a link to a prior occupancy and the fifth becomes
backed like the rest.

### DB-16 — There is never an "other, please specify"

**Not now and not later.** A free-text escape hatch beside the picker is free text returning through
the back door, and it would undo the decision entirely — the box is being removed precisely because
it is the last free-text field on a referral surface.

**The owner accepted a real cost knowingly:** a coordinator whose actual reason is not on the list
must pick the nearest one. That is a worse record of that one override, and it is the price of the
guarantee that no patient's words, and no author's summary of them, can ever land here.

**Growing the list is an owner decision. Adding an escape hatch is not available to anyone.** If the
five turn out to be too few, the answer is a sixth entry he supplies, never a text box.

### Owed at the fold, recorded so it is not lost

- **The board route is an orphan.** `/mockups/ward-flow/board/[unitId]` has **zero inbound references
  anywhere in `src`**, and route reachability excludes every `/mockups` route — **so nothing fails.**
  It is a temporary route by design, but it must gain a nav entry or a documented
  `WARD_NAV_INTENTIONALLY_UNLISTED` reason at the fold. `ward-nav.ts` belongs to the other branch.
- **A correction worth carrying:** the button-wiring lint rule **does** apply to
  `src/components/ward-management/**` — its exemption covers four patterns and that is not one of
  them. An earlier claim that Ward Flow was exempt was wrong, checked against `eslint.config.mjs`
  rather than the documentation. **Do not spend visual-pass time auditing what lint already covers.**
