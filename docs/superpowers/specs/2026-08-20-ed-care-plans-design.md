# ED Care Plans — Standalone Synthetic Application Design

**Status:** User-approved product and visual direction; implementation plan complete; implementation not started.

## Purpose

Build a complete, linked, synthetic application for finding people with recurrent psychiatric emergency-department presentations and making their current management plan easy to find and use. The same patient workspace also records concise ED presentation outcomes, exposes the responsible community mental health team (CMHT), and maintains a distinct printable Personal Safety Plan.

The primary usability target is that an authorised ED clinician can find the correct synthetic patient, confirm whether a Current Plan exists, understand its first-minute continuity guidance, and reach the CMHT contact within 30 seconds.

The product name is **ED Care Plans**, with the descriptor **Continuity for recurrent presentations**. Patient-facing and clinician-facing copy must not use “frequent flyer”. “Frequent presenter” is reserved for discussion of the service workflow, not as a label for a person.

The canonical domain language is defined in [`docs/ed-care-plans-context.md`](../../ed-care-plans-context.md).

## Evidence and governance grounding

The design reflects public Australian guidance that:

- Mental-health presentations in ED require individual care planning, appropriate transfer of information, communication with follow-up services, and patient, carer, and provider involvement.
- Comprehensive care plans are developed through shared decision-making, identify agreed goals and accountable actions, and are reviewed when they are ineffective or the person's circumstances change.
- Safety planning should be personal, practical, and accessible to the person during distress.
- Health information is sensitive information and must be collected, disclosed, printed, and communicated carefully.
- Comparable frequent-use programs apply different locally governed presentation thresholds and emphasise coordinated, non-stigmatising care rather than punitive labelling.

Primary public references:

