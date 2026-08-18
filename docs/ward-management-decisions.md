# Ward Flow — architecture decisions

Decisions for the ward-management context that are hard to reverse, surprising without
context, and the result of a real trade-off. Vocabulary lives in
[`ward-management-context.md`](./ward-management-context.md); routes and roles live in
[`ward-management-mode-map.md`](./ward-management-mode-map.md).

Status values: **Accepted** (decided and reflected in the build), **Proposed** (recommended,
awaiting the product owner).

---

## 1. Authorised-hospital status gates the destination of an involuntary admission

**Status:** Accepted — 2026-08-18
**Context**

The prototype models a ward as `Open` or `Secure`, and models the patient's legal standing
separately. That reads as sufficient: put involuntary patients in secure wards. It is not,
but not for the reason an earlier version of this record claimed.

Detention in an emergency department is lawful. A person referred for examination under
Form 1A may be detained under Form 3A or 3B in a general hospital emergency department that
is **not** an authorised hospital, while awaiting examination and a bed. Emergency
departments hold detained patients routinely — this is the normal state that almost every
movement in this system passes through, not an exception or a compliance gap to be closed.

The authorisation requirement bites on the **destination**, not on wherever the patient
currently is. A person admitted as an involuntary _inpatient_ must be at a hospital
authorised under the Mental Health Act 2014. Authorisation is a legal property of the site,
granted by the Chief Psychiatrist, and it is independent of ward security: an authorised
hospital may run open wards, and a locked ward at an unauthorised site still cannot receive
an involuntary admission. Locking a ward door does not confer authorisation, and the two
properties are genuinely independent — the synthetic data already contains the crossing
case, a movement with involuntary status routed to an open ward.

With one axis, the placement filter cannot express this legal constraint, and the system
could propose a destination that cannot lawfully receive the patient. That is the failure
mode most damaging to trust in an advisory tool.

**Decision**

Model authorisation and security as two independent properties. Authorisation is a property
of the hospital; security is a property of the ward. Eligibility filtering applies
authorisation as a hard legal gate on **candidate destinations for an involuntary
admission**, evaluated before any ranking, and treats security as a clinical suitability
factor. The gate never looks at the patient's current location — a detained patient held in
an unauthorised emergency department is not a violation to be flagged, and the system must
not represent it as one.

**Consequences**

- Every hospital record gains an authorisation property; every proposal must state it.
- A proposal for an involuntary or detained patient to a non-authorised _destination_
  becomes impossible to generate rather than merely unlikely. Where the patient already is
  — including an unauthorised emergency department — is never evaluated against this gate.
- The capacity mode must show authorisation, because a coordinator scanning free beds needs
  to know which of them are legally reachable for the patient in front of them.
- The system never treats a patient's current location as a compliance problem.
- Cost: one more dimension in fixtures, filters and the capacity matrix.

**Alternatives considered**

_Keep the single open/secure axis and rely on the coordinator._ Rejected: it pushes the
hardest legal check onto the human while the system displays a confident recommendation,
which is the inversion of the intended division of labour.

_Derive authorisation from security._ Rejected: factually wrong in both directions.

_Gate on the patient's current location as well as the destination._ Rejected: it is
factually wrong — detention in an unauthorised emergency department is lawful and is the
normal state a movement starts in — and it would make the system flag the ordinary,
expected condition of nearly every open movement as a compliance failure.

---

## 2. The system proposes; a human allocates

**Status:** Accepted — 2026-08-18
**Context**

The tool computes an operational fit score and ranks destinations. The obvious next step is
to let it allocate: assign the bed, notify the ward, save everyone a phone call. Bed
coordination is exactly the kind of repetitive matching that automation suits, and the delay
between "a bed is free" and "someone notices" is a real source of harm.

Against that: WA Health's mandatory AI policy and the WA Government AI Assurance Framework
require transparent, accountable and contestable use. The Privacy and Responsible
Information Sharing Act 2024's IPP 10 governs automated decision-making from 1 July 2026.
Bed allocation determines where a person is detained and treated. It is a decision about
liberty, not logistics.

**Decision**

The system never allocates. It proposes, with visible positive reasons, visible exclusions,
the calculation time, and ranked alternatives. An authorised human confirms or overrides,
and that action with its reason enters the audit trail. There is no auto-accept, no
"allocate if confidence exceeds a threshold", and no silent default after a timeout.

**Consequences**

- Confirmation is a required step in every placement flow, and every mode's primary control
  is a confirm/override pair rather than a submit.
- The scorer's job is ordering and explanation, not decision. Its output must be legible to
  a coordinator under time pressure, which constrains it toward few, nameable factors.
