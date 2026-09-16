# DSM-5-TR and Sources handover reconciliation, 16 September 2026

Reconciliation of the `PsychSift_DSM5TR_Claude_Cloud_2026-09-16` handover against this
checkout. The package itself is not vendored here: it is an input, and copying its clinical text
into the repository would move the authority from the source to this file.

- Evidence baseline the package was prepared against: `c6d677e569ee9faedefa31c96eb927ab5fbd433d` (14 September 2026)
- HEAD reconciled against: `66105e18dc490e0e4c8ec6eb5c4f42fa506c13c3`
- Package integrity: `CHECKSUMS.sha256` clean, 100/100 offline tests green across both suites, all JSON schemas valid
- Scope: DSM, Clinical Ask evidence, and Sources. WardFlow, Calculators and the ingestion worker were not touched.
- What still needs a person: [dsm5tr-approvals-queue.md](dsm5tr-approvals-queue.md)

## What was implemented

### 1. A key-feature summary was being called the DSM-5-TR criteria

145 of the 146 records in `src/data/dsm-clinical-content.json` ship an empty `criteria_display`.
Only Bipolar II carries structured criteria. `dsmCriteria()` collapsed that with
`criteria_display.length > 0 ? criteria_display : key_features`, and every caller then labelled the
key-feature summary as the diagnostic standard:

- the diagnosis page headed it **Core diagnostic criteria** with the subtitle _All criteria are shown_,
  and the at-a-glance tile read _4 criteria, A-D_;
- the compare table read it out under **Core threshold** and **Additional criteria**, duplicating the
  **Key features** row directly beneath;
- the note builder emitted **Criteria met (A, B, C)** and closed with **Recorded against DSM-5-TR
  criteria**, into text designed to be pasted into a progress note.

`dsmCriteriaView()` now carries the provenance with the rows, and `dsmCriteria` is gone as an
exported symbol so a caller cannot drop it. Every label follows `isDsmCriteria`. The summary content
is unchanged and still shown in full; only what it is called has changed. A record without criteria
now says so explicitly rather than reporting zero criteria, because an empty array means the export
omitted them, not that DSM-5-TR defines none.

### 2. The DSM catalogue was vouching for itself in Clinical Ask

`dsmEvidence` hard-coded `publisher: "Authorised DSM clinical catalogue"` and
`reviewState: "reviewed"`. `assessEvidenceSufficiency` gates `sufficient` on `hasReviewedSupport`, so
that one constant made every DSM answer register as fully supported by the catalogue alone and
suppressed the external-corroboration path. Both fields now come from `dsmCatalogueProvenance`, the
extract states when a record has no full criteria, and the export's generation date is carried as
currency. The adjacent "Authorised specifier catalogue" fallback label went with it.

### 3. One passage was counted as support for every answer section

`annotateEvidenceCoverage` computed one `directlySupports` verdict against the whole request and
mapped it onto every section in `sectionOrder`, so a passage stating a duration threshold was
recorded as direct support for impairment and for exclusions too. Sections that assert a specific
dimension now have to be addressed by the passage itself. A section absent from the cue table is
request-scoped: it frames the question, or reports what is missing, and a gap section is not
something a source is cited for.

`conflictsWithEvidenceIds` was also hard-coded empty, so one source saying two weeks and another
saying four both counted as support. Detection is narrow: same atom kind, same unit, different
canonical value, only between passages that already support the request.

### 4. The upload route asserted a jurisdiction it could not know

`metadata.jurisdiction` initialised to `"Australia/WA"` while publisher, version and publication date
were honestly null, so a clinician uploading the APA's own PDF produced a record claiming it was
Western Australian. It is null now. This was safe to change without a retrieval evaluation and the
test pins why: a fresh upload has no publisher, so authority classification is decided by
`unrecognized_authority` and the jurisdiction value never reached it. Classification is byte-identical
with and without the default.

### 5. Five publishers registered, for catalogue identity only

The American Psychiatric Association, IHACPA, SAMHSA, the Government of Western Australia and the
University of Sydney's Specialty of Addiction Medicine are now in `src/lib/source-authority-registry.ts`
with `catalogueIdentityOnly: true`. That flag is the safety boundary, not a formality:
`sourceAuthorityIsRuntimeClassifiable` filters these out of `registeredCodes`, and
`sourceAuthorityForPublisher` returns null for them, so nothing here reaches the runtime
classification that steers retrieval selection. `tests/dsm5tr-source-registration.test.ts` holds that.
Making any of them runtime-classifiable later is a retrieval-behaviour change and needs the eval
canary the RAG safeguards require.

