# Care Plan — Standalone Synthetic Application Design

**Status:** User-approved product and visual direction; implementation plan complete; implementation not started.

## Purpose

Build a complete, linked, synthetic application for finding people with recurrent psychiatric emergency-department presentations and making their current management plan easy to find and use. The same patient workspace also records concise ED presentation outcomes, exposes the responsible community mental health team (CMHT), and maintains a distinct printable Personal Safety Plan.

The primary usability target is that an authorised ED clinician can find the correct synthetic patient, confirm whether a Current Plan exists, understand its first-minute continuity guidance, and reach the CMHT contact within 30 seconds.

The product name is **Care Plan**, with the descriptor **Continuity for recurrent presentations**. Patient-facing and clinician-facing copy must not use “frequent flyer”. “Frequent presenter” is reserved for discussion of the service workflow, not as a label for a person.

The canonical domain language is defined in [`docs/care-plan-context.md`](../../care-plan-context.md).

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

## Naming

The product is **Care Plan**, descriptor **Continuity for recurrent presentations** (renamed from ED Care Plans on 21 August 2026). The documents inside it keep their glossary names, which are deliberately not the product name so that "the app" and "the document" can never be confused in code, copy, or conversation:

- **Management Plan** — the clinician-facing continuity document. The main object of the product.
- **Patient Plan** — the patient-facing edition of that Management Plan, in the person's own voice.
- **Personal Safety Plan** — the person's own distress plan, which is theirs rather than a clinical document.

## Read primacy

Decided 21 August 2026 by the user: _"the plan is for clinicians to look up and see the management plan; it is rarely for changing or updating — this is the main use."_

This is the ordering principle for the whole product, not a preference. Where reading and authoring compete for screen space, navigation depth, attention, or implementation effort, **reading wins**. Concretely:

- The search-to-read journey is never more than two actions from any route.
- Authoring, comparison, approval, and withdrawal controls never occupy space that first-minute reading content needs, and never appear above it.
- A reader who has no authoring permission sees a clean reading surface, not a surface full of unavailable controls.
- Build order follows the same rule: the complete reading experience, including print, is finished and reviewed before any authoring surface is built.

## Product boundary

### Included

- A linked route suite under `/mockups/care-plan`.
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
- Automatic identification, enrolment, diagnosis, risk scoring, clinical-severity scoring, treatment recommendation, allocation, or clinical plan generation.
- Any language model, AI service, or provider call, including for the Patient Plan transformation, which is deterministic and offline.
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
9. (Added 21 August 2026.) Reading is the primary use. Authoring, approval, comparison, and withdrawal are supporting machinery and never take precedence over the reading surface in layout, navigation depth, or build order.
10. (Added 21 August 2026.) The Patient Plan is produced by a deterministic offline transformation that flags what it cannot convert, requires clinician approval before the patient receives it, and never auto-converts the agreed-approach section.
11. (Added 21 August 2026.) The prototype is built so that real persistence could later be added without redesigning the domain: the reducer stays pure, prototype state stays plain serialisable data, and every change goes through one dispatched action. No storage layer, adapter, persistence flag, or migration scaffolding is built now, and this decision does not weaken any synthetic-only, privacy, or production-readiness boundary stated elsewhere in this specification.

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

