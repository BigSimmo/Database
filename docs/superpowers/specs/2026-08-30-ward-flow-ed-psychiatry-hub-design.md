# ED Psychiatry Hub — design

**Status:** design complete, nothing built. **Owner decisions:** `P9-D2`…`P9-D9`, `FD-11`…`FD-20`.
**Register of record:** `docs/ward-flow-ledger.md`. Where this document and the ledger disagree, the
ledger holds identity and status and this document holds reasoning — but a decision cited here
without a matching ledger row is a defect in one of them, not a decision.

## What it is

One screen per emergency department, showing that department's **psychiatry** work. Reached from
Ward Flow's ED route. It replaces the existing ED screen, which becomes the slide-out detail.

**Who it is for: ED psychiatry staff only** (`P9-D4`). The emergency physician in charge was
explicitly removed from scope — *"leave out the ED emergency physician in charge and mainly keep it
just to the ED psychiatry staff"*. **"For now" is load-bearing:** the physician-in-charge is
deferred, not refused, so nothing here may make a second reader structurally impossible to add.
Concretely: **do not fuse the count header into the worklist's layout.**

## The shape: inbox and outbox

The owner's structure (`P9-D5`, `P9-D8`): *"a screen with referrals in and referrals out"*, named
*"a ED psychiatry Hub showing inbox and outbox for referrals and anything else relevant"*.

*"And anything else relevant"* is recorded as **latitude, not scope.** It authorises nothing
specific and must not later be read as approval for a feature nobody named.

### 1. INBOX — patients to see

**What the inbox actually is (`FD-16`, and this is the part most likely to be built wrong):
a list of referrals psychiatry addressed to THEMSELVES.**

The owner's mechanism, verbatim: *"Psychiatry receive a verbal referral from medical ED staff and
physical search the patient and add a new referral to themselves."*

- **Nothing arrives from ED medical staff through the system.** The request is a conversation — a
  phone call, or someone walking over. It happens outside the software entirely.
- Psychiatry search for the patient, then **create a referral addressed to their own team.**
- **The verbal step is deliberate.** Someone will later propose "let ED medical staff raise it
  directly" as an obvious improvement. It is not an oversight: he described a real workflow in
  which the conversation happens first and **psychiatry own what enters the record.**

Two kinds of entry sit in the inbox, and they behave differently:

| Kind | Arrival | Clocks |
| --- | --- | --- |
| **Community expects** (CMHT and other external referrers) | Addressed to this team; may not have arrived | Referral clock only until they arrive (`P9-D7`) |
| **ED patients** | Already in the department | Both clocks run |

Sorted longest-waiting first.

### 2. OUTBOX — seen, referred on, and still to be moved

Patients this team has assessed and referred onward to a ward.

⚠️ **This is not a list of patients the team has finished with, and reading it that way is the
mistake this section exists to prevent** (`TR-D3`). **The sending ward or ED books the transport**
(`TR-D1`), and for an ED patient going to a ward **the ED psychiatry team IS the sending team.**

**So the outbox is a list of patients this team must still MOVE.** Three things follow, and none of
them is cosmetic:

- **A transport action belongs here** — the booking is made from this board, not from somewhere else.
- **The job stays on this board until the patient physically LEAVES, not until it is booked**
  (`TR-D1`). **A booking that disappears from the booker's view the moment it is made is a booking
  nobody is watching**, and the sending team already has the weakest incentive to chase it — the
  patient is leaving them either way.
- **The receiving ward's readiness signal arrives here as a prompt** (`TR-D4`). ⚠️ **It is a prompt,
  not a transfer of responsibility.** A design in which the prompt substitutes for ownership
  reintroduces exactly the gap `TR-D1` names.

**Full transport contract:** `docs/superpowers/specs/2026-08-30-ward-flow-transport-design.md`.
**Transport is not a separate hub** — if a transport-officer view is ever wanted it is a view over
the same jobs, **never a second place they live.**