`alcoholtreatmentguidelines.com.au` was added to `GOVERNED_SOURCE_HOSTS`. The two other ungoverned
hosts were not: `tests/source-catalogue-providers.test.ts` requires the governed set to equal the set
of hosts actually emitted, and the Queensland Health and PCH sources are still held, so neither host
is emitted.

## Claims: disposition of all 30

| Disposition                                         | Count | Claims                                                                                                                                                                      |
| --------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implemented                                         | 7     | `criteria-fallback`, `count-is-not-completeness`, `clinical-use`, `review-state-amplification`, `section-coverage`, `upload-default-jurisdiction`, `authority-gate`         |
| Already satisfied at HEAD                           | 7     | `preserve-current-fixes`, `bipolar-ii-correction`, `ledger-admission`, `upload-metadata-boundary`, `source-id-crosswalk`, `date-precision-map`, `separate-ingestion-stages` |
| Held, needs an admitted source or clinical sign-off | 16    | the coding, alcohol, eating-disorder, legal and permissions claims                                                                                                          |

The Bipolar II deletion instruction from the earlier audit stays withdrawn. The record's five
criteria rows are untouched.

## Sources: all 24 accounted for, 7 admitted

The package's no-write preview holds every source on pinned-policy drift (`source-authority-registry.ts`
blob has changed since the baseline). That hold was not worked around: the pinned hash was left alone
and the current native gate, `acquisitionLedgerIssues()` in `src/lib/sources/acquisition-ledger.ts`,
was run independently against all 24.

Seven were admitted as **unverified candidates** once their publishers had a registered identity. Each
carries the date precision its publisher actually printed rather than a manufactured day, which is what
`datePrecision` exists for: "September 2025" is recorded as `2025-09-01` at month precision, "2022" as
`2022-01-01` at year precision, and IHACPA's exact `2025-03-14` stays at day precision. None is adopted,
none is reviewed, and `capturedAt` stays at the handover's 14 September check rather than being re-dated
to today.

Seventeen are held because the publisher prints no version, no publication date, or both. Neither may be
invented, so they stay held.

`psychsift-dsm-export-format-1-0-0` is a separate case: the DSM dataset is already registered through
`dsmProvider` in `src/lib/sources/repository-providers.ts`, with the `dsm-5-diagnosis` identity, export
version and generation date preserved.