- Throughput benefit is forgone. The tool's value is that the right movement surfaces first
  and the reasoning is already assembled, not that steps disappear.
- Governance mode must be able to reconstruct, for any movement, what was proposed, what was
  confirmed, by whom and why.

**Alternatives considered**

_Auto-allocate below an urgency threshold._ Rejected: urgency tiers are clinical judgement,
so the threshold would itself be an automated clinical decision, and the low-urgency cases
are precisely where wrong placement goes unnoticed longest.

_Auto-allocate with a human veto window._ Rejected: a veto that expires is consent by
inattention, and the audit trail would record a confirmation nobody made.

---

## 3. Catchment and region are different concepts

**Status:** Accepted — 2026-08-18
**Context**

The prototype uses one four-value list — North, East, South, Country — for both the patient's
catchment and the hospital's region, and matches them for equality to decide whether a
placement is local.

This works for metropolitan patients and breaks for everyone else. Country is not a peer of
the three metropolitan services; it is WACHS, a single health service spanning seven regions
across the state. Under the flat list, every country patient placed at a metropolitan
hospital is scored as out-of-catchment, which is often the correct and intended pathway, and
two country patients in regions a thousand kilometres apart are scored as equally local to
each other.

The synthetic data already shows the strain: a country patient's recommended destination is
a metropolitan hospital, so the "local catchment first" rule cannot fire for the cases where
placement is hardest.

**Decision**

Model the patient's catchment as the responsible health service, and the hospital's region
as its physical location, as two separate properties. Locality is a computed relationship
between them, not string equality. For a country patient, local means their WACHS region
first, then other WACHS regions, then metropolitan escalation — a graded ladder rather than
an in/out flag.

**Consequences**

- Country movements can express their real pathway, including the case where metropolitan
  placement is the correct destination rather than a failure.
- The constellation and capacity modes gain a genuine hierarchy to render, which is the
  visual the coordinator role actually needs.
- Escalation becomes a degree rather than a boolean, and the operational priority factor for
  escalation must be re-expressed accordingly.
- Cost: fixtures, filters, the network layout and the escalation copy all change together.

**Alternatives considered**

_Add country sub-regions to the flat list._ Rejected: it makes the list longer without fixing
the level error, and every metropolitan-versus-country comparison still compares a health
service to a geographic region.

_Treat all country placement as escalation._ Rejected: it labels the normal, correct country
pathway as an exception, which would flood the exceptions mode with routine work and train
users to ignore it.

---

## 4. Durations are stored relative to now, and exactly one module reads the wall clock

**Status:** Accepted — 2026-08-18
**Context**

Every screen in Ward Flow is time-driven: forms count down, holds expire, capacity ages,
operational priority moves with elapsed wait. The obvious representation is a fixed
timestamp per fact — "due at 14:32", "confirmed at 09:07" — computed once when the fixture
is authored.

Fixed timestamps do not survive contact with a screenshot or a test run tomorrow. A movement
"due in ninety-three minutes" authored against a clock that has since moved on either reads
as already overdue or, worse, silently drifts into looking healthier than it is. Every test
and every screenshot would need to either freeze the system clock globally or accept
time-dependent flakiness, and the board would tick correctly only by coincidence.

**Decision**

Durations are stored relative to now — "due in ninety-three minutes", "confirmed four
minutes ago" — and bind to a real or injected clock only at render time, so the board ticks
without the underlying fixture data changing shape. Exactly one module, `ward-clock.ts`,
reads the wall clock. Every other function in the domain that needs the current time
receives `now` as an explicit parameter; none of them call `Date.now()`, `new Date()`, or an
equivalent directly.

**Consequences**

- Every duration-consuming function's signature carries `now`, which is more parameters but
  makes the time dependency visible at every call site rather than hidden inside it.
- Tests and screenshots inject a fixed `now` and get fully deterministic output — a movement
  "due in ninety-three minutes" renders identically no matter when the test runs.
- `ward-clock.ts` is the only place that can introduce clock-related flakiness, which makes
  it the only place that needs scrutiny for that failure class.
- Cost: any new derivation that touches elapsed time, a deadline, or freshness must thread
  `now` through, rather than reaching for the wall clock locally.

**Alternatives considered**

_Read `Date.now()` at each call site._ Rejected: it makes every test and every screenshot
time-dependent, because the moment a fixture's "due in" figure is computed is no longer
under the test's control — the same test can pass or fail depending on when it happens to
run.

_Store fixed timestamps and compute durations for display only._ Rejected: it moves the
problem rather than removing it — the fixture data itself would still encode a specific
moment that becomes stale, and every fixture would need periodic regeneration to keep
looking current.
