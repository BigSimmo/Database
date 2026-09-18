# Specifier definition worklist — 2026-09-18

Clinical worklist for the diagnostic specifier catalogue (`data/specifiers-content.json`), prepared
for issue **#693** and the clinician sign-off debt behind it.

**How this was produced:** a read-only traversal of the committed catalogue at `b06569491`, using the
same walk as `buildCatalog()` in `src/lib/specifiers-content.ts` and
`scripts/lib/governance-catalogue-audit.ts`. No provider call, no live database read, no application
query. Every count below is reproducible offline from the committed file.

**What this document is not:** it contains no clinical definitions. Writing them is the clinician's
work. This is the scaffolding — what exists, what is missing, which missing entries matter most, and
what a completed entry has to contain before it can be marked reviewed.

## The headline numbers, and why the obvious reading of them is wrong

| Measure                                                   | Count |
| --------------------------------------------------------- | ----- |
| Specifier items in the catalogue                          | 585   |
| Universal specifiers (apply across disorders)             | 18    |
| Items marked `defined`                                    | 71    |
| Items marked `needs-manual-or-clinician-verification`     | 494   |
| Items marked `obvious-no-definition` (e.g. "Unspecified") | 20    |
| Items marked `source-verified`                            | 71    |
| **Items carrying clinician sign-off**                     | **0** |

Two of those rows need stating plainly, because the catalogue's own `stats` block invites the wrong
conclusion.

**First: "71 defined" is not 71 definitions.** Of the 71, **57 are formulaic restatements of their own
label** — they match the pattern `For <disorder>, "<label>" uses the stated threshold: <the label's own
parenthesis>`. For example, the entry for Adjustment Disorders "Acute (less than 6 months)" reads: _"For
Adjustment Disorders, 'Acute (less than 6 months)' uses the stated threshold: less than 6 months."_ That
adds nothing a reader could not get from the label. Only **14** of the 71 carry content beyond the
label, and all 14 sit in ICD-11 trauma, dissociative, ARFID and personality material — the areas
someone worked through deliberately. So the real definition coverage is **14 of 585, not 71 of 585**.

**Second: nothing in this catalogue has been signed off by a clinician.** `clinicianReviewStatus` takes
exactly one value across all 585 items and all 18 universal specifiers: `clinician-review-pending`. The
71 marked `source-verified` include the 57 restatements; source verification was applied to text that
mostly repeats the label.

This matters beyond bookkeeping because the display logic reads those fields.
`src/lib/site-content/adapters/specifiers.ts` shows an entry as `locally_reviewed` only when
`clinicianReviewStatus` matches approved/reviewed **and** `changedSinceReview` is false, and as
source `current` only when `sourceVerificationStatus` is `source-verified` **and** `changedSinceReview`
is false. Today that path is never taken for a specifier. The wiring is correct and the sign-off is
absent — which is the safe way round, but it means every specifier the site shows is carrying an
`unverified` badge.

### Where the definition work has and has not happened

| Category                  | Items | Undefined | Defined |
| ------------------------- | ----: | --------: | ------: |
| 1. Neurodevelopmental     |    39 |        39 |       0 |
| 2. Schizophrenia Spectrum |    49 |        46 |       0 |
| 3. Bipolar & Related      |    45 |        44 |       0 |
| 4. Depressive Disorders   |    39 |        39 |       0 |
| 5. Anxiety Disorders      |    20 |        19 |       0 |
| 6. Obsessive-Compulsive   |    34 |        34 |       0 |
| 7. Trauma & Stressor      |    22 |        16 |       5 |
| 8. Dissociative Disorders |    11 |         9 |       2 |
| 9. Somatic Symptom        |    29 |        23 |       6 |
| 10. Feeding & Eating      |    29 |        14 |      15 |
| 11. Elimination Disorders |     5 |         5 |       0 |
| 12. Sleep-Wake Disorders  |    52 |        41 |      10 |
| 13. Sexual Dysfunctions   |    55 |        55 |       0 |
| 14. Gender Dysphoria      |     5 |         3 |       2 |
| 15. Disruptive & Impulse  |    14 |         9 |       4 |
| 16. Substance & Addictive |    31 |        13 |       8 |
| 17. Neurocognitive        |    28 |        26 |       2 |
| 18. Personality Disorders |    23 |        12 |       9 |
| 19. Paraphilic Disorders  |    36 |        36 |       0 |
| 20. ICD-11 Specifics      |    19 |        11 |       8 |

