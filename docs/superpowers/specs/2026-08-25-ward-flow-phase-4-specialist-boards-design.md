# Ward Flow Phase 4 — specialist boards, design

**Date:** 2026-08-25. **Product owner:** a psychiatrist in Perth.

Ward Flow is a **synthetic, offline prototype, not clinical decision support.** No live database,
no patient data, no OpenAI call, no server. Every number is invented.

## 0. Authority

- **Binding:** `docs/superpowers/specs/2026-08-18-ward-flow-metro-patient-flow-design.md` — §6
  (specialist boards), §11 (success criteria), §15 (migration), §18 (phasing).
- **Phase 3 close:** `docs/ward-flow-phase-3-handover.md`.
- This document settles Phase 4's open questions and **supersedes** the one-line Phase 4 sentence
  in §18 of the binding spec. Where the two disagree, this document wins for Phase 4 scope only;
  every other section of the binding spec still governs.

## 1. Standing constraints — absolute, unchanged

1. **Never invent, infer, restate or "correct" any figure, requirement, title or classification
   from the Mental Health Act.** If a legal quantity is needed it comes from the product owner or
   it does not exist. This is the project's single most-violated rule: four fabricated statutory
   figures have reached the code, one of them production. Form titles resolve from the Chief
   Psychiatrist's official register or render as the bare code.
2. **Synthetic data only.** No name, date of birth, medical record number, address, diagnosis,
   narrative history or treatment. **Sex is the only permitted patient attribute. Free text
   counts** — see item 11, which removes the last free-text input in the prototype.
3. **Advisory only.** The system proposes; a human confirms or overrides, always, with the reason
   recorded. Nothing auto-allocates and nothing defaults after a timeout.
4. **Conservative failure.** Missing data narrows what is shown. An absence renders as an explicit
   absence, never as a substituted default. No `?? array[0]`, no `.find()!`.
5. **Not a medical device**, and the pages say so.
6. **Repo gates:** design tokens only (no raw hex); every `<button>` has a real handler, is a
   submit inside a form, or is a `<Link>`; never both `disabled` and `aria-disabled`; production
   tap targets `3rem`/48px, never `2.75rem`; one search composer per page; internal navigation via
   `<Link>`/`router.push`, never a raw `<a href>`; a new production route needs an inbound nav
   link plus a reachability assertion.
7. **Purity:** no `Math.random()`; no wall-clock read outside `ward-clock.ts`; the reducer stays
   pure and `now` arrives on the event.

## 2. Where Phase 4 starts — measured, 2026-08-25

Everything below was measured against the code, not read from a plan.

| Fact                                         | Value                                                    |
| -------------------------------------------- | -------------------------------------------------------- |
| Movements in the fixture                     | 48 (18 authored + 30 generated), **41 open**             |
| Reducer events that exist                    | **15**, every one of them forward-only                   |
| Open movements with **no** eligible ward     | **0** — the scarcest has six                             |
| Movements with a recorded escalation         | **1**                                                    |
| Movements with any decline                   | **2**                                                    |
| Beds held                                    | **7** — 1 hold already expired, 6 expire within the hour |
| Movements with a transport job               | 8 (2 accepted, 6 collected)                              |
| Longest waits                                | 15h52, 15h15, 14h01, 13h24, 12h47                        |
| Open movements past the 24h ED access target | **0**                                                    |
| Movements carrying a recorded status change  | **1**, hand-authored                                     |

Four gaps follow from that table and drive most of this phase:

- **The synthetic night is easy.** Every open patient has at least six eligible wards, so the
  escalation board, the handover's "placement gone wrong" section and the whole scarcity story have
  nothing to show. Item 2 fixes the data, not the boards.
- **Nothing can be undone.** All fifteen events move a patient forwards. The _only_ path that
  releases a held bed or cancels a transport job is closing the movement entirely — recording an
  examination with outcome `community_order` or `revoked`. A coordinator who holds the wrong bed
  must therefore declare the patient no longer needs admission. Item 10 fixes this.
