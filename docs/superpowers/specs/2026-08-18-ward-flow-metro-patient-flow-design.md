# Ward Flow — metro psychiatry patient flow, design

**Status:** Approved design, awaiting implementation plan.
**Date:** 2026-08-18
**Supersedes:** the route model in `docs/ward-management-mode-map.md` and the mode list in
`docs/superpowers/plans/2026-08-18-ward-flow-model-and-modes.md`, both of which assume a
nine-mode strip rather than the role-first structure decided here.

---

## 1. The problem

A patient in mental health crisis presents to a metropolitan emergency department and needs an
inpatient psychiatric bed. Today, finding one is a phone-around. The mental health liaison
nurse or ED registrar rings services one at a time. The bed numbers they are told are already
stale. Mental Health Act clocks are running — the Form 1A examination window, a Form 3A
detention, a Form 4A transport order. Transport has to be booked and usually waits. Meanwhile
the patient sits in the department, frequently for twelve to twenty-four hours and sometimes
much longer.

Nobody holds a single current picture of who is waiting, which beds are genuinely allocatable,
who has already declined and why, what is legally due and when, and where the vehicle is.

Ward Flow replaces the phone-around with that shared picture.

Two constraints drive most of the difficulty and the system should make both visible rather
than let them be discovered on the fourth phone call: older-adult beds are far scarcer than
adult beds, and authorisation under the Mental Health Act is a property of the receiving site,
not of the ward's locked door.

## 2. Scope

**In.** Getting a patient from a metropolitan emergency department to an inpatient psychiatric
bed. Adults and older adults. The three metropolitan health services — North, South and East —
are the focus. WA Country Health Service remains in the model so the system can serve the whole
state, but it is not the focus.

**The boundary is the ward door.** A movement closes when the patient arrives. From that moment
the patient leaves the system entirely.

**Out.** Everything after arrival: repatriation back to catchment, discharge as a clinical
event, length of stay. Also child and adolescent services, forensic services, community teams,
and sub-locations inside an emergency department.

**Consequence of the boundary, accepted deliberately.** The system never observes a discharge,
so it cannot derive bed supply from its own data. Supply arrives instead as a signal the ward
reports — see _Bed release_ in section 4.

## 3. Legal grounding

Detention in an emergency department is lawful. A person referred for examination under Form 1A
may be detained under Form 3A or 3B in a general hospital that is **not** an authorised hospital
while awaiting examination and a bed. Emergency departments hold detained patients routinely;
this is the normal state, not an exception.

The authorisation requirement bites on the **destination**. A person admitted as an involuntary
inpatient must be at a hospital authorised under the Act. Authorisation is a legal property of
the site granted by the Chief Psychiatrist. It is independent of whether a ward is locked: an
authorised hospital may run open wards, and a locked ward at an unauthorised site still cannot
receive an involuntary admission.

The system therefore applies authorisation as a hard gate on candidate destinations only, and
never treats the patient's current location as a compliance problem.

## 4. What the system holds

**Site.** A hospital, belonging to a health service — North Metro, South Metro, East Metro,
WACHS or private. A site has an emergency department, inpatient units, or both. This asymmetry
is real and load-bearing: Fremantle and Bentley have mental health units but no emergency
department; Peel and Joondalup have emergency departments that feed elsewhere; Royal Perth, Sir
Charles Gairdner, Fiona Stanley, Armadale, St John of God Midland and Rockingham have both.

**Emergency department.** Where demand originates, and the single most important location in the
model. Tracks how many mental health patients are waiting, the longest current wait, and how
many have passed a legal deadline. This per-department pressure figure is the first thing a
coordinator scans.

**Unit.** An inpatient ward. Carries cohort (adult or older adult), security (open or secure),
authorisation under the Act, bed count, current sex mix, and specialling capacity.

**Movement.** One patient's journey from an emergency department to a bed. Holds the originating
department, urgency tier, operational score, stage, current owner, legal status with its
governing form and deadline, cohort, security requirement, sex, specialling requirement,
transport job, refusals recorded so far, and the single active blocker.