| Route                                                                    | Purpose                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `/mockups/care-plan`                                                     | Search-first Home and Clinical Snapshot                                                     |
| `/mockups/care-plan/patients`                                            | Full patient directory and presentation-activity view                                       |
| `/mockups/care-plan/patients/[patientId]`                                | Patient overview and first-minute snapshot                                                  |
| `/mockups/care-plan/patients/[patientId]/management-plan`                | Full Current Plan, draft summary, review state, and version history entry points            |
| `/mockups/care-plan/patients/[patientId]/management-plan/edit`           | Create or edit a draft version                                                              |
| `/mockups/care-plan/patients/[patientId]/management-plan/review`         | Compare, return for changes, and approve a submitted version                                |
| `/mockups/care-plan/patients/[patientId]/management-plan/print`          | Print-optimised clinician summary to carry to the bedside or send with a handover           |
| `/mockups/care-plan/patients/[patientId]/patient-plan`                   | The patient-facing edition of the Management Plan, with its own version and approval state  |
| `/mockups/care-plan/patients/[patientId]/patient-plan/edit`              | Create the patient edition from the Current Plan, fill its flagged gaps, and approve it     |
| `/mockups/care-plan/patients/[patientId]/patient-plan/print`             | Print-optimised patient copy, including their resources                                     |
| `/mockups/care-plan/patients/[patientId]/safety-plan`                    | Current patient-owned Personal Safety Plan                                                  |
| `/mockups/care-plan/patients/[patientId]/safety-plan/edit`               | Co-produce or revise a Personal Safety Plan Version                                         |
| `/mockups/care-plan/patients/[patientId]/safety-plan/print`              | Print-optimised patient copy                                                                |
| `/mockups/care-plan/patients/[patientId]/presentations`                  | Longitudinal ED Presentation timeline                                                       |
| `/mockups/care-plan/patients/[patientId]/presentations/new`              | Record a concise ED Presentation                                                            |
| `/mockups/care-plan/patients/[patientId]/presentations/[presentationId]` | View an episode, plan-use feedback, outcome, and amendments                                 |
| `/mockups/care-plan/patients/[patientId]/history`                        | Combined plan, presentation-amendment, print, and contact-action audit chronology           |
| `/mockups/care-plan/reviews`                                             | Awaiting Approval, Review Suggested, contact verification, and manual identification queues |
| `/mockups/care-plan/team`                                                | Synthetic CMHT and plan-owner directory                                                     |
| `/mockups/care-plan/governance`                                          | Prototype boundary, roles, lifecycle rules, and unresolved identification policy            |
| `/mockups/care-plan/system-states`                                       | Deterministic degraded-state specimens and scenario controls                                |

The route suite is reachable on the live site at `psychiatry.tools` for a signed-in administrator, by adding `/mockups/care-plan` to the developer-gated path prefixes, exactly as the Caring Contact prototype already is. Every other `/mockups/**` path continues to return 404 in production. This is deliberate (user decision, 21 August 2026): the application holds no real information, it sits behind an existing administrator sign-in, and being able to open it on a phone in a meeting is most of what a prototype is for. It is linked from the login-gated Developer hub rather than production navigation. Each route has a literal inbound link or an explicitly documented parameterised child relationship so repository reachability checks remain truthful.

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

Revised 21 August 2026 after user review. The earlier draft carried nineteen content sections. Four pairs of those sections said the same thing twice (`what usually helps` against `helpful interventions`; `what may increase distress` against `unhelpful interventions`; `preferred engagement` against `agreed ED approach`; `usual presentation pattern` against `contextual triggers`), which would leave an author unsure which box a sentence belongs in and a reader seeing the same guidance twice. The two safety-critical items — what has actually been agreed, and what would make this presentation different — sat below the fold in the full plan rather than in the first-minute summary. And nineteen required fields is an authoring burden heavy enough that plans would not get written at all.

The content is therefore eleven fields in two tiers.

### First-minute tier — the Current Plan summary card

All five are required before a version can be approved. They are the entire summary card, in this order:

1. **How to approach this person.** The engagement approach that works for them.
2. **What helps.** Concrete things that reduce distress.
3. **What makes it worse.** Concrete things to avoid, written about what the service does rather than about what the person does.

   Written carelessly this section becomes a list of the patient's faults, which is the single most common way documents like this cause harm. It describes the corridor, the repeated history-taking, the security presence, the unexplained wait — things the department controls and can change. Where a person's own response genuinely must be recorded, it is written as a response to circumstances, never as a trait. Every fixture models this, because whatever the fixtures do is what every real plan written in this tool will imitate.

4. **What we have agreed to do.** The agreed ED approach, including the usual disposition and any agreed position on admission.

   This section carries a wording rule, because it is the one most open to misuse. A continuity plan that states an agreed position on admission can be read at 3am as a pre-authorised refusal by a clinician who has never met the person, and the person is not present to argue with it. Refusing to write it down is worse — the decision still gets made, just unaccountably. So the section must: name who agreed the position and when; be phrased as an agreed default rather than a ceiling on care; and never use prohibitive constructions. `Should not be admitted`, `do not admit`, `admission is not indicated`, and equivalents are banned outright in fixture content, interface copy, and any example. Every rendering of this section sits adjacent to section 5.

