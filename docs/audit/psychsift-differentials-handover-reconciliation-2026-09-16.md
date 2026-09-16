# PsychSift Differentials handover reconciliation — 2026-09-16

Reconciliation receipt for the `PsychSift_Differentials_Claude_Cloud_2026-09-16` handover
bundle. Read-only preflight, then the narrowly scoped metadata work this document records.
No commit, push, merge, deployment, migration, database write, index write, provider call
or source activation formed part of it.

## Environment actually observed

| Fact                              | Value                                      |
| --------------------------------- | ------------------------------------------ |
| Working directory                 | `/home/user/Database`                      |
| Repository root                   | `/home/user/Database`                      |
| Remote                            | `github.com/BigSimmo/Database`             |
| Branch                            | `claude/bold-planck-dn3a76`                |
| HEAD at start                     | `66105e18dc490e0e4c8ec6eb5c4f42fa506c13c3` |
| Dirty state at start              | clean                                      |
| Handover baseline `reviewedRef`   | `c6d677e569ee9faedefa31c96eb927ab5fbd433d` |
| Commits between baseline and HEAD | 88                                         |

## Supplied package checks (offline, bundle root)

| Command                                            | Exit | Result                                                                                                                                                                    |
| -------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validate_package.py --integrity`                  | 0    | PASS, 26 JSON files, 11 relative links. `jsonschema` not installed, so the optional schema pass reported `not_run_jsonschema_not_installed` rather than silently skipping |
| `test_tools.py`                                    | 0    | 25 tests passed                                                                                                                                                           |
| `test_validation.py`                               | 0    | 20 tests passed                                                                                                                                                           |
| `import_preview.py --check-repeat` (frozen ledger) | 0    | rehearsal only                                                                                                                                                            |

Package counts confirmed: 30 sources, 385 claims of which **28 are passage-checked**,
33 clinical concepts, 53 crosswalk entries, 30 ingestion plans, 10 tasks, 28 held items.

## Native policy drift, and how it was reconciled

The first live planner run refused:

```
Native policy drift: src/lib/source-authority-registry.ts; reconcile and recapture policy before relying on preview
```

The guard was not removed and `--repo-root` was not omitted. The drift was inspected
instead.

- `src/lib/sources/source-url-policy.ts` — blob unchanged (`f3fb7631…`).
- `src/lib/sources/acquisition-ledger.ts` — blob unchanged (`06137d72…`).
- `src/lib/source-authority-registry.ts` — `5633cb1a…` to `ad953efa…`, from
  `3bdd799d3 Register nine Australian clinical publishers in the source authority register`.

The whole diff is 75 insertions and **one** deletion. Eight authorities were added
(`healthywa`, `mental-health-commission-wa`, `aihw`, `australian-medicines-handbook`,
`healthdirect-australia`, `racp`, `therapeutic-guidelines`, `cochrane`). The single
deleted line is `codes: ["AUSPRES"],`, replaced by its own superset
`codes: ["AUSPRES", "AUSTPRESC"],` on the same authority. No authority was removed and
no tier or designation was loosened.

Effect on the six publisher identities the frozen snapshot pins (WHO, WAHEALTH, ACSQHC,
AUSPRES, RANZCP, NICE): **none**. `australian-prescriber` still carries
`catalogueIdentityOnly: true`, so the handover's AUSPRES constraint still holds at HEAD.
All 13 governed hosts in the frozen subset are still present in the live 51-host list,
so the subset is narrower than live policy rather than broader.

A reconciled snapshot carrying the refreshed blob identities, the new `reviewedRef` and
a written record of the above was produced as a session working copy. The sealed
`payload/` was not modified.

## Live planner result

`import_preview.py --repo-root <repo> --ledger src/data/source-acquisitions.json
--policy <reconciled snapshot> --check-repeat`, exit 0:

| Outcome  | Count |
| -------- | ----- |
| insert   | 3     |
| reuse    | 0     |
| skip     | 6     |
| conflict | 1     |
| held     | 20    |

`ledgerWrites: 0`, `providerCalls: 0`. Repeat-run simulation added 0 further inserts and
left holds and conflicts stable. The live counts match the frozen projection exactly.

The 20 held records are held for missing publication evidence, not for a weakened gate:
18 have no native projection ready, 14 lack `publicationDate` and `datePrecision`, 8 lack
`version` and `publisherCode`, and 7 sit on ungoverned hosts. No URL was stripped, no
publisher label changed and no validation relaxed to move any of them.

## Changes actually applied

Scope: source metadata only. No Calculators, WardFlow, ranking or retrieval change.

`src/data/source-acquisitions.json`, 8 records to 11:

1. `ps-diff-src-who-icd11-cddr-2024` — WHO ICD-11 CDDR, rung 5, candidate, unverified, link_only.
2. `ps-diff-src-au-ausprescr-movement-2019` — Australian Prescriber, drug-induced movement disorders, rung 3, candidate, unverified, link_only.
3. `ps-diff-src-au-ausprescr-lithium-2020` — Australian Prescriber, lithium therapy and interactions, rung 3, candidate, unverified, link_only.

All three entered as metadata-only candidates. None was set to `adopted`, `approved`,
`locally_reviewed` or `indexed_content`, and no original bytes were fetched.

4. `ranzcp-mood-disorders-clinical-practice-guideline` — currentness correction,
   `documentStatus` `current` to `outdated`, with the reason recorded in `notes`.
   The publisher's own guideline page states the guideline is no longer current
   guidance, which the ledger contradicted. The existing identity, rung, candidate
   disposition and the 2026-09-06 owner review (`validationStatus: locally_reviewed`)
   are unchanged. This is a currentness correction, not a review downgrade, and no
   duplicate record was created. The acquisition gate now bands it B (outdated)
   instead of A, which is the accurate state.

## Verification

| Command                                                               | Exit | Result                                                                     |
| --------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------- |
| `npm run check:source-acquisitions`                                   | 0    | 11 sources, 3 awaiting clinical sign-off at D band, gate passed unweakened |
| `npm run check:source-catalogue`                                      | 0    | acquisitions 11, coverage passed                                           |
| `npx --no-install vitest run tests/source-acquisition-ledger.test.ts` | 0    | 35 tests passed                                                            |

No dependency was installed and no provider was called.

## Per-source stage status

For all three new records and the corrected RANZCP record:

| Stage               | Status                                             |
| ------------------- | -------------------------------------------------- |
| staged              | done                                               |
| catalogued          | done (repository acquisition ledger metadata only) |
| bytes acquired      | not attempted                                      |
| extraction checked  | not attempted                                      |
| indexed             | not attempted                                      |
| retrieval verified  | not attempted                                      |
| clinically approved | **not attempted**                                  |
| activated           | **not attempted**                                  |

## Finding raised during reconciliation: presentation-scope text is stamped onto

## individual diagnoses

The handover listed one instance, an akathisia-style hinge sitting under acute dystonia.
That instance is confirmed at HEAD, and it is not isolated.

In `data/differentials-snapshot.json`, across all 31 presentation groups and 232
candidate rows, five of the seven comparison fields are byte-identical for every
candidate within their group:

| Field                 | Groups where all candidates share one value |
| --------------------- | ------------------------------------------- |
| `why-it-fits`         | 0 of 31                                     |
| `must-not-miss`       | 0 of 31                                     |
| `what-argues-against` | **31 of 31**                                |
| `bedside-question`    | **31 of 31**                                |
| `immediate-action`    | **31 of 31**                                |
| `investigations`      | **31 of 31**                                |
| `mimics-overlap`      | **31 of 31**                                |

Only `why-it-fits` and `must-not-miss` actually discriminate between diagnoses. There
are 31 distinct `clinicalHinge` values across 201 diagnosis records, one per presentation.

Root cause, in `scripts/lib/parse-differentials-export.ts`: `buildCandidateComparison`,
`diagnosisSections` and `buildDiagnosisRecord` assign `presentation.clinicalHinge`,
`presentation.immediateActions`, `presentation.investigations` and `presentation.mimics`
onto each diagnosis record without marking their scope. The same hinge is also pushed
into the diagnosis's `why-it-fits` items and used as the `safetySnapshot.summary`
fallback.

Worked example, `acute-dystonia`:

- `clinicalHinge` reads "Subjective inner restlessness is the key feature, often with
  observable motor restlessness." That is the akathisia discriminator.
- `investigations` reads "Thyroid function tests", which is a tremor workup.
- `immediate-action` carries the group blob, including "Bilateral onset after medication
  strongly suggests drug-induced parkinsonism", and says nothing about airway or
  anticholinergic reversal.

This is a clinical-accuracy hazard rather than a formatting defect, and it is
out of scope for a metadata reconciliation. The snapshot cannot be regenerated in this
environment: `scripts/import-differentials-export.ts` reads an export zip from a
Windows workstation path that does not exist here. Remediation is recorded as
outstanding work for the clinical owner to direct.

## Residual approvals and rollback

Outstanding, none of them resolved here:

- Clinical owner sign-off for the three new candidate sources before any adoption.
- Owner confirmation of the RANZCP currentness correction.
- A decision on how to remediate the presentation-scope finding above.
- The 357 claims without a checked source passage, and the 20 held source records.
- Any original-byte acquisition, indexing or activation. Approved provider budget is AUD 0.

Rollback targets are exactly: the three record IDs listed above, and the
`documentStatus` and `notes` fields of `ranzcp-mood-disorders-clinical-practice-guideline`.
Nothing else in the repository was changed by this reconciliation.