**Declines are visible, with their reason** (`P9-D9`, owner: *"Yes the ED psychiatry need to see if
a referral is declined and why"*). Uses the built vocabulary — `declineReason` on `Referral`, and
`DECLINE_REASONS` for the movement side. **No new field and no free text.**

⚠️ **The seven decline reasons are a closed union. No eighth is invented to cover an awkward case.**
A decline that fits none of them is a finding for the owner, not a new string.

Why this earns its place: a patient waiting six hours on `no_bed` is a different problem from one
waiting six hours on `sex_mix`. The first is capacity; the second might be solved this afternoon by
a different ward. Without the reason, a waiting list is not actionable.

### 3. COMPLETED — assessed, not going to a ward

Patients assessed and not admitted — home, community follow-up, or admitted medically.

**Stays visible until midnight, then clears** (`P9-D6`, owner: *"Until midnight"*).

⚠️ **Midnight is a wall-clock boundary, not a duration.** A patient completed at 23:50 is visible
for ten minutes; one completed at 00:10 for almost a full day. **That asymmetry is correct for a
day-based board and is what he chose — do not "improve" it into a rolling window.** Read the clock
through the prototype's existing time source, never a fresh `Date`, so demo time control governs it.

Why the section exists at all: without it the board shows only the fraction of the team's work that
ends in a bed, which in an ED is the minority.

## The two clocks

Every waiting patient carries **two clocks, both visible** (`P9-D2`): **time in department** (from
triage) and **time since referral**.

**The gap between them is the point.** It says whether a delay sits upstream of psychiatry or with
them. Either clock alone hides that: referral-only lets a patient sit for hours pre-referral while
the screen shows a short wait; triage-only makes psychiatry look slow for delays they could not act
on. A third option — measuring from "medically ready" — was rejected because it needs a state
somebody must actively set, so the number silently depends on remembering to tick something.

**A community expect who has not arrived has only one clock** (`P9-D7`). Time-in-department must
render as **genuinely absent** — not `0m`, not a dash styled like a duration, and never a zero that
sorts alongside real waits. **"0m in department" reads as "just arrived", the exact opposite of the
truth**, and would sort them as the newest arrival when they are not in the building. Expected
arrival is shown **only if the referral carries one**; it is never estimated.

## Refusals that apply here

- **No invented threshold** (`P9-D3`). Durations render raw. Nothing is coloured, ranked or flagged
  against a limit the owner has not supplied. **A wait-time screen is the single most natural place
  in this prototype for an invented four-hour rule to appear** — it would look like an obvious
  omission to whoever builds it, and would be added helpfully.
- **No free-typed values** except the one story field on the referral (`FD-13`). That field is
  labelled, optional, last, and **never feeds eligibility, matching, ranking or ordering.**
  **"Exactly one" is load-bearing** — this screen is where a second box will feel necessary.
- **No name, date of birth, address or record number.** Synthetic data only.
- **Fields may narrow which beds are ELIGIBLE; nothing may rank a person.**

## Guard: the two "medical ED" flows

Two flows now share the words *medical* and *ED* and behave oppositely:

| Flow | Affordance |
| --- | --- |
| **ward → ED-medical** | Visible to psychiatry, **actionable by nobody** |
| **ED-medical → ED-psychiatry** | Acted on (becomes a self-addressed referral) |

The first is a notification so psychiatry know one of their patients is physically in the department
for a medical reason. Nobody accepts it and nobody declines it — a **narrower** affordance than
`FD-3`'s, where an ED cannot decline but a referral is still acted upon.

🔴 **CORRECTED 2026-08-30 — the guard as first written is now FORBIDDEN, and building it would have
broken a newer owner ruling.**

**The original guard asserted that no action — accept, decline or otherwise — is ever rendered on a
medical notification.** ⚠️ **That rested on `FD-3`, which the owner has SUPERSEDED: every referral is
declinable, and no code path may render a referral with no decline affordance. The built reducer
already implements the newer ruling.**

**So the medical notification is declinable like everything else.** What is true about it is a claim
about **frequency, not affordance**:

> **Nobody is expected to act on it. Everybody is able to.**

⚠️ **The distinction is the whole correction.** *Nobody can* is a guard on the interface and
contradicts the owner. *Nobody is expected to* is a statement about what normally happens and
contradicts nothing.

**What survives from `FD-18`, because it is still true and still needed:** the two flows must not be
conflated, **and naming will not hold them apart under refactoring.** The distinguishing property is
now **what the row is FOR**, not what it forbids — a ward→ED-medical notification exists so
psychiatry know a patient is physically in the department for a medical reason, **and that purpose
must be visible on the row itself**, because a declinable row with no stated purpose is
indistinguishable from a bed referral.

⚠️ **How this was caught, recorded because the mechanism matters more than the fix:** two live
documents held opposite safety rules and **both were current**. A session reading only this spec
builds the guard; a session reading only the destination spec forbids it. **Neither would have been
careless and neither would have noticed.** **The implementer stopped rather than choose, which is
why nothing was built.**

## Dependencies this design does not own

- **`FD-11` / `FD-15` — the destination model.** A referral names its destination, and a destination
  is a **team within a department**, not only a place: *the ED* and *ED psychiatry* are different
  addressees at one location. **`Movement.referredUnitIds` (a `string[]` of unit ids) cannot express
  this** — a self-addressed referral is only representable if a destination can be a team. The
  surviving option is a tagged union of kinds (ward, ED psychiatry team, community team). **Owned by
  the referral session, not by this screen.**
- **`FD-14` — recording where a verbal request came from.** Shrunk by `FD-16`: ED medical staff are
  not a system actor raising anything, so this is a value on an existing field, not a new source
  with a screen. Any new value is **derived from the exported `REFERRAL_SOURCES` array, never
  hand-listed** — `ed-screen.tsx`'s hand-written `COHORT_OPTIONS` silently omitted `"Youth"` for
  exactly that reason, and widening the union could never fail.
- **`FD-17` — whether `PARALLEL_REFERRAL_CAP` applies to team destinations.** Recommended (not
  decided) that parallel referral stays a **ward** concept: you do not refer a patient to three
  emergency departments, and a patient has one home region. **Its meaning must not be inherited by a
  type change.**

## Build notes

- `src/components/ward-management/ed/ed-screen.tsx` (794 lines) currently renders the tail of the
  journey only — `MOVEMENT_STAGES` begins at `placement_requested`, i.e. after a bed is requested
  (`P9-F1`). **The inbox and completed sections are states ahead of that chain, not a view over it.**
- Ward Flow is **not exempt** from the button-wiring rule: `src/components/ward-management/**`
  matches none of `MOCKUP_IGNORES` in `eslint.config.mjs`. Every control must be wired or an
  explicit `aria-disabled` placeholder.
- Route reachability **is** the real gap for Ward Flow, not button wiring — a new route needs its
  inbound link.
