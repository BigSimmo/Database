# Ward Flow mode map

> **Status (2026-09-02):** superseded. The role screens this document says are unbuilt now exist as the developer-gated sandbox under `/mockups/ward-flow` (32 routes; see `docs/codebase-index.md` § Ward Flow). Kept as the pre-sandbox design record.

**Superseded:** the nine-mode strip this document describes is superseded by the role-first
structure (flow coordinator, ED, ward, transport officer, specialist boards) set out in
[`docs/superpowers/specs/2026-08-18-ward-flow-metro-patient-flow-design.md`](./superpowers/specs/2026-08-18-ward-flow-metro-patient-flow-design.md).
Phases 2-5 of that design are built (see `docs/ward-flow-context.md` for the phase table). The
route table below is the **coordinator-view subset** — the eight `WARD_VIEWS` entries. The role
screens and specialist boards added by Phases 3-5 (and since expanded further) are listed in the
second table below; the source of truth for both is `WARD_VIEWS` + `WARD_NAV` in
`src/components/ward-management/ward-nav.ts`, and `tests/ward-landmarks.test.ts` pins the full
count (32 routes: 31 renderable + 1 redirect-only).

**Phase 2 update (Task 9):** Constellation (`/mockups/ward-flow/constellation`) is retired. The
route remains as a server `redirect()` to `/mockups/ward-flow/network` so live-main bookmarks do
not 404. Command
is rebuilt as the coordinator screen (`CoordinatorScreen`) — priority queue, statewide flow
diagram and explainable shortlist in one view — and absorbs the working-surface role Constellation
used to carry; the table below is corrected to drop the Constellation row. The eight remaining
mode links (Command, Network, Priority queue, Capacity, Movements, Exceptions, Transport,
Governance) moved out of the horizontal mode strip and into the left `ClinicalRail`, per the
owner's direction that Ward Flow is its own application inside the PsychSift shell and free to
use that rail for its own navigation. See "Navigation" below.

**Status:** Synthetic product wireframe. The routes below model a WA mental-health patient-flow coordination layer; they do not claim to reproduce an internal WA Health system or current allocation policy.

## Operating model

Ward Flow uses one shared synthetic movement record and three role lenses:

- **Flow coordinator:** statewide demand, cross-HSP escalation, destination review, bed holds and movement exceptions.
- **ED mental health:** referral readiness, legal/form timing, handover requirements and transport request readiness.
- **Ward manager:** capacity confirmation, suitability response, release forecast, acceptance and time-limited holds.

The public WA sources used to ground the wireframes establish five important constraints:

1. The WA health system uses system-wide flow coordination and real-time or predictive dashboards to monitor demand, patient movement and bed availability.
2. Public reporting describes an Assertive Mental Health Patient Flow Beds Live dashboard with ward-level secure and non-secure availability. Ward Flow therefore adds a coordination layer rather than presenting itself as the bed-state source of truth.
3. Mental Health Act referral, detention, transport, transfer and inpatient states have distinct approved forms and timing; the UI must show plain language plus the relevant form, not a single `involuntary` flag.
4. Country transfers involve WACHS Mental Health Patient Flow and MHETS coordination, and country transport processes differ from metropolitan processes.
5. WA Health's mandatory AI policy and the WA Government AI Assurance Framework require responsible, safe, transparent and accountable use. The prototype exposes reasons, confidence, owner, override and human confirmation; it never performs an automatic allocation.

## Primary route system

