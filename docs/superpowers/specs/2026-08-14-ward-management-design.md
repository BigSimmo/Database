# Ward Management — Statewide Mental Health Patient Flow Design

**Status:** Approved design direction; implementation planning and final image mockups pending.

## Purpose

Add a `/ward-management` section to Clinical KB for a synthetic, statewide Western Australian mental health patient-flow prototype. The module should let flow coordinators, emergency department teams, and ward managers share one operational picture of placement-ready patients, psychiatric bed capacity, destination reviews, transport, and arrival.

The first usability target is that, within 30 seconds, each role can identify its next action, find the highest-priority movement, understand suitable destinations, see the current owner, and safely advance the workflow.

## WA operational grounding

WA Health describes an existing Assertive Mental Health Patient Flow Beds Live dashboard that exposes mental health availability and occupancy, including secure and non-secure ward-level information. This design does not attempt to reproduce that dashboard. It adds the patient-to-bed coordination layer: ownership, suitability, referral response, bed hold, handover, transport, arrival, and exception management.

The design also reflects these public WA workflow signals:

- Mental Health Act status is more specific than a voluntary/involuntary binary. Referral, detention, transport, transfer, and inpatient orders have distinct forms and timing.
- Catchment is operationally important, but statewide coordination is required when local flow cannot provide an appropriate bed.
- Inter-hospital and Mental Health Act transport require explicit readiness, documentation, provider, and delay handling.
- Adult and older-adult services have different eligibility and capability constraints.

Public grounding sources:

