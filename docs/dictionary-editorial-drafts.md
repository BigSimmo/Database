# Dictionary editorial drafts

The 2026-09 PsychSift Dictionary + Sources handover added 333 abbreviation senses, 96 reviews of
existing definitions and 58 source records. None of it is published. This document says where it
lives, why it is held back, and what has to happen before any of it reaches a reader.

## Why there are two dictionaries

The published dictionary in `src/lib/dictionary-data.ts` is **term-first**: one entry per concept,
with abbreviations hanging off it as aliases. The handover is **sense-first**: one record per
_meaning_ of a token, so `BD` is two records rather than one entry with an ambiguous alias.

That difference is the reason the two are not merged. `BD` meaning bipolar disorder and `BD` meaning
twice a day are not one thing with two names, and a term-first model cannot hold both without
choosing one — which is exactly the collision the corpus exists to warn about. Folding the drafts
into the published entries would lose the distinction that makes them worth having.

| Layer              | File                                           | State                                                |
| ------------------ | ---------------------------------------------- | ---------------------------------------------------- |
| Sense drafts       | `src/data/dictionary-sense-drafts.json`        | 333 records, all pending approval                    |
| Definition reviews | `src/data/dictionary-definition-reviews.json`  | 96 verdicts, 28 with proposed wording, none applied  |
| Source outcomes    | `src/data/dictionary-source-dispositions.json` | 58 records: 2 admitted as ledger candidates, 56 held |

The typed readers are in `src/lib/dictionary-editorial/`. Re-import with
`node scripts/import-dictionary-handover.mjs --package <dir>`; `--check` proves the committed files
still match the package.

## Nothing here is clinically approved

Every draft carries `clinicalApproval: "pending"` and `publicationAllowed: false`.
`assertNoDraftIsPublished` throws if that ever stops being true, and
`tests/dictionary-sense-drafts.test.ts` runs it.

Promotion into the published dictionary is a per-record decision by a named clinician. It is not a
data migration and there is no bulk path for it, deliberately.

## What the evidence actually covers

This is the finding that should govern how much weight the corpus carries:

- **206 of 1,881 statements have a source attached.** The other 1,645 are marked `unverified`
  upstream.
- **None of the 292 safety warnings has a source.** They read as authoritative and are not.
- `expansion` is the best-covered field at 146 of 333. `context`, `jurisdiction`, `meaning` and
  `availability` have **no** source coverage at all.
- `name_checked` on a sense means the token and its expansion were checked against the cited source.
  It says nothing about the clinical prose around them.

An empty evidence list is not proof that no source exists — it means nobody has looked. Per-statement
outcomes are in `docs/audit/dictionary-handover-2026-09-16/field-resolutions.jsonl`.

## The ambiguity rule

Nine tokens carry more than one governed meaning: `ACT`, `BD`, `OST`, `OT`, `SA`, `SAD`, `SCI`,
`SSRI`, `SW`.

`dictionarySenseCollisions` computes these over the **whole** corpus, never a filtered view. A reader
who has filtered to "Medicines notation" and sees only `BD — twice a day` must still be told that
`BD` means bipolar disorder elsewhere, because the note they are reading was not written under their
filter. A filter that hides a collision makes an ambiguous abbreviation look settled, which is the
failure mode the whole corpus exists to prevent.

`dictionarySenseDraftIssues` re-derives the groups from the data rather than trusting the handover's
list, so a token that gains a second meaning cannot quietly escape the rule.

## Token normalisation keeps punctuation

`normalizeSenseToken` flattens case and spacing and nothing else. An earlier version stripped
punctuation and merged `K10` with `K10+` — two different Kessler instruments, one with supplementary
questions. `ACE-III` is likewise not `ACEIII`. Reader-facing search may be more forgiving than this;
identity may not.

Numeric-leading tokens (`4AT`, `15L`) file under a single `#` bucket in an A–Z index rather than
per-digit buckets.

## Definition reviews are reconciled, never applied

Each review records the wording it was written against and a SHA-256 of it.
`reconcileDefinitionReviews` compares that hash to the live entry and returns one of four outcomes:

- `actionable` — baseline matches, the proposal is ready for sign-off (28 reviews)
- `no_change_proposed` — a verdict with no rewrite (68 reviews)
- `conflict` — the live wording has changed since the review; a person decides, and the reviewed text
  is **not** restored
- `missing_entry` — the slug moved and the crosswalk needs re-checking

As at 2026-09-16 all 96 baselines matched the live definitions exactly: no conflicts, no missing
entries.

## Sources: registered is not ingested

