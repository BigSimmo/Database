# Caring contacts — developer handoff

**Status:** frozen synthetic design handoff, 15 August 2026  
**Implementation authority:** not granted

This handoff maps the complete approved prototype to a future production architecture. Route and
component names below are targets, not existing production code. Production work must remain
separate from Clinical KB search, RAG, OpenAI, favourites, recent-search, analytics and browser
persistence.

## 1. Route and domain-component inventory

| Screen/state                  | Future route                                           | Domain components                                                                   | Prototype fixture/source          | Required production contract                                                  | Safety invariant                                                               |
| ----------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Workspace shell / Today       | `/caring-contacts`                                     | `CaringContactShell`, `ActiveTeamContext`, `TodayWorkQueue`, `SendingWindowPanel`   | referrals, contacts, audit events | team-scoped queue projection; queue age; explicit handover state              | actions precede metrics; no risk ranking; no PHI in title/alerts               |
| Patients search/empty/results | `/caring-contacts/patients`                            | `PatientSearch`, `IdentityResultRow`, `IdentityAssurance`                           | synthetic patients/referrals      | active-team-only search; audited view; no global-search indexing              | identity-forward result plus separate assurance; clear state on team switch    |
| Patient and agreement         | `/plans/new` — agreement stage                         | `IdentityHeader`, `SourceEvidence`, `CommunicationEligibility`, `ActivationStepper` | patient + referral                | source provenance, accepted team, coordinator, exact agreement classification | imported-mobile/suitability provenance; no verification or consent overclaim   |
| Pathway selection             | `/plans/new` — pathway stage                           | `PathwaySelector`, `PathwayVersionCard`                                             | pathway fixtures                  | current locally approved versions and immutable approval evidence             | no best/recommended ranking; unapproved cadence stays illustrative             |
| Personalisation               | `/plans/new` — personalisation stage                   | `GovernedVariantSelector`, `SmsPreview`, `SegmentCounter`                           | template/pathway/patient fixtures | allowlisted substitutions; deterministic encoding/segment calculation         | one selected sending preference; no free text; more than two segments blocks   |
| Review and activation         | `/plans/new` — review stage                            | `ActivationAssuranceReview`, `ExactSchedule`, `FreshAuthGate`                       | all activation fixtures           | fresh auth; atomic idempotent activation; frozen versions/text/schedule/audit | exact identity, content, selected window, dates and states before final action |
| Patient overview              | `/patients/[patientId]`                                | `PatientIdentityHeader`, `PlanSummary`, `ContinuityThread`, `EpisodeChronology`     | episode/contact/audit fixtures    | authorised patient/episode read model with immutable chronology               | each dated row has transport state; Delivered is transport-only                |
| Plan detail                   | `/plans/[planId]`                                      | `PlanDetail`, `GovernedPlanActions`, `AuditHistory`                                 | episode/pathway/template fixtures | version snapshots, selected preference, current owner and deterministic state | terminal states read only; every mutation rechecks authority/connectivity      |
| Schedule                      | `/caring-contacts/schedule`                            | `SevenDayStrip`, `DaySchedule`, `SendingWindowList`, `ExceptionList`                | planned contacts                  | Perth calendar/public-holiday service, day/window projection                  | missed contacts never late; exceptions stay separate from routine lists        |
| Contact detail                | `/contacts/[contactId]`                                | `ContactDetail`, `TransportHistory`                                                 | contact/delivery fixtures         | provider-neutral signed event history; bounded retry state                    | Processing cannot change; Delivered means transport receipt only               |
| Delivery exception            | same contact route with drawer state                   | `DeliveryExceptionDrawer`, `OperationalTask`, `WriteBackSummary`                    | synthetic delivery event          | three-attempt evidence, same-day task, atomic pause/write-back/audit          | no clinical inference or automatic follow-up; uncertain send not resent        |
| Templates list/detail         | `/caring-contacts/templates`, `/templates/[pathwayId]` | `TemplateList`, `TemplateVersionDetail`, `ApprovalEvidence`                         | pathway/template fixtures         | immutable versions, two-person approval, lifecycle                            | retired version stays readable; only current approved version selectable       |
| Team                          | `/caring-contacts/team`                                | `TeamRoster`, `UnclaimedWorkEscalation`, `TeamSwitcher`                             | team fixtures                     | service-managed groups, coverage and 60-minute escalation                     | assignment is coordination; external alert has no PHI                          |
| Guidance                      | `/caring-contacts/guidance`                            | `ProgrammeBoundary`, `IncidentGuidance`                                             | static governed content           | versioned locally approved operational guidance                               | caring contacts are not monitoring, triage or crisis response                  |
| Reports                       | `/caring-contacts/reports`                             | `OperationalMetrics`, `SuppressedCell`                                              | synthetic aggregates              | approved data dictionary/demographics/threshold and audited access            | operational outcomes only; no clinician ranking/effectiveness inference        |