5. **What would make this presentation different.** The explicit “this plan does not apply — assess afresh” boundary. This section is visually distinct from the other four and is never collapsed, truncated, or hidden behind a disclosure.

   It is additionally **pinned**: a one-line form of it appears directly beneath the patient's name, above all plan content, at every viewport and in print, as well as in its numbered place in the sequence. On a phone the five sections are a long card and a hurried reader stops before the end — which is precisely the reader this section exists for. The pinned line links to the full section; it never replaces it.

The summary card also shows, as metadata rather than content: version, Current state, approver and approval date, owner, review state, primary CMHT contact with operating hours, and a link to the Personal Safety Plan.

### Full-plan tier — read when there is time

Only `Why this plan exists` is required; the remaining five may be empty and are then displayed as `Not recorded` rather than omitted silently.

6. **Why this plan exists.** Purpose, applicability, and the person's usual presentation pattern and known contextual triggers.
7. **What the person wants.** Their goals, preferences, and communication preferences.
8. **Practical needs.** Interpreter, accessibility, sensory, cultural, spiritual, family, community, Aboriginal Liaison, and peer-support preferences, recorded consent-aware.
9. **Physical health and medication.** Allergies, physical-health reminders, and a pointer to the authoritative medication record. Never orders, doses, or a parallel medication list.
10. **Who else is involved.** CMHT, primary care, and consented support people, with whether their involvement is current.
11. **What should trigger the next review.** Distinct from the version's own revision reason, which is version metadata rather than plan content.

Every view of the plan states that it supports continuity and never replaces fresh triage, physical assessment, mental-state assessment, immediate risk assessment, clinical judgment, or legal obligations.

## Management Plan lifecycle

A Management Plan has one or more versions. Version state and review state remain separate:

- Version states: `draft`, `awaiting_approval`, `current`, `superseded`, `withdrawn`.
- Review states for a Current version: `within_review`, `due_soon`, `overdue`.

The review clock (decided 21 August 2026; the earlier draft defined the three states but never their durations). On approval the next review date defaults to **12 months** ahead and remains editable by the author on every version. A Current version is `due_soon` within **28 days** of that date and `overdue` after it. The default is a suggestion that saves the author work; it is editable per plan and is not a governance rule about a patient, which is why it is treated differently from the identification threshold below.

The Personal Safety Plan uses the same 12-month default and 28-day warning window.

The workflow is:

1. Create a draft from an empty plan or copy the Current version.
2. Edit required structured sections and a concise revision reason.
3. Submit the draft for senior-clinician approval.
4. Compare the submitted version against the Current version.
5. Return it to Draft with a reason or approve it with an explicit confirmation.
6. On approval, atomically make the submitted version Current and the previous Current version Superseded.
7. Withdraw a Current version only with an explicit reason and confirmation, leaving the patient with no Current Plan rather than silently restoring an older version. Withdrawal is restricted to a named `senior_clinician`, the same role that approves, because removing a plan from use is as consequential as putting one into it. Afterwards the patient's record reads `Plan withdrawn on <date> — <reason>` with the withdrawing clinician named, never a bare `No Current Plan`; superseded versions stay readable in history. A patient who has never had a plan and a patient whose plan was withdrawn must never look the same.

An overdue Current Plan remains visible with a prominent warning. It is not silently hidden, downgraded to Draft, or represented as expired. A replacement draft never suppresses the Current version while approval is pending.

## ED Presentation record

Each ED Presentation records only the continuity information this application owns. Revised 21 August 2026 after user review: the earlier draft required all of the fields below, which is two to three minutes of typing at the end of a shift, in a second system, partly duplicating the hospital record. Work that heavy does not get done, and an empty feedback loop makes the Review Suggested queue and roughly a third of the application scaffolding for something that never runs.

**Required — the roughly thirty-second set.** Fictional ED site; disposition; whether the plan was available; whether it was used; whether it helped; and one required line of free text labelled `In one line: why they came and what happened`. Arrival date and time default to now and stay editable.

That single line is deliberately doing the work the separate structured `presenting indication` and `assessment outcome` fields would otherwise do. It costs the recorder no more time, it is always filled in, and it is what the presentation-activity view needs in order to be useful. One line of prose from the clinician who was actually there beats two structured boxes that get skipped.