**Capacity figure.** A number, plus its source, when it was confirmed, and when it goes stale.
Two sources exist and they answer different questions. A feed knows which beds are _physically
empty_. A ward knows which are _actually allocatable_ once staffing, sex mix, acuity mix,
single-room requirements and existing holds are accounted for. A feed can never know the second
thing, which is why ward confirmation persists even after a feed exists. Where the two disagree
— "feed shows three empty, ward last confirmed one allocatable" — that disagreement surfaces as
an exception rather than one silently overwriting the other.

**Bed release.** A ward-flagged expected release, carrying service, unit, expected time,
confidence (confirmed, likely or possible), the blocker holding it up, and who last confirmed
it. It carries **no detail whatsoever about the departing patient**. This is what gives
_potential_ capacity a named action and an estimate behind it.

**Transport job.** Provider, escort requirement, the legal form required to travel, and four
timestamped events supplied by the transport officer.

**Escalation record.** What was tried, why each option failed, who was contacted, and the
outcome.

## 5. Stages

Seven, sequential, one at a time:

1. Placement requested
2. Destination review
3. Accepted, awaiting bed
4. Bed held
5. Handover ready
6. Moving
7. Arrived

Stage 3 exists because it is where patients actually stall. A ward routinely accepts a patient
in principle before a bed physically exists, and collapsing that into "bed held" hides hours of
waiting.

Cross-catchment escalation is an attribute of a movement at any stage, never an eighth stage.

## 6. Roles and screens

Four roles, four primary screens. Specialist boards exist as routes for deep-linking but do not
occupy the top navigation — they are reached from the context that raises them.

### Flow coordinator — statewide, desktop

The main screen.

- **ED pressure strip.** Every metro emergency department with number waiting, longest wait, and
  number past a deadline.
- **Queue.** Urgency tier first, operational score within tier.
- **Flow diagram.** Emergency departments on the left, statewide flow in the centre, inpatient
  units on the right. The selected patient's routes are drawn to their shortlist. This layout is
  the patient journey; the previous region-clustered layout never showed where pressure
  originated.
- **Shortlist.** Each candidate with why it fits and what nearly excluded it — authorisation,
  cohort, security, sex mix, specialling — plus anyone who has already declined. Confirm or
  override.
- **Exceptions.** Breaching forms, expiring holds, stale capacity, feed-versus-ward
  disagreements, overdue bed releases, ownerless movements.

A phone form of this screen collapses to queue, exceptions and one-tap confirm, because
after-hours coordination happens on a phone.

### ED — own patients

The people waiting in this department, each with their legal clock, referral state, and the
single outstanding item: a form, a transport request, or handover. Statewide capacity is visible
but read-only.

### Ward — own unit and incoming

Confirm allocatable beds by cohort, security and sex mix. Accept or decline with a reason. Flag
bed releases. See who has been accepted, held, or is en route.

### Transport officer — phone

This officer's jobs only. Patient identifier, origin department, destination unit, legal form
required, escort. Four actions: accepted, en route, patient collected, arrived. Nothing else.

### Specialist boards

Capacity matrix, statutory clock, movements board, escalation, network diagram, shift handover,
governance.

**Shift handover** is a point-in-time printable summary produced at changeover: who is breaching,
who is stuck with no bed, what is held and expiring, what is en route. Coordinators assemble this
by hand today.

### Visibility

Role-scoped. The coordinator sees statewide. An emergency department sees its own patients. A
ward sees its own unit plus incoming. **Statewide capacity is visible to everyone** — that shared
fact is what removes the phone-around, and hiding it would recreate the problem.

**Patient search** across identifier, department, destination, stage and owner.

## 7. How a movement travels

**Opening.** The emergency department raises a referral. The movement opens at _placement
requested_, owned by that department, carrying its location, legal status and deadline, cohort,
security need, sex and any specialling requirement.

**Shortlisting.** The coordinator picks it up. The system **filters before it ranks**. Hard gates
first: authorisation where the destination would be an involuntary admission, cohort, security,
sex mix, specialling capacity, and any unit that has already declined. Only survivors are ranked
and shown, each with its reasons and what nearly excluded it. Stage becomes _destination review_,
owned by the coordinator.

**Parallel referrals are supported**, capped at three at a time. Every unit receiving one is told
it is a parallel referral. When one accepts, the others are withdrawn automatically with a
reason. Concealing parallel referrals from wards is how trust between services breaks.

**Acceptance.** A ward accepting in principle moves it to _accepted, awaiting bed_, owned by the
ward. Naming a bed moves it to _bed held_ with an expiry running. Declining returns it to
_destination review_; that unit drops out of this patient's suggestions with its reason recorded.