The five categories carrying the commonest presentations in general adult psychiatry —
neurodevelopmental, schizophrenia spectrum, bipolar, depressive and anxiety disorders — hold **192
items and not one definition between them**.

## How the backlog splits for triage

Three groups, by what getting the specifier wrong would change. The split is mechanical (label and
group matching) so it can be re-derived; the clinical judgement about whether it is the _right_ split
is the clinician's, and the boundary between A and B is the part most worth arguing with.

| Group | What it holds                                                                                                                                        | Items | Undefined |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----: | --------: |
| **A** | Features that change immediate management: psychotic, mixed, catatonia, peripartum, insight, self-injurious behaviour, intoxication/withdrawal onset |    63 |    **63** |
| **B** | Severity and remission status                                                                                                                        |   193 |       164 |
| **C** | Everything else: type, pattern, course, aetiology, context, onset age                                                                                |   329 |       287 |

**Group A is the recommended starting point,** for three reasons: every one of the 63 is undefined; each
one plausibly changes a prescribing or admission decision rather than only a formulation; and 63 is a
finite piece of work rather than an open-ended programme.

Group B is larger than it looks useful. Severity means different things in DSM-5-TR and ICD-11 for the
same disorder, and 27 of its undefined items are sexual dysfunctions and 14 are paraphilic disorders,
where a severity qualifier changes management much less than it does in mood or substance disorders. It
is worth deciding which disorders in Group B are worth the effort before starting it, rather than
working through 193 rows in file order.

## Category 20 is a parallel ICD-11 view, not a category

All ten disorders in "20. ICD-11 Specifics" also appear under their clinical category: catatonia,
olfactory reference disorder, body-focused repetitive behaviour disorder, complex PTSD, partial
dissociative identity disorder, trance disorder, bodily distress disorder, compulsive sexual behaviour
disorder, gender incongruence and gaming disorder. That accounts for all 19 of its items.

It is **not** straightforward duplication, and reading it as duplication would delete real content.
Catatonia is the clearest case: the schizophrenia-spectrum entry carries the DSM three-way context
(associated with another mental disorder / catatonic disorder due to another medical condition /
unspecified catatonia) while the category-20 entry carries the ICD-11 three-way context (associated
with another mental disorder / induced by psychoactive substances including medications / secondary to
a medical condition not classified elsewhere). Two manuals, two structures, same diagnosis.

The pairing is not applied consistently, though. Olfactory reference disorder appears twice with the
_same_ `icd11Context` sentence verbatim and differing only in one insight label — "with absent
insight/delusional beliefs" in the OCD category against "with absent insight" in category 20. Whether
that is the DSM wording paired against the ICD-11 wording, or an artefact, is a clinical judgement
and is not resolved here.

Two consequences for anyone counting: the catalogue holds 585 item rows but fewer than 585 distinct
clinical statements, and an entry written in one category does not automatically answer its partner in
category 20.

## Group A is 17 definitions, not 63

The 63 rows carry only **17 distinct specifier labels**. Ten of them are the same specifier repeated
across disorders, and those ten account for 56 of the 63 rows.