**Required conditionally.** A review reason whenever review is suggested, and a deviation reason whenever a deviation is recorded.

**Optional — behind a disclosure, never blocking the save.** Presenting indication, assessment outcome, CMHT contact attempt and outcome, and the deviation flag itself. Optional fields left empty display as `Not recorded`; they are never silently dropped and never invented.

The complete field set is:

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

ED Presentation records are append-only in the domain model. A correction creates a visible Presentation Amendment with author, time, reason, and replacement value. Amendable fields are the disposition, the assessment outcome, the one-line account, and the plan-use answers (availability, use, and helpfulness). The three plan-use answers are presented to the user as one group under a single reason; each changed answer still records its own attributed amendment, so stored evidence stays one field per record. Extending amendment to the plan-use answers does not let anyone rewrite history — every amendment is visible and attributed — and refusing it would mean a clinician who mis-taps `the plan helped` can never correct it, which is exactly the kind of friction that makes people stop using a tool. Plan-use feedback that suggests review creates a Review Trigger without automatically changing the plan.

## Personal Safety Plan

The Personal Safety Plan is written in the patient's voice and uses seven practical sections:

1. My warning signs.
2. Making my surroundings safer.
3. My reasons for living.
4. Things I can do myself.
5. People and places that help me feel connected.
6. Family, friends, and supports I can contact.
7. Professional and emergency support.

It has independent `draft`, `current`, and `superseded` versions plus `within_review`, `due_soon`, and `overdue` review states. The patient-confirmation state records `confirmed`, `discussed_not_confirmed`, `declined`, or `unavailable`. A clinician records the collaboration; senior-clinician approval is not required. Any clinical role may create or revise one, including an ED clinician mid-shift: the emergency department at 2am is very often exactly when a safety plan gets made, and a tool that refuses it there is useless at the moment it matters most. Only `plan_coordinator`, which is deliberately a non-clinical coordination role, cannot author one.

The print route:

- Uses plain language and large, scannable sections.
- Includes minimum necessary synthetic identifiers, version, last-confirmed date, personal supports, CMHT details, and urgent-help information.
- Includes a clear `000` emergency instruction and source-backed Australian and WA crisis contacts.
- Shows a synthetic-prototype watermark and a printed-at timestamp.
- Removes navigation, action controls, audit history, and unrelated presentation data.
- Uses browser print/PDF capability with repository print styles; no PDF dependency is added.

## Printing the clinician plan

The Management Plan summary prints as well as the Personal Safety Plan. An ED clinician may want the five first-minute sections on paper to carry to the bedside, and a community team may want them for a handover. The print view carries the patient identifiers, the pinned safety boundary, the five sections in order, the version and approval metadata, the CMHT contact block, a `check the electronic record` warning, a printed-at timestamp, the synthetic-prototype watermark, and a confidential-document footer. It omits navigation, actions, audit history, and drafts.

Both print views, and any later one, are built on the repository's existing `PrintOutput` and `BrowserPrintButton` primitives in `src/components/ui/print-output.tsx`, alongside the two working printed screens in Therapy Compass. Where those primitives are missing something genuinely general — page-break control per section, a monochrome state treatment, a standard confidential footer — the general capability is added to the shared primitive and consumed from there, not reimplemented locally. Route-scoped print CSS is limited to what is genuinely specific to this application's layout.

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

## Patient Plan

The Patient Plan is the patient-facing edition of an approved Management Plan Version, written in the person's own voice with recovery-focused language, together with a set of resources chosen for them. It is distinct from the Personal Safety Plan, which is the person's own plan for managing distress rather than a rendering of the clinical one.

### How it is produced

A deterministic, offline transformation. No language model, no network call, no provider, no clinical text leaving the machine — the application's provider-free boundary is unchanged.

Naive term-substitution over clinical prose produces confident nonsense, so the transformation does not attempt to rewrite arbitrary sentences. It works because the Management Plan is already eleven fields with known meanings:

- Each clinical field maps to a known patient-voice heading.
- A curated plain-language dictionary replaces clinical vocabulary with everyday words.
- Framing shifts to second person, present tense, strengths-based and recovery-focused.
- **Anything the transformation cannot convert with confidence becomes a visible gap for the clinician to write, never a guess.** The output is an incomplete draft by design.