- [Australian Commission on Safety and Quality in Health Care — Comprehensive Care Standard](https://www.safetyandquality.gov.au/standards/nsqhs-standards/comprehensive-care-standard/clinical-governance-and-quality-improvement-support-comprehensive-care)
- [Victorian Department of Health — Emergency departments and clinical care](https://www.health.vic.gov.au/practice-and-service-quality/emergency-departments-and-clinical-care)
- [NSW Agency for Clinical Innovation — Complex Care Coordination in NSW Emergency Departments](https://aci.health.nsw.gov.au/ie/projects/complex-care-coordination)
- [Lifeline/Beyond Blue — suicide safety planning](https://www.beyondblue.org.au/mental-health/suicide-prevention/suicide-safety-planning)
- [WA Health — Mental Health Emergency Response Line](https://emhs.health.wa.gov.au/Hospitals-and-Services/Mental-Health-Alcohol-and-Other-Drugs/Inpatient-and-Other-Services/MHERL)
- [Office of the Australian Information Commissioner — Guide to health privacy](https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/health-service-providers/guide-to-health-privacy/introduction-and-key-concepts)

These sources ground the prototype's workflow and language. They do not validate the application for clinical use, establish a local identification policy, or substitute for WA Health governance review.

## Product boundary

### Included

- A linked route suite under `/mockups/ed-care-plans`.
- Deterministic synthetic patients, clinicians, EDs, CMHTs, plans, presentations, and audit events.
- A multi-site fictional WA health-service context with three fictional EDs and several fictional CMHTs.
- Adults and older adults.
- Search by synthetic name, MRN, date of birth, and alias.
- Objective presentation-activity counts without an encoded eligibility threshold.
- Manual referral to an identification-review worklist.
- One longitudinal Management Plan per patient with versioning, named ownership, senior-clinician approval, review triggers, and history.
- A separate patient-owned Personal Safety Plan with its own versions and print view.
- Concise, append-only ED Presentation records with visible amendments.
- CMHT team, shared-mailbox, telephone, operating-hours, care-coordinator, and after-hours details.
- Explicit empty, stale, overdue, conflicting, offline, and unavailable states.
- Desktop, tablet, phone, keyboard, dark, reduced-motion, forced-colour, and print presentations.

### Excluded

- Real patient, clinician, service, site, caseload, or utilisation data.
- Persistent storage, local storage, cookies for patient state, databases, APIs, analytics, or network calls.
- EDIS, EMR, PAS, PSOLIS, pharmacy, ambulance, police, CMHT, email-provider, or identity-provider integration.
- Automatic identification, enrolment, diagnosis, risk scoring, clinical-severity scoring, treatment recommendation, allocation, or plan generation.
- Medication ordering or a parallel medication record.
- Automated email or messaging.
- A general staff inbox, chat, comments feed, or social activity.
- CAMHS, forensic, perinatal, eating-disorder, or other specialist-cohort workflows.
- Production authentication, authorisation, break-glass access, retention enforcement, or immutable audit infrastructure.
- Production deployment or any claim of clinical, privacy, security, legal, or operational readiness.

## Resolved product decisions

1. Each patient has one longitudinal Management Plan. Its approved versions describe continuity guidance across presentations rather than one episode of care.
2. Only a named senior-clinician approval action can make a Management Plan Version Current. Draft and Awaiting Approval versions never replace the existing Current Plan.
3. A Personal Safety Plan is a separate patient-owned document, co-produced with the patient and independently versioned. It does not require the same senior-clinician approval as the Management Plan.
4. ED Presentations are separate episode records linked to the patient and to the Management Plan Version available during that presentation.
5. The numeric presentation threshold is intentionally unspecified. The application must not encode, imply, default, or visually suggest an approved number until local governance resolves it.
6. Objective presentation activity may be displayed and sorted. Authorised users may manually refer a patient for identification review.
7. CMHT email actions launch the user's email client but must not pre-populate patient identifiers or clinical content and must not record that an email was sent or received.
8. The application remains a synthetic, reset-on-refresh prototype. “Created” and “stored” mean held in the current in-memory prototype session only.
9. (Added 21 August 2026, user decision.) The prototype is built so that real persistence could later be added without redesigning the domain: the reducer stays pure, prototype state stays plain serialisable data, and every change goes through one dispatched action. No storage layer, adapter, persistence flag, or migration scaffolding is built now, and this decision does not weaken any synthetic-only, privacy, or production-readiness boundary stated elsewhere in this specification.

## Visual direction

The approved primary shell is **Direction A — Clinical Snapshot**.

### Desktop and tablet

- A restrained Sky Graphite clinical rail carries `Home`, `Patients`, `Reviews`, `Team`, and `Governance`.
- The main header contains one prominent patient search and the context-appropriate primary action.
- The Home and Patients surfaces use a split layout: a compact patient directory or recent-patient list on the left and the selected patient workspace on the right.
- The Current Plan owns the visual centre. Status, version, approver, review state, first-minute guidance, CMHT contact, and Personal Safety Plan access appear without scrolling at an ordinary desktop viewport.
- Presentation history uses Direction B's longitudinal timeline inside the patient workspace.
- Governed approval, review, contact-verification, and manual-identification worklists use Direction C's queue treatment on the separate Reviews route.

### Phone

- Phone never compresses the desktop split view into two narrow columns.
- Search and recent patients form one full-width surface; selecting a patient opens a full-width workspace.
- The Current Plan summary, CMHT contact, Personal Safety Plan, and `Record ED presentation` action remain reachable without a desktop-only rail.
- Primary controls meet the repository's 48 px target convention.
- At 320 px and 390 px, meaningful top content remains below the effective safe-area inset while the background may paint edge-to-edge.

### Repository design language

- Reuse the repository's Clinical White / Sky Graphite token roles and shared components.
- Use true-white working surfaces, graphite navigation and command actions, and clinical blue for selection and focus.
- Reserve green for genuinely current or completed states, amber for review/staleness states, and red for unavailable, withdrawn, or blocking states.
- Every state has text and structure; colour is never the only differentiator.
- Prefer hairline borders, restrained surface shifts, and tabular numerals over nested card stacks, gradients, or heavy shadows.
- Support dark mode, forced colours, reduced motion, zoom, keyboard navigation, and print without separate information hierarchies.

## Information architecture

The linked application uses the following route families:

| Route                                                                        | Purpose                                                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `/mockups/ed-care-plans`                                                     | Search-first Home and Clinical Snapshot                                                     |
| `/mockups/ed-care-plans/patients`                                            | Full patient directory and presentation-activity view                                       |
| `/mockups/ed-care-plans/patients/[patientId]`                                | Patient overview and first-minute snapshot                                                  |
| `/mockups/ed-care-plans/patients/[patientId]/management-plan`                | Full Current Plan, draft summary, review state, and version history entry points            |
| `/mockups/ed-care-plans/patients/[patientId]/management-plan/edit`           | Create or edit a draft version                                                              |
| `/mockups/ed-care-plans/patients/[patientId]/management-plan/review`         | Compare, return for changes, and approve a submitted version                                |
| `/mockups/ed-care-plans/patients/[patientId]/safety-plan`                    | Current patient-owned Personal Safety Plan                                                  |
| `/mockups/ed-care-plans/patients/[patientId]/safety-plan/edit`               | Co-produce or revise a Personal Safety Plan Version                                         |
| `/mockups/ed-care-plans/patients/[patientId]/safety-plan/print`              | Print-optimised patient copy                                                                |
| `/mockups/ed-care-plans/patients/[patientId]/presentations`                  | Longitudinal ED Presentation timeline                                                       |
| `/mockups/ed-care-plans/patients/[patientId]/presentations/new`              | Record a concise ED Presentation                                                            |
| `/mockups/ed-care-plans/patients/[patientId]/presentations/[presentationId]` | View an episode, plan-use feedback, outcome, and amendments                                 |
| `/mockups/ed-care-plans/patients/[patientId]/history`                        | Combined plan, presentation-amendment, print, and contact-action audit chronology           |
| `/mockups/ed-care-plans/reviews`                                             | Awaiting Approval, Review Suggested, contact verification, and manual identification queues |
| `/mockups/ed-care-plans/team`                                                | Synthetic CMHT and plan-owner directory                                                     |
| `/mockups/ed-care-plans/governance`                                          | Prototype boundary, roles, lifecycle rules, and unresolved identification policy            |
| `/mockups/ed-care-plans/system-states`                                       | Deterministic degraded-state specimens and scenario controls                                |

The route suite is linked from the login-gated Developer hub rather than production navigation. Each route has a literal inbound link or an explicitly documented parameterised child relationship so repository reachability checks remain truthful.

## Patient workspace

Every patient workspace keeps the following identity and currency information visible:

- Synthetic-data label.
- Synthetic name, MRN, date of birth, age cohort, preferred name, pronouns, and fictional home health service.
- Current Plan status, version, approver, approval date, owner, review date, and review state.
- Personal Safety Plan status and confirmation date.
- Primary CMHT, care coordinator, current availability, after-hours pathway, and last-verified date.
- Objective rolling presentation counts with the lookback period stated.

The workspace uses four primary patient sections: `Overview`, `Management Plan`, `Personal Safety Plan`, and `ED Presentations`. `History` remains available as a secondary audit surface.

## Management Plan content

The collapsed Current Plan summary shows:

- Preferred engagement approach.
- What usually helps.
- What may increase distress.
- Immediate continuity considerations.
- CMHT coordination expectation.
- Current owner, approver, and review state.

The full plan adds:

- Purpose and applicability.
- Patient goals and preferences.
- Usual presentation pattern and known contextual triggers.
- Assessment considerations and explicit “must assess afresh” boundary.
- Agreed ED approach and escalation/disposition guidance.
- Helpful and unhelpful interventions.
- Physical-health and medication-record reminders without reproducing orders.
- CMHT, primary-care, and consented support-person coordination.
- Patient and carer involvement state.
- Review triggers and the reason for the current version.

Every view of the plan states that it supports continuity and never replaces fresh triage, physical assessment, mental-state assessment, immediate risk assessment, clinical judgment, or legal obligations.

## Management Plan lifecycle

A Management Plan has one or more versions. Version state and review state remain separate:

- Version states: `draft`, `awaiting_approval`, `current`, `superseded`, `withdrawn`.
- Review states for a Current version: `within_review`, `due_soon`, `overdue`.

The workflow is:

1. Create a draft from an empty plan or copy the Current version.
2. Edit required structured sections and a concise revision reason.
3. Submit the draft for senior-clinician approval.
4. Compare the submitted version against the Current version.
5. Return it to Draft with a reason or approve it with an explicit confirmation.
6. On approval, atomically make the submitted version Current and the previous Current version Superseded.
7. Withdraw a Current version only with an explicit reason and confirmation, leaving the patient with no Current Plan rather than silently restoring an older version.

An overdue Current Plan remains visible with a prominent warning. It is not silently hidden, downgraded to Draft, or represented as expired. A replacement draft never suppresses the Current version while approval is pending.

## ED Presentation record

Each ED Presentation records only the continuity information this application owns:

- Arrival date and time.
- Fictional ED site.
- Concise presenting indication.
- Concise assessment outcome.
- Disposition: discharged home, short stay, mental-health admission, medical admission, transfer, left before completion, or other.
- CMHT contact attempt and operational outcome.
- Management Plan Version available.
- Whether the plan was available, used, partially used, not applicable, or not used.
- Whether it was helpful, mixed, not helpful, or not assessed.
- Any deviation and its reason.
- Whether plan review is suggested and why.
- Recording synthetic clinician and recorded time.

The record does not duplicate a full ED note, diagnosis list, medication chart, risk assessment, or narrative clinical history.

ED Presentation records are append-only in the domain model. A correction creates a visible Presentation Amendment with author, time, reason, and replacement value. Plan-use feedback that suggests review creates a Review Trigger without automatically changing the plan.

## Personal Safety Plan

The Personal Safety Plan is written in the patient's voice and uses seven practical sections:

1. My warning signs.
2. Making my surroundings safer.
3. My reasons for living.
4. Things I can do myself.
5. People and places that help me feel connected.
6. Family, friends, and supports I can contact.
7. Professional and emergency support.

It has independent `draft`, `current`, and `superseded` versions plus `within_review`, `due_soon`, and `overdue` review states. The patient-confirmation state records `confirmed`, `discussed_not_confirmed`, `declined`, or `unavailable`. A clinician records the collaboration; senior-clinician approval is not required.

The print route:

- Uses plain language and large, scannable sections.
- Includes minimum necessary synthetic identifiers, version, last-confirmed date, personal supports, CMHT details, and urgent-help information.
- Includes a clear `000` emergency instruction and source-backed Australian and WA crisis contacts.
- Shows a synthetic-prototype watermark and a printed-at timestamp.
- Removes navigation, action controls, audit history, and unrelated presentation data.
- Uses browser print/PDF capability with repository print styles; no PDF dependency is added.

## CMHT and contact actions

Each CMHT record includes:

- Fictional team name and catchment.
- Shared mailbox.
- Duty telephone.
- Operating hours and timezone.
- Named fictional care coordinator where applicable.
- After-hours label and telephone.
- Last verified date and verification state.

`Email team` uses a `mailto:` URI containing only the shared mailbox and a generic non-clinical subject. It contains no name, MRN, date of birth, presentation reason, plan content, or other patient information. Opening the URI creates an `email_intent_opened` Audit Event; it never creates delivery, readership, response, or contact-completion evidence.

`Call` uses a `tel:` URI and records no completed-call claim. The app displays the number and operating hours before invoking it.

Current public crisis details must be source-verified when implemented. As verified on 20 August 2026, the prototype may present `000` for emergencies, MHERL for metropolitan Perth and Peel, and Rurallink for regional and remote WA, with the explicit statement that MHERL is not an emergency service.

## Identification review

The prototype includes an Identification Policy record with:

- `status: pending_governance`.
- No threshold count.
- No lookback threshold.
- Manual referral enabled.
- A visible explanation that local clinical and privacy governance must define eligibility before operational use.

Patient lists may display objective counts such as “7 ED presentations in 12 months” and sort by activity. They must not convert those counts into an automatic label, mandatory care pathway, severity claim, or risk score.

An authorised synthetic user may manually add a patient to `Identification review` with a reason. The queue action initiates multidisciplinary review; it does not create or approve a plan.

## Roles and permissions boundary

The prototype illustrates, but does not enforce, these responsibilities:

- ED clinician: find and read the Current Plan, record a presentation, capture plan-use feedback, and access contacts.
- ED mental-health liaison or CMHT clinician: create and edit drafts, co-produce the Personal Safety Plan, verify contacts, and respond to review triggers.
- Named senior clinician: compare, return, approve, withdraw, and record formal review of a Management Plan Version.
- Plan coordinator: manage review and identification worklists without making clinical-severity judgments.

The displayed synthetic user and role explain why an action is available. This is interaction modelling only, not authentication, RBAC, relationship-based access, or break-glass evidence.

## Patient, carer, communication, and cultural preferences

The Management Plan records whether participation was `co_produced`, `discussed`, `declined`, or `patient_unavailable`. It may record consented support people and whether their involvement is current.

The patient-owned summary can include:

- Preferred name and pronouns.
- Communication preferences.
- What helps the person feel safe and heard.
- What may increase distress.
- Interpreter and accessibility needs.
- Sensory and environmental preferences.
- Cultural, spiritual, family, community, Aboriginal Liaison, or peer-support preferences.

Non-participation is never labelled non-compliance. Sensitive details are shown only when needed for the approved synthetic scenario and are not made searchable.

## Review triggers and queues

A Review Trigger can arise from:

- A clinician marking the plan not helpful or mixed.
- A materially different presentation or outcome.
- A mental-health or medical admission.
- Repeated plan deviations.
- A change in CMHT, care coordinator, patient preference, support involvement, or Personal Safety Plan.
- An overdue formal review.
- Unverified CMHT contact details.

The Reviews route has four focused queues:

1. Awaiting Approval.
2. Review Suggested.
3. Contact Verification.
4. Identification Review.

These are action worklists, not performance dashboards. They do not rank patients by clinical severity or optimise for reducing attendance alone.

## State architecture

One client-side provider owns the complete synthetic application state. A pure reducer applies explicit domain actions and refuses invalid transitions. Routes read the same state rather than maintaining route-local copies.

Primary entities are:

- `Patient`.
- `ManagementPlan` and `ManagementPlanVersion`.
- `PersonalSafetyPlan` and `PersonalSafetyPlanVersion`.
- `EdPresentation` and `PresentationAmendment`.
- `CmhtContact`.
- `ReviewTrigger`.
- `IdentificationPolicy` and `IdentificationReview`.
- `AuditEvent`.

All fixture IDs use a `SYN-` prefix, and every patient-facing route displays the fictional-data boundary. Refresh returns the application to deterministic fixtures. The provider performs no persistence or network access.

## Error and degraded-state behaviour

- **No Current Plan:** state this directly and keep any draft visibly separate.
- **Review overdue:** keep the Current Plan readable with a persistent caution and review action.
- **Withdrawn plan:** show the withdrawal reason and do not silently restore a superseded version.
- **Identity uncertainty:** require the user to return to search; never display a nearby patient's plan as a fallback.
- **Conflicting draft:** preserve both the saved synthetic version and the user's working copy, explain the conflict, and offer explicit reload or review actions.
- **Offline/unavailable:** show the last fixture-backed state only in the dedicated specimen scenario and make all mutation actions unavailable with a stated reason.
- **CMHT contact unverified:** keep details visible with a warning, last-verified date, and verification task; do not imply availability.
- **Email/call launch failure:** retain the displayed contact details and explain that the external application could not be opened.
- **Print failure:** keep the Safety Plan visible and offer retry through the browser print action.
- **Invalid transition:** leave state unchanged, show a specific explanation, and announce the result without claiming success.

Errors use the repository's three-part content pattern: what happened, what it means, and what action is available.

## Accessibility and responsive requirements

- One clear page heading and landmark structure per route.
- Search, tabs, forms, tables, sheets, dialogs, and print actions use shared repository primitives where available.
- Every interactive control has a real action or an explicit unavailable reason.
- All primary targets meet the 48 px convention.
- No hover-only, colour-only, map-only, or drag-only interaction.
- Focus order follows visual order in desktop split and phone single-column layouts.
- Material state changes use restrained live announcements; routine fixture changes do not create announcement noise.
- Dense presentation or version data has a semantic list/table equivalent.
- At 200% zoom and 320 px width, content reflows without horizontal page scrolling.
- Forced colours preserves Current, Draft, Review, Withdrawn, and unavailable distinctions.
- Reduced motion removes decorative transitions without hiding state changes.
- The Personal Safety Plan print view remains readable in colour and monochrome.

## Synthetic scenarios

Fixtures cover at least these states without using real organisations or identifiable details:

- Current Plan and Current Personal Safety Plan.
- Review-overdue Current Plan.
- No plan with objective presentation activity.
- Draft awaiting approval while an older Current Plan remains active.
- Returned-for-changes draft.
- Withdrawn plan.
- Presentation that found the plan helpful.
- Presentation that creates a Review Trigger.
- Amended presentation outcome.
- Unverified CMHT contact.
- Identification review created manually while the policy remains pending governance.
- Identity uncertainty, conflict, offline, launch-failure, empty, and print specimens.

## Verification strategy

Implementation verification is local and offline:

- Pure reducer tests pin valid transitions, refused transitions, single-Current invariants, append-only presentation behaviour, amendments, and audit semantics.
- Domain/privacy tests reject non-synthetic identifiers, an encoded threshold, patient data in `mailto:` URIs, medication orders, automated recommendations, and delivery/readership overclaims.
- DOM tests cover search, Current-versus-Draft hierarchy, review warnings, route-local actions, error summaries, and accessible names.
- Route tests cover every linked route, static parameters, Developer-hub reachability, and literal inbound navigation requirements.
- Focused Chromium journeys cover search-to-plan, record-presentation, plan-use feedback, draft-to-approval, return-for-changes, version comparison, safety-plan edit and print, CMHT contact launch, presentation amendment, manual identification review, and degraded states.
- Visual checks cover desktop, 390 px, 320 px, dark mode, forced colours, reduced motion, 200% zoom, and print.
- Build verification confirms the Next.js route suite compiles and remains within the separate mockup bundle budget.

No live Supabase, OpenAI, email, identity, hospital, CMHT, analytics, or provider verification is authorised or required for this prototype.

## Acceptance criteria

- An ED clinician can find a synthetic patient and the Current Plan within 10 seconds.
- The first-minute continuity guidance, Current status, version, approver, review state, and CMHT contact are understandable within 30 seconds.
- A clinician can record a concise ED Presentation within two minutes.
- The Current Personal Safety Plan is reachable and printable within three actions.
- A replacement draft never obscures or replaces the Current Plan before approval.
- Approving a version creates exactly one Current version and supersedes the prior Current version.
- An overdue Current Plan remains readable and unmistakably overdue.
- Presentation corrections are visible amendments rather than silent overwrites.
- Plan-use feedback can create a Review Trigger but cannot change a plan automatically.
- Objective presentation counts never become an automatic patient label or eligibility decision.
- No numeric identification threshold appears in code, fixture content, tests, or interface copy.
- CMHT email links contain no patient identifier or clinical content and never imply successful communication.
- The Personal Safety Plan remains independent from the clinician-facing Management Plan.
- Every record and screen is visibly synthetic, and refresh restores deterministic state.
- The primary journeys work at desktop, 390 px, and 320 px and remain operable by keyboard.
- Current, Draft, Review, Withdrawn, unavailable, and error states remain distinguishable without colour.
- The print view is readable in monochrome and contains only the intended patient-facing Safety Plan content.

## Production-readiness boundary

The prototype demonstrates an interaction and domain model only. Operational use would require, at minimum, WA Health clinical governance approval, an approved identification policy, patient and consumer co-design, privacy impact assessment, cultural-safety review, legal review, clinical-content validation, data-retention rules, authoritative record ownership, identity matching, RBAC and relationship-based access, break-glass controls, immutable audit, secure messaging, integration contracts, concurrency control, downtime procedures, cybersecurity review, accessibility acceptance, training, monitoring, incident response, and controlled deployment.

Passing local tests or rendering a complete prototype does not satisfy any of those requirements.