| Distinct specifier                       | Rows | Disorders it appears on                                                                                                                                                                                                                  |
| ---------------------------------------- | ---: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| With catatonia                           |    9 | Autism Spectrum Disorder; Brief Psychotic Disorder; Schizophreniform Disorder; Schizophrenia; Schizoaffective Disorder; Psychotic Disorder Due to Another Medical Condition; Bipolar I; Bipolar II; Major Depressive Disorder            |
| With onset during intoxication           |    8 | The eight substance/medication-induced disorders (psychotic, bipolar, depressive, anxiety, OCD, sleep, sexual dysfunction, mental disorders)                                                                                             |
| With onset during withdrawal             |    8 | The same eight                                                                                                                                                                                                                           |
| With mixed features                      |    7 | Bipolar I; Bipolar II; Substance/Medication-Induced Bipolar; Bipolar Due to Another Medical Condition; Major Depressive Disorder; Substance/Medication-Induced Depressive Disorder; Depressive Disorder Due to Another Medical Condition |
| With good or fair insight                |    5 | OCD; Body Dysmorphic Disorder; Hoarding Disorder; Olfactory Reference Disorder (both entries)                                                                                                                                            |
| With poor insight                        |    5 | The same five                                                                                                                                                                                                                            |
| With peripartum onset                    |    4 | Brief Psychotic Disorder; Bipolar I; Bipolar II; Major Depressive Disorder                                                                                                                                                               |
| With absent insight / delusional beliefs |    4 | OCD; Body Dysmorphic Disorder; Hoarding Disorder; Olfactory Reference Disorder (ICD-11 / DSM-5-TR Sec III)                                                                                                                               |
| With mood-congruent psychotic features   |    3 | Bipolar I; Bipolar II; Major Depressive Disorder                                                                                                                                                                                         |
| With mood-incongruent psychotic features |    3 | Bipolar I; Bipolar II; Major Depressive Disorder                                                                                                                                                                                         |
| **Seven one-off rows**                   |    7 | Stereotypic Movement Disorder (self-injurious behaviour); Catatonia (three context rows); Delirium (intoxication and withdrawal delirium); Olfactory Reference Disorder (absent insight)                                                 |

**This does not mean one definition can be pasted across a row's disorders, and that is the clinical
judgement to make first.** Whether "with catatonia" carries the same requirement on autism spectrum
disorder as it does on schizophrenia, and whether "with mixed features" means the same thing applied to
a depressive episode as to a manic one, are exactly the questions a shared definition would paper over.
The right unit of work is probably one definition per specifier plus a note on each disorder where it
differs — but deciding that is the first thing to settle, because it sets the shape of every entry that
follows.

## Group A — the 63 items, by disorder

Each row carries its stable `rowKey`, which is how an entry is addressed in the catalogue file.

**Autism Spectrum Disorder** · 1. Neurodevelopmental

- [Co-occurring] With catatonia `specifier:ndv:autism-spectrum-disorder:co-occurring:with-catatonia`

**Stereotypic Movement Disorder** · 1. Neurodevelopmental

- [Features] With/without self-injurious behaviour `specifier:ndv:stereotypic-movement-disorder:features:with-without-self-injurious-behaviour`

**Brief Psychotic Disorder** · 2. Schizophrenia Spectrum

- [Features] With peripartum onset `specifier:psy:brief-psychotic-disorder:features:with-peripartum-onset`
- [Features] With catatonia `specifier:psy:brief-psychotic-disorder:features:with-catatonia`

**Schizophreniform Disorder** · 2. Schizophrenia Spectrum

- [Features] With catatonia `specifier:psy:schizophreniform-disorder:features:with-catatonia`

**Schizophrenia** · 2. Schizophrenia Spectrum

- [Features] With catatonia `specifier:psy:schizophrenia:features:with-catatonia`

**Schizoaffective Disorder** · 2. Schizophrenia Spectrum

- [Features] With catatonia `specifier:psy:schizoaffective-disorder:features:with-catatonia`

**Substance/Medication-Induced Psychotic Disorder** · 2. Schizophrenia Spectrum

- [Onset] With onset during intoxication `specifier:psy:substance-medication-induced-psychotic-disorder:onset:with-onset-during-intoxication`
- [Onset] With onset during withdrawal `specifier:psy:substance-medication-induced-psychotic-disorder:onset:with-onset-during-withdrawal`

