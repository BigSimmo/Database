# Ward Flow — domain glossary

The ubiquitous language for the ward-management context. Glossary only: no schemas, no
component names, no file paths. Where a term is contested or still unresolved, that is
recorded explicitly rather than smoothed over.

Companion documents: [`ward-management-mode-map.md`](./ward-management-mode-map.md) for the
route and role model, [`ward-management-decisions.md`](./ward-management-decisions.md) for the
decisions that shaped this language.

## Core record

**Movement** — the unit of work. A single patient's journey from "needs an inpatient
psychiatric bed" to "arrived at the receiving ward". Ward Flow tracks movements, not
patients: a person who is admitted, discharged and re-presents has two movements. This is
why every surface counts movements and never claims to be a patient census.

**Placement request** — the opening of a movement. The referring team asserts that this
patient needs an inpatient bed and states cohort, ward security and legal status.

**Origin** — where the patient physically is now. Usually an emergency department, but also
a country hospital awaiting metropolitan transfer, or a ward seeking a different level of
care. A patient's origin is never evaluated against the authorised-hospital gate: detention
in an unauthorised emergency department is lawful and is the normal state a movement opens
in (see decision 1).

**Destination** — the receiving ward. A movement has at most one destination at a time.
A destination is _proposed_ (system suggestion), _requested_ (referral sent), _accepted_
(receiving ward has agreed) or _declined_. Proposed is not requested.

**Stage** — where the movement sits in the six-step pathway: placement requested,
destination review, bed held, handover ready, moving, arrived. Stages are sequential and a
movement occupies exactly one. Escalation and blockers are attributes of a movement at any
stage, never additional stages.

**Blocker** — the single named thing preventing the movement advancing to the next stage.
A movement has at most one active blocker. "No blocker" is a real value and means the next
action is owned and on time.

**Owner** — the role accountable for the _next_ action on this movement right now.
Ownership moves between roles as the movement advances. A movement with no owner is an
exception by definition.

## Places

**Health service** — the WA Health Service Provider responsible for a population.
The metropolitan services are North, South and East; WA Country Health Service (WACHS)
covers the rest of the state; Child and Adolescent Health Service covers under-18s.

**Site** — a hospital, belonging to a health service. A site has an emergency department,
inpatient units, or both — this asymmetry is real and load-bearing. Some sites have units
but no emergency department; some have an emergency department that feeds patients
elsewhere; some have both.

**Emergency department** — where demand originates, and the single most important location
in the model. Belongs to a site. Tracks how many mental health patients are waiting, the
longest current wait, and how many have passed a legal deadline; this per-department
pressure figure is the first thing a coordinator scans. A patient can be lawfully detained
here regardless of whether the site is authorised — see Origin above.

**Catchment** — the health service responsible for _this patient_, determined by where
they live, not where they presented. A patient who presents to a metropolitan ED while
visiting from Broome has a country catchment.

**Region** — where a _hospital_ physically sits. Catchment and region are different
concepts and must never be collapsed into one list (see decision 3). A movement is
"in catchment" when the destination's region is served by the patient's catchment health
service; otherwise it is an escalation.

**Escalation** — placing a patient outside their catchment because no suitable in-catchment
bed is available or timely. Escalation is a visible, reason-bearing state, not a silent
fallback.

**Authorised hospital** — a hospital authorised under the Mental Health Act 2014 to receive
an involuntary patient as an _inpatient_. Authorisation is a legal property of the site,
granted by the Chief Psychiatrist, and is independent of whether a ward is locked — an
authorised hospital may run open wards, and a locked ward at an unauthorised site still
cannot receive an involuntary admission (see decision 1). Authorisation gates only the
**destination** of an involuntary admission. It says nothing about where a patient may
lawfully be held while awaiting one: detention under Form 3A or 3B in an unauthorised
general hospital emergency department is lawful and is the normal state, not a compliance
problem. The system never treats a patient's current location as a test of this property.

**Unit** — an inpatient ward. Carries cohort (adult or older adult), security (open or
secure), authorisation under the Act, bed count, current sex mix and specialling capacity.
"Ward" and "unit" name the same thing in this glossary; "unit" is preferred where the record
itself is meant, "ward" where the physical/operational sense is meant (as in ward security).

**Ward security** — whether a unit is open or secure (locked). An operational and clinical
property, not a legal one. A secure unit at a non-authorised hospital still cannot hold an
involuntary patient.

**Unit capability** — what a unit can actually care for: adult, older adult, and (not yet
modelled) child and adolescent, mother and baby, eating disorder, intensive psychiatric
care, forensic. Capability is matched before ranking, never traded off against wait time.

## Capacity

