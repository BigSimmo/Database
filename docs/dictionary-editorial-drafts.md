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

Two WHO instrument manuals (AUDIT 2001, ASSIST 2010) were admitted to
`src/data/source-acquisitions.json` as **candidates**. That is metadata and nothing else.

Eight receipt stages are tracked per source and only the first two have been attempted:

| Stage                                                                                           | State                        |
| ----------------------------------------------------------------------------------------------- | ---------------------------- |
| staged, catalogued                                                                              | attempted                    |
| bytes acquired, extraction checked, indexed, retrieval verified, clinically approved, activated | not attempted for any source |

`originalBytesSha256`, `documentId` and `jobId` stay null until real receipts exist. Acquiring
original documents needs a separate per-source rights, environment and cost approval.

The ASSIST manual's publication date is recorded at **year** precision. WHO gives 2010 with no day;
`2010-01-01` is the ledger's year-precision representation, not an established publication day.

The 56 held sources each name a blocker and a next action. The commonest are: no publication date
established from the publisher's own page (56), source not re-read during preparation (43), no
version identifier (39), publisher absent from the authority register (36), and host not in
`GOVERNED_SOURCE_HOSTS` (19). `nice-delirium` is a genuine conflict — a dictionary source already uses
that id at a different URL, and the existing identity is preserved rather than rewritten.

## The link trap

`sourceUsageHref` turns a dictionary `recordId` straight into `/dictionary/<id>`, which resolves only
for term slugs. A sense id like `dict-sense-0045` would produce `/dictionary/dict-sense-0045` — a dead
page and an implied citation at the same time.

No draft emits a source usage, and a test pins both halves of that: the href the helper _would_
build, and the absence of any sense id in the catalogue. Publishing drafts later means giving them a
real route first, not reusing the term-slug helper.
