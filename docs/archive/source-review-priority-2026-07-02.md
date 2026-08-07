# Source review priority list — 2026-07-02

## Why this list exists

The release quality eval's top-result `review_required_rate` rose from 0.14 (accepted 2026-07-02 morning,
ceiling 0.2) to 0.5398 in the afternoon run. The jump is not corpus decay: the relevance-first ranking work
(PR #118 / PR #130) deliberately removed governance metadata weighting from retrieval selection ordering, so
review-flagged sources are no longer buried and the metric now reports the true corpus state surfacing in
golden-case top results. The bounded debt acceptance in
`docs/release-source-metadata-debt-2026-06-30.json` was re-accepted at a 0.6 ceiling (expiry unchanged,
2026-07-31) on the condition that the documents below are clinically reviewed first.

Corpus context (live DB, 2026-07-02): 2,065 indexed documents — 1,397 current/locally_reviewed, 481
`review_due`, 132 `unknown` status, 130 `unverified` validation, 0 outdated, 0 poor-extraction.

## Burn-down math

Eval run `retrieval-quality-2026-07-02T08-37-08-387Z`: 113 top-5 slots across 23 golden cases; 61 slots
review-required (31 `review_due` + 37 `unverified`, overlapping). **25 distinct documents account for all 61
slots.** Reviewing the 12 documents with 2+ slots clears 47 slots, taking the rate from 0.54 to roughly 0.12
— back under the original 0.2 ceiling.

## Priority order (golden top-5 slot count)

| Slots | Document                                                                                      | Status flag | Validation flag | Golden cases hit                                                                   |
| ----: | --------------------------------------------------------------------------------------------- | ----------- | --------------- | ---------------------------------------------------------------------------------- |
|     8 | Clozapine Management by GP (NMHS).pdf                                                         | review_due  | —               | show-source-table-image, monitoring-threshold-from-chart                           |
|     6 | Opioid use disorder.pdf                                                                       | —           | unverified      | opioid-use-disorder-management, opioid-withdrawal-doses                            |
|     6 | Bipolar disorder in adults.pdf                                                                | —           | unverified      | bipolar-management-summary, bipolar-vs-schizoaffective, lithium-therapy-monitoring |
|     5 | Alcohol withdrawal.pdf                                                                        | review_due  | unverified      | alcohol-withdrawal-management, alcohol-ciwa-threshold                              |
|     5 | Postnatal depression.pdf                                                                      | —           | unverified      | depression-adults-vs-children, postnatal-depression-treatment                      |
|     5 | Alcohol and Other Drugs - Addiction, Toxicity and Withdrawal (FSH).pdf                        | review_due  | —               | alcohol-ciwa-scoring, alcohol-ciwa-threshold                                       |
|     4 | Schizophrenia.pdf                                                                             | —           | unverified      | clozapine-anc-threshold, schizophrenia-overview                                    |
|     2 | Arousal and Agitation Drug Management (CAMHS).pdf                                             | review_due  | —               | agitation-im-po-options, medication-chart-dose-route                               |
|     2 | Depression in adults.pdf                                                                      | —           | unverified      | depression-adults-vs-children                                                      |
|     2 | Depression in children.pdf                                                                    | —           | unverified      | depression-adults-vs-children                                                      |
|     2 | Schizoaffective disorder.pdf                                                                  | review_due  | unverified      | bipolar-vs-schizoaffective                                                         |
|     1 | Clozapine GP Shared Care (FSH).pdf                                                            | review_due  | —               | clozapine-anc-threshold                                                            |
|     1 | ED CNS Roles and Responsibilities (RPBG).pdf                                                  | review_due  | —               | active-community-patient-ed                                                        |
|     1 | Discharge Follow-Up for Inpatients (FSH).pdf                                                  | review_due  | —               | admission-discharge-comparison                                                     |
|     1 | Resuscitation and Responding to Clinical Deterioration - MET Review and Code Blue (CAMHS).pdf | review_due  | —               | flowchart-next-step                                                                |
|     1 | Dyssomnias in children.pdf                                                                    | —           | unverified      | insomnia-assessment-management                                                     |
|     1 | Assessment of fatigue.pdf                                                                     | —           | unverified      | insomnia-assessment-management                                                     |
|     1 | Insomnia.pdf                                                                                  | —           | unverified      | insomnia-assessment-management                                                     |
|     1 | Suicide risk mitigation.pdf                                                                   | —           | unverified      | suicide-risk-mitigation-guidance                                                   |
|     1 | Advance Health Directive (AKG).pdf                                                            | review_due  | —               | schizophrenia-overview                                                             |
|     1 | Alcohol use disorder.pdf                                                                      | —           | unverified      | alcohol-ciwa-scoring                                                               |
|     1 | NS IPWU Transfer from Methadone to Buprenorphine OST SOP (RPBG).pdf                           | review_due  | —               | opioid-withdrawal-doses                                                            |
|     1 | Analgesia and Sedation Assessment in PCC (CAMHS).pdf                                          | review_due  | —               | opioid-withdrawal-doses                                                            |
|     1 | Electroconvulsive Therapy Policy and Procedure (RKPG).pdf                                     | review_due  | —               | bipolar-vs-schizoaffective                                                         |
|     1 | ECT Registrar Role (FSH).pdf                                                                  | review_due  | —               | bipolar-vs-schizoaffective                                                         |

## How to clear a flag (per the debt-acceptance follow-up rules)

- `review_due` → confirm the source is still the current published version, then backfill
  `documents.metadata.document_status` to `current`. Do not mark current without confirming source
  currentness.
- `unverified` → complete local clinical review, then backfill
  `documents.metadata.clinical_validation_status` to `locally_reviewed`. Do not mark reviewed without an
  actual local review.
- After updating metadata, re-run `npm run eval:quality:release` and tighten
  `max_review_required_rate` in the debt file back toward 0.2 (or delete the debt file if under threshold).
