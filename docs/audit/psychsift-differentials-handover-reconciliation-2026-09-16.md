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

| Command                                                                                                                                   | Exit  | Result                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check:source-acquisitions`                                                                                                       | 0     | 11 sources, 3 awaiting clinical sign-off at D band, gate passed unweakened                                                                                                     |
| `npm run check:source-catalogue`                                                                                                          | 0     | acquisitions 11, coverage passed                                                                                                                                               |
| `npx --no-install vitest run tests/source-acquisition-ledger.test.ts`                                                                     | 0     | 35 tests passed                                                                                                                                                                |
| `npm run verify:cheap`                                                                                                                    | 0     | 1364 test files, 20640 passed, 2 expected fail, 3 skipped                                                                                                                      |
| `npm run typecheck` / `npm run lint`                                                                                                      | 0 / 0 | clean                                                                                                                                                                          |
| `npm run plan:browser`                                                                                                                    | —     | escalates to `full`, because `data/repo-awareness-snapshot.json` is unattributable. It still names the real target: `differential-detail-page.tsx` to `tests/ui-tools.spec.ts` |
| `node scripts/run-playwright.mjs --project=chromium tests/ui-tools.spec.ts --grep "diagnosis detail actions stay tappable\|differential"` | 0     | 13 passed, including the journey asserting `differential-clinical-hinge`                                                                                                       |

This is a **focused browser proof, not `verify:ui`**. The full Chromium suite is left to
CI, which runs it on a non-draft pull request. `npm run ensure` served the app at
`http://localhost:4598` and `/api/local-project-id` confirmed `PsychSift` /
`clinical-kb:e641a7e2d0fd` before any browser work.

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

This is a clinical-accuracy hazard rather than a formatting defect. The owner
directed a corpus-wide scope labelling remediation on 2026-09-16, which is applied
in the commit that follows this one.

### What the remediation does

Presentation-scope text stays in the corpus. It is labelled as group context and is
never presented as the diagnosis's own discriminator. No clinical content was
authored, rewritten or deleted.

- `scripts/lib/parse-differentials-export.ts` — root cause. Comparison criteria,
  diagnosis sections and the diagnosis record now carry an explicit
  `scope`/`clinicalHingeScope`. The presentation hinge is no longer pushed into the
  diagnosis's "why it fits" items, and `safetySnapshot.summary` no longer falls back
  to it.
- `src/lib/differentials.ts` — `withPresentationScope()` derives the same labels from
  the committed snapshot's own structure, since the snapshot predates the parser fix
  and cannot be regenerated here (`import-differentials-export.ts` reads an export zip
  from a Windows workstation path that does not exist in this environment).
- `src/lib/differential-snapshot.ts` — `DifferentialTextScope`, plus
  `diagnosisScopedHinge()` and `diagnosisOwnSummary()` so a surface showing a
  diagnosis's own description cannot reach for a group hinge.
- Search results, stream cards, cross-mode links and the cross-mode index now show
  the diagnosis's own summary. The index previously projected the group hinge, which
  is the exact trap `src/lib/dsm.ts` documents and routes around; that note is updated.
- `formatDifferentialCopyText()` labels the hinge, immediate actions and investigations
  with the group they belong to, because that text is copied into a medical record.
- The detail page shows an "Applies to the &lt;group&gt; group" note on every
  presentation-scope section.
- `site-content-publication.ts` allows the scope fields through the public projection,
  so a published page cannot lose the labelling.

`tests/differentials-presentation-scope.test.ts` is the guard. It was written first and
failed on three assertions against the unfixed corpus, including acute dystonia
carrying "inner restlessness" and "thyroid function". It now passes, and it fails
again if any future import presents group text as a diagnosis's own.

Acute dystonia after the change: its own text is the dystonia phenomenology and the
airway/laryngospasm red flags. The akathisia hinge and the thyroid workup are still
present, labelled as the Akathisia / EPSE / Tremor / Sedation group's.

### Deliberately not done: the frozen publication seed

`tests/site-content-publication-route.test.ts` pins the P03 epoch-zero bootstrap
population against a JSON block frozen inside
`supabase/migrations/20260824122000_add_site_content_release_and_outbox.sql`. Writing
the scope into `data/differentials-snapshot.json` changes that population, so the seed
would have to be refreshed in the migration body plus `supabase/schema.sql` and
`supabase/drift-manifest.json`.

