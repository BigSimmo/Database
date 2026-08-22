# Medication lexicon — clinician reading worklist (`#318`)

**This is a reading aid, not a review.** It does not fill in the sign-off block in
`docs/medication-interaction-lexicon-review.md`, and it makes no clinical determination. Its only
job is to make the top-down pass that `#318` asks for as short as it can honestly be.

First written against `origin/main` at `8069188`; **updated 2026-08-17** after §2.1 and §4 were fixed.
The sheet now reads 28 catalogue terms, **2 flagged** — the coxib gap in §2.2 is raised
automatically where it previously was not.

## Read this first

**Two of the row's three known defects were already closed** before this pass, one new mechanical
defect was found and has now been **fixed**, and the guard that should have caught it has been
repaired.

| Defect as stated in `#318`                           | State now                                                                                                                                     |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| ARB matching Carbapenem across 16 CRITICAL/HIGH rows | **Closed.** `arbs` resolves to Candesartan only, and a standing substring check now guards it.                                                |
| Two divergent Warfarin records                       | **Open.** Still the single flagged item. §2.6 — highest consequence on this page.                                                             |
| Lithium unreachable from eight HIGH rows             | **Closed.** `lithium` resolves to Lithium carbonate (IR/SR) across 9 rows / 9 severe, and lithium is absent from the unreachable-drugs table. |

**New, and now fixed — a dead slug dropped a TCA from 20 severe rows.** `§2.1`. A broken reference
rather than a clinical judgment call, and the reason `§4` matters: the sheet's "Checks that ran and
found nothing" line was **overstated for two terms**, `tcas` among them. Both are repaired.

**Nothing that needed your clinical answer was changed.** §2.2 to §2.6 are still open questions with
their mappings untouched, and the sign-off block is still empty.

## 1. The top ten terms by severe usage

`Severe` = CRITICAL or HIGH interaction rows the term fires on. These ten carry **236 of the 390
severe firings across all 28 terms (61%)**, so a pass that stops after ten has covered most of the
red-and-amber surface.

| #   | Term              | Rows / Severe | Resolves to                                                                                                                                                                                                                                    | Look at  |
| --- | ----------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | `nsaids`          | 39 / 38       | 6 — Aspirin, Diclofenac, Ibuprofen, Ketorolac, Meloxicam, Naproxen                                                                                                                                                                             | **§2.2** |
| 2   | `opioids`         | 36 / 35       | 14 — Buprenorphine (SL/depot), Buprenorphine + naloxone, Buprenorphine patch, Codeine, Fentanyl, Hydromorphone (IR/IV), **Loperamide**, Methadone, Morphine (IR/IV), Morphine SR/MR, Oxycodone IR, Oxycodone SR/MR, Tapentadol SR, Tramadol IR | §2.4     |
| 3   | `benzodiazepines` | 32 / 32       | 8 — Alprazolam, Clonazepam, Diazepam, Lorazepam, Midazolam, Nitrazepam, Oxazepam, Temazepam                                                                                                                                                    | clean    |
| 4   | `beta-blockers`   | 23 / 22       | 7 — Atenolol, Bisoprolol, Carvedilol, Labetalol, Metoprolol, Propranolol, Sotalol                                                                                                                                                              | clean    |
| 5   | `acei`            | 20 / 20       | 1 — Perindopril                                                                                                                                                                                                                                | §2.5     |
| 6   | `tcas`            | 22 / 20       | **6** — Amitriptyline, Clomipramine, **Dosulepin**, Doxepin, Imipramine, Nortriptyline                                                                                                                                                         | **§2.1** |
| 7   | `ssris`           | 21 / 19       | 6 — Citalopram, Escitalopram, Fluoxetine, Fluvoxamine, Paroxetine, Sertraline                                                                                                                                                                  | clean    |
| 8   | `diuretics`       | 18 / 17       | 6 — Amiloride, Eplerenone, Frusemide, Hydrochlorothiazide, Indapamide, Spironolactone                                                                                                                                                          | clean    |
| 9   | `maois`           | 19 / 17       | 2 — Phenelzine, Tranylcypromine                                                                                                                                                                                                                | §2.3     |
| 10  | `arbs`            | 16 / 16       | 1 — Candesartan                                                                                                                                                                                                                                | §2.5     |

"clean" means I enumerated every catalogue record whose class or subclass names that class and found
the term already covers all of them, with the deliberate exclusions accounted for.

## 2. The findings — six items, in priority order

The prose a clinician sees is always verbatim catalogue text. What is in question is only which
drugs a phrase was taken to mean.

### 2.1 `tcas` carried a dead slug — Dosulepin was excluded from 20 severe rows — **FIXED**