| Source                                                                                            | Publisher                                                                                 | Outcome                            | Detail                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apa-dsm5tr-manual`                                                                               | American Psychiatric Association                                                          | **admitted, unverified candidate** | version `Fifth Edition, Text Revision`, published `2022-01-01` (year precision), rung by publisher geography                                                                                                                                                  |
| `apa-dsm5tr-supplement-2022-09`                                                                   | American Psychiatric Association                                                          | **admitted, unverified candidate** | version `September 2022`, published `2022-09-01` (month precision), rung by publisher geography                                                                                                                                                               |
| `apa-dsm5tr-supplement-2023-09`                                                                   | American Psychiatric Association                                                          | **admitted, unverified candidate** | version `September 2023`, published `2023-09-01` (month precision), rung by publisher geography                                                                                                                                                               |
| `apa-dsm5tr-supplement-2024-09`                                                                   | American Psychiatric Association                                                          | **admitted, unverified candidate** | version `September 2024`, published `2024-09-01` (month precision), rung by publisher geography                                                                                                                                                               |
| `apa-dsm5tr-supplement-2025-09`                                                                   | American Psychiatric Association                                                          | **admitted, unverified candidate** | version `September 2025`, published `2025-09-01` (month precision), rung by publisher geography                                                                                                                                                               |
| `ihacpa-icd10am-achi-acs-13`                                                                      | Independent Health and Aged Care Pricing Authority                                        | **admitted, unverified candidate** | version `Thirteenth Edition`, published `2025-03-14` (day precision), rung by publisher geography                                                                                                                                                             |
| `sydney-alcohol-problems-guidelines-4`                                                            | Specialty of Addiction Medicine, Faculty of Medicine and Health, The University of Sydney | **admitted, unverified candidate** | version `4th edition`, published `2021-01-01` (year precision), rung by publisher geography                                                                                                                                                                   |
| `alcohol-guidelines-thiamine-section`                                                             | (not supplied)                                                                            | held                               | publisher is required; jurisdiction is required; version is required; publicationDate is required; publisher "" is not in the source authority register; incomplete source metadata (missing_dates, missing_publisher, missing_version, unknown_jurisdiction) |
| `apa-about-dsm5tr`                                                                                | American Psychiatric Association                                                          | held                               | version is required; publicationDate is required; incomplete source metadata (missing_dates, missing_version)                                                                                                                                                 |
| `apa-copyright-information`                                                                       | American Psychiatric Association                                                          | held                               | version is required; publicationDate is required; incomplete source metadata (missing_dates, missing_version)                                                                                                                                                 |
| `apa-dsm-landing`                                                                                 | American Psychiatric Association                                                          | held                               | version is required; publicationDate is required; incomplete source metadata (missing_dates, missing_version)                                                                                                                                                 |
| `apa-dsm5tr-approved-update-register`                                                             | American Psychiatric Association                                                          | held                               | version is required; publicationDate is required; incomplete source metadata (missing_dates, missing_version)                                                                                                                                                 |
| `apa-dsm5tr-autism-fact-sheet`                                                                    | American Psychiatric Association                                                          | held                               | version is required; publicationDate is required; incomplete source metadata (missing_dates, missing_version)                                                                                                                                                 |
| `apa-dsm5tr-autism-severity-proposal`                                                             | American Psychiatric Association                                                          | held                               | version is required; publicationDate is required; incomplete source metadata (missing_dates, missing_version)                                                                                                                                                 |
| `apa-dsm5tr-bipolar-fact-sheet`                                                                   | American Psychiatric Association                                                          | held                               | version is required; publicationDate is required; incomplete source metadata (missing_dates, missing_version)                                                                                                                                                 |
| `apa-dsm5tr-icd10cm-update-register`                                                              | American Psychiatric Association                                                          | held                               | version is required; publicationDate is required; incomplete source metadata (missing_dates, missing_version)                                                                                                                                                 |
| `cahs-pch-eating-disorders-prereferral`                                                           | Perth Children's Hospital                                                                 | held                               | version is required; publicationDate is required; pch.health.wa.gov.au is not a governed source host; incomplete source metadata (missing_dates, missing_version, unsafe_location)                                                                            |
| `ihacpa-national-coding-advice-register`                                                          | Independent Health and Aged Care Pricing Authority                                        | held                               | version is required; incomplete source metadata (missing_version)                                                                                                                                                                                             |
| `psychsift-dsm-combined-guide-supplied`                                                           | (not supplied)                                                                            | held                               | publisher is required; version is required; publicationDate is required; publisher "" is not in the source authority register; incomplete source metadata (ambiguous_identity, missing_dates, missing_publisher, missing_version, unknown_jurisdiction)       |
| `psychsift-dsm-export-format-1-0-0`                                                               | (not supplied)                                                                            | held                               | publisher is required; jurisdiction is required; publicationDate is required; publisher "" is not in the source authority register; incomplete source metadata (ambiguous_identity, missing_dates, missing_publisher, unknown_jurisdiction)                   |
| `psychsift-dsm-reviewed-guide-2-0`                                                                | (not supplied)                                                                            | held                               | publisher is required; publicationDate is required; publisher "" is not in the source authority register; incomplete source metadata (ambiguous_identity, missing_dates, missing_publisher, unknown_jurisdiction)                                             |
| `qldhealth-eating-disorders-adult-wards-1-0`                                                      | Queensland Health                                                                         | held                               | publicationDate is required; www.health.qld.gov.au is not a governed source host; incomplete source metadata (unsafe_location)                                                                                                                                |
| `samhsa-dsm-iv-dsm-5-bipolar-ii-comparison`                                                       | Substance Abuse and Mental Health Services Administration                                 | held                               | version is required; incomplete source metadata (missing_version)                                                                                                                                                                                             |
| `wa-mandatory-reporting-child-sexual-abuse-guidance`                                              | Government of Western Australia                                                           | held                               | version is required; publicationDate is required; incomplete source metadata (missing_dates, missing_version)                                                                                                                                                 |
| No source advanced past `staged` and a local ledger row. Nothing was indexed, retrieval-verified, |
| clinically approved or activated, and no bytes were acquired.                                     |

## The 14 content concepts

They are clinical-information and governance concepts, not diagnoses. None was turned into a
diagnosis record and the catalogue still holds 146. Five (`source-model`, `ingestion`, `ai-evidence`,
`rights`, `update-lineage`) are developer and governance documentation and are recorded here. The
other nine are candidate help text and are held pending named clinical review, listed in the
approvals queue.

## Operations performed

Local edits and offline tests on this branch. No push to `main`, no pull request, no merge, no
deployment, no database or index write, no provider or paid API call, no source adoption or
activation, and no change to ranking or to any runtime-classifiable authority.
