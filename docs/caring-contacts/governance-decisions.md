# Caring contacts — governance decisions and residual risks

**Status:** approved product-decision record for synthetic design, 15 August 2026  
**Authority:** [Approved decision lock](../superpowers/plans/2026-08-14-caring-contact-coordination-rollout.md#approved-decision-lock--15-august-2026)

`Locked` means the prototype must represent the decision consistently; it does not mean production
approval. A formal owner may block production use, but the conflict and owner must be recorded rather
than silently changing the model. Nothing here authorises patient data, APIs, Supabase, OpenAI/RAG,
SMS, migration, deployment, procurement or a live canary.

## 1. Service, handover and pilot

| Locked decision                                                                                                               | Production evidence/owner                                                                | Current limit                                     |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------- |
| One dedicated aftercare/transition team at one hospital/service; clinician-enrolled adults discharged after a suicidal crisis | Named service, protocol and eligibility — service clinical governance                    | Organisation and real enrolment not approved here |
| Structured hospital referral; Accept, Return for clarification or Decline with structured write-back                          | Interface/correction/write-back contract — integration, records and service owners       | Synthetic referral only                           |
| Referring team responsible until explicit acceptance; coordinator claimed/assigned after acceptance; no round robin           | Handover procedure, role matrix and coverage — clinical governance, service and identity | Locked in design                                  |
| Single-team pilot has no numeric cap; every eligible referral accepted while open                                             | Workload exposure, stopping rules and 6–8-week review — governance board                 | Conscious residual exposure                       |
| Two weeks of seven-day hypercare with named clinical, service, technical, privacy and incident leads                          | Approved go-live plan — service governance                                               | Not scheduled or authorised                       |

No cap is not unlimited safe capacity. Design must expose queue age, unclaimed work and workload.

## 2. Identity, agreement, schedule and content

| Locked decision                                                                                                                                                                              | Production evidence/owner                                                                                                    | Current limit                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Source-system identity/mobile imported without Callback test SMS/read-back; separate patient-controlled/suitable flag required                                                               | Source-field definitions, provenance and correction flow — health-information/integration owner                              | No independently verified-mobile claim |
| `Agreement confirmed: Yes/No`; source referral/referrer/time retained                                                                                                                        | Classification and record procedure — clinical governance, legal/privacy and records                                         | Legal/consent classification open      |
| Discharge anchor; Morning 10:00, Afternoon 14:00, Early evening 17:00 AWST; weekends/public holidays within 09:00–18:00                                                                      | Versioned schedule and seven-day staffing — service governance                                                               | Illustrative pathway only              |
| One selected sending preference per plan; all contacts derive the same window; missed contacts never sent late; pause skips without rebasing; withdrawal immediately cancels unsent contacts | Deterministic schedule/preference/audit/write-back proof — service and records                                               | Locked in design                       |
| Governed variants/substitutions only; two SMS segments; approved English only                                                                                                                | Versioned library — clinical programme lead and lived-experience/content representative; privacy/legal if disclosure changes | Exact content not approved here        |
| Non-receiving sender; first SMS has phone/hours, emergency direction and one crisis contact; later SMS keeps no-reply boundary/contact                                                       | Provider proof and exact approved wording — SMS owner, clinical programme and lived experience                               | No provider/sender selected            |

## 3. Episode, delivery and reconciliation

| Locked decision                                                                                                                          | Production evidence/owner                                 | Current limit                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| Duplicate active referral blocked; later discharge creates a new linked episode                                                          | Domain/idempotency/source-event proof                     | No datastore                                          |
| Readmission pauses; recorded death irreversibly cancels; correction is an incident                                                       | Integration contract and assessed simulation              | Synthetic events only                                 |
| Two bounded retries, three attempts total, original window only; permanent failure pauses future contacts                                | Provider-neutral status/retry tests and service procedure | No provider                                           |
| Provider outage misses are never sent late; uncertain contacts never resent automatically                                                | Outage/recovery simulation                                | Locked in design                                      |
| Signed replay-safe webhooks are routine status source; manual provider reconciliation only for outage, discrepancy or suspected incident | Provider, service and security acceptance                 | Conscious residual risk: no daily full reconciliation |

Webhook-primary operation can leave a missing/delayed event temporarily undetected. Controls are an
exact `Status unavailable` state, retained evidence, event-triggered reconciliation and no automatic
resend of uncertainty. Provider, service and security owners must accept the remaining risk.

## 4. Identity, records, hosting and reporting

| Locked decision                                                                                                                                                                                                                                      | Production evidence/owner                                                                 | Current limit                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------- |
| WA Health SSO/MFA, conditional access and managed sessions; no local credentials; fresh auth for activation, withdrawal, reassignment/export                                                                                                         | Identity and supported-device proof — identity/security                                   | No live identity integration                      |
| Service-managed team groups, deny by default; context switch clears patient state                                                                                                                                                                    | Role matrix, joiner/mover/leaver and team-scope tests — service/identity                  | Synthetic roles only                              |
| Callback is not the clinical record; structured milestones write back while detailed transport/access evidence remains in Callback                                                                                                                   | Authority, event set, retention/correction/legal hold — records and service               | Target systems unresolved                         |
| Every search/view/decision/mutation/write-back/admin access audited; clinicians see episode operations, privacy/security see complete access                                                                                                         | Append-only, transactional and role evidence — privacy/security/records                   | Design contract only                              |
| Separately contracted PHI-capable Australian-region hosting; all identifiers/messages/data/backups/logs/provider processing stay in Australia; dedicated tenant-scoped Australian keys                                                               | PIA, data flow, contracts, key/access/rotation proof — privacy/security/legal/procurement | Current Clinical KB deployment prohibited for PHI |
| No patient-level export or browser persistence/offline cache; no real patient information or PHI in Clinical KB/RAG/OpenAI/logs/URLs/toasts/analytics/screenshots; prototype/test screenshots require clearly fictional synthetic identities/details | Static/runtime/device/fixture proof — privacy/security                                    | Locked prohibition                                |
| Aggregates may use approved source demographics with configured small-cell threshold and `Suppressed`; never rank clinicians                                                                                                                         | Data dictionary, threshold and access rules — governance/analytics                        | Threshold not invented in design                  |

## 5. Incident authority

A confirmed wrong-recipient message, duplicate send, unauthorised content, material privacy/security
incident or loss of audit integrity immediately pauses the entire pilot. Restart requires joint
approval after reconciliation/remediation from the incident lead, privacy/security owner and clinical
programme lead. No one role or automation may restart it. Downtime fails closed: no offline patient
cache, new activation or uncertain send.

## 6. Residual-risk register

| Risk                                                            | Current control                                                                                             | Acceptance owner                            |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Patient-controlled-mobile evidence wrong/stale                  | Source provenance, deliberate review, pause on source change, no overstated verification                    | Integration, clinical governance, privacy   |
| Missing/delayed webhook without daily reconciliation            | Unavailable state, event-triggered reconciliation, no uncertain resend                                      | Provider, service, security                 |
| No-cap pilot exceeds capacity                                   | Queue/workload visibility, 60-minute unclaimed escalation, stopping rules, early review                     | Governance board, service operations        |
| One-way contact feels mechanical or implies unavailable support | First-message support content, staffed phone, two lived-experience gates, external acceptability evaluation | Clinical programme, lived experience        |
| Agreement classification unresolved                             | Exact neutral label; no legal/treatment-consent claim; synthetic only                                       | Clinical governance, legal/privacy, records |
| Aggregate small cells enable inference                          | Approved threshold and non-inferable `Suppressed`; synthetic aggregates until set                           | Governance, analytics                       |
| Design mistaken for readiness                                   | Persistent synthetic/non-production label and explicit gates                                                | Product owner and design reviewers          |

## 7. Non-production limit

Progression requires clinical/lived-experience approval of message versions, approval of the complete
prototype, privacy/security/accessibility review, assessed simulation and later explicit provider and
pilot authorisation. This record claims no clinical approval, WA Health endorsement, provider
acceptance, deployment, migration, production readiness or clinical effectiveness.