**Resolved 2026-08-17.** The selector now reads `dosulepin` and the sheet shows `tcas` resolving to
**6** drugs including Dosulepin, so those 20 CRITICAL/HIGH rows now reach it. Nothing below is
outstanding; it is kept as the record of what the defect was.

This was a defect rather than a judgment call: Dosulepin _is_ dothiepin under its current INN, the
catalogue already filed it as `subclass: TCA`, and the lexicon author wrote `dothiepin` — so
including it was the evident intent and only the spelling had drifted. The durable guard is
`tests/medication-interaction-lexicon-coverage.test.ts`, which now fails on **any** selector slug
that resolves to no catalogue record. The pre-existing test only required a term to resolve to _some_
drug, so `tcas` stayed green on five of six slugs — which is exactly how this shipped.

What it was: `src/lib/medication-interaction-lexicon.ts` selected TCAs by explicit slug list, and one
entry read `dothiepin` where the catalogue record's slug is `dosulepin`. A search of
`data/medications-snapshot.json` for `"dothiepin"` returned **zero** records, so Dosulepin — whose own
record flags `Toxicity in OD: FATAL` and `Anticholinergic: HIGH` — fired none of the 20 severe `tcas`
rows.

Still your call, and unchanged by the fix: whether the _interaction rows themselves_ are right for
Dosulepin now that it reaches them. Restoring the mapping does not review the 20 rows it switched on.

### 2.2 `nsaids` excludes Celecoxib and Parecoxib — missed-alert direction, 38 severe rows

`nsaids` selects on `subclassIncludes: ["NSAID"]`. The catalogue holds two more analgesics whose
subclass reads `COX-2 Inhibitor` and `COX-2 Inhibitor (Injectable)` — Celecoxib and Parecoxib.
Neither string contains "NSAID", so neither is selected. Both records carry `tag: "NSAID"`, which
the selector does not read.

Note the inconsistency this creates: Meloxicam **is** included, only because its subclass happens to
be spelled `NSAID (COX-2 preferential)`. So a COX-2-preferential NSAID is in and two selective COX-2
inhibitors are out, on spelling rather than pharmacology.

**Your call:** celecoxib's GI-bleeding risk is genuinely lower, so exclusion from bleeding-risk rows
may be right. Its renal, lithium-level, and ACE-I/ARB "triple whammy" interactions are not lower.
Should `nsaids` cover the coxibs for the non-bleeding rows? This may be a row-by-row answer rather
than a blanket include.

**Now surfaced automatically.** Since the §4 fixes, the generated sheet raises this itself under
"Flagged for a closer look" — it no longer depends on someone reading the term table by hand. The
mapping is deliberately unchanged, because unlike §2.1 this one needs your clinical answer first.

### 2.3 `maois` excludes Moclobemide — missed-alert direction, 17 severe rows

Moclobemide **is** in the catalogue: `class: Antidepressant`, `subclass: RIMA`. Phenelzine and
Tranylcypromine are `Irreversible MAOI`. The selector is `subclassIncludes: ["MAOI"]`, and the
string `RIMA` does not contain `MAOI`, so Moclobemide sits outside all 17 severe rows.

**This one the sheet still cannot find on its own**, even after the §4 fixes: Moclobemide's `tag` is
also `RIMA`, so widening the haystack to include tags does not reach it. `RIMA` and `MAOI` are
synonyms in pharmacology and unrelated as strings, and no string check closes that gap — which is
precisely why the clinician pass in this document is not replaceable by a better guard.

**Your call:** moclobemide is a reversible, selective MAO-A inhibitor. Its tyramine/food risk is
genuinely much lower than the irreversible agents, so excluding it from dietary rows is defensible.
Its serotonin-syndrome risk with SSRIs, TCAs, tramadol or other serotonergics is not lower. Should
`maois` cover Moclobemide for the serotonergic rows specifically?

Moclobemide is reachable by name from 4 places in the interaction index, so it is not invisible to
the feature — only to this class term.

### 2.4 `opioids` includes Loperamide — false-alert direction, 35 severe rows

Loperamide is `class: Antidiarrhoeal`, `subclass: Peripheral Opioid Agonist`, so it matches on the
substring `Opioid`. It is a true opioid agonist but peripherally restricted, and does not
meaningfully cross the blood-brain barrier at therapeutic doses.

**Your call:** for the sedation and respiratory-depression rows — opioids paired with
benzodiazepines, alcohol or other CNS depressants — should Loperamide fire? If not, it is producing
false CRITICAL/HIGH alerts on a common OTC antidiarrhoeal. Loperamide does carry real QTc and
cardiac risk in overdose, so this too may be row-dependent.

### 2.5 `acei` and `arbs` resolve to one drug each — confirm this is intended catalogue scope