Section 4, the agreed ED approach and any position on admission, is **never** auto-converted under any circumstances. It is always presented as a gap for a person to word. It is the section where a wording slip does the most harm and the one a patient is most likely to read as a judgment about them.

The transformation is a pure function of an approved Management Plan Version. Replacing it later with a language-model implementation must not require redesigning the surrounding screens, the version model, or the approval step.

### Sections

Eight, in this order:

1. Why we wrote this together.
2. What matters to you.
3. What helps you.
4. What makes things harder.
5. What we agreed will happen when you come to the emergency department.
6. If something new is happening.
7. Who's involved in your care.
8. Things that might help.

Physical health and medication is deliberately absent. The person has their own record, and duplicating medication detail onto a printed sheet that leaves the building is a privacy cost with no corresponding benefit.

### Approval

A Patient Plan Version has its own draft and current states and its own approval, separate from the Management Plan's. Any clinical role may approve one — requiring a senior clinician would mean people wait days for their own copy, which defeats the purpose — and the approving clinician is named on the version and on the print. Approval is mandatory: an automatic rewrite of a clinical document into patient-facing language can drift in meaning, and this is the copy that leaves the building. A Patient Plan Version cannot be approved while any flagged gap is unfilled.

### Currency

Each Patient Plan Version names the Management Plan Version it was derived from. When a newer Management Plan Version becomes Current, the Patient Plan is marked `Based on an earlier version — needs updating`, stays fully readable, and raises a Review Trigger. It is never silently regenerated, never hidden, and never withdrawn automatically: the person may be holding a printed copy of it, and the application's account of what they were given must stay truthful.

### Resources

Four kinds, all synthetic except the already-verified public crisis lines:

- The person's own community team, care coordinator, and consented supports.
- Local services in the fictional health service, typed so the list can carry practical categories — housing, financial, transport, carer support, alcohol and other drugs, cultural and peer support — alongside clinical ones. Housing and money are frequently the actual reason someone keeps presenting, and a resource list that cannot mention them is the wrong list.
- The verified national and WA crisis contacts, with the same caveats used elsewhere in this specification.
- Self-help and psychoeducation reading.

Resources are hand-authored per patient in this prototype. They are structured so that a later revision of this application can source them from the existing Services and Factsheets modes; that integration is recorded intent, not present scope, and no production module is imported now.

### Print

The patient copy prints with plain language, generous spacing, and monochrome safety, carrying the person's preferred name, the version and approval date, the eight sections, their resources, the verified crisis contacts, the synthetic watermark, and a printed-at timestamp. It omits navigation, clinical vocabulary, audit history, ED presentation data, and the Management Plan's internal metadata.

## Identification review

The prototype includes an Identification Policy record with:

- `status: pending_governance`.
- No threshold count.
- No lookback threshold.
- Manual referral enabled.
- A visible explanation that local clinical and privacy governance must define eligibility before operational use.

Patient lists display objective activity: the count over a named window, which fictional EDs the person attended and how often at each, and a compact reverse-chronological line per presentation giving the date, the site, and the one-line account of why they came and what happened. They must not convert any of that into an automatic label, mandatory care pathway, severity claim, or risk score.

Sorting by presentation count is available **only inside the Identification Review workflow**, where finding people who attend often is the stated and governed purpose of the screen. It is not offered on the general patient directory or on any other surface. The glossary bans `frequent presenter` as a label for a person; a sortable ranking of everyone by attendance is the same ranking without the word, and confining it to the one screen that has a reason for it is more honest than either banning it outright or leaving it lying around the application. Wherever the ranking is offered, the statement that counts do not determine eligibility is on the same screen.

An authorised synthetic user may manually add a patient to `Identification review` with a reason. The queue action initiates multidisciplinary review; it does not create or approve a plan.

Closing a review (added 21 August 2026; the earlier draft opened referrals but gave them no way to close, so the queue would have filled permanently and become useless). When the multidisciplinary group has discussed the patient, an authorised user records one decision — `proceed_to_plan`, `not_needed_now`, or `revisit_later` — plus a short reason, and the referral closes. The decision, its reason, its author, and its time remain visible in the patient's history, so a later reader can see that coordinated care was considered and what was concluded. On `proceed_to_plan` the interface offers to start a Management Plan draft; it never creates one automatically, and closing a referral never approves anything.