**Decline reasons are a fixed list** — no bed, sex mix, specialling unavailable, acuity mix,
capability mismatch, bed held for an earlier referral — with an optional note. Free text would
make refusals unreadable in aggregate, and this is the data that later shows why placements fail.

**Movement.** Handover complete and transport booked gives _handover ready_, owned by the
department. The officer marking collected gives _moving_, owned by the officer. The officer
marking arrived gives _arrived_; the record closes and the patient leaves the system.

**Closing without arrival.** A movement may end as _closed — did not proceed_, with a reason.
Patients abscond from emergency departments, improve and go home, are admitted medically, or go
private. Without this path those records stay open forever and the queue fills with ghosts.

**Legal status can change mid-movement.** A voluntary patient becoming detained in a department is
among the commonest events in the pathway, and it changes eligibility: the authorisation gate
switches on and part of the current shortlist may become unlawful. A status change re-runs
eligibility and flags any shortlisted unit that has just become invalid.

**Urgency can change.** The tier is editable mid-movement with a record of who changed it and
when, because it re-orders the queue.

**An expiring hold raises an exception rather than auto-releasing the bed.** A machine silently
dropping a held bed at 3am is worse than a late human.

**Transport jobs can be cancelled or reassigned** without killing the movement.

**When nothing is eligible** the movement enters the escalation state: what was tried and why each
failed; least-bad options with what would need to change for each to work; who to contact; and a
record that the escalation happened. That record is exactly what gets asked for afterwards when a
patient waited thirty hours.

**Nothing auto-allocates.** Every placement requires a human confirm or override, and both enter
the audit trail.

## 8. Ordering the queue

Clinical urgency tier leads and is never computed. It is the clinician's judgement and must not
be buried inside an algorithm.

The operational score orders movements **within** a tier, from wait time, legal deadline
proximity, transport delay, response delay and blockers. It contains no urgency component. It
answers "how badly is this one going", which is an operations question. It is labelled
operational and never described as severity, acuity or risk.

## 9. Time

Clocks run. Times are stored as durations relative to now — "due in ninety-three minutes",
"confirmed four minutes ago" — and bind to real time on load, so the board ticks. Forms count
down, holds expire, capacity ages, transport status stamps a real time.

Tests inject a fixed value for now so they stay deterministic.

## 10. Failure behaviour

**When data is missing or stale, the system says less, not more.**

- Stale capacity drops out of suggestions rather than being shown hopefully.
- Unknown legal status is treated as _requiring_ an authorised destination, because that is the
  safe direction in which to be wrong.
- Missing sex or specialling data marks a candidate "cannot confirm eligibility" rather than
  assuming it fits.

## 11. Success criteria

Three measures. Every screen should move at least one; anything that moves none is decoration.

1. Time from referral to a ward accepting.
2. Number of separate contacts a coordinator makes to place one patient.
3. Legal deadlines passed while a patient waits.

## 12. Governance, privacy and safety

**Advisory only.** The system proposes; a human confirms or overrides, always, with the reason
recorded. Every suggestion shows why it fits and what nearly excluded it. Nothing auto-allocates
and nothing defaults after a timeout. This follows WA Health's AI policy (MP 0193/25), the WA
Government AI Assurance Framework, and the automated decision-making provisions of the Privacy
and Responsible Information Sharing Act 2024 that commence 1 July 2026.

**Not a medical device, and the page says so.** Bed allocation sits close enough to clinical
decision-making that someone will read it that way. The system orders operational work. It never
assesses risk, acuity or treatment.

**Privacy.** Records carry an identifier and operational facts only — no name, date of birth,
medical record number, address, diagnosis or history. Sex is the single patient attribute beyond
operations, present because bed allocation genuinely turns on ward mix. Bed releases carry
nothing about the departing patient.

## 13. What this is not

A synthetic wireframe. No server, no authentication, no integration with PAS, PSOLIS, emergency
department systems, bed management, ambulance or police. Every number is invented. The bed feed
is simulated. Transport officer updates reach the coordinator within a single browser window
only; two real devices would require a proper build.

Real operational use would require AI assurance sign-off, a privacy impact assessment,
role-based access control, an immutable audit trail, retention and deletion rules, verified
integrations, monitoring, downtime procedures, and health service governance approval. This
prototype is none of that.

