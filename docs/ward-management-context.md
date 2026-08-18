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
care.

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

**Authorised hospital** — a hospital authorised under the Mental Health Act 2014 to detain
and treat involuntary patients. Authorisation is a legal property of the site and is
independent of whether a ward is locked (see decision 1).

**Ward security** — whether a ward is open or secure (locked). An operational and clinical
property, not a legal one. A secure ward at a non-authorised hospital still cannot hold an
involuntary patient.

**Unit capability** — what a ward can actually care for: adult, older adult, and (not yet
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

Whether _potential_ is disjoint from _occupied_ or a subset of it is currently unresolved,
and the synthetic data is inconsistent on the point. It must be settled before any capacity
total is presented as authoritative.

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
is the single most consequential event in the pathway and is not yet modelled.

**Statutory timing** — the deadline attached to a legal form: when an examination is due,
when a detention or transport authority expires. Timing drives operational priority and
generates exceptions. It is a deadline, not descriptive text.

## Movement mechanics

**Transport readiness** — whether the legal authority, risk documentation, escort
requirements and booking are all in place for this patient to travel. Readiness is a
conjunction: any missing element makes the movement not ready. Metropolitan and country
transport follow different processes.

**Handover** — the clinical transfer of responsibility from origin to destination. Distinct
from physical transport: a patient can be transported without handover being complete.

**Decline** — the receiving ward refusing a proposed or requested destination, with a
reason. A first-class outcome that returns the movement to destination review. Not yet
modelled.

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
