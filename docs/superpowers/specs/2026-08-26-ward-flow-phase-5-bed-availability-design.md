# Ward Flow Phase 5 — Bed availability becomes real

**Status:** design, approved in chat 2026-08-26. Implementation plan follows separately.

**One sentence:** wards say when beds are actually coming free, and the coordinator's capacity
figure becomes a number that can be planned against rather than a snapshot of the present moment.

---

## Why this phase, and why first

Ward Flow models one direction. Beds fill; nothing in the system ever releases one on a schedule.
The capacity board answers "how many beds exist right now", which is not the question a bed
coordinator asks. The question is "will there be a bed tonight", and that is a discharge question,
not an admission question.

The phase order after this one changed on 2026-08-26: the morning state-of-the-state page moves
from Phase 8 to **Phase 6**, ahead of the community front door. It is built entirely from the
numbers this phase produces, it is small, and it is the artefact that can be put in front of
colleagues. Finding out whether any of this is right is worth more than the next feature.

Every other item on the Phase 6–8 list — the morning page, escalation tiers, the closest-suitable-
bed measure, the retrospective — needs a trustworthy availability number underneath it. Building
any of those first means building them twice: once against guesses, then again once the guesses are
replaced. So this phase has no headline screen and is still the one that has to come first.

## What already exists (do not rebuild it)

Phase 4 built more of this than the Phase 5 discussion credited, and the plan must extend it rather
than introduce a parallel concept:

- **`BedRelease`** (`ward-model.ts`) — `{ id, unitId, expectedAt, confidence, blocker, confirmedAt,
confirmedBy }`. Its doc comment records the privacy rule as non-negotiable: every field is about
  the bed or the confirming ward, never about a person. `tests/ward-flow-reducer.test.ts` asserts
  this **structurally against the type's own field set**, not merely against fixture content.
- **`BED_RELEASE_CONFIDENCE_LEVELS`** — `confirmed | likely | possible`.
- **`BED_RELEASE_BLOCKERS`** — `Awaiting clean | Awaiting pharmacy | Awaiting placement
confirmation | Awaiting service coordination`, chosen from a list and never typed. The list's own
  doc comment records that "Pending case review outcome" was deliberately excluded because it reads
  as being about the patient's case rather than about the bed.
- **`FLAG_BED_RELEASE`**, ward-only in `EVENT_ROLE`, with the acting-unit claim checked against the
  target unit.
- **A flagging panel on the ward screen** already collecting confidence and blocker.
- **`unitCapacity().potential`** — a raw count of that unit's releases, rendered as a column.

## Scope

**In:**

1. A lifecycle for a bed release, replacing the current single-shot flag.
2. Leave beds, as a distinct thing from an empty bed.
3. A discharge and egress board.
4. Predicted capacity for today, expressed in time bands.
5. A freshness signal on every screen.

**Out, and deliberately so:** the community front door, geography and distance, the morning
state-of-the-state page, escalation tiers, the retrospective view, notifications, cohort and
bed-type matching, the navigation regrouping, the network diagram rework. Those are Phases 6–8.

---

## Decisions

### D1 — A bed release has a lifecycle, and `confidence` stops doing two jobs

Add `state: "predicted" | "confirmed" | "blocked" | "released"` to `BedRelease`.