## 14. Data volume

Fixtures are built at realistic pressure, not comfortable pressure: forty to sixty movements
across eight emergency departments, several breaching, older-adult beds at or near zero, and two
or three movements with no eligible destination at all. **The bad night is the default view.**

Designing against fourteen calm movements produces screens that look elegant and collapse on
first contact with reality — the queue overflows, the diagram crowds, the exception band becomes
a wall.

## 15. Migration of existing work

Ten routes exist today. Role-first restructuring means some are kept, some rewritten, some
retired. The implementation plan must state each explicitly rather than leave orphans.

| Existing                         | Disposition                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| `/ward-management` (command)     | **Rewritten** as the coordinator screen: adds ED pressure strip, seven stages, new shortlist gates. |
| `/ward-management/constellation` | **Retired.** Folds into the coordinator screen.                                                     |
| `/ward-management/network`       | **Kept and reshaped** — EDs left, flow centre, units right. Becomes the diagnostic deep-link.       |
| `/ward-management/queue`         | **Kept** as a specialist board; primary queue lives on the coordinator screen.                      |
| `/ward-management/capacity`      | **Kept and extended** with source, age, sex mix, specialling, authorisation.                        |
| `/ward-management/movements`     | **Kept**, extended to seven stages.                                                                 |
| `/ward-management/exceptions`    | **Kept** as a board; also a band on the coordinator screen.                                         |
| `/ward-management/transport`     | **Rewritten** as the coordinator's live tracker; officer surface is new and separate.               |
| `/ward-management/governance`    | **Kept and extended** with the not-a-medical-device statement and status-change audit.              |
| `/ward-management/patients/[id]` | **Kept and extended** with declines, status changes, escalation record.                             |

New: ED screen, ward screen, transport officer phone screen, statutory clock, escalation, shift
handover, patient search.

## 16. How it gets proved

**Contract tests** for model invariants: beds always account for; no unlawful destination is ever
suggested; no identity field is present on any record; no movement is left ownerless; parallel
referrals never exceed the cap; a declined unit never reappears in that patient's suggestions.

**One browser journey per role screen**, plus phone, dark mode, forced colours and print.

**Time is injected** as a fixed value in tests so clocks do not make them flaky.

## 17. Reconciling the existing decision records

`docs/ward-management-decisions.md` holds three ADRs written before this design. Two need
action.

**ADR 1 — authorised hospitals — is wrong as written and must be corrected, not merely
accepted.** It states that an involuntary patient must be _detained_ at an authorised hospital,
which reads as though holding a detained patient in an emergency department were unlawful. It is
not: detention under Form 3A or 3B in an unauthorised general hospital is the normal, lawful
state while a patient awaits examination and a bed. Section 3 of this document is the corrected
rule. ADR 1 is rewritten to gate the **destination of an involuntary admission** and nothing
else.

**ADR 2 — the system proposes, a human allocates — stands unchanged** and is reinforced by
sections 7 and 12.

**ADR 3 — catchment and region are different concepts — is accepted as written.** It is what
allows WACHS to remain in the model without distorting metropolitan placement, which is exactly
the balance section 2 requires.

A fourth ADR is owed for the time model in section 9, because binding fixtures to real time is
hard to reverse and shapes every test.

## 18. Phasing

This design is too large for a single implementation plan. It should be built as four plans,
each producing something usable on its own.

**Phase 1 — the model.** Sites with emergency departments and units, seven stages, the
authorisation gate, sex mix and specialling, capacity with source and age, declines, legal
status change, close-without-arrival, realistic data volume. No new screens. Everything proved
by contract tests. Nothing else can be built correctly until this is right.

**Phase 2 — the coordinator screen.** ED pressure strip, queue, reshaped flow diagram,
shortlist with gates and decline history, exception band, phone form. Retires Constellation.

**Phase 3 — the other three roles.** ED screen, ward screen with capacity confirmation and bed
release flagging, transport officer phone screen with its four events and the coordinator's live
tracker.

**Phase 4 — specialist boards and escalation.** Statutory clock, escalation state with its
record, shift handover, patient search, governance extensions, capacity matrix extensions.

Migration in section 15 happens across phases 2 to 4, not as a separate exercise.