## Roles and permissions boundary

The prototype illustrates, but does not enforce, these responsibilities:

- ED clinician: find and read the Current Plan, record a presentation, capture plan-use feedback, and access contacts.
- ED mental-health liaison or CMHT clinician: create and edit drafts, co-produce the Personal Safety Plan, verify contacts, and respond to review triggers.
- Named senior clinician: compare, return, approve, withdraw, and record formal review of a Management Plan Version.
- Plan coordinator: manage review and identification worklists without making clinical-severity judgments.

The displayed synthetic user and role explain why an action is available. This is interaction modelling only, not authentication, RBAC, relationship-based access, or break-glass evidence.

## Patient, carer, communication, and cultural preferences

The Management Plan records whether participation was `co_produced`, `discussed`, `declined`, or `patient_unavailable`. It may record consented support people and whether their involvement is current.

A version may be approved at any participation state — sometimes a plan must be written for a person who cannot or will not engage, and blocking that would make the tool refuse the situations it exists for. But it is never invisible that this happened. A version whose participation is `declined` or `patient_unavailable` carries a persistent `Written without this person's involvement` marker on every view, print, and queue entry, and its approval raises an open Review Trigger so that involving the person stays on somebody's list.

The Management Plan also records whether the person has been shown their plan, and whether a Patient Plan edition exists and is current. A plan written about someone who has never seen it is the thing this category of document is most criticised for, so the state is recorded rather than left unasked.

The patient-owned summary can include:

- Preferred name and pronouns.
- Communication preferences.
- What helps the person feel safe and heard.
- What may increase distress.
- Interpreter and accessibility needs.
- Sensory and environmental preferences.
- Cultural, spiritual, family, community, Aboriginal Liaison, or peer-support preferences.

These are not additional content fields. They live inside the eleven fields defined under **Management Plan content**: preferred name and pronouns are patient identity shown in the workspace header; communication preferences and what helps the person feel safe and heard belong to `What the person wants`; interpreter, accessibility, sensory, environmental, cultural, spiritual, family, community, Aboriginal Liaison, and peer-support preferences belong to `Practical needs`; and anything that an ED clinician must act on within the first minute belongs to `What helps` or `What makes it worse` instead. Do not add a twelfth field for them.

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

All fixture IDs use a `SYN-` prefix, and every patient-facing route displays the fictional-data boundary. Refresh returns the application to deterministic fixtures. The shell states this in plain words about _state_, not only about data — something to the effect of `Nothing is saved. Reloading this page starts over.` — because the synthetic-data label does not warn a person demonstrating the tool that an accidental reload will discard the draft they are showing someone. The provider performs no persistence or network access.

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
- The Current Plan summary card is exactly the five first-minute sections, in the specified order.
- `What would make this presentation different` is visible on the summary card at every supported viewport, in dark mode, in forced colours, and in print, and is never collapsed, truncated, or clipped.
- An approved version defaults its next review date 12 months ahead, the author can change it, and the amber warning begins 28 days before it.
- An ED Presentation saves with only site, disposition, plan availability, plan use, plan helpfulness, and the note completed; the optional detail fields never block the save and render as `Not recorded` when empty.
- An Identification Review can be closed with a recorded decision and reason, leaves the queue when closed, remains visible in the patient's history, and creates no plan on any decision.
- The pinned safety boundary is visible above all plan content at 320 px, 390 px, desktop, dark mode, forced colours, and in print.
- No fixture, interface string, or example contains a prohibitive admission construction.
- A version approved at `declined` or `patient_unavailable` participation shows the `written without this person's involvement` marker everywhere and raises a Review Trigger.
- A withdrawn plan never renders identically to a patient who never had one.
- Sort-by-count exists only within the Identification Review workflow and nowhere else.
- The Management Plan summary prints, and both print views consume the shared `PrintOutput` primitive rather than reimplementing print behaviour.
- The Patient Plan transformation produces visible gaps rather than guesses, never auto-converts the agreed-approach section, and cannot be approved with a gap unfilled.
- A Patient Plan derived from a superseded Management Plan Version is marked as needing updating, stays readable, and is never regenerated or hidden automatically.
- No language model, network call, or provider is reachable from any part of the application, including the Patient Plan transformation.
- The shell states in plain words that nothing is saved and reloading starts over.
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
