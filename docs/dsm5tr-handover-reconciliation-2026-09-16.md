# DSM-5-TR and Sources handover reconciliation, 16 September 2026

Reconciliation of the `PsychSift_DSM5TR_Claude_Cloud_2026-09-16` handover package against this
checkout. The package itself is not vendored here: it is an input, and copying its clinical text
into the repository would move the authority from the source to this file.

- Evidence baseline the package was prepared against: `c6d677e569ee9faedefa31c96eb927ab5fbd433d` (14 September 2026)
- HEAD reconciled against: `66105e18dc490e0e4c8ec6eb5c4f42fa506c13c3`
- Package integrity: `CHECKSUMS.sha256` clean, 100/100 offline tests green across both suites, all JSON schemas valid
- Scope: DSM and Sources only. WardFlow, Calculators and the ingestion worker were not touched.

## What was implemented

One defect, the one that reached a patient record.

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

Held by `tests/dsm-criteria-provenance.test.ts`.

## Claims: disposition of all 30

| Disposition                                         | Count | Claims                                                                                                                                                                      |
| --------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implemented                                         | 3     | `criteria-fallback`, `count-is-not-completeness`, `clinical-use`                                                                                                            |
| Already satisfied at HEAD                           | 7     | `preserve-current-fixes`, `bipolar-ii-correction`, `ledger-admission`, `upload-metadata-boundary`, `source-id-crosswalk`, `date-precision-map`, `separate-ingestion-stages` |
| Held, protected behaviour                           | 3     | `review-state-amplification`, `section-coverage`, `authority-gate`                                                                                                          |
| Held, needs an admitted source or clinical sign-off | 17    | the coding, alcohol, eating-disorder, legal and permissions claims                                                                                                          |

The Bipolar II deletion instruction from the earlier audit stays withdrawn. The record's five
criteria rows are untouched.

## Held for approval

1. **`src/lib/clinical-ask/catalogue-evidence.ts`** hard-codes `publisher: "Authorised DSM clinical
catalogue"` and `reviewState: "reviewed"` for every DSM evidence item, while no record in the
   catalogue carries a review receipt and 145 of 146 carry no criteria. `reviewState` feeds
   `evidence-sufficiency.ts`, which decides when Clinical Ask falls back to external search, so
   correcting it changes answer behaviour and needs the protected-behaviour approval.
2. **`src/lib/clinical-ask/evidence-sufficiency.ts`** computes `directlySupports` once per evidence
   item and maps it to every answer section, so a passage about duration counts as support for
   impairment and exclusions. Same approval gate.
3. **Registering the American Psychiatric Association and IHACPA** in
   `src/lib/source-authority-registry.ts`. This is what blocks 20 of the 24 sources, and it changes
   retrieval selection, so it is an owner decision with the evaluation the RAG safeguards require.
4. **`src/app/api/upload/route.ts`** defaults `metadata.jurisdiction` to `"Australia/WA"`. That
   default must not be read as evidence that an APA source is local. Ingestion is read-only planning
   in this scope.

## Sources: all 24 accounted for, none admitted

The package's no-write preview holds every source on pinned-policy drift (`source-authority-registry.ts`
blob has changed since the baseline). That hold was not worked around: the pinned hash was left alone
and the current native gate, `acquisitionLedgerIssues()` in `src/lib/sources/acquisition-ledger.ts`,
was run independently against all 24. **0 of 24 pass.** No row was added to
`src/data/source-acquisitions.json`, no host was added to `GOVERNED_SOURCE_HOSTS`, and no publisher
was added to the authority register.

`psychsift-dsm-export-format-1-0-0` is the one already-satisfied identity: the DSM dataset is
registered through `dsmProvider` in `src/lib/sources/repository-providers.ts`, with the
`dsm-5-diagnosis` identity, export version and generation date already preserved.