Eight sources were admitted to `src/data/source-acquisitions.json` as **candidates**: the WHO AUDIT
(2001) and ASSIST (2010) manuals, WA Health MP 0155/21, RANZCP PS #74, PS #116 and PPG #16, NICE
NG225 and NICE CG103. That is metadata and nothing else.

Eight receipt stages are tracked per source and only the first two have been attempted:

| Stage                                                                                           | State                        |
| ----------------------------------------------------------------------------------------------- | ---------------------------- |
| staged, catalogued                                                                              | attempted                    |
| bytes acquired, extraction checked, indexed, retrieval verified, clinically approved, activated | not attempted for any source |

`originalBytesSha256`, `documentId` and `jobId` stay null until real receipts exist. Acquiring
original documents needs a separate per-source rights, environment and cost approval.

### Dates are recorded as the events they actually are

Thirty sources were read from their publishers' own pages on 2026-09-16. Each carries a
`publisherCheck` with the finding and the date checked.

Publication, version-release, effective, updated and review dates are different events and none was
substituted for another:

- **MP 0155/21** — 2021-08-09, the policy's stated date of effect.
- **PS #74, PS #116, PPG #16** — month precision. RANZCP states a last-updated month and no
  publication day; day precision would assert a day the College never gave.
- **ASSIST 2010** — year precision. WHO gives 2010 and no day.
- **NG225** — 2022-09-07; **CG103** — 2010-07-28. NICE returned HTTP 403 to direct fetches, so both
  came from NICE's own site index; the records say so, and say to confirm in a browser.

### `nice-delirium` was not a conflict

The dictionary cites `.../cg103/chapter/context`; the handover proposed
`.../cg103/chapter/Recommendations`. These are two chapters of one guideline, not two sources. The
register row carries the guideline itself and the dictionary keeps its chapter URL, because pointing
at the chapter that supports the claim is more precise than pointing at the guideline. No second id
was minted.

### The one structural blocker, now evidenced

**Australia's most-used official clinical web sources publish a review date, not a publication
date.** Healthdirect stamps `Last reviewed: <Month Year>`; WA Health's consent article stamps
`Last reviewed: 22-05-2026`; the WA Chief Psychiatrist's forms, AMHP and PMP pages and the WHO mhGAP
page carry no date at all because they are continuously maintained registers.

`acquisitionLedgerIssues` requires a `publicationDate` for every non-rejected record. So thirteen
governed WA, national and WHO sources cannot be registered — **not because their metadata is
missing, but because the register cannot represent the shape of date these publishers give**. The
review dates that were read are banked on each record in `establishedReviewDate` so the reading is
not repeated.

This was not fixed here. Relaxing the mandatory field is precisely the "weakened schema" the field
policy forbids, and the honest alternative — a distinct state that requires a real review date
instead — is a change to the clinical source register's contract, which is the owner's to make.

### Why the other 50 are held

The reads changed the character of most holds rather than clearing them, which is the more useful
outcome: a source nobody had looked at is now a source with a named, specific obstacle.

| Count | Obstacle                                                                                                                                                      | Whose call                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 21    | Publisher absent from the source authority register (Mental Health Tribunal WA, Mental Health Commission WA, NSW ACI, NACCHO, AMHOCN, COPE, AADPA and others) | Owner — registering a publisher changes retrieval selection |
| 19    | Host absent from `GOVERNED_SOURCE_HOSTS`, including `meteor.aihw.gov.au`                                                                                      | Owner — widening host policy is never a side effect         |
| 13    | Publisher gives a review date or no date at all (see above)                                                                                                   | Owner — register contract                                   |
| 4     | `aihw.gov.au` returned HTTP 403 to this session; publisher already registered and ledger-eligible, so the date is the only thing missing                      | Needs a browser read                                        |
| 1     | Australian Prescriber is dated (1 April 2019, Aust Prescr 2019;42:56-61, doi 10.18773/austprescr.2019.014) but registered `catalogueIdentityOnly`             | Owner — changing it alters retrieval selection              |
| 2     | Not yet read: a WA Health PDF and a document on the archived `www1.health.gov.au`                                                                             | Needs a browser read                                        |

`publisherCheck.checkedOn: null` means nobody has looked, which is a weaker statement than "the
publisher states no date". The two lead to different next actions and are kept apart.

## The link trap

`sourceUsageHref` turns a dictionary `recordId` straight into `/dictionary/<id>`, which resolves only
for term slugs. A sense id like `dict-sense-0045` would produce `/dictionary/dict-sense-0045` — a dead
page and an implied citation at the same time.

No draft emits a source usage, and a test pins both halves of that: the href the helper _would_
build, and the absence of any sense id in the catalogue. Publishing drafts later means giving them a
real route first, not reusing the term-slug helper.