| Mode           | Route                           | Primary question                                                            | Dominant visual                                                        | Primary owner         |
| -------------- | ------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------- |
| Command        | `/mockups/ward-flow`            | What needs a decision now?                                                  | Priority queue + statewide flow diagram + explainable shortlist        | Flow coordinator      |
| Network        | `/mockups/ward-flow/network`    | Where is bed pressure concentrated, and which movements cross a catchment?  | Schematic node/edge diagram: fill is bed pressure, edges are movements | Flow coordinator      |
| Priority queue | `/mockups/ward-flow/queue`      | Which placement-ready movement should be reviewed next, and why?            | Sortable queue with tier, operational score and current blocker        | Flow coordinator / ED |
| Capacity       | `/mockups/ward-flow/capacity`   | Which currently confirmed bed states could support a review?                | Hospital and ward capacity matrix with freshness and capability        | Ward manager          |
| Movements      | `/mockups/ward-flow/movements`  | Where is every patient movement in the six-stage pathway?                   | Stage board with owned next action and elapsed time                    | All roles             |
| Exceptions     | `/mockups/ward-flow/exceptions` | Which time-sensitive exception needs an owner action?                       | Action inbox organised by overdue, expiring and stale state            | All roles             |
| Transport      | `/mockups/ward-flow/transport`  | Is the legal/document/booking chain ready for safe transfer?                | Transport readiness board and metro/country pathway cues               | ED / Flow coordinator |
| Governance     | `/mockups/ward-flow/governance` | Why did the system recommend this, who confirmed it, and what is synthetic? | AI assurance, audit trail, data boundary and source register           | Authorised reviewers  |

### Role screens and specialist boards (Phases 3-5, and later additions)

The 24 routes below complete the 32-route sandbox (8 core views above + these 24 = 32). They are
not modes in the eight-view sense: the three role screens (`ed/[edId]`, `ward/[unitId]`,
`board/[unitId]`) are entered from `WardRoleSwitcher` (the dynamic ones can only be linked as one
example instance each, `exampleOnly` in `WARD_NAV`), and the remaining boards, indexes and
workspaces sit outside the eight views. Source of truth: `WARD_NAV` in
`src/components/ward-management/ward-nav.ts` and the filesystem scan in
`tests/ward-landmarks.test.ts`.

