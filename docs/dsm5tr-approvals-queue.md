# DSM-5-TR and Sources: what is waiting on a person

Everything in this file needs a human decision. None of it can be resolved by code, and
none of it should be resolved by an agent. It exists so the decisions can be made in one
sitting rather than rediscovered each time the handover is reopened.

Companion to [dsm5tr-handover-reconciliation-2026-09-16.md](dsm5tr-handover-reconciliation-2026-09-16.md),
which records what was implemented.

## 1. Clinical sign-off: 16 claims

None of these has a named reviewer. Each was checked against a public source on 14 September
2026 and none has been clinically approved. Reopening this file does not re-date that check.

Decide for each: accept as written, amend, or reject. An accepted claim still needs a source
admitted before any clinical content may cite it.

| Claim                          | Priority | Verdict                                 | What it is about                                             | What the corrected wording says                                                                                                                                                      |
| ------------------------------ | -------- | --------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `permissions-specific`         | Critical | Unable to verify                        | Permissions are operation-specific                           | Check permission separately for access, storage, reproduction/display, modification, redistribution, commercial use and AI indexing. APA terms and licensed classification products  |
| `adult-eating-scope`           | High     | Overgeneralised                         | Adult Queensland guideline context                           | Keep adult eating-disorder medical assessment and inpatient care recommendations in a separate guideline-backed block. QH-GDL-516 is Queensland guidance, effective 14 July 2026 and |
| `alcohol-parent-metadata`      | High     | Incorrect                               | Correct alcohol guideline attribution and currency           | Use the printed 2021 fourth-edition citation: Haber PS and Riordan BC; Specialty of Addiction Medicine, Faculty of Medicine and Health, The University of Sydney. A 2026 website foo |
| `approved-updates`             | High     | Verified but wording should be improved | Version the approved change stream                           | Keep the manual edition and each incorporated amendment separate. September 2025 was the newest approved supplement listed on the accessed register. Record update incorporation per |
| `australian-coding-boundary`   | High     | Context-dependent                       | Australian admitted-care coding is a separate system         | For Australian admitted care, use separately verified ICD-10-AM/ACHI/ACS Thirteenth Edition for separations from 1 July 2025, with current National Coding Advice. Do not infer Aust |
| `autism-a-domains`             | High     | Verified but wording should be improved | Autism Criterion A public clarification                      | The APA fact sheet clarifies that all three Criterion A social-communication domains are required. Do not replace this with a generic symptom-score rule or assume a separate severi |
| `coding-advice-dates`          | High     | Incorrect                               | Keep register dates separate from advice issue dates         | The National Coding Advice webpage publication date is 7 August 2022. The listed Thirteenth Edition issue is effective 1 July 2026. Neither is evidence that a particular source was |
| `cyclothymic-like-terminology` | High     | Outdated                                | Other Specified Bipolar terminology                          | The 2025 supplement changes the example to short-duration cyclothymic-like disorder. Apply the amendment only to its defined example, not as a replacement for the diagnosis cycloth |
| `eating-coding-model`          | High     | Overgeneralised                         | Conditional eating-disorder coding                           | Represent the relevant code family using conditioned code objects with effective dates. Obtain the authoritative table and verify every selected mapping before migrating anorexia n |
| `pch-expired-review`           | High     | Outdated                                | PCH child/adolescent source is not current adult guidance    | Label the supplied PCH guidance as child/adolescent material with an elapsed review period: last reviewed November 2022, review due November 2025. Retain it for traceability; seek  |
| `pica-coding-delta`            | High     | Outdated                                | Pica age-specific US coding                                  | For the DSM-linked US coding delta effective 1 October 2024, pica uses F98.3 for children/adolescents and F50.83 for adults. Preserve age applicability and do not copy these into I |
| `proposal-not-final`           | High     | Context-dependent                       | Proposal versus promulgated change                           | Treat that as a proposal-stage observation. Require evidence of final publication/incorporation before changing current criteria or severity logic.                                  |
| `rumination-coding-delta`      | High     | Outdated                                | Rumination age-specific US coding                            | The 2024 amendment distinguishes F98.21 for infants/children/adolescents from F50.84 for adults. This is a US ICD-10-CM distinction, not an Australian crosswalk.                    |
| `supplement-lineage`           | High     | Verified but wording should be improved | Supplements are amendments, not independent complete manuals | Retain edition-specific identities, distinguish amendment lineage from independent corroboration, and do not automatically mark whole earlier sources superseded because a later cum |
| `thiamine-conditional-timing`  | High     | Overgeneralised                         | Preserve the timing qualification for thiamine               | The Australian guideline qualifies carbohydrate timing: administer thiamine before carbohydrate when feasible, otherwise as soon as possible. Do not convert that conditional recomm |
| `wa-reporting-guidance`        | High     | Incorrect                               | WA reporting webpage is guidance, not legislation            | Classify the webpage as government professional guidance. It describes the child-sexual-abuse reporting duty and identifies the Children and Community Services Act 2004. Check the  |