`acei` → Perindopril only (20 severe). `arbs` → Candesartan only (16 severe). `loop-diuretics` →
Frusemide only.

**No lexicon defect here** — I verified by exact record name that ramipril, lisinopril, irbesartan,
telmisartan and valsartan are not in `data/medications-snapshot.json` at all. This is catalogue
coverage, exactly as the sheet says.

**Your call:** is one ACE inhibitor and one ARB the right scope for your prescribing? A patient on
ramipril or irbesartan gets **no** alert from these 36 severe rows, and per the sheet's "What this
tool can never warn about" section, silence looks identical on screen to a checked-and-clear result.

### 2.6 `anticoagulants` — the flagged Warfarin split, plus an internal inconsistency

Rank 12 by severe usage (18 rows / 15 severe), but it carries the sheet's only flagged defect.

**The flagged defect.** The catalogue holds two records both named **Warfarin**
(`warfarin-vka`, `warfarin-anticoagulant`), with identical class `Anticoagulant` and subclass
`Vitamin K Antagonist`. They carry 3 interaction rows each and **zero in common**. Which record a
clinician opens changes which warnings appear, with no visible cue that a second Warfarin exists.
This is a catalogue reconciliation, not a lexicon fix.

**The inconsistency.** `anticoagulants` also resolves to Clopidogrel, Dipyridamole and Ticagrelor —
antiplatelets, not anticoagulants — because the catalogue files all three under class
`Anticoagulant`. Meanwhile Aspirin, which carries the _same_ class `Anticoagulant` (subclass
`Antiplatelet / NSAID`), sits on the sheet's deliberate-exclusion list.

**Your call:** three antiplatelets are in and one is out, on identical class metadata. Is that the
intended clinical line, or should `anticoagulants` and `antiplatelets` be cleanly separated?

## 3. What is still owed from you

- **The sign-off block is still empty and the sheet is still UNREVIEWED.** Nothing in this document
  or in the fixes below changes that; only a clinician filling it in closes `#318`.
- **§2.2 to §2.6 are unanswered clinical questions**, and their mappings are deliberately unchanged.
- `check:medication-lexicon-report` passing is still not review. It proves only that the sheet
  describes the current lexicon, never that a mapping is correct. `#318`'s stop condition stands.

What changed on 2026-08-17: only §2.1 (a broken reference restoring evident intent) and §4 (the
instrument's own blind spots). No mapping that needed a clinical answer was touched.

## 4. The review instrument had two blind spots — **both FIXED**

**Resolved 2026-08-17.** This section is kept because the failure shape matters more than the fix: a
printed "checked, nothing found" that _could not have found anything_ is worse than no line at all,
because it retires the question.

The sheet used to print "**Missed class members** — no catalogue drug whose own class or subclass
names a term's phrase was left out of that term". For two terms that sentence was **not true**,
because the check could not run. `missedClassMembers()` skipped any surface whose singular stem was
shorter than four characters — which silently disabled it for a three-letter class acronym unless
some _other_ surface on the same term was long enough to carry it. Executing the guard's own logic
against each term's real surfaces, rather than reasoning about it:

| Term   | Usable stems under the old `< 4` filter                        | Verdict         | Severe rows | Real miss?                   |
| ------ | -------------------------------------------------------------- | --------------- | ----------- | ---------------------------- |
| `tcas` | `tricyclic`, `tricyclic antidepressant`, `anticholinergic tca` | **cannot fire** | 20          | **Yes — Dosulepin (§2.1)**   |
| `arbs` | _none_                                                         | **cannot fire** | 16          | No — catalogue holds one ARB |
| `ppis` | `proton pump inhibitor`                                        | ran correctly   | 8           | n/a                          |

`ppis` was rescued by its long surface; `tcas` was not, because none of its three usable stems match
the haystack `antidepressant tca`, and `arbs` had no usable stem at all.

The second blind spot: the check read only `class` and `subclass`, never `tag` — so Celecoxib and
Parecoxib, which carry `tag: "NSAID"`, were invisible to it (§2.2).

**Both are now closed.** The floor is 3, the shortest stem any real surface produces, and the
haystack includes `tag`. The sheet now raises the coxibs itself.

One design note worth recording, because the first attempt was wrong: the fix originally matched short
acronyms as whole tokens (`\btca\b`). Mutation testing showed that branch did no protective work —
the leading `\b` already stops `arb` reaching inside `Carbapenem` — while it would newly **miss** a
subclass spelled `TCAs`, a regression in the dangerous direction. It is a plain prefix match, pinned
by a test using a pluralised subclass.

Neither fix is made here. Both are cheap, and doing them before the clinical pass would mean the
"ran clean" lines can be trusted at face value.