- **Nothing can change after referral.** No event writes `movement.statusChanges`, and urgency is
  fixed at `RAISE_REFERRAL`. The binding spec §7 says explicitly that urgency is editable
  mid-movement with a record of who changed it. Item 3 fixes this.
- **One free-text box survives.** The escalation contact is a `<textarea>` whose label asks for
  "a role or service only, never a person's name". Nothing enforces it. Item 11 fixes this.

## 3. Product-owner decisions settled for this phase

Each answered 2026-08-24/25.

| #      | Decision                                                                                                                                                                                                                                                                         |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | **The statutory clock board is HELD, not built.** It was a board of legal countdowns and every legal deadline has been removed. Nothing is built and nothing claims a legal deadline until the owner supplies real figures.                                                      |
| **D2** | **Urgency and legal status both become changeable**, each change recorded with who made it and when. **Both roles — the emergency department and the coordinator — can change both.**                                                                                            |
| **D3** | **A second, scarcer scenario** is added, switchable from the existing demo menu. **Fewer beds only** — the same patients, genuinely tight beds.                                                                                                                                  |
| **D4** | **The escalation board records and shows only.** It never suggests a ward the patient does not fit, and never ranks "least-bad options".                                                                                                                                         |
| **D5** | **Release-a-hold and cancel-a-transport are added.** Available to **the coordinator and the ward holding the bed.**                                                                                                                                                              |
| **D6** | **The escalation contact becomes a fixed list**: State bed coordination desk, Duty psychiatrist, Bed management, Nurse unit manager (destination ward), Escort or transport provider, **plus a general "Other service" entry.** No typing.                                       |
| **D7** | **Two live effectiveness numbers** go on the governance board: median time from referral to a ward accepting, and average wards contacted per patient. **The third success measure — "legal deadlines passed while a patient waits" — is dropped**, because it no longer exists. |
| **D8** | **Patient search gets its own page**, reached from the left-hand rail.                                                                                                                                                                                                           |
| **D9** | **The shift handover** is its own printable page, frozen at the moment it is opened, statewide, leading with longest waits ranked.                                                                                                                                               |

## 4. The twelve items

Eleven are built. One (item 12) is held.

---

### Item 1 — Shift handover

**What it is.** A point-in-time, printable summary produced at shift changeover. Coordinators
assemble this by hand today.

**Design (D9), approved by the product owner.** Its own page. **Frozen at the moment it is
opened** — a handover that changes while it is being read is worse than no handover — with the
freeze time shown. Statewide. Four sections, each of which **states plainly when it is empty**
rather than being hidden:

1. **Longest waits, ranked.** Every open movement, longest first, with time since arrival, current
   stage, emergency department and destination if one is chosen. Always populated. **No threshold**
   — this deliberately replaces "who is breaching", because 0 of 41 patients are past the 24-hour
   departmental access target and a breach-led handover would be blank.
2. **Beds held and expiring.** Every held bed with its unit, the patient it is held for, and
   whether the hold has expired or expires soon. **This is the sharpest section on the page** — a
   held bed silently lapsing is what the incoming coordinator most needs to catch.
3. **In transit.** Every movement with a transport job, split by leg — accepted and awaiting
   departure, versus physically in a vehicle.
4. **Placement gone wrong.** Movements with a recorded escalation, and movements declined by every
   unit they were referred to. Small on today's data and honestly so.

**What must not happen.** No section may invent a threshold, a deadline, or a legal claim. The
freeze must be real — the page reads state once on open and does not re-derive on a clock tick.

**Route.** `/ward-management/handover`. Needs a left-rail entry and a reachability assertion.

---

### Item 2 — The scarce-beds scenario

**What it is.** A second synthetic night, switchable from the **existing demo-controls menu** —
which is already marked "not a clinical action" and already carries the `demo` role, so a scenario
switch belongs there and nowhere near a clinical screen.

