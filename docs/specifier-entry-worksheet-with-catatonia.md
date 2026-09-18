# Specifier entry worksheet — "With catatonia"

The first entry of the #693 specifier work, laid out to the edge of where a non-clinician's judgement
stops. Every field is present and every clinical statement is blank. Filling the blanks is the work;
nothing here needs formatting, renaming or restructuring first.

Context, the triage that selected this specifier, and the four questions a completed entry answers are
in [`specifier-definition-worklist-2026-09-18.md`](specifier-definition-worklist-2026-09-18.md).
**"With catatonia" was chosen as the first entry because it is the most reused (9 disorders) and its
recognition criteria are the most stable part of it — so it proves the method without spending the
hardest clinical judgement first.**

## Before filling anything in: two decisions this worksheet assumes

1. **Unit of work.** This worksheet is built for _one definition plus per-disorder exceptions_. If the
   nine turn out to diverge enough that nine separate definitions are right, that will be visible by
   the third row and the worksheet should be abandoned rather than forced.
2. **Sign-off value.** There is no approved value for `review.clinicianReviewStatus` yet, because
   nothing in the catalogue has ever been signed. Section 4 leaves it blank. Pick it once here and it
   is settled for all 585 items.

## 1 — The shared definition (write once)

**What has to be present for the specifier to apply.**
Which features, how many of them, and over what period. Not a gloss of the word "catatonia".

> _(blank)_

**What excludes it, or what it must be distinguished from.**
The boundary that stops it being applied too widely.

> _(blank)_

**What applying it changes.**
Treatment, monitoring, or urgency. If the honest answer is "nothing changes", write that — it is a
legitimate finding and it would move this specifier down the priority order.

> _(blank)_

**Source.** Named manual and edition, not a family. This replaces the placeholder
`"Best-effort DSM-derived clinical anchor pending manual verification"`.

> _(blank)_

## 2 — The nine disorders

Each row asks the same three questions. "Same" is a legitimate and expected answer; the point of asking
nine times is that any difference becomes deliberate rather than accidental.

Two observations from the catalogue itself, offered as prompts and not as answers:

- **The catalogue already groups these three different ways.** Autism spectrum disorder files it under
  `Co-occurring`, the psychotic disorders under `Features`, and the mood disorders under
  `Episode Specifiers`. Whether that reflects a real clinical difference or is an artefact of how the
  file was assembled is worth settling, because it is the most likely place a shared definition breaks.
- **Not one of the nine `icd11Context` strings mentions catatonia.** Schizophrenia's names a
  `psychomotor` symptom qualifier, and the others are silent. ICD-11 also carries catatonia as a
  standalone diagnosis with its own three-way context, recorded separately in the catalogue. Whether
  "with catatonia" has an ICD-11 equivalent on each of these disorders, or routes to that standalone
  diagnosis instead, is question 3 below and is the single thing most likely to differ across the nine.

---

### 2.1 Autism Spectrum Disorder · group `Co-occurring`

`specifier:ndv:autism-spectrum-disorder:co-occurring:with-catatonia`
Catalogue ICD-11 note: _ICD-11 (6A02): Categorised explicitly by presence/absence of intellectual impairment and functional language impairment._

- Shared definition applies unchanged? **yes / no** → _(blank)_
- If no, what differs here: _(blank)_
- ICD-11 route for this disorder: _(blank)_

### 2.2 Brief Psychotic Disorder · group `Features`

`specifier:psy:brief-psychotic-disorder:features:with-catatonia`
Catalogue ICD-11 note: _ICD-11 (6A23): Known as Acute and transient psychotic disorder._

- Shared definition applies unchanged? **yes / no** → _(blank)_
- If no, what differs here: _(blank)_
- ICD-11 route for this disorder: _(blank)_

### 2.3 Schizophreniform Disorder · group `Features`

`specifier:psy:schizophreniform-disorder:features:with-catatonia`
Catalogue ICD-11 note: _ICD-11: No direct equivalent. Usually coded as first episode schizophrenia (6A20) or acute transient (6A23)._

- Shared definition applies unchanged? **yes / no** → _(blank)_
- If no, what differs here: _(blank)_
- ICD-11 route for this disorder: _(blank)_

### 2.4 Schizophrenia · group `Features`

`specifier:psy:schizophrenia:features:with-catatonia`
Catalogue ICD-11 note: _ICD-11 (6A20): Symptom qualifiers required: positive, negative, depressive, manic, psychomotor, cognitive._

- Shared definition applies unchanged? **yes / no** → _(blank)_
- If no, what differs here: _(blank)_
- ICD-11 route for this disorder — **note this is the one entry whose ICD-11 context names a
  `psychomotor` qualifier**: _(blank)_

### 2.5 Schizoaffective Disorder · group `Features`

`specifier:psy:schizoaffective-disorder:features:with-catatonia`
Catalogue ICD-11 note: _ICD-11 (6A21): Subtyped heavily by current episode type (manic, depressive, mixed)._

- Shared definition applies unchanged? **yes / no** → _(blank)_
- If no, what differs here: _(blank)_
- ICD-11 route for this disorder: _(blank)_