**Bed state** — every bed carries exactly one of five states:

- **Available** — confirmed empty and allocatable now.
- **Held** — reserved for a named movement until a stated expiry time.
- **Potential** — expected to become available after a named action, with an estimate.
  A potential bed is not yet allocatable.
- **Blocked** — physically present but unusable, with a stated reason.
- **Occupied** — in use, with no expectation of release inside the planning horizon.

_Potential_ is a subset of _occupied_, not a disjoint state: a bed expected to free up is
still in use right now, by the patient a bed release has been raised against. It is never
added to a capacity total — a coordinator can see it as a coming action with an estimate
behind it, but it does not make the bed count as free before it actually is.

**Hold** — a time-limited reservation of a specific bed for a specific movement. A hold
always has an expiry. An expired hold is an exception, never a silent release.

**Freshness** — the time a bed state was last confirmed by a human at the receiving site.
Every displayed capacity figure carries its freshness. Capacity older than the agreed
threshold becomes an exception rather than continuing to display as available.

**Release forecast** — the receiving ward's expectation of which beds will free up and when.
The supply side of flow. Not yet modelled, and the primary lever a ward manager actually
holds.

## Priority

**Urgency tier** — the human clinical judgement of how urgently this patient needs a bed,
set by a clinician. The first and dominant ordering rule. Never computed.

**Operational priority** — an algorithmic ordering _within_ an urgency tier, reflecting
elapsed wait, statutory timing, response delays, transport delays, blockers and escalation
state. It measures how badly the process is going, not how unwell the patient is. It is
labelled operational and never described as severity, acuity or risk.

**Elapsed** — how long this movement has been open, measured from the placement request.
Distinct from time in the current stage, which is what most blockers are actually about.

## Legal status

**Legal status** — the patient's current standing under the Mental Health Act 2014, shown
in plain language with the governing form and its timing beneath. Never reduced to a single
voluntary/involuntary flag, because the form and its expiry are what drive action.

**Status change** — a patient's legal status changing during a movement, most often a
voluntary patient becoming a referred or detained patient in the emergency department. This
is the single most consequential event in the pathway. It is modelled as an event — who
changed it, when, from what status to what — and it re-runs eligibility: the authorisation
gate can switch on mid-movement, and any unit already shortlisted or referred that has just
become unlawful is flagged rather than left standing.

**Statutory timing** — the deadline attached to a legal form: when an examination is due,
when a detention or transport authority expires. It is modelled as a structured deadline —
an instant, plus a computed state (clear, due, critical, breached) derived from how far away
that instant is — rather than descriptive prose. Timing drives operational priority and
generates exceptions.

## Movement mechanics

**Transport readiness** — whether the legal authority, risk documentation, escort
requirements and booking are all in place for this patient to travel. Readiness is a
conjunction: any missing element makes the movement not ready. Metropolitan and country
transport follow different processes.

**Handover** — the clinical transfer of responsibility from origin to destination. Distinct
from physical transport: a patient can be transported without handover being complete.

**Decline** — the receiving unit refusing a proposed or requested destination, with a
reason. A first-class outcome that returns the movement to destination review; that unit
then drops out of this patient's suggestions with its reason recorded. Modelled with a fixed
six-value reason list — no bed, sex mix, specialling unavailable, acuity mix, capability
mismatch, bed held for an earlier referral — plus an optional note. Free text is
deliberately excluded: it would make refusals unreadable in aggregate, and this is the data
that later shows why placements fail.

**Parallel referral** — sending the same movement to more than one candidate unit at once,
capped at three concurrent live referrals. Every unit receiving one is told it is a parallel
referral; concealing that from wards is how trust between services breaks. When one unit
accepts, the others are withdrawn automatically with a reason recorded.

**No bed available** — the state where no suitable destination exists anywhere in the
state, in or out of catchment. The system must be able to say this plainly and name the
escalation path. Not yet modelled, and it is the state the tool most needs to handle well.

**Exception** — any movement that is overdue, has an expiring hold, has stale capacity
underneath it, or has lost its owner. Exceptions are the work list, not a report.

## Assurance

**Proposal** — a system-generated destination suggestion carrying its positive reasons,
what it excluded, the time it was calculated and ranked alternatives. A proposal is advice.
It is never an allocation (see decision 2).

**Confirmation** — an authorised human accepting or overriding a proposal. The action, the
actor and the reason enter the audit trail. No movement changes destination without one.

**Synthetic** — the data in this prototype. Movements carry an identifier and operational
fields only, and deliberately omit name, date of birth, medical record number, address,
diagnosis, narrative history and treatment. "Synthetic" is a governance claim that the
governance mode must be able to evidence, not a disclaimer.