**What gets built (D3).** **Fewer beds only.** The same 48 movements and the same patients; unit
allocatable counts, sex-mix headroom and specialling capacity are tightened until the network is
genuinely exhausted for some patients. Scarcity is the single variable that changes.

**The acceptance test for this item is a measurement, not a screenshot:** in the scarce scenario,
**at least one open movement must have zero eligible wards**, and the distribution of eligible-ward
counts must be materially tighter than tonight's (where the minimum is six). Report both
distributions. If the scarce night still leaves everyone six options, the item is not done.

**What must not happen.** No new patient attribute, no free text, no clinical content of any kind.
The scenario differs in operational numbers only. `RESET_SCENARIO` must return to the standard
night, and switching scenarios must not leave a half-applied state.

---

### Item 3 — Urgency and legal status can change

**What it is.** Two new events, each recording who made the change and when. **Both the emergency
department and the coordinator may change both** (D2).

**What gets built.**

- **Change urgency.** Re-orders the queue immediately, because urgency is the queue's first sort
  key. Records the previous and new tier, the role that changed it, and the time.
- **Change legal status.** Writes `movement.statusChanges`, the field that exists today and that no
  event has ever written.
- Both changes require a **reason chosen from a fixed list**, never typed — the same treatment
  decline reasons already have. **The lists, ruled here so no implementer invents one:**
  - urgency: `reassessed`, `new_information`, `correcting_an_error`
  - legal status: `recorded_by_treating_team`, `correcting_an_error`

  These are deliberately operational and content-free. **None of them describes a patient, a
  diagnosis, a clinical judgement or a legal requirement** — a reason code that said "patient
  deteriorated" would be narrative clinical content, which rule 2 forbids, and one that said
  "order made" would be a claim about the Act, which rule 1 forbids. If the product owner wants
  richer reasons he supplies them; no agent adds one.

**The risk this creates, and it must be designed for, not discovered.** A legal status change can
make a destination that was lawful when it was chosen unlawful now — a patient accepted to an
unauthorised unit who becomes an involuntary patient. **The system must surface this as an
exception and must never silently re-sort, re-suggest or un-accept the patient.** Nothing
auto-allocates; that rule does not bend because the trigger was a status change.

**What must not happen.** No inference about what a legal status _means_ legally. The model records
which of its four statuses applies and who said so. It asserts nothing about the Act.

---

### Item 4 — Escalation board

**What it is.** One place showing every patient whose placement has gone wrong.

**What gets built (D4).** Two groups, both read-only:

1. **Escalated** — movements with a recorded escalation: when, which units were tried, who is being
   contacted, and how long the patient has been waiting.
2. **Nowhere eligible** — open movements with zero eligible wards right now.

**It records and shows. It suggests nothing.** No "least-bad options", no ranking of wards the
patient does not fit, no statement of what would need to change. Suggesting an ineligible
destination is the software making a placement judgement, which this project has repeatedly and
deliberately pulled back from.

**Route.** `/ward-management/escalation`, left-rail entry, reachability assertion.

**Note for the implementer:** recording an escalation already works, on the coordinator's shortlist
panel. This item adds the board, not the recording.

---

### Item 5 — Patient search

**What it is (D8).** Its own page, reached from the left rail. Searches by patient identifier,
emergency department, destination unit, stage, and owning role.

**What gets built.** A single search field plus stage and department filters; results show
identifier, stage, department, destination, time since arrival, and a link to the patient page.
**One search composer per page** — this repository's rule — so the page owns its composer and does
not also mount the shell's.

**What must not happen.** Search must never surface a closed movement as if it were open, and must
render "no matches" explicitly rather than an empty table.

---

### Item 6 — Capacity board extensions

**What it is.** The capacity board shows bed counts and freshness. It does not show the three
things that actually decide whether a patient can go to a unit.

**What gets built.** Add to each unit row: **current sex mix**, **specialling capacity**
(one-to-one observation headroom), and **whether the unit is authorised under the Mental Health Act
to receive involuntary admissions**. All three already exist on the model and already gate
placement; they are simply invisible on the board whose job is capacity.