### 2.6 Psychotic Disorder Due to Another Medical Condition · group `Features`

`specifier:psy:psychotic-disorder-due-to-another-medical-condition:features:with-catatonia`
Catalogue ICD-11 note: _ICD-11 (6E61): Secondary psychotic syndrome._

- Shared definition applies unchanged? **yes / no** → _(blank)_
- If no, what differs here — **and how this relates to the separate "catatonic disorder due to another
  medical condition" entry**: _(blank)_
- ICD-11 route for this disorder: _(blank)_

### 2.7 Bipolar I Disorder · group `Episode Specifiers`

`specifier:bip:bipolar-i-disorder:episode-specifiers:with-catatonia`
Catalogue ICD-11 note: _ICD-11 (6A60): Characterised by manic episodes. Qualifiers: anxiety, panic, melancholia, seasonal, rapid cycling._

- Shared definition applies unchanged? **yes / no** → _(blank)_
- If no, what differs here — **including whether it attaches to the episode or the disorder**: _(blank)_
- ICD-11 route for this disorder: _(blank)_

### 2.8 Bipolar II Disorder · group `Episode Specifiers`

`specifier:bip:bipolar-ii-disorder:episode-specifiers:with-catatonia`
Catalogue ICD-11 note: _ICD-11 (6A61): Hypomanic + major depressive episodes. Same qualifier structure as Bipolar I._

- Shared definition applies unchanged? **yes / no** → _(blank)_
- If no, what differs here: _(blank)_
- ICD-11 route for this disorder: _(blank)_

### 2.9 Major Depressive Disorder · group `Episode Specifiers`

`specifier:dep:major-depressive-disorder:episode-specifiers:with-catatonia`
Catalogue ICD-11 note: _ICD-11 (6A70/6A71): Single or recurrent. Severity, psychotic, anxiety, melancholia, seasonal qualifiers._

- Shared definition applies unchanged? **yes / no** → _(blank)_
- If no, what differs here: _(blank)_
- ICD-11 route for this disorder: _(blank)_

## 3 — Deliberately out of scope for this worksheet

Catatonia also appears in the catalogue as a **diagnosis** rather than a specifier, twice, with two
different three-way context sets:

| Entry                                                      | Context rows                                                                                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `2. Schizophrenia Spectrum :: Catatonia` (DSM structure)   | associated with another mental disorder (catatonia specifier); catatonic disorder due to another medical condition; unspecified catatonia                    |
| `20. ICD-11 Specifics :: Catatonia (Standalone diagnosis)` | associated with another mental disorder; induced by psychoactive substances including medications; secondary to a medical condition not classified elsewhere |

Those six rows are a separate small job. One of them —
`associated with another mental disorder (catatonia specifier)` — overlaps this worksheet's nine
directly, and reconciling that overlap is worth doing straight after this entry rather than inside it.

## 4 — What to change in the file, once the blanks are filled

For each of the nine, in `data/specifiers-content.json`:

| Field                             | Current value                                                            | Set to                                              |
| --------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| `definition.meaning`              | the placeholder                                                          | sections 1 and 2.x, combined                        |
| `definition.clinicalNote`         | "Auto-generated definition withheld pending qualified clinician review." | the exclusion boundary and what applying it changes |
| `definition.sourceFamily`         | "Best-effort DSM-derived clinical anchor pending manual verification"    | the named manual and edition from section 1         |
| `definition.status`               | `needs-manual-or-clinician-verification`                                 | `defined`                                           |
| `definitionStatus`                | `needs-manual-or-clinician-verification`                                 | `defined`                                           |
| `review.sourceVerificationStatus` | `source-needs-formal-review`                                             | `source-verified`                                   |
| `review.clinicianReviewStatus`    | `clinician-review-pending`                                               | _(the value decided above)_                         |
| `review.changedSinceReview`       | `true`                                                                   | `false`                                             |

`review.rowKey` and `review.contentHash` are not hand-edited — `rowKey` is the address and
`contentHash` is derived.

Then regenerate the search index and prove it is in step:

```bash
npm run build:specifiers-search-index
npm run check:specifiers-search-index
```

The second command fails the build if the index is stale, so the index can never be edited by hand or
left behind.

**What this unlocks.** `src/lib/site-content/adapters/specifiers.ts` shows a specifier as
`locally_reviewed` only when `clinicianReviewStatus` matches approved or reviewed **and**
`changedSinceReview` is false, and its source as `current` only when `sourceVerificationStatus` is
`source-verified` **and** `changedSinceReview` is false. Today neither path is ever taken. These nine
would be the first entries in the catalogue to take them.

## 5 — Sign-off

|                              |                                                                           |
| ---------------------------- | ------------------------------------------------------------------------- |
| Reviewed by                  | _(blank — name, not job title; the governance audit rejects a bare role)_ |
| Date                         | _(blank)_                                                                 |
| Manual and edition consulted | _(blank)_                                                                 |
| Entries covered              | the nine `rowKey`s in section 2                                           |