The approved rollout routes above are canonical. The earlier nested episode/version proposals are
**superseded and not approved**: `/caring-contacts/patients/[episodeId]/activate/*`,
`/caring-contacts/patients/[episodeId]/plan`,
`/caring-contacts/patients/[episodeId]/contacts/[contactId]`,
`/caring-contacts/patients/[episodeId]` and `/caring-contacts/templates/[versionId]`. Do not
implement aliases or parallel route identities for them.

## 2. Episode and boundary state inventory

| State                                                          | Required UI/state handling                                                       | Data/authority gate                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Pending referral                                               | Accept, Return for clarification, Decline; referring-team responsibility visible | source/write-back contract; authorised clinician        |
| Duplicate active referral                                      | block creation; link to active episode                                           | idempotency key and active-episode uniqueness           |
| Later qualifying discharge                                     | new linked episode only after earlier closure                                    | source event identity and linkage rules                 |
| Readmission                                                    | pause future contacts; later discharge needs new referral                        | assessed source-event integration                       |
| Recorded death                                                 | irreversibly cancel unsent contacts                                              | high-assurance source event, transaction and audit      |
| Death correction                                               | incident workflow; old plan remains cancelled; no undo                           | incident authority and new-referral rule                |
| Mobile/contact changed                                         | pause; review source evidence; never silently switch                             | source correction/version contract                      |
| Wrong recipient/duplicate send/unauthorised content/lost audit | pause entire pilot                                                               | joint incident, privacy/security and clinical authority |
| Pause                                                          | preserve calendar and skip contacts during pause                                 | authorised member, reason/audit/write-back              |
| Withdrawal                                                     | immediately cancel unsent; immutable terminal history                            | patient request evidence and fresh auth; no approval    |
| Cancellation                                                   | distinct reasoned authorised action                                              | role and fresh-auth policy                              |
| Reassignment                                                   | retain handover/audit; change coordinator only                                   | fresh auth and service role; no duty-of-care inference  |

## 3. System-state contract

Every route must define loading, empty, recoverable error, offline, expired authentication,
permission unavailable and version/conflict behaviour. Loading never becomes terminal. Failed reads
do not render as zero results. Offline mode stores no patient data and permits no activation,
mutation or uncertain resend; an already-open mutation rechecks connectivity at commit time. Session
expiry blocks the shared overlay stack until re-authentication. Permission and version conflicts
preserve the current record and name the authorised remedy.

The complete overlay inventory is: verify identity; change patient; pathway preview; message preview;
communication preference; adjust date/time; outside-window warning; save draft; discard changes;
final activation; activation success; pause; withdrawal; reassignment; delivery detail; resolve
failed delivery; contact-changed block; template changed/retired; session expiry; offline banner;
recoverable error; permission unavailable; team switcher; draft/version conflict. Implement with the
repository `Sheet`, `ConfirmDialog` and `OverlayRoot` contracts, including initial/return focus,
scroll containment, safe-area actions and responsive modality.

The modality matrix is frozen as follows; `action only` means Escape, backdrop and close controls
cannot dismiss the session gate, while the offline banner remains until its recovery action:

| #   | Decision                 | Phone modality               | Desktop modality             | Dismissal                 |
| --- | ------------------------ | ---------------------------- | ---------------------------- | ------------------------- |
| 1   | Verify identity          | protected full-screen stage  | dialog                       | Escape, backdrop or close |
| 2   | Change patient           | protected full-screen stage  | dialog                       | Escape, backdrop or close |
| 3   | Pathway preview          | full-screen inspection       | right inspection drawer      | Escape, backdrop or close |
| 4   | Message preview          | full-screen inspection       | right inspection drawer      | Escape, backdrop or close |
| 5   | Communication preference | compact bottom sheet         | dialog                       | Escape, backdrop or close |
| 6   | Adjust date/time         | compact bottom sheet         | dialog                       | Escape, backdrop or close |
| 7   | Outside-window warning   | compact bottom sheet         | dialog                       | Escape, backdrop or close |
| 8   | Save draft               | compact bottom sheet         | dialog                       | Escape, backdrop or close |
| 9   | Discard changes          | compact bottom sheet         | dialog                       | Escape, backdrop or close |
| 10  | Final activation         | protected full-screen stage  | dialog                       | Escape, backdrop or close |
| 11  | Activation success       | compact bottom sheet         | dialog                       | Escape, backdrop or close |
| 12  | Pause                    | compact bottom sheet         | dialog                       | Escape, backdrop or close |
| 13  | Withdrawal               | protected full-screen stage  | dialog                       | Escape, backdrop or close |
| 14  | Reassignment             | compact bottom sheet         | dialog                       | Escape, backdrop or close |
| 15  | Delivery detail          | full-screen inspection       | right inspection drawer      | Escape, backdrop or close |
| 16  | Resolve failed delivery  | compact bottom sheet         | dialog                       | Escape, backdrop or close |
| 17  | Contact-changed block    | compact bottom sheet         | dialog                       | Escape, backdrop or close |
| 18  | Template changed/retired | protected full-screen stage  | dialog                       | Escape, backdrop or close |
| 19  | Session expiry           | non-dismissible session gate | non-dismissible session gate | action only               |
| 20  | Offline banner           | persistent status banner     | persistent status banner     | recovery only             |
| 21  | Recoverable error        | compact bottom sheet         | dialog                       | Escape, backdrop or close |
| 22  | Permission unavailable   | compact bottom sheet         | dialog                       | Escape, backdrop or close |
| 23  | Team switcher            | compact bottom sheet         | dialog                       | Escape, backdrop or close |
| 24  | Draft/version conflict   | protected full-screen stage  | dialog                       | Escape, backdrop or close |

## 4. Production data and integration boundaries

Create dedicated tenant-scoped patient, referral, episode, plan, contact, template snapshot,
delivery event, operational task, write-back and append-only audit contracts in a separately
approved Australian PHI-capable environment. Use WA Health SSO/MFA, conditional access and managed
sessions; deny by default. Signed replay-safe webhooks are the routine provider status source.
Manual reconciliation is permitted only for outage, discrepancy or suspected incident. Detailed
transport/access evidence stays in Callback; only approved structured milestones write back.

Each plan stores exactly one selected sending preference (`Morning`/10:00 am,
`Afternoon`/2:00 pm or `Early evening`/5:00 pm AWST). Every planned contact derives its window and
time from that plan value; the preference is never rotated contact-by-contact. A governed proposed
change is distinct from the current value and must atomically update future eligible contacts while
preserving the original cadence, already-final transport history and audit evidence. The Rowan
fixture freezes `Morning 10:00 am AWST` across all 10 contacts.

No patient-level export, browser persistence, offline cache, global search/RAG/OpenAI path or PHI in
logs, analytics, URLs, page titles, notifications or screenshots is permitted.

## 5. Authority gates before implementation or release

1. Explicit authority to begin production architecture and implementation.
2. Named service protocol, eligibility, role matrix, capacity/stopping rules and seven-day coverage.
3. Clinical-programme and lived-experience approval of every exact message version and the complete
   prototype.
4. Legal/privacy/records agreement classification, PIA, data-flow, retention, correction and legal-
   hold decisions.
5. Australian hosting, tenant/key/access controls and provider procurement/security acceptance.
6. Source identity/referral/readmission/death/mobile/write-back contracts and assessed simulation.
7. SMS sender, retry, webhook, outage and reconciliation proof with no late/uncertain resend.
8. Accessibility approval including physical iPhone Safari and installed-PWA evidence.
9. Incident, audit-integrity and joint restart simulation.
10. Explicit pilot/go-live authorisation; production migration/deployment remains separately gated.

## 6. Frozen non-goals

No two-way messaging, inbox, reply storage/analysis, crisis triage, risk scoring, diagnostic
eligibility, clinical advice, treatment workflow, effectiveness claim, clinician ranking, global
patient search, unrestricted content authoring, generative text, dynamic translation, automatic
round robin, late catch-up sends, automatic clinical follow-up from delivery failure, daily full
provider reconciliation, patient export or offline patient cache. Do not promote mockup fixtures or
components into production by copying them wholesale; implement domain contracts behind repository
primitives and gates.