**`/mockups/ward-flow/patients/[patientId]` no longer exists.** It was renamed to
`/mockups/ward-flow/movements/[movementId]`, nested under the existing `/movements` mode page
(see `tests/ward-landmarks.test.ts`'s own note: "despite its name [it] looked a MOVEMENT up by
id").

| Route                                         | What it is                                                                                  | Source                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `/mockups/ward-flow/ed/[edId]`                | Emergency department role screen (Phase 3); rail links the `peel-ed` example                | `src/app/mockups/ward-flow/ed/[edId]`                |
| `/mockups/ward-flow/ward/[unitId]`            | Ward role screen (Phase 3); rail links the `rph-adult-secure` example                       | `src/app/mockups/ward-flow/ward/[unitId]`            |
| `/mockups/ward-flow/board/[unitId]`           | Ward board for one unit; rail links the `rph-adult-secure` example                          | `src/app/mockups/ward-flow/board/[unitId]`           |
| `/mockups/ward-flow/transport/officer`        | Transport officer phone screen (Phase 3)                                                    | `src/app/mockups/ward-flow/transport/officer`        |
| `/mockups/ward-flow/movements/[movementId]`   | Patient workspace for one movement (renamed from `/patients/[patientId]`)                   | `src/app/mockups/ward-flow/movements/[movementId]`   |
| `/mockups/ward-flow/people/[patientId]`       | A person's own screen, distinct from the movement workspace above                           | `src/app/mockups/ward-flow/people/[patientId]`       |
| `/mockups/ward-flow/people/new`               | Add-patient form                                                                            | `src/app/mockups/ward-flow/people/new`               |
| `/mockups/ward-flow/handover`                 | Shift handover board (Phase 4)                                                              | `src/app/mockups/ward-flow/handover`                 |
| `/mockups/ward-flow/escalation`               | Escalation board (Phase 4)                                                                  | `src/app/mockups/ward-flow/escalation`               |
| `/mockups/ward-flow/search`                   | Patient search board (Phase 4); the only Ward Flow surface with a search slot               | `src/app/mockups/ward-flow/search`                   |
| `/mockups/ward-flow/discharges`               | Discharges board (Phase 5)                                                                  | `src/app/mockups/ward-flow/discharges`               |
| `/mockups/ward-flow/morning`                  | Morning bed state board                                                                     | `src/app/mockups/ward-flow/morning`                  |
| `/mockups/ward-flow/referrals`                | Referral board                                                                              | `src/app/mockups/ward-flow/referrals`                |
| `/mockups/ward-flow/referrals/new`            | New referral intake form                                                                    | `src/app/mockups/ward-flow/referrals/new`            |
| `/mockups/ward-flow/out-of-area`              | Out-of-area board                                                                           | `src/app/mockups/ward-flow/out-of-area`              |
| `/mockups/ward-flow/wards`                    | All-wards index — the page that gives `ward/[unitId]` a way in                              | `src/app/mockups/ward-flow/wards`                    |
| `/mockups/ward-flow/community`                | All-community-teams index — the page that gives `community/[teamId]` a way in               | `src/app/mockups/ward-flow/community`                |
| `/mockups/ward-flow/community/[teamId]`       | Community team screen                                                                       | `src/app/mockups/ward-flow/community/[teamId]`       |
| `/mockups/ward-flow/statistics`               | Statistics index                                                                            | `src/app/mockups/ward-flow/statistics`               |
| `/mockups/ward-flow/statistics/overview`      | Statistics overview                                                                         | `src/app/mockups/ward-flow/statistics/overview`      |
| `/mockups/ward-flow/statistics/compare`       | Statistics comparison view                                                                  | `src/app/mockups/ward-flow/statistics/compare`       |
| `/mockups/ward-flow/statistics/ward/[unitId]` | Ward statistics                                                                             | `src/app/mockups/ward-flow/statistics/ward/[unitId]` |
| `/mockups/ward-flow/statistics/ed/[edId]`     | Emergency department statistics                                                             | `src/app/mockups/ward-flow/statistics/ed/[edId]`     |
| `/mockups/ward-flow/constellation`            | Redirect-only stub to `/mockups/ward-flow/network` (Phase 2 retirement; see the note above) | `src/app/mockups/ward-flow/constellation`            |

**Navigation:** the left `ClinicalRail` carries both the global PsychSift application switcher
and, below it, Ward Flow's own eight mode links (icon-only, each with its own accessible name) —
there is no separate horizontal mode strip. This follows from Ward Flow being its own application
inside the PsychSift shell, free to use that rail as its own local navigation, and it also gives
the coordinator screen back the vertical space the horizontal strip used to take. The rail stays
visible and reachable down to 320px; on a short viewport the mode-link section scrolls
independently of the pinned app-switcher icons above it and the pinned favourites/settings/avatar
controls below it.

## Role-to-mode defaults

| Role             | Default focus        | Can act on                                                                       | Read-only context                                |
| ---------------- | -------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------ |
| Flow coordinator | Command              | Match review, cross-catchment escalation, hold coordination, exception ownership | ED readiness, ward capacity, transport documents |
| ED mental health | Queue / Transport    | Referral readiness, legal/form timing, handover and transport request readiness  | Destination shortlist and ward response          |
| Ward manager     | Capacity / Movements | Capacity freshness, suitability response, acceptance and hold                    | ED handover and transport status                 |

Role switching changes task emphasis and owned controls, not the underlying record.

## Patient-to-bed proposal contract

The prototype's `AI best fit` is an operational proposal:

- Human urgency tier remains the first ordering rule.
- The algorithmic score orders movements within a tier using elapsed wait, timing, response delay, transport delay, blockers and escalation state.
- Candidate eligibility is evaluated before ranking: cohort, open/secure setting, unit capability, legal/transport constraints, bed state and freshness.
- Local catchment appears first when suitable. Statewide options remain visible when local placement is unavailable or delayed.
- Every proposal displays positive reasons, exclusions, last calculation time and alternative destinations.
- An authorised user must confirm or override. The action and reason appear in the synthetic audit trail.
- The score is labelled operational priority or operational fit, never clinical severity.

## Network diagram semantics

The network mode is a schematic, not a map. Positions are fixed layout coordinates chosen for
legibility and carry no geographic meaning; the mode says so on the page.

- A node is one service. Its fill is a **bed pressure band** derived only from confirmed
  available beds against total beds: no beds (0 available), tight (under 15%), moderate
  (15–28%), open (over 28%). Potential capacity is deliberately excluded because it is not yet
  allocatable.
- An edge is one open movement, drawn from the patient's catchment anchor to the destination
  service. Edges inside a catchment are plain; cross-catchment escalations are dashed and
  emphasised, because escalation is the state a coordinator most needs to see at a glance.
- Selecting a node dims unrelated edges and replaces the side panel with that service's five
  bed states, freshness and inbound movements. Nothing on this mode confirms or changes a
  placement; it is a read surface that hands off to the queue and decision surfaces.

Command and Network deliberately overlap now that Constellation is retired. Command is the
working surface — it carries the queue and the explainable shortlist. Network is the diagnostic
one: it answers "where is the system under strain" without asking the coordinator to act.

## Capacity semantics

Capacity and suitability are separate. Each displayed place has one state:

1. Available now — confirmed and allocatable.
2. Held — reserved until a visible time.
3. Potential — may become available after a named operational action and estimate.
4. Blocked — unavailable with a reason.
5. Occupied — no availability.

Every state includes a last-confirmed time. Stale data becomes an exception rather than silently retaining a green status.

## Movement semantics

The visible pathway has six stages:

1. Placement requested.
2. Destination review.
3. Bed held.
4. Handover ready.
5. Moving.
6. Arrived.

Cross-catchment escalation is a flag across these stages, not a seventh stage.

## Privacy and production boundary

Wireframes use `WF-###` identifiers and synthetic operational fields only. They deliberately omit name, date of birth, medical record number, address, diagnosis, narrative history, treatment information and departing-patient details. The prototype does not persist data or call PAS, PSOLIS, ED, bed-management, ambulance, police, cloud AI or other provider systems.

Operational use would require WA Health AI assurance, privacy impact assessment, RBAC, immutable audit, data-retention and deletion rules, verified source integrations, model and rule validation, monitoring, downtime procedures, legal review and health-service governance approval.

## Public WA grounding

- [WA Health System Flow Centre](https://www.health.wa.gov.au/Improving-WA-Health/System-Flow-Centre)
- [WA Department of Health Annual Report 2024-25](https://www.health.wa.gov.au/~/media/Corp/Documents/Reports-and-publications/Annual-report/2025/Annual-Report-2025.pdf)
- [WA Health mental health patient transport](https://www.health.wa.gov.au/Articles/J_M/Mental-health-patient-transport)
- [Office of the Chief Psychiatrist Mental Health Act 2014 forms](https://www.chiefpsychiatrist.wa.gov.au/laws-and-rights/legislation/mental-health-act-2014-forms/)
- [WACHS Mental Health Emergency Telehealth Service](https://www.wacountry.health.wa.gov.au/Our-services/Command-Centre/Mental-Health-Emergency-Telehealth-Service)
- [WA Health Artificial Intelligence Policy](https://www.health.wa.gov.au/about-us/policy-frameworks/digital-health/mandatory-requirements/artificial-intelligence-policy)
- [WA Government Artificial Intelligence Policy and Assurance Framework](https://www.wa.gov.au/government/publications/wa-government-artificial-intelligence-policy-and-assurance-framework)
- [WA Information Commissioner: privacy and accountability in automated decision making](https://www.wa.gov.au/organisation/office-of-the-information-commissioner/privacy-and-accountability-automated-decision-making)