| Source                                                                                        | Publisher                                                                                 | Outcome | Blockers at this HEAD                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alcohol-guidelines-thiamine-section`                                                         | (not supplied)                                                                            | held    | publisher is required; version is required; publicationDate is required; alcoholtreatmentguidelines.com.au not a governed source host; publisher (none) not in the source authority register; incomplete source metadata (ambiguous_identity, missing_dates, missing_publisher, missing_version, unknown_jurisdiction, unsafe_location) |
| `apa-about-dsm5tr`                                                                            | American Psychiatric Association                                                          | held    | version is required; publicationDate is required; publisher American Psychiatric Association not in the source authority register; incomplete source metadata (missing_dates, missing_version, unknown_jurisdiction)                                                                                                                    |
| `apa-copyright-information`                                                                   | American Psychiatric Association                                                          | held    | version is required; publicationDate is required; publisher American Psychiatric Association not in the source authority register; incomplete source metadata (missing_dates, missing_version, unknown_jurisdiction)                                                                                                                    |
| `apa-dsm-landing`                                                                             | American Psychiatric Association                                                          | held    | version is required; publicationDate is required; publisher American Psychiatric Association not in the source authority register; incomplete source metadata (missing_dates, missing_version, unknown_jurisdiction)                                                                                                                    |
| `apa-dsm5tr-approved-update-register`                                                         | American Psychiatric Association                                                          | held    | version is required; publicationDate is required; publisher American Psychiatric Association not in the source authority register; incomplete source metadata (missing_dates, missing_version, unknown_jurisdiction)                                                                                                                    |
| `apa-dsm5tr-autism-fact-sheet`                                                                | American Psychiatric Association                                                          | held    | version is required; publicationDate is required; publisher American Psychiatric Association not in the source authority register; incomplete source metadata (missing_dates, missing_version, unknown_jurisdiction)                                                                                                                    |
| `apa-dsm5tr-autism-severity-proposal`                                                         | American Psychiatric Association                                                          | held    | version is required; publicationDate is required; publisher American Psychiatric Association not in the source authority register; incomplete source metadata (missing_dates, missing_version, unknown_jurisdiction)                                                                                                                    |
| `apa-dsm5tr-bipolar-fact-sheet`                                                               | American Psychiatric Association                                                          | held    | version is required; publicationDate is required; publisher American Psychiatric Association not in the source authority register; incomplete source metadata (missing_dates, missing_version, unknown_jurisdiction)                                                                                                                    |
| `apa-dsm5tr-icd10cm-update-register`                                                          | American Psychiatric Association                                                          | held    | version is required; publicationDate is required; publisher American Psychiatric Association not in the source authority register; incomplete source metadata (missing_dates, missing_version, unknown_jurisdiction)                                                                                                                    |
| `apa-dsm5tr-manual`                                                                           | American Psychiatric Association                                                          | held    | publicationDate is required; publisher American Psychiatric Association not in the source authority register; incomplete source metadata (missing_dates, unknown_jurisdiction)                                                                                                                                                          |
| `apa-dsm5tr-supplement-2022-09`                                                               | American Psychiatric Association                                                          | held    | publicationDate is required; publisher American Psychiatric Association not in the source authority register; incomplete source metadata (missing_dates, unknown_jurisdiction)                                                                                                                                                          |
| `apa-dsm5tr-supplement-2023-09`                                                               | American Psychiatric Association                                                          | held    | publicationDate is required; publisher American Psychiatric Association not in the source authority register; incomplete source metadata (missing_dates, unknown_jurisdiction)                                                                                                                                                          |
| `apa-dsm5tr-supplement-2024-09`                                                               | American Psychiatric Association                                                          | held    | publicationDate is required; publisher American Psychiatric Association not in the source authority register; incomplete source metadata (missing_dates, unknown_jurisdiction)                                                                                                                                                          |
| `apa-dsm5tr-supplement-2025-09`                                                               | American Psychiatric Association                                                          | held    | publicationDate is required; publisher American Psychiatric Association not in the source authority register; incomplete source metadata (missing_dates, unknown_jurisdiction)                                                                                                                                                          |
| `cahs-pch-eating-disorders-prereferral`                                                       | Perth Children's Hospital                                                                 | held    | version is required; publicationDate is required; pch.health.wa.gov.au not a governed source host; incomplete source metadata (missing_dates, missing_version, unsafe_location)                                                                                                                                                         |
| `ihacpa-icd10am-achi-acs-13`                                                                  | Independent Health and Aged Care Pricing Authority                                        | held    | publisher Independent Health and Aged Care Pricing Authority not in the source authority register; incomplete source metadata (unknown_jurisdiction)                                                                                                                                                                                    |
| `ihacpa-national-coding-advice-register`                                                      | Independent Health and Aged Care Pricing Authority                                        | held    | version is required; publisher Independent Health and Aged Care Pricing Authority not in the source authority register; incomplete source metadata (missing_version, unknown_jurisdiction)                                                                                                                                              |
| `psychsift-dsm-combined-guide-supplied`                                                       | (not supplied)                                                                            | held    | publisher is required; version is required; publicationDate is required; publisher (none) not in the source authority register; incomplete source metadata (ambiguous_identity, missing_dates, missing_publisher, missing_version, unknown_jurisdiction)                                                                                |
| `psychsift-dsm-export-format-1-0-0`                                                           | (not supplied)                                                                            | held    | publisher is required; publicationDate is required; publisher (none) not in the source authority register; incomplete source metadata (ambiguous_identity, missing_dates, missing_publisher, unknown_jurisdiction)                                                                                                                      |
| `psychsift-dsm-reviewed-guide-2-0`                                                            | (not supplied)                                                                            | held    | publisher is required; publicationDate is required; publisher (none) not in the source authority register; incomplete source metadata (ambiguous_identity, missing_dates, missing_publisher, unknown_jurisdiction)                                                                                                                      |
| `qldhealth-eating-disorders-adult-wards-1-0`                                                  | Queensland Health                                                                         | held    | publicationDate is required; www.health.qld.gov.au not a governed source host; incomplete source metadata (unsafe_location)                                                                                                                                                                                                             |
| `samhsa-dsm-iv-dsm-5-bipolar-ii-comparison`                                                   | Substance Abuse and Mental Health Services Administration                                 | held    | version is required; publicationDate is required; publisher Substance Abuse and Mental Health Services Administration not in the source authority register; incomplete source metadata (missing_dates, missing_version, unknown_jurisdiction)                                                                                           |
| `sydney-alcohol-problems-guidelines-4`                                                        | Specialty of Addiction Medicine, Faculty of Medicine and Health, The University of Sydney | held    | publicationDate is required; alcoholtreatmentguidelines.com.au not a governed source host; publisher Specialty of Addiction Medicine, Faculty of Medicine and Health, The University of Sydney not in the source authority register; incomplete source metadata (missing_dates, unknown_jurisdiction, unsafe_location)                  |
| `wa-mandatory-reporting-child-sexual-abuse-guidance`                                          | Government of Western Australia                                                           | held    | version is required; publicationDate is required; publisher Government of Western Australia not in the source authority register; incomplete source metadata (missing_dates, missing_version, unknown_jurisdiction)                                                                                                                     |
| No source advanced past `staged`. Nothing was catalogued, no bytes were acquired, nothing was |
| extracted, indexed, retrieval-verified, clinically approved or activated.                     |

## The 14 content concepts

They are clinical-information and governance concepts, not diagnoses. None was turned into a
diagnosis record and the catalogue still holds 146. Five (`source-model`, `ingestion`, `ai-evidence`,
`rights`, `update-lineage`) are developer and governance documentation and are recorded here. The
other nine are candidate help text and are held pending named clinical review.

## Operations performed

Local edits and offline tests on this branch. No push to `main`, no pull request, no merge, no
deployment, no database or index write, no provider or paid API call, no source activation, no
change to ranking, authority policy or governed hosts.