**Psychotic Disorder Due to Another Medical Condition** · 2. Schizophrenia Spectrum

- [Features] With catatonia `specifier:psy:psychotic-disorder-due-to-another-medical-condition:features:with-catatonia`

**Catatonia** · 2. Schizophrenia Spectrum

- [Context] Associated with another mental disorder (catatonia specifier) `specifier:psy:catatonia:context:associated-with-another-mental-disorder-catatonia-specifier`
- [Context] Catatonic disorder due to another medical condition `specifier:psy:catatonia:context:catatonic-disorder-due-to-another-medical-condition`
- [Context] Unspecified catatonia `specifier:psy:catatonia:context:unspecified-catatonia`

**Bipolar I Disorder** · 3. Bipolar & Related

- [Episode Specifiers] With mixed features `specifier:bip:bipolar-i-disorder:episode-specifiers:with-mixed-features`
- [Episode Specifiers] With mood-congruent psychotic features `specifier:bip:bipolar-i-disorder:episode-specifiers:with-mood-congruent-psychotic-features`
- [Episode Specifiers] With mood-incongruent psychotic features `specifier:bip:bipolar-i-disorder:episode-specifiers:with-mood-incongruent-psychotic-features`
- [Episode Specifiers] With catatonia `specifier:bip:bipolar-i-disorder:episode-specifiers:with-catatonia`
- [Episode Specifiers] With peripartum onset `specifier:bip:bipolar-i-disorder:episode-specifiers:with-peripartum-onset`

**Bipolar II Disorder** · 3. Bipolar & Related

- [Episode Specifiers] With mixed features `specifier:bip:bipolar-ii-disorder:episode-specifiers:with-mixed-features`
- [Episode Specifiers] With mood-congruent psychotic features `specifier:bip:bipolar-ii-disorder:episode-specifiers:with-mood-congruent-psychotic-features`
- [Episode Specifiers] With mood-incongruent psychotic features `specifier:bip:bipolar-ii-disorder:episode-specifiers:with-mood-incongruent-psychotic-features`
- [Episode Specifiers] With catatonia `specifier:bip:bipolar-ii-disorder:episode-specifiers:with-catatonia`
- [Episode Specifiers] With peripartum onset `specifier:bip:bipolar-ii-disorder:episode-specifiers:with-peripartum-onset`

**Substance/Medication-Induced Bipolar** · 3. Bipolar & Related

- [Onset] With onset during intoxication `specifier:bip:substance-medication-induced-bipolar:onset:with-onset-during-intoxication`
- [Onset] With onset during withdrawal `specifier:bip:substance-medication-induced-bipolar:onset:with-onset-during-withdrawal`
- [Features] With mixed features `specifier:bip:substance-medication-induced-bipolar:features:with-mixed-features`

**Bipolar Due to Another Medical Condition** · 3. Bipolar & Related

- [Features] With mixed features `specifier:bip:bipolar-due-to-another-medical-condition:features:with-mixed-features`

**Major Depressive Disorder** · 4. Depressive Disorders

- [Episode Specifiers] With mixed features `specifier:dep:major-depressive-disorder:episode-specifiers:with-mixed-features`
- [Episode Specifiers] With mood-congruent psychotic features `specifier:dep:major-depressive-disorder:episode-specifiers:with-mood-congruent-psychotic-features`
- [Episode Specifiers] With mood-incongruent psychotic features `specifier:dep:major-depressive-disorder:episode-specifiers:with-mood-incongruent-psychotic-features`
- [Episode Specifiers] With catatonia `specifier:dep:major-depressive-disorder:episode-specifiers:with-catatonia`
- [Episode Specifiers] With peripartum onset `specifier:dep:major-depressive-disorder:episode-specifiers:with-peripartum-onset`

**Substance/Medication-Induced Depressive Disorder** · 4. Depressive Disorders