**What must not happen.** The authorisation flag is a property the model already carries about a
unit. Rendering it is not a legal claim and must not be dressed as one — no explanation of what
authorisation requires or means.

---

### Item 7 — Governance board extensions

**What it is.** The governance board carries the assurance cards. It lacks the not-a-medical-device
statement (which today appears only on the coordinator screen) and any audit of changes.

**What gets built.**

- The **not-a-medical-device** statement.
- An **audit of changes** — every urgency change, legal status change, hold release and transport
  cancellation from item 3 and item 10, with who and when. This is the reason item 3 comes first.
- **Two live effectiveness numbers (D7):** median time from referral to a ward accepting, and
  average number of units contacted per patient. Both computed from movements in the current
  scenario.
- **The third success measure is dropped.** The binding spec §11 lists "legal deadlines passed
  while a patient waits" as one of three measures; it no longer exists and cannot be computed.
  Record the drop on the page rather than silently omitting it.

**What must not happen.** Neither number may be presented as evidence the prototype works. They
describe the synthetic scenario, and the page must say so.

---

### Item 8 — Patient page extensions

**What it is.** The patient page shows the legal form but not the three records §15 of the binding
spec requires.

**What gets built.** That patient's **declines** (which unit, fixed reason, when), their **status
changes** (from item 3), and their **escalation record**. Each renders an explicit absence when
empty.

---

### Item 9 — Bed release flagging

**What it is.** A ward saying "a bed is coming free". Bed releases exist today as static fixture
data feeding the _potential_ capacity figure — **no ward can flag one.** This was named as part of
Phase 3 and did not get built.

**What gets built.** A control on the ward screen recording a coming-free bed with its
**confidence** (confirmed, likely, possible), the **blocker** holding it up, and who confirmed it.

**What must not happen.** A bed release carries **nothing whatsoever about the departing patient** —
no identifier, no timing that could identify them, no reason relating to them. That is a privacy
rule from the binding spec §4 and it is not negotiable. The blocker is an operational fact about
the bed ("awaiting clean"), never about a person.

---

### Item 10 — Release a hold, cancel a transport

**What it is.** The undo the prototype has never had. Today the only way to release a held bed or
cancel a transport job is to close the movement by declaring the patient does not need admission.

**What gets built (D5).** Two events, available to **the coordinator and the ward holding the bed**:

- **Release a held bed** — available **only at stage `bed_held`**, never once the patient is
  `handover_ready` or `moving`, because by then a vehicle and a receiving ward are committed and
  unwinding it is a different decision. The bed returns to allocatable, the movement returns to
  **`accepted_awaiting_bed`** — the unit has still accepted them in principle, it just no longer
  holds a bed — and the release is recorded with who and why.
- **Cancel a transport job** — available while a transport job exists, is not already cancelled,
  and the patient has not arrived. The movement returns to **`handover_ready`** and survives;
  `transport.cancelledAt` already exists on the model and is currently reachable only through
  closure.

Both take a **reason from a fixed list**, ruled here:

- release a hold: `patient_no_longer_coming`, `bed_needed_for_another_patient`,
  `ward_withdrew_the_bed`, `hold_made_in_error`
- cancel transport: `provider_unavailable`, `patient_not_ready`, `destination_changed`,
  `job_created_in_error`

Both appear in the governance audit (item 7).

**This also makes the expiring-hold warning actionable.** The system correctly refuses to silently
drop a held bed at 3am and raises a warning instead — right, and until now nobody could act on it.
Seven beds are held, one hold has already expired, six expire within the hour.

**How "the ward holding the bed" is enforced.** Follow the `CONFIRM_CAPACITY` precedent exactly: a
ward caller states the unit it is acting as, the ward screen supplies its own route `unitId`, and
the reducer refuses when the acting unit is not the unit holding the bed, naming both ids. **Say
plainly in the comment, as `CONFIRM_CAPACITY` does, that this records the caller's claim and does
not prove it, and that this is not an identity model** — claiming more would be the defect this
project keeps producing. A coordinator caller needs no acting unit.

