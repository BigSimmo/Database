# WA MHA Forms handover — reconciliation receipt, 16 September 2026

What a portable Forms/Sources handover package asked for, what of it was already true in this
repository, what landed, and what is still waiting on someone with authority this session did
not have.

The package (`psychsift-wa-mha-forms-handoff-2026-09-16`) was supplied as a ZIP to a coding
session, not to the clinical-document upload screen. Nothing in it was registered as a clinical
source, and none of it is primary authority: its 338 claim records ship
`publicationEligible: false`, `qualifiedReviewer: null`, `reviewStatus: inherited_not_reverified`,
and they still do.

## Preflight

| Check                   | Result                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Working tree            | `/home/user/Database`, branch `claude/stoic-rubin-bvva4b`, clean at start                                                                                         |
| HEAD                    | `66105e18dc490e0e4c8ec6eb5c4f42fa506c13c3` — the package's `finalObservedMainSha`                                                                                 |
| Reviewed baseline       | `d804bdde0358f2b18046e57e8682c9d7c383c149`, present locally                                                                                                       |
| Drift, baseline to HEAD | 5 commits, 9 files, all search/catalogue-cache (PR #2805). No Forms, Sources, PDF-manifest or Act file touched, so the package's file and identity baseline holds |
| Package validator       | `validate_bundle.py` — `verified`, 0 errors, 18 JSON files parsed, checksums match. Optional `jsonschema` absent, built-in checks ran                             |
| Package tests           | `python -B -m unittest discover -s tests` — 52 passed                                                                                                             |

## Source preview — nothing to insert

`plan_import.py` was run twice: once against the package's own snapshot, once against this
checkout's live acquisition ledger (`src/data/source-acquisitions.json`, 8 records) and the
53 provider identities derived from `data/forms-pdf-manifest.json`, `src/lib/form-register.ts`
and `data/mha-2014-sections.source.json`.

| Outcome  | Bundled snapshot | Current checkout |
| -------- | ---------------- | ---------------- |
| insert   | 0                | 0                |
| reuse    | 59               | 58               |
| skip     | 1                | 1                |
| conflict | 0                | 1                |
| held     | 14               | 14               |

Repeat-run simulation proposed zero duplicate inserts. No writes, no network calls.

**The one conflict is the Act, and it is a URL-shape difference, not a version disagreement.**
The package carries the legislation.wa.gov.au landing page
(`statutes.nsf/law_a147019.html`); this repository's `mental-health-act-2014-wa` identity points
at the consolidated HTML filestore document for the same version, `02-b0-01`. The repository's
URL is the one that resolves to the text the section summaries are hash-pinned to, so it stays.
No identity was repointed and no review was inherited.

The single `skip` is the package's own implementation-provenance record, which is not a clinical
authority. The 14 `held` records are sources whose original publication metadata the package
could not establish — they stay out of the ledger rather than being fabricated into
schema-complete entries.

`src/data/source-acquisitions.json`, `src/lib/source-authority-registry.ts`,
`src/lib/sources/source-url-policy.ts` and `data/forms-pdf-manifest.json` are unchanged.

## What landed

### Forms mode had 40 of 54 forms carrying nothing usable

The register in `src/lib/form-register.ts` has always listed all 54 codes, and the UI has always
rendered all 54. The operational text behind them did not keep up:

- 14 forms had real curated content.
- 33 carried scaffolding from an old PDF indexing pass, verbatim, as clinical content:
  `"Official form source: Continuation Of Detention. Review the source snippets and approved
form before use."` as the purpose, `"Check the official form signature block and Act
sections."` as the maker, `"Open the source snippets before relying on the pathway."` as the
  safety pearl. "Source snippets" is not a surface this application has.
- 7 had no catalogue row at all and fell through to the generic fallback in `form-catalog.ts`.

All 54 now carry purpose, maker, threshold, clock, authority boundaries, traps and pre-use
checks. The 14 curated entries keep their own wording; five of them had a clock written as an
instruction with no duration or origin (`"Review and continuation dates must be diarised."`) and
those were replaced.

The case that mattered most is Form 3C. Its clock read `"24 hours, up to 72 hours, 72 hours"` —
three numbers, no start event, which invites the reader to start a fresh 72 hours at signing. It
now states that the ceiling runs from the original reception under ss 52-53 and does not reset.

### Two new fields, and a caveat that travels with the content

- **`boundaries`** on `FormCatalogDetails`, separate from `doesNotAuthorise`. The generic
  disclaimer and "cancelling leave does not itself supply apprehension or transport authority"
  are different statements; folding the second into the first loses it. It renders as an
  "Authority boundaries" row.
- **`contentReviewStatus`**, from the new `data/forms-content-review.json`. Every one of the 54
  rows is `drafted` and states a checkable basis — the governing sections and the approved form
  it was written from. A missing row defaults to `drafted`, because an absent record is a gap in
  the evidence, not evidence of review.
- The Priority-facts block says "Drafted from the Act and the approved form, awaiting clinical
  review" under its heading, and the detail sheet repeats it beside the full text. This is the
  same bargain `mha-act-sections.ts` already documented for the Act-section summaries, and it
  was the repository owner's recorded decision there.

A form with several statutory clocks now gets an explicit priority-fact card, so a paragraph
never becomes a card title and sets the height of the whole row. The title is never a clause cut
mid-sentence: where nothing short enough fits without stating a different requirement from the
one the Act imposes, there is no card and the full text stays the title.

### One gate corrected

`check:mha-act-sections` read catalogue membership as "this form has its own section cue", so
the seven new rows looked like two sources disagreeing about the same mapping. They are not: the
mapping still comes from `data/forms-act-section-cues.json`, which is where the checkable basis
lives. Doing what the gate asked would have left those seven forms with no Act sections at all.
The gate now looks for an actual `sourceFacts.sectionCue`, which is what `sectionCueForForm` has
always done at runtime.

### Independent corroboration of the section mapping

The package and `data/forms-act-section-cues.json` were written separately, and they agree
exactly on the governing section for all seven previously uncovered forms: 1A attachment ss
41/42, 4D s 555, 4E s 557, 7C s 110, 10H s 238, 12C attachment s 262, 13 s 201. That is two
independent passes reaching the same mapping, which is worth more than either on its own. It is
not clinician sign-off.

## What did not change, and why

| Package item                              | Decision                                                                                                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The 338 claim records                     | Not imported as a ledger. Their substance informed the catalogue text, which is labelled drafted; a claim ledger with `publicationEligible: false` throughout does not belong in a runtime surface |
| `INHERITED_MASTER_v5.md/.pdf`             | Not committed and not uploaded. AI-authored research synthesis; the package says so itself                                                                                                         |
| Act version and `as at` date              | Unchanged at `02-b0-01` / 2025-09-25. See the open item below                                                                                                                                      |
| Form 10G title                            | Already correct here ("Revocation or expiry..."). The register's apparent typo is recorded, not copied — H06 closed on this side                                                                   |
| Form 12B sections                         | Already correct here (s 248, not s 262). The package would add s 249; deferred to the reviewer with the rest                                                                                       |
| `forms-pdf-manifest.json` generation date | Not advanced. Advancing it without re-fetching and comparing the original bytes would fabricate an assurance — the package's H04, still open                                                       |
| Source acquisition ledger                 | No inserts proposed, none made                                                                                                                                                                     |
| Publisher classification, governed hosts  | Untouched. Owner decisions, ranking-sensitive                                                                                                                                                      |

## Open items for someone else

1. **Clinical sign-off on 54 forms (package H01/H03).** Everything shipped is drafted. A named
   WA clinician or legal reviewer setting `status: "reviewed"` with `reviewedBy` and
   `reviewedAt` in `data/forms-content-review.json` is what drops the caveat, form by form.
   Suggested order, highest consequence first: 3C, 10B, 10E, 11B, 11E, 6C, 12C attachment, 5A,
   2, 3B, 3D, 4B, 10A, 10H, 11A.
2. **Act currency (package H02).** The repository pins `02-b0-01` as at 25 September 2025. A
   read of the legislation.wa.gov.au landing page on 16 September 2026 reported the current
   consolidation as **`02-b0-02`, currency start 25 September 2025** — a different suffix on the
   same in-force date, which is the shape of a corrected reprint rather than an amendment. This
   was **not** acted on. Bumping the pinned version invalidates the `sourceTextSha256` of all 79
   section summaries, so it needs the two documents compared section by section, not a suffix
   read off a landing page.
3. **Original form assets (H04).** No PDF bytes were re-fetched or compared this session.
4. **Full-text acquisition and indexing (H05, H09).** Not planned or run. Rights by operation,
   steward, environment and cost are all unresolved, and none of it is authorised here.
5. **Rendered browser acceptance.** Not run. No local server was started and no browser journey
   was exercised; the proof below is offline only.

## Second pass, same day: the holds that could be closed, were

The first pass left four gates open and two tests red. Three of the four are now closed with
evidence, and the P03 blocker turned out to be tractable.

### The P03 seed baseline now has a supported refresh route

`supabase/migrations/20260824122000_...sql` and `supabase/schema.sql` embed the whole
site-content seed as dollar-quoted JSON, pinned to the live runtime records, so any Forms or
Services content change turned two tests red. The first pass could not refresh it because a
frozen entry carries seven fields `canonicalDynamicSiteContentProjection` does not return.

Those seven are derived in `scripts/sync-site-content-corpus.ts`, which only ever writes to a
provider. `scripts/refresh-site-content-p03-baseline.ts` now duplicates the derivations and
rewrites both blobs, with `--check` for stale detection and
`tests/site-content-p03-baseline.test.ts` pinning the duplication against the corpus-sync
source so the two cannot drift apart.

Before regenerating anything, the refresh was proved to be a value change rather than a
reshuffle: 843 entries before and after, none added, none removed, exactly the 54 form records
different. Rewriting this applied migration in place is the established convention for the file
(`fb0b0279b`). **Applying the new definition to the live database is a separate approved step:
a merge does not re-run an existing migration.**

### The Act citation was pointing at a withdrawn document

Chased to the end rather than left as an open question, and it was worse than "a suffix looks
different". `02-b0-01` has been **withdrawn**: its filestore URL returns HTTP 404, and it does
not appear among the versions of the Act at all. Every Act-section sheet in the app rendered
that URL as a link, so that link was dead.

`02-b0-02` replaced it at the **same** currency start, 25 September 2025. The trailing pair is
the revision of one consolidation at one currency point, and the versions page shows no period
between them, so the in-force law never changed — the publisher reissued the document and
retired the old file.

The pin moved through the designed route. `--refresh` re-fetched and re-extracted; all 79 cited
sections came back **byte-identical**, so no `sourceTextSha256` moved, no summary was
invalidated and nothing flipped to `pending`. `--draft` then synced the curated metadata,
leaving all 79 entries and their drafted status untouched. `ACT_AS_AT` does not move, because
the law did not. Package hold H02 is closed.

### The asset dates now rest on an actual comparison

All 51 downloadable approved-form PDFs were fetched from their OCP URLs and hashed: **51 of 51
byte-identical**, no digest moved, no fetch failed. The register was read the same day and all
54 codes, titles and availability states reconcile. `data/forms-pdf-manifest.json`'s
`generatedAt` and the UI's "Official register checked" date both move to 16 September 2026 on
that evidence rather than by assertion. Per-asset table:
[`docs/evidence/forms-pdf-publisher-comparison-2026-09-16.md`](evidence/forms-pdf-publisher-comparison-2026-09-16.md).
Package holds H04 and H06 are closed — H06 with the register's own Form 10G typo preserved and
explained rather than copied.

### Clinical sign-off is not closed, and could not be

All 54 forms remain `drafted`. No AI signs off clinical content, and neither the package nor
this repository's governance would permit it. What this pass could do is make the sign-off a
reading task instead of an archaeology task:
[`docs/evidence/forms-operational-guidance-review.md`](evidence/forms-operational-guidance-review.md)
puts what the app displays, the sections it rests on, the basis it was drafted from and a link
to the approved PDF on one line of sight per form. A reviewer sets `status` to `reviewed` with
`reviewedBy` and `reviewedAt` for one code at a time. Package holds H01 and H03 stay open.

### What is left, and it is not what it looked like

`tests/drift-detection.test.ts` is red because `supabase/schema.sql` changed and
`supabase/drift-manifest.json` was not regenerated. Chasing that to the end found something
bigger.

**`supabase/schema.sql` does not replay, and it did not before this branch.** Replaying the
pristine pre-branch file into the pinned `supabase/postgres:17.6.1.127` container aborts with
`site_content_bootstrap_population_mismatch`: the seeded bootstrap guard expects digest
`57f6ec90...` over 843 records, and the committed blob actually computes `b3caf89c...`. Two
independent methods agree on that — a container replay with the guard made self-reporting, and
an offline reimplementation of `site_content_canonical_json` now committed and pinned by tests.

So `npm run drift:manifest` cannot be run on `main` at all. The manifest can never be
legitimately regenerated, `tests/drift-detection.test.ts` can only stay green while
`schema.sql` never changes, and disaster recovery from `schema.sql` would fail. It stayed
invisible because CI replays `supabase/migrations/**` via `supabase migration up` rather than
`schema.sql`, and the offline drift test only compares `schema_sha256`.

**The repair is not local, which is why this branch does not attempt it.**
`site_content_retained_bootstrap_valid` asserts
`r.id = site_content_release_id(r.release_digest, 0, 'bootstrap-v1')`, so the release UUID is
derived from the digest. Correcting the digest re-keys the bootstrap release identity, and that
UUID is hardcoded 36 times across the migration and `schema.sql` — including inside
`create function` bodies already applied to the live database — and 12 more times in
application code. A second guard, `site_content_transition_backfill_unprovable`, needs the same
re-keying to classify at epoch zero. Rewriting the digest alone trades one broken invariant for
another. Re-keying the release is an owner decision about the live clinical content control
plane, in an approved window.

`npm run site-content:p03` now prints the mismatch, what it breaks and why it is not fixing it.

**`schema_sha256` was updated by hand, with the owner's approval, and here is the whole
argument for why that is the same answer a replay would give.**

`schema_sha256` is a plain sha256 of `supabase/schema.sql` — `normalizedSchemaSha256` in
`scripts/check-drift.ts` is `sha256(text.replace(/\r\n/g, "\n"))` and nothing more. It is a
checksum of a file in the repository, not an observation of a replayed database.

The rest of the manifest is provably unaffected. The diff against the last commit to touch
`schema.sql` (`ff1ac7b93`) is **two lines**: line 13087, a string literal inside the
`site_content_registry_baseline` function body, and line 13398, a string literal inside a
top-level `insert ... from jsonb_to_recordset(...)`. No `create table`, `create view`,
`create index`, `create policy`, constraint, trigger, extension or storage bucket is touched,
so no snapshot category except `functions` could move.

And the one function that could move, does not. The snapshot hashes
`md5(pg_get_functiondef(...))` after stripping block comments, then `--` to end of line, then
all whitespace. Applying that normalisation to the old and new statement gives **164524
characters both times, with the same md5** — the bytes that differ sit past the first `--`,
which falls at offset 176107 inside a service URL, and the normaliser discards everything after
it. That is the blind spot described below, and here it is load-bearing in this change's
favour. It was checked against the real thing, not just asserted: replaying the function into a
local Postgres reproduced the manifest's pinned `def_hash`
`c2dc2183657bab3c994af7f18ddfcb9b` for the old body, and the same value for the new one.

So a faithful regeneration would produce this manifest, with this one field changed.

**What is deliberately NOT changed:** `generated_at` (2026-09-13) and `replay_seconds` (20).
They describe the last real container replay and still do. Advancing them would claim a replay
that did not happen, which is a worse falsehood than a stale timestamp beside a correct
checksum. They will move on their own the next time `npm run drift:manifest` actually runs —
which, per the finding above, requires the schema replay to be repaired first.

### Drift detection has a blind spot worth knowing about

`schema_drift_snapshot()` strips from any `--` to end of line before hashing a function
definition, and cannot tell a real comment from `--` inside a string literal.
`site_content_registry_baseline` embeds the registry seed as a single-line blob whose first
`--` falls at offset 176107, inside a service URL. **91.1 per cent of that function's
definition is invisible to drift detection** — 1841007 normalised characters down to 164524.
Every other function in the schema loses only genuine comments, which is the intended
behaviour. Filed; a fix moves `def_hash` for every function and needs a manifest regeneration
in the same change.

## Evidence

Offline only. No provider call, no paid operation, no database or index write, no source
activation, no deploy, no migration.

- `npx vitest run tests/forms.test.ts tests/forms-operational-content.test.ts
tests/mha-act-sections.test.ts tests/form-priority-facts.dom.test.tsx` and the rest of the
  Forms suite — passing; see the pull request for the full run.
- `npm run check:mha-act-sections` — `Act section data is current (79 sections cited by forms,
0 reviewed, 79 drafted, 0 pending; Act 02-b0-01 as at 2025-09-25).`
- `npm run check:forms-pdf-manifest` — `Forms PDF manifest is current (51 PDFs, 50 require a
user password, 50 editing-restricted).`
- `npm run check:mha-act-sections` — `Act section data is current (79 sections cited by forms,
0 reviewed, 79 drafted, 0 pending; Act 02-b0-02 as at 2025-09-25).`
- `npm run check:site-content-p03` — `P03 seed baseline is current.`
- `npm run check:forms-review-sheet`, `npm run check:repo-awareness-snapshot` — passing.
- `npm run check:maintainability-budgets`, `npm run check:knip`, `npm run docs:check-index`,
  `npm run docs:check-links`, `npm run docs:check-inventory`,
  `npm run check:ledger-write-discipline`, `npm run lint`, `npm run typecheck` — passing.
- `npm run drift:manifest` — **not run**, Docker daemon unavailable. This is the one
  outstanding command.
- `npm run verify:ui` and any browser journey — **not run**. No local server was started.
- Package checks as tabulated above.