- [Onset] With onset during intoxication `specifier:dep:substance-medication-induced-depressive-disorder:onset:with-onset-during-intoxication`
- [Onset] With onset during withdrawal `specifier:dep:substance-medication-induced-depressive-disorder:onset:with-onset-during-withdrawal`
- [Features] With mixed features `specifier:dep:substance-medication-induced-depressive-disorder:features:with-mixed-features`

**Depressive Disorder Due to Another Medical Condition** · 4. Depressive Disorders

- [Features] With mixed features `specifier:dep:depressive-disorder-due-to-another-medical-condition:features:with-mixed-features`

**Substance/Medication-Induced Anxiety Disorder** · 5. Anxiety Disorders

- [Onset] With onset during intoxication `specifier:anx:substance-medication-induced-anxiety-disorder:onset:with-onset-during-intoxication`
- [Onset] With onset during withdrawal `specifier:anx:substance-medication-induced-anxiety-disorder:onset:with-onset-during-withdrawal`

**Obsessive-Compulsive Disorder** · 6. Obsessive-Compulsive

- [Insight] With good or fair insight `specifier:ocd:obsessive-compulsive-disorder:insight:with-good-or-fair-insight`
- [Insight] With poor insight `specifier:ocd:obsessive-compulsive-disorder:insight:with-poor-insight`
- [Insight] With absent insight/delusional beliefs `specifier:ocd:obsessive-compulsive-disorder:insight:with-absent-insight-delusional-beliefs`

**Body Dysmorphic Disorder** · 6. Obsessive-Compulsive

- [Insight] With good or fair insight `specifier:ocd:body-dysmorphic-disorder:insight:with-good-or-fair-insight`
- [Insight] With poor insight `specifier:ocd:body-dysmorphic-disorder:insight:with-poor-insight`
- [Insight] With absent insight/delusional beliefs `specifier:ocd:body-dysmorphic-disorder:insight:with-absent-insight-delusional-beliefs`

**Hoarding Disorder** · 6. Obsessive-Compulsive

- [Insight] With good or fair insight `specifier:ocd:hoarding-disorder:insight:with-good-or-fair-insight`
- [Insight] With poor insight `specifier:ocd:hoarding-disorder:insight:with-poor-insight`
- [Insight] With absent insight/delusional beliefs `specifier:ocd:hoarding-disorder:insight:with-absent-insight-delusional-beliefs`

**Substance/Medication-Induced OCD** · 6. Obsessive-Compulsive

- [Onset] With onset during intoxication `specifier:ocd:substance-medication-induced-ocd:onset:with-onset-during-intoxication`
- [Onset] With onset during withdrawal `specifier:ocd:substance-medication-induced-ocd:onset:with-onset-during-withdrawal`

**Olfactory Reference Disorder (ICD-11 / DSM-5-TR Sec III)** · 6. Obsessive-Compulsive

- [Insight] With good or fair insight `specifier:ocd:olfactory-reference-disorder-icd-11-dsm-5-tr-sec-iii:insight:with-good-or-fair-insight`
- [Insight] With poor insight `specifier:ocd:olfactory-reference-disorder-icd-11-dsm-5-tr-sec-iii:insight:with-poor-insight`
- [Insight] With absent insight/delusional beliefs `specifier:ocd:olfactory-reference-disorder-icd-11-dsm-5-tr-sec-iii:insight:with-absent-insight-delusional-beliefs`

**Substance/Medication-Induced Sleep Disorder** · 12. Sleep-Wake Disorders

- [Onset] With onset during intoxication `specifier:slp:substance-medication-induced-sleep-disorder:onset:with-onset-during-intoxication`
- [Onset] With onset during withdrawal `specifier:slp:substance-medication-induced-sleep-disorder:onset:with-onset-during-withdrawal`

**Substance/Medication-Induced Sexual Dysfunction** · 13. Sexual Dysfunctions