## 2. Clinical sign-off: 9 candidate information concepts

These are supporting clinical-information concepts, not diagnoses. None was turned into a
diagnosis record and the catalogue still holds 146. They are candidates for visible help
text and none is shown anywhere in the app today.

Decide for each: publish as help text, keep as internal documentation, or drop.

| Concept              | Title                                                              | Purpose                                                               |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `alcohol`            | Alcohol-related management belongs in an Australian guidance block | Correct the scope and attribution of embedded management text.        |
| `asd`                | ASD: published clarification versus proposal                       | Avoid symptom-score substitution and premature proposal adoption.     |
| `au-coding`          | Australian admitted-care coding                                    | Prevent jurisdiction and date conflation.                             |
| `bipolar-correction` | Bipolar II: do not repeat the earlier audit error                  | Preserve the corrected research history.                              |
| `criteria-boundary`  | Summary versus complete criteria                                   | Repair semantic completeness without deleting useful source material. |
| `eating`             | Eating disorders: distinguish diagnostic severity from disposition | Use population- and jurisdiction-specific clinical evidence.          |
| `legal`              | WA legal references are not psychiatric diagnostic rules           | Preserve legal authority and trigger boundaries.                      |
| `orientation`        | Use the DSM mode as a clinician reference                          | Place the safest high-yield context on the first screen.              |
| `us-coding`          | Age- and condition-aware US coding                                 | Provide exact, bounded coding-delta tasks.                            |

## 3. Rights and permissions: 7 questions per source, 24 sources

A permission is operation-specific. Being able to read a page online establishes none of the
other six. Nothing in this table has been resolved, and `unknown` means unresolved, not
permitted and not prohibited.

This matters most for `ai_processing_indexing`: it is the permission that decides whether a
source may be chunked and embedded, and it is `unknown` for all 24. No source has been
indexed, so nothing has been done that any of these answers would forbid.

The APA material needs a licence answer before anything beyond a link. The repository is
publicly visible, which makes reproduction and redistribution the two to settle first.