That migration has already reached the live database, and refreshing it needs Docker,
which is not available in this session. Editing an applied migration is not this
change's to make. The scope is therefore derived at catalogue load time rather than
written into the snapshot file, which leaves the frozen seed untouched and the
publication test green.

Consequence to carry forward: records seeded from `buildDefaultDifferentialRows()`
still carry unscoped payloads until that seed is refreshed. Everything the app renders
is scoped.

## Corpus census (handover task 04)

Counted from `data/differentials-snapshot.json` at HEAD, not inherited from the package:

| Thing                                                 | Count                         |
| ----------------------------------------------------- | ----------------------------- |
| Presentations                                         | 31                            |
| Diagnoses                                             | 201                           |
| Presentation-candidate relationships                  | 232 (124 selected by default) |
| Diagnoses appearing in more than one presentation     | 21                            |
| Related-diagnosis edges                               | 1232                          |
| Scenario presets / red-flag flows / search-alias keys | 7 / 7 / 20                    |

No orphans in either direction: every candidate slug resolves to a diagnosis record, and
every diagnosis belongs to at least one presentation. No record, slug or relationship was
added, removed or renamed by this work.

## Handover task outcomes

| Task                                           | Outcome                                                                                                                                                                                                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 Validate and reconcile the handover         | Done. Four package checks green, policy drift reconciled rather than bypassed, every source carries an outcome, repeat run adds nothing                                                                                                                           |
| 02 Reconcile source identities and metadata    | Done. 3 inserts, 1 currentness correction, native gate passes unweakened, no duplicate identity, nothing auto-adopted                                                                                                                                             |
| 03 Differentials evidence adapter              | **Not done, and not doable as packaged.** See below                                                                                                                                                                                                               |
| 04 Reconcile the clinical corpus               | Done. Census above, taken from the checkout                                                                                                                                                                                                                       |
| 05 Correct discriminator leakage               | Done, and wider than the package described. Guard test written first and red on three assertions                                                                                                                                                                  |
| 06 Preserve fail-closed governance and exports | Verified unchanged: `differentialValidationStatus()` still defaults to `unverified`, `deriveGovernanceFromSnapshot()` still fails to `unknown`/`unverified` on negative review wording, and the copy-after-review disclaimer is still the last line of the export |
| 07 Resolve source admission holds              | Owner decision. 20 stay held, AUSPRES not re-added, no host or authority change, no ranking surface touched                                                                                                                                                       |
| 08 Original-document acquisition               | Blocked by design. No bytes fetched, no indexing, provider budget AUD 0                                                                                                                                                                                           |
| 09 Application and presentation tests          | Done. Offline gate plus a focused browser proof, reported separately above                                                                                                                                                                                        |
| 10 Completion receipt                          | This document                                                                                                                                                                                                                                                     |

### Why task 03 cannot be completed from this package

The adapter needs a real native `recordId` and `field` per the package's own crosswalk
entry `ps-diff-map-06`. The claims do not carry one. All 385 claims have
`currentLocation.repository: null`, 377 of them point at an external `canonical-v2`
artifact, and their record IDs are handover-internal (`ps-diff-block-acute-mental-state`,
`ps-diff-entity-...`), not repository slugs. Building the adapter would mean inventing the
claim-to-record mapping, which the package explicitly forbids.

The 28 passage-checked claims are additionally all `reviewStatus: requires_clinical_review`,
`productionEligible: false`, with no clinical reviewer, and four of the nine sources they
anchor are among the 20 held. There is nothing admissible to wire up yet. Recorded as
outstanding rather than stubbed.

## Residual approvals and rollback

Outstanding, none of them resolved here:

- Clinical owner sign-off for the three new candidate sources before any adoption.
- Owner confirmation of the RANZCP currentness correction.
- A decision on how to remediate the presentation-scope finding above.
- The 357 claims without a checked source passage, and the 20 held source records.
- A Differentials evidence adapter, which needs a verified claim-to-record mapping this
  package does not supply (see task 03 above).
- Any original-byte acquisition, indexing or activation. Approved provider budget is AUD 0.

Rollback targets are exactly: the three record IDs listed above, and the
`documentStatus` and `notes` fields of `ranzcp-mood-disorders-clinical-practice-guideline`.
Nothing else in the repository was changed by this reconciliation.