- [Onset/Severity] With onset during intoxication `specifier:sxd:substance-medication-induced-sexual-dysfunction:onset-severity:with-onset-during-intoxication`
- [Onset/Severity] With onset during withdrawal `specifier:sxd:substance-medication-induced-sexual-dysfunction:onset-severity:with-onset-during-withdrawal`

**Substance/Medication-Induced Mental Disorders** · 16. Substance & Addictive

- [Onset] With onset during intoxication `specifier:sub:substance-medication-induced-mental-disorders:onset:with-onset-during-intoxication`
- [Onset] With onset during withdrawal `specifier:sub:substance-medication-induced-mental-disorders:onset:with-onset-during-withdrawal`

**Delirium** · 17. Neurocognitive

- [Aetiology] Substance intoxication delirium `specifier:ncg:delirium:aetiology:substance-intoxication-delirium`
- [Aetiology] Substance withdrawal delirium `specifier:ncg:delirium:aetiology:substance-withdrawal-delirium`

**Olfactory Reference Disorder** · 20. ICD-11 Specifics

- [Insight] With good or fair insight `specifier:icd:olfactory-reference-disorder:insight:with-good-or-fair-insight`
- [Insight] With poor insight `specifier:icd:olfactory-reference-disorder:insight:with-poor-insight`
- [Insight] With absent insight `specifier:icd:olfactory-reference-disorder:insight:with-absent-insight`

## The first entry is drafted

The "with catatonia" entry — the recommended starting point, and the most reused of the 17 — is laid
out field by field in [`specifier-entry-worksheet-with-catatonia.md`](specifier-entry-worksheet-with-catatonia.md),
with all nine disorders enumerated and every clinical statement left blank. The worked example below
explains the method; the worksheet is the method applied to a specific entry.

## Worked example — Major Depressive Disorder, "With mixed features"

`specifier:dep:major-depressive-disorder:episode-specifiers:with-mixed-features`

Chosen because it is the shape of the problem rather than the easiest case: it changes management, it
is one of the places DSM-5-TR and ICD-11 genuinely disagree, and it is currently blank.

**Current state in the file:**

```json
{
  "label": "With mixed features",
  "definition": {
    "meaning": "Pending clinician verification — confirm this specifier against current DSM-5-TR / ICD-11 materials.",
    "clinicalNote": "Auto-generated definition withheld pending qualified clinician review.",
    "sourceFamily": "Best-effort DSM-derived clinical anchor pending manual verification",
    "status": "needs-manual-or-clinician-verification"
  },
  "definitionStatus": "needs-manual-or-clinician-verification",
  "review": {
    "rowKey": "specifier:dep:major-depressive-disorder:episode-specifiers:with-mixed-features",
    "sourceVerificationStatus": "source-needs-formal-review",
    "clinicianReviewStatus": "clinician-review-pending",
    "changedSinceReview": true
  }
}
```

**What a completed entry has to answer.** Four questions, in this order. The first three are what the
`meaning` and `clinicalNote` fields are for; the fourth is what `sourceFamily` records.

1. **What has to be present for the specifier to apply?** Not a gloss of the words "mixed features" —
   the actual requirement: which symptoms, how many, for how much of the episode, and whether they must
   be present nearly every day.
2. **What excludes it?** The boundary that stops it being applied too widely — in this case the line
   between a depressive episode with mixed features and a manic or hypomanic episode, which is a
   different diagnosis rather than a different specifier.
3. **What does applying it change?** This is the field the current formulaic entries never touch, and
   the reason this specifier is worth doing first. If the answer is "nothing", the entry can say so and
   drop to Group C.
4. **Which document says so, and in which edition?** Named source and version, not "DSM-derived".

**The divergence that must not be papered over.** DSM-5-TR carries "with mixed features" as an episode
specifier applied to a depressive episode. ICD-11 (6A70/6A71) handles the same clinical territory
differently in its qualifier structure. The catalogue's `icd11Context` for Major Depressive Disorder
already records _"ICD-11 (6A70/6A71): Single or recurrent. Severity, psychotic, anxiety, melancholia,
seasonal qualifiers"_ — which lists the ICD-11 qualifiers and does **not** list mixed features among
them.