**What must not happen.** Releasing a bed must not close the movement, must not clear the patient's
legal form, and must not auto-refer them anywhere. Cancelling transport must not close the movement.
The reducer must refuse both on a closed movement, naming the closure reason, the way every other
handler already does.

---

### Item 11 — The last free-text box becomes a fixed list

**What it is.** The escalation form asks the coordinator to type who they are contacting next. Its
label says "a role or service only, never a person's name (synthetic data only)". Nothing enforces
that, and it is the only free-text input left in the prototype.

**What gets built (D6).** A picker offering exactly: **State bed coordination desk**, **Duty
psychiatrist**, **Bed management**, **Nurse unit manager (destination ward)**, **Escort or transport
provider**, and **Other service**. No typing. Every entry except "Other service" is drawn from
language the model already uses; none is invented.

**Why it matters more than its size.** The synthetic-data promise currently depends on a user
reading a label and complying. After this it is true by construction — the same reasoning that made
decline reasons a fixed list.

**Migration:** the one authored escalation in the fixture uses "State bed coordination desk", which
is on the list, so no fixture data is lost.

---

### Item 12 — Statutory clock board (HELD, not built)

**Not built (D1).** This was a board of legal countdowns. Every legal deadline was removed from the
model on the owner's instruction, so the board has nothing to show and any rebuild would either be
empty or would re-invent the statutory figures this project has fabricated four times.

**It is recorded here as awaiting real timeframes from the product owner.** If they arrive, the
precedent is set: `LegalForm.dueAt` is already optional and the "Statutory timing" factor in the
operational score is dormant rather than deleted, so the board returns as an optional field plus one
derivation. **No agent may supply those figures.**

---

## 5. Build order

Groundwork first, because four boards read what it produces.

1. **Item 2** — the scarce scenario. Everything downstream is demonstrable only against it.
2. **Item 3** — urgency and legal status changes. Item 7's audit and item 8 both depend on it.
3. **Item 10** — release a hold, cancel a transport. Shares the audit and the fixed-reason pattern
   with item 3, and is the highest-value single addition in the phase.
4. **Item 1** — shift handover.
5. **Item 4** — escalation board.
6. **Item 11** — the fixed contact list. Small, and it touches the escalation surface item 4 just
   built.
7. **Item 5** — patient search.
8. **Item 6** — capacity board extensions.
9. **Item 7** — governance extensions, including the two effectiveness numbers.
10. **Item 8** — patient page extensions.
11. **Item 9** — bed release flagging.

Items 5 through 11 are small and largely independent; their order can move. Items 1 through 4
cannot.

## 6. How it gets proved

- **Contract tests** for every new event: role gating, refusal on a closed movement, refusal on a
  mismatched acting unit where one applies, and the exact state each event does and does not touch.
- **A measurement, not an assertion, for item 2** — the eligible-ward distribution in both
  scenarios, reported in full.
- **Every test mutation-tested**: make the single edit that should kill it, print the edited line
  back from the file, watch it fail, revert, confirm green. A mutation not read back did not
  happen. A mutation that does not kill the test is **reported, not reshaped**.
- **Dark, forced-colours and print coverage** for every new page, following the established
  `emulateMedia` pattern. The handover's print rendering is a requirement, not a nicety.
- **Reachability assertions** for all three new routes.
- Read counts, never exit codes.

## 7. Known limits, stated so they are not later filed as defects

- **Everything runs in one browser window.** One person switches between roles. The prototype
  therefore cannot demonstrate its own central claim — that shared visibility removes the
  ring-around — because two people cannot use it at once. That needs a server build and is out of
  scope for every phase of this prototype.
- **The system never observes a discharge**, so it cannot derive bed supply from its own data.
  Supply arrives only as a ward-reported bed release (item 9).
- **No legal countdown exists anywhere in this model** and none may be added (item 12).
- **The two effectiveness numbers describe a synthetic scenario**, not real performance.