`confidence` currently carries `confirmed | likely | possible`, which conflates a _lifecycle
position_ ("the ward has confirmed this is happening") with a _degree of belief_ ("we think it is
likely"). Narrow it to `likely | possible`, and make it meaningful only while `state` is
`predicted`. A confirmed release has no confidence: it is not a belief any more.

Migration is mechanical: any existing release whose `confidence` is `confirmed` becomes
`state: "confirmed"` with `confidence: null`.

- `predicted` — the ward expects this bed to come free today. Carries `confidence` and `expectedAt`.
- `confirmed` — the ward has confirmed it is happening today. No `confidence`.
- `blocked` — the bed would be free but something operational is holding it. Carries a `blocker`.
- `released` — terminal. The bed is now empty and counts as available.

### D2 — Only the ward moves a release; the coordinator is read-only

`FLAG_BED_RELEASE` is already ward-only. The three new transitions (`CONFIRM_BED_RELEASE`,
`BLOCK_BED_RELEASE`, `RELEASE_BED`) are ward-only too, with the same acting-unit claim check.

A coordinator attempting any of them produces a `Rejection` — the codebase's existing first-class
refusal type, already surfaced on the coordinator screen rather than swallowed. The coordinator can
see every release and can escalate about one; they cannot change it. This is the point: the ward
owns its own beds, and a hub that lets a central coordinator edit a ward's bed state is a hub wards
will stop trusting.

### D3 — `blocker` becomes state-dependent and typed

Today `blocker` is `string` and always present. Tighten to `BedReleaseBlocker | null`: required when
`state` is `blocked`, and `null` in every other state. The reducer refuses a `blocked` transition
with no blocker, and refuses a blocker on any other state.

Extend `BED_RELEASE_BLOCKERS` with three additions that are operational rather than clinical:

- `Awaiting accommodation`
- `Awaiting transport`
- `Awaiting receiving-service acceptance`

**Deliberately excluded: anything describing a person's own circumstances.** Guardianship,
financial arrangements and family availability are all real blockers in practice and all describe
the patient rather than the bed, so they follow "Pending case review outcome" out of the list. If
the product owner wants any of them, it is a one-line addition and a recorded decision — not
something an implementer adds because it seemed useful.

### D4 — A leave bed is not an empty bed

Add `LeaveBed`: `{ id, unitId, usable, expectedReturn, confirmedAt, confirmedBy }`.

A patient on approved leave occupies a bed that may or may not be fillable while they are away, and
a coordinator needs to see which. `usable: true` means the ward says it can be filled; `usable:
false` means it cannot. Like `BedRelease`, it carries nothing about the person on leave — not an
identifier, not a reason, not a destination.

**A usable leave bed is never merged into `available`.** It is its own count, rendered as its own
figure. Merging it would inflate the one number the whole hub depends on.

### D5 — The horizon is today, in four bands

`expectedAt` stays an instant. Bands are derived from it relative to the demo clock:

- **Now** — already released.
- **By midday**
- **By 1600**
- **Tonight** — up to the end of the operating day, taken as **24:00**.

**AMENDED 2026-08-26 by the product owner, during implementation: the boundary is 24:00, not
22:00.** The original decision and its reasoning are kept below rather than deleted, because the
argument against midnight is still the argument a future reader will want to weigh.

> **Superseded — why 22:00 and not midnight.** Midnight is a calendar boundary; nobody hands over
> at midnight. The band has to end where the working day ends, or "beds tonight" means something
> different to the person reading it than to the ward that entered it. 22:00 is this prototype's
> choice, recorded here so it can be changed in one place, and it is a synthetic convenience rather
> than a claim about how any real service runs its shifts.

The owner's instruction was to keep it simple and end the day at 24:00. That is what the code does,
in one named constant (`END_OF_DAY_MINUTES = 24 * 60`), and reversing it is a one-line change to
that constant and its test — exactly the property the original decision was written to preserve.
The trade the owner accepted: a release a ward enters for 23:30 now counts inside "tonight" rather
than being reported as excluded. That is the less conservative direction of the two, and it is the
only behavioural consequence.

Anything expected beyond tonight is **excluded from every count and the board says how many were
excluded**. Silent truncation reads as "we counted everything" when we did not, and a bed
coordinator who discovers a hidden bucket stops trusting the visible ones.

Beyond roughly 24 hours a psychiatric discharge prediction is a guess wearing a number's clothes.
The horizon is a deliberate refusal, not a limitation to be lifted later.

### D6 — Predicted beds are never added to available

The capacity headline becomes five separate figures, never a sum:

> **Available now 25 · Confirmed today 9 · Predicted today 6 · Held 14 · Leave (usable) 3**

`Available now` keeps its current meaning exactly. Nothing predicted or confirmed-but-not-yet-
released is permitted to change it. The render policy is explicit: a coordinator must be able to
point at one number and say "that is a bed I can fill this minute", and that number must never have
been softened by an expectation.

`unitCapacity().potential` — today a raw count of every release regardless of state or timing — is
replaced by this breakdown. It is the one existing behaviour this phase changes rather than extends,
and the plan must say so where it does.

### D7 — Every screen states when its data was last true

One shared freshness component, rendered on every Ward Flow board:

- Where a confirming role exists: **"Confirmed 10:22 · RPH Adult Secure"**.
- Where nothing has ever been confirmed: **"Never confirmed"** — never a blank, never a dash.
- Where the screen shows derived rather than confirmed data: **"As at 10:42"**, the clock time it
  was computed.

Today only the capacity board carries freshness. A board that looks authoritative and cannot say how
old it is invites the reader to assume it is current, and every other board in Ward Flow currently
does exactly that.

### D8 — An owner is a role, never a person

`confirmedBy` is tightened from `string` to a role identifier — a unit or a named service, never an
individual. This is the general rule for the whole hub (agreed for Phases 5–8): accountability
attaches to a role, which survives a shift change without reassignment and keeps staff names out of
the system entirely.

### D9 — The discharge and egress board

New route: `/mockups/ward-flow/discharges`, reached from the sidebar's Boards group and from the
capacity board's own figures.

Grouped by state in the order a coordinator scans them — **Blocked** first (these are the ones
somebody must act on), then **Confirmed**, then **Predicted**, then **Released today**. Within a
group, ordered by expected band.

Each row: unit, health service, expected band, blocker where there is one, confirming role, and its
freshness stamp. A count of releases excluded for falling beyond tonight sits at the foot of the
board, stated even when it is zero.

**On a phone this board is cards, not a squeezed table** — one card per release, the blocker and the
band as the two prominent facts. Ward Flow's tables are right at a desk and wrong in a corridor, and
this is the first board built after that was noticed.

### D10 — The ward screen owns the transitions

The ward screen's existing flagging panel gains the rest of the lifecycle: confirm a predicted
release, mark one blocked with a reason from the fixed list, mark one released, and record a leave
bed with its usability. Every control is a real control with a real handler — no advisory buttons.

The coordinator screen renders the same data read-only, with an escalation path but no edit path.

### D11 — No new fact about any person, anywhere

`BedRelease` and `LeaveBed` both stay free of anything describing the departing or absent patient.
Specifically, **neither carries sex**, even though sex is the one permitted patient attribute and
carrying it would let the sex-mix column update on a predicted release.

The trade is deliberate: sex mix updates only when occupancy actually changes, which is already
modelled. Adding sex to a bed release for arithmetic convenience would break the structural privacy
test Phase 4 wrote against the type's own field set, and that test is worth more than a column that
refreshes an hour earlier.

### D12 — A coordinator may ask a ward to refresh, and may do nothing else

A coordinator can mark a unit's bed count as **refresh requested**. The ward sees that mark on its
own screen, next to its own capacity, with the time it was asked and by which role.

Nothing leaves the sandbox and no message is sent. This is the most common real interaction in bed
management — the phone call that says "is that still right?" — and modelling it as a visible mark
rather than a message makes the hub useful before notifications exist (Phase 8), without acquiring
any of notification's governance weight.

It remains the only thing a coordinator can do to a ward's bed data, and it changes no number. D2
still holds: the ward owns its beds.

### D13 — The seeded scenario opens on its worst case, not its best

The default scenario seeds bed releases across **every** state, including at least two `blocked`
ones and at least one leave bed marked unusable. A discharge board that opens empty demonstrates
nothing, and a board that opens with everything confirmed demonstrates the wrong thing — the
screen's whole purpose is the awkward cases.

### D14 — The four states are the prototype's model, and are not yet clinically validated

`predicted → confirmed → blocked → released` is a software model of how a bed comes free. It has
not been checked against how a ward charge nurse actually thinks, and it may be a tidy version of
something messier — a bed can be simultaneously confirmed and blocked in reality, and "predicted"
may compress several distinct real states.

It is built as specified because a working model beats an unbuilt one, and because the model is
cheap to change while it is synthetic. **This is recorded as the single most valuable thing to check
with a ward clinician**, not as a defect. If it turns out to be wrong, the states change; nothing
else in this phase depends on there being exactly four.

---

## Data flow

A ward flags a release → it enters state `predicted` with a confidence and an expected time → the
ward later confirms, blocks, or releases it → every state change re-derives that unit's capacity
breakdown → the coordinator's capacity board, the new discharge board and the priority queue all
read the same derivation. No screen computes its own version of the number.

Leave beds follow the same path with a two-state life: recorded, then ended on return.

## Failure behaviour

Consistent with the rest of Ward Flow, every failure degrades toward saying less rather than
guessing more:

- A release with no valid state, an unknown blocker, or an expected time outside today is **not
  counted and is reported as excluded**, never quietly dropped.
- A refused transition produces a visible `Rejection`, never a silent no-op.
- A unit with no confirmed capacity reads **"Never confirmed"**, never zero. Zero is a claim.
- If the derivation cannot produce a breakdown, the board shows `Available now` alone and states
  that the prediction is unavailable — the conservative figure survives; the optimistic one does not.

## Verification

- Unit tests for the lifecycle, the role gate, the band derivation and the exclusion count — each
  mutation-tested, with the surviving mutation reported rather than the test reshaped.
- Extension of the existing structural privacy test to `LeaveBed` and to the new fields.
- A contract test that no screen sums a predicted figure into `Available now`.
- A Chromium journey: a ward flags, confirms and blocks a release, and the coordinator's board
  reflects each change without a reload.
- A phone-width check that the discharge board renders as cards and does not overflow.
- Screenshots at 390px, 820px and 1440px, looked at rather than assumed. Every defect found in the
  Phase 4 sweep was invisible to structural checks.

## Success criteria

1. A coordinator can answer "how many beds will exist tonight" from one screen.
2. No predicted bed has ever been counted as an available one.
3. A ward can record everything it knows about its own beds in under a minute.
4. Every board says how old its data is.
5. Not one new fact about any patient has entered the system.

## Risks

- **The prediction is only as good as the ward's habit of updating it.** No software fixes that; the
  design's answer is to make the ward screen fast and to make staleness visible everywhere rather
  than to nag.
- **Replacing `potential` changes an existing rendered figure.** It is the one behavioural change in
  this phase and must be called out where it happens, not folded in silently.
- **The state model is unvalidated (D14).** A ward clinician has not yet checked it, and it is the
  assumption most likely to be wrong.
- **The four bands are a synthetic convenience.** They are the prototype's choice, not a clinical
  standard, and the board should not imply otherwise.