A single blended sentence covering "DSM and ICD" would hide that. The entry needs to say which manual
it is describing, and where the other one differs — the same treatment the ICD-11 dissociative entries
already get, where the catalogue states plainly that trance disorder (6B62) and possession trance
disorder (6B63) are two diagnoses in ICD-11 rather than one with/without specifier. That entry is the
house style to copy; it is one of the 14 substantive ones.

**What makes it done.** Four field changes, all in `data/specifiers-content.json`:

| Field                                      | From                                                                  | To                           |
| ------------------------------------------ | --------------------------------------------------------------------- | ---------------------------- |
| `definition.meaning`                       | placeholder                                                           | the answer to questions 1–3  |
| `definition.sourceFamily`                  | "Best-effort DSM-derived clinical anchor pending manual verification" | the named manual and edition |
| `definitionStatus` and `definition.status` | `needs-manual-or-clinician-verification`                              | `defined`                    |
| `review.sourceVerificationStatus`          | `source-needs-formal-review`                                          | `source-verified`            |
| `review.clinicianReviewStatus`             | `clinician-review-pending`                                            | the approved value           |
| `review.changedSinceReview`                | `true`                                                                | `false`                      |

`review.contentHash` is derived, not hand-edited. `npm run build:specifiers-search-index` regenerates
the search index and `npm run check:specifiers-search-index` fails the build if it is stale, so the
index is never edited by hand either.

**One thing to settle before the first entry is written:** there is no approved value for
`clinicianReviewStatus` yet, because no entry has ever been signed. The adapter accepts anything
matching approved or reviewed as a whole word; picking the exact string once — and recording who may
set it — is a five-minute decision that every subsequent entry depends on.

## The other two clinical worklists

### #229 — source governance across 835 catalogue records

Now unblocked. Until PR #2867 landed, `scripts/audit-source-governance.ts` read both clinical
catalogues at keys that do not exist and enumerated **0 records** against 835, so it reported success
on a population it had never loaded. The audit can now see the records.

**What it needs:** one run of `npm run audit:source-governance --json`. That is provider-backed — it
reads Supabase — so it needs explicit approval at the time. **Expect it to fail**, and expect that to
be correct: it will surface real review debt where it previously reported none. The failure is the
first honest measurement, not a regression.

Two findings from that PR shape what the run will report. The audit no longer accepts a job title as a
reviewer — `reviewed_by: "Consultant Psychiatrist"` identifies nobody — so some records that previously
passed attribution will now fail it. And all 585 specifier items report `clinician-review-pending`, so
the specifier half of the run is fully accounted for by this document.

### #289 — differential record completeness

**What it needs:** one owner-scoped query against the live differential rows, to establish which
records change derived status now that source metadata no longer clears a recorded supersession
(PR #2867). Provider-backed, so it needs approval at the time and belongs in an approved window.

The change is conservative in direction: records that were reading `current` on the strength of a stale
review date or an upstream `source.lastUpdated` will read `outdated` again. The query answers how many,
and which.

Related and already recorded rather than fixed: `scripts/pr-policy.mjs` treats
`data/differentials-snapshot.json` as a clinical-risk surface but not `src/lib/differential-records.ts`,
the code that decides whether a record reads current or outdated. That is an owner decision about a
governance surface and is in the outstanding-work ledger.

## What this pass deliberately did not do

- **No clinical definitions were written.** Every one of the 585 entries is unchanged.
- **No specifier taxonomy was changed.** The external review packet asserted that a with/without
  possession specifier needed splitting; that split was made on 2026-07-17 in `cb544a4c6`, an ancestor
  of the packet's own baseline. The remaining with/without row is dissociative identity disorder
  (6B64), where ICD-11 genuinely includes it. Acting on the packet's instruction would have
  reintroduced a clinical error.
- **No review status was raised** and nothing was marked verified.