| Source                                               | Access  | Storage | Reproduction / display | Modification / translation | Redistribution      | Commercial use | AI processing / indexing |
| ---------------------------------------------------- | ------- | ------- | ---------------------- | -------------------------- | ------------------- | -------------- | ------------------------ |
| `alcohol-guidelines-thiamine-section`                | unknown | unknown | unknown                | unknown                    | unknown             | unknown        | unknown                  |
| `apa-about-dsm5tr`                                   | unknown | unknown | permission required    | permission required        | permission required | unknown        | unknown                  |
| `apa-copyright-information`                          | unknown | unknown | permission required    | permission required        | permission required | unknown        | unknown                  |
| `apa-dsm-landing`                                    | unknown | unknown | permission required    | permission required        | permission required | unknown        | unknown                  |
| `apa-dsm5tr-approved-update-register`                | unknown | unknown | permission required    | permission required        | permission required | unknown        | unknown                  |
| `apa-dsm5tr-autism-fact-sheet`                       | unknown | unknown | permission required    | permission required        | permission required | unknown        | unknown                  |
| `apa-dsm5tr-autism-severity-proposal`                | unknown | unknown | permission required    | permission required        | permission required | unknown        | unknown                  |
| `apa-dsm5tr-bipolar-fact-sheet`                      | unknown | unknown | permission required    | permission required        | permission required | unknown        | unknown                  |
| `apa-dsm5tr-icd10cm-update-register`                 | unknown | unknown | permission required    | permission required        | permission required | unknown        | unknown                  |
| `apa-dsm5tr-manual`                                  | unknown | unknown | permission required    | permission required        | permission required | unknown        | unknown                  |
| `apa-dsm5tr-supplement-2022-09`                      | unknown | unknown | permission required    | permission required        | permission required | unknown        | unknown                  |
| `apa-dsm5tr-supplement-2023-09`                      | unknown | unknown | permission required    | permission required        | permission required | unknown        | unknown                  |
| `apa-dsm5tr-supplement-2024-09`                      | unknown | unknown | permission required    | permission required        | permission required | unknown        | unknown                  |
| `apa-dsm5tr-supplement-2025-09`                      | unknown | unknown | permission required    | permission required        | permission required | unknown        | unknown                  |
| `cahs-pch-eating-disorders-prereferral`              | unknown | unknown | unknown                | unknown                    | unknown             | unknown        | unknown                  |
| `ihacpa-icd10am-achi-acs-13`                         | unknown | unknown | unknown                | unknown                    | unknown             | unknown        | unknown                  |
| `ihacpa-national-coding-advice-register`             | unknown | unknown | unknown                | unknown                    | unknown             | unknown        | unknown                  |
| `psychsift-dsm-combined-guide-supplied`              | unknown | unknown | unknown                | unknown                    | unknown             | unknown        | unknown                  |
| `psychsift-dsm-export-format-1-0-0`                  | unknown | unknown | unknown                | unknown                    | unknown             | unknown        | unknown                  |
| `psychsift-dsm-reviewed-guide-2-0`                   | unknown | unknown | unknown                | unknown                    | unknown             | unknown        | unknown                  |
| `qldhealth-eating-disorders-adult-wards-1-0`         | unknown | unknown | unknown                | unknown                    | unknown             | unknown        | unknown                  |
| `samhsa-dsm-iv-dsm-5-bipolar-ii-comparison`          | unknown | unknown | unknown                | unknown                    | unknown             | unknown        | unknown                  |
| `sydney-alcohol-problems-guidelines-4`               | unknown | unknown | unknown                | unknown                    | unknown             | unknown        | unknown                  |
| `wa-mandatory-reporting-child-sexual-abuse-guidance` | unknown | unknown | unknown                | unknown                    | unknown             | unknown        | unknown                  |

## 4. Metadata the publisher does not print: 17 sources

These are held because the publisher prints no version, no publication date, or both. They
cannot be admitted without inventing a value, and inventing one is the failure this whole
register exists to prevent. Exact blockers per source are in the reconciliation record.

Most are APA web pages that carry no version at all. A living register page such as IHACPA's
National Coding Advice genuinely has no version, and that is a property of the source rather
than a gap in the capture. For those, the decision is whether the acquisition contract should
accept a dated-but-unversioned living register, which is a change to the metadata floor and
a separate piece of work.

## 5. Retrieval evaluation not run

The five authority entries added on 16 September are `catalogueIdentityOnly`, which excludes
them from runtime classification by construction, so retrieval is unchanged and no evaluation
is owed. If any of them is ever made runtime-classifiable, that is a retrieval-behaviour
change and needs the before-and-after eval canary the RAG safeguards require. That run is
provider-backed and costs money, so it needs explicit approval and cannot be done offline.