- [WA Department of Health Annual Report 2024–25](https://www.health.wa.gov.au/~/media/Corp/Documents/Reports-and-publications/Annual-report/2025/Annual-Report-2025.pdf)
- [Office of the Chief Psychiatrist — Mental Health Act 2014 forms](https://www.chiefpsychiatrist.wa.gov.au/laws-and-rights/legislation/mental-health-act-2014-forms/)
- [WA Health — Mental health patient transport](https://www.health.wa.gov.au/Articles/J_M/Mental-health-patient-transport)
- [WA Country Health Service — Mental Health Emergency Telehealth Service](https://wacountry.health.wa.gov.au/Our-services/Command-Centre/Mental-Health-Emergency-Telehealth-Service)
- [South Metropolitan Health Service — adult inpatient and community mental health referrals](https://smhs.health.wa.gov.au/Our-services/Mental-health/SMHS-mental-health-referrals/Fiona-Stanley-Fremantle-Hospitals/Adult-inpatient-and-community-mental-health-referrals)
- [North Metropolitan Health Service — inpatient adult mental health](https://nmhs.health.wa.gov.au/Hospitals-and-Services/Mental-Health/Inpatient)

This is product-design grounding, not an assertion that public web pages describe every current internal allocation rule. Real facility lists, eligibility rules, legal timing, scoring factors, and escalation policies would require WA Health governance validation before operational use.

## Scope

### Included

- Statewide WA public mental health coordination across metropolitan health service providers and WACHS.
- General adult and older-adult cohorts.
- Three role lenses over one shared flow record: flow coordinator, ED team, and ward manager.
- Aggregate demand for people still awaiting mental health assessment.
- Individual movement records only after inpatient placement is requested.
- Five truthful bed states.
- Six patient-movement stages.
- Catchment-first matching with explainable statewide escalation.
- Human-confirmed matching supported by an explainable algorithmic priority score.
- Lightweight expected-bed-release forecasts without departing-patient details.
- An operational transport chain and a shared action inbox.
- Desktop, tablet, phone, keyboard, forced-colours, and reduced-motion designs.

### Excluded

- Patient-identifiable data.
- Live PAS, ED, PSOLIS, bed-management, ambulance, police, or provider integrations.
- Automatic patient allocation.
- Clinical diagnosis, treatment, or risk scoring.
- Full discharge, community follow-up, or step-down management.
- Departing-patient details in release forecasts.
- Vehicle tracking or provider messaging.
- General staff chat, mentions, or social activity.
- Production deployment or a claim of clinical readiness.

## Product architecture

One shared synthetic data model drives every role. Role selection changes priorities, controls, and default detail; it does not create separate copies of patient, bed, or movement state.

### Flow coordinator

- Sees the statewide schematic network, demand, capacity, movement, and escalations.
- Reviews explainable patient-to-bed shortlists.
- Confirms matches and coordinates cross-HSP or WACHS escalation.
- Oversees bed holds, handover readiness, transport, and arrival.

### ED team

- Sees its own placement-ready patient queue.
- Owns referral readiness, plain-language legal status, legal timing, handover, and transport prerequisites.
- Reviews destination responses and resolves local blockers.

### Ward manager

- Sees its own unit capacity and incoming reviews.
- Owns bed state, lightweight release forecast, suitability response, acceptance, and bed hold.
- Confirms the last-updated time for every capacity state.

Every role can read the shared event timeline. Only the owning role can update its step in the prototype.

## Information architecture

### Desktop and tablet

The visual centre is a schematic hospital network grouped by coordinating service rather than literal geography:

```text
North        East         South        Country
  |            |             |            |
Hospitals    Hospitals     Hospitals    Regional units
  |            |             |            |
Beds         ED demand     Beds         Transfer demand
```

The network is paired with:

- Statewide demand and truthful bed-state totals.
- A priority-movement panel.
- A shared action inbox.
- Cross-system escalations.
- A selected patient-to-bed matching panel.

Hospital nodes remain compact until selected. Movement connections appear only for active proposed, accepted, or moving patients; the network must not become a permanently tangled route diagram.

### Phone

Phone defaults to a role-specific operational queue. `Hospitals` and `Map` remain secondary views. The phone does not shrink the desktop network into an unreadable miniature.

- Coordinator: prioritised movement and exception queue.
- ED: patient readiness and destination-response tasks.
- Ward: capacity, release, review, and hold tasks.
- Patient movement detail: a full-width screen rather than a narrow drawer.

## Patient movement record

The collapsed card shows only operational essentials:

- Synthetic patient ID.
- Current hospital and elapsed wait.
- Adult or older-adult cohort.
- Required open or secure setting.
- Home catchment.
- Plain-language legal status.
- Current referral destination and response.
- Movement stage and responsible role.
- Transport readiness.
- One current blocker.
- Human urgency tier and supporting algorithmic score.

The expanded desktop panel or phone detail screen shows:

- Relevant legal form and expiry time.
- Referral and destination-review history.
- Suitability requirements and exclusions.
- Algorithmic score factors.
- Handover and document readiness.
- Transport chain.
- Complete synthetic audit timeline.

No diagnosis, narrative clinical history, or treatment information appears on the main card.

## Bed state model

Every bed or allocatable place has exactly one state:

1. `occupied`
2. `allocatable_now`
3. `held`
4. `potential_after_action`
5. `blocked_unavailable`

`potential_after_action` requires an estimated time and one blocker such as discharge, cleaning, staffing, review, or another explicit reason. It contains no departing-patient details.

Suitability is separate from availability. It includes cohort, open or secure setting, location, service owner, and essential unit capability constraints. An empty place must never be presented as suitable merely because it is physically vacant.

All capacity states show a last-confirmed time. Stale capacity becomes an actionable exception.

## Movement state model

The visible patient pathway has six stages:

1. `placement_requested`
2. `destination_review`
3. `accepted_bed_held`
4. `handover_transport_ready`
5. `moving`
6. `arrived_closed`

Statewide escalation is a cross-stage flag, not another stage. Assessment-pending demand appears as aggregate counts only.

## Legal status

Plain language is primary. Examples include:

- Voluntary.
- Referred for psychiatric examination.
- Detained awaiting examination.
- Involuntary inpatient.

The relevant Mental Health Act form, expiry, and timing appear directly beneath the plain-language state when applicable. The prototype must not collapse these states into a single `involuntary` badge.

## Matching and priority

### Destination shortlist

The shortlist checks:

- Cohort.
- Required open or secure setting.
- Unit capability.
- Legal and transport constraints.
- Catchment.
- Current bed state.

Local catchment services rank first. Suitable statewide options appear when local placement is unavailable or delayed. Excluded destinations remain inspectable with a short plain-language reason. A human must confirm every match.

### Operational priority

Human-assigned urgency determines the priority tier. A configurable algorithm orders patients within that tier using operational factors such as:

- Elapsed wait.
- Statutory timing.
- Destination-response delay.
- Transport delay.
- Unresolved blockers.
- Local unavailability and escalation state.

The score and its contributing factors are visible. The interface must describe it as operational priority, never clinical severity. It cannot change the human urgency tier or allocate a bed automatically.

## Transport model

The first version uses these transport states:

1. Not required.
2. Request ready.
3. Requested.
4. Booked.
5. Collected.
6. Arrived.

When transport is required, the detail view shows provider, estimated time, required legal/risk-document readiness, and one delay reason. There is no dispatch integration or live vehicle tracking.

## Action inbox

The inbox surfaces only actionable exceptions:

- Unanswered destination review.
- Expiring legal timing.
- Expiring bed hold.
- Delayed transport.
- Stale ward capacity state.
- A newly available destination for a higher-priority patient.

It is not a general notification feed or messaging system. Each item names the owner, required action, and elapsed or remaining time.

## Visual system

The module extends Clinical KB's existing Clinical White / Sky Graphite system:

- True-white operational canvas.
- Graphite commands and primary text.
- Clinical blue for selection, focus, active movement, and network connections.
- Green only for genuinely ready or completed states.
- Amber for held, potential, or time-sensitive states.
- Red for blocked or overdue actions.
- Hairline borders and restrained surface changes instead of nested cards and heavy shadows.
- Tabular numerals for waiting time, capacity, score, and legal timing.

Colour never carries meaning alone. Every state also has a visible label and distinct structural treatment.

## Accessibility and responsive requirements

- Every network node is keyboard reachable.
- The same information is available as a semantic list or table.
- No drag-only matching or map-only workflow.
- No control relies on hover.
- Phone primary targets meet the repository's 48 px convention.
- Focus, forced-colours, reduced-motion, zoom, and 320 px layout states are designed explicitly.
- Material state transitions use restrained live-region announcements; routine data refreshes do not continuously interrupt assistive technology.
- State is never communicated by red/amber/green alone.
- Last-confirmed times remain readable at every breakpoint.

## Privacy and governance boundary

All mockup and prototype records are visibly synthetic. Names, MRNs, dates of birth, addresses, contacts, narrative histories, and real bed counts are prohibited.

This design is not validated clinical decision support and is not production-ready. Operational use would require privacy assessment, RBAC, immutable audit, data-retention rules, availability and downtime planning, algorithm validation and change control, legal review, health-service governance, security review, and verified integrations.

## Mockup sequence

After the mockup-generation plan is reviewed:

1. Generate exactly three independent image directions for the primary desktop flow-coordinator screen.
2. Preserve the approved schematic-network architecture in all three while varying hierarchy, density, and interaction treatment.
3. Ask the user to select or combine one direction.
4. Generate the selected direction's phone and role-specific companion screens.
5. Only then write the coded production implementation plan against the selected visual target.

## Acceptance criteria for the design phase

- A flow coordinator can find the highest-priority movement and its reason within 10 seconds.
- Each role can identify its next owned action within 30 seconds.
- A user can distinguish allocatable, held, potential, blocked, and occupied capacity without relying on colour.
- A user can explain why a destination is recommended or excluded.
- A user can see catchment-first handling and statewide escalation without reading an audit log.
- A user can identify the current movement stage, owner, blocker, legal timing, and transport status.
- Phone users can complete role-owned tasks without using the map.
- No screen contains real patient or real-time bed data.
