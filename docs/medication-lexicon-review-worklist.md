# Medication lexicon — clinician reading worklist (`#318`)

**This is a reading aid, not a review.** It does not fill in the sign-off block in
`docs/medication-interaction-lexicon-review.md`, and it makes no clinical determination. Its only
job is to make the top-down pass that `#318` asks for as short as it can honestly be.

Generated against `origin/main` at `8069188`. The review sheet was regenerated at that commit and
came back byte-identical to the committed copy, so the sheet is current: 28 catalogue terms,
1 flagged.

## Read this first

**Two of the row's three known defects are already closed**, and one new mechanical defect was found
that the sheet's own guard could not see.

| Defect as stated in `#318`                           | State now                                                                                                                                     |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| ARB matching Carbapenem across 16 CRITICAL/HIGH rows | **Closed.** `arbs` resolves to Candesartan only, and a standing substring check now guards it.                                                |
| Two divergent Warfarin records                       | **Open.** Still the single flagged item. §2.6 — highest consequence on this page.                                                             |
| Lithium unreachable from eight HIGH rows             | **Closed.** `lithium` resolves to Lithium carbonate (IR/SR) across 9 rows / 9 severe, and lithium is absent from the unreachable-drugs table. |

**New — a dead slug drops a TCA from 20 severe rows.** `§2.1`. This one is a broken reference, not a
clinical judgment call, and it is the reason `§4` matters: the sheet's "Checks that ran and found
nothing" line is **overstated for two terms**, `tcas` among them.

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
| 6   | `tcas`            | 22 / 20       | 5 — Amitriptyline, Clomipramine, Doxepin, Imipramine, Nortriptyline                                                                                                                                                                            | **§2.1** |
| 7   | `ssris`           | 21 / 19       | 6 — Citalopram, Escitalopram, Fluoxetine, Fluvoxamine, Paroxetine, Sertraline                                                                                                                                                                  | clean    |
| 8   | `diuretics`       | 18 / 17       | 6 — Amiloride, Eplerenone, Frusemide, Hydrochlorothiazide, Indapamide, Spironolactone                                                                                                                                                          | clean    |
| 9   | `maois`           | 19 / 17       | 2 — Phenelzine, Tranylcypromine                                                                                                                                                                                                                | §2.3     |
| 10  | `arbs`            | 16 / 16       | 1 — Candesartan                                                                                                                                                                                                                                | §2.5     |

"clean" means I enumerated every catalogue record whose class or subclass names that class and found
the term already covers all of them, with the deliberate exclusions accounted for.

## 2. The findings — six items, in priority order

The prose a clinician sees is always verbatim catalogue text. What is in question is only which
drugs a phrase was taken to mean.

### 2.1 `tcas` carries a dead slug — Dosulepin is silently excluded from 20 severe rows

**This is a defect, not a judgment call, and it needs no clinical opinion to confirm.**

`src/lib/medication-interaction-lexicon.ts` selects TCAs by an explicit slug list:

```
select: { slugs: ["amitriptyline", "nortriptyline", "imipramine", "clomipramine", "doxepin", "dothiepin"] }
```

Six slugs, but the catalogue record's slug is **`dosulepin`**, not `dothiepin`. A search of
`data/medications-snapshot.json` for `"dothiepin"` returns **zero** records — the slug matches
nothing. The drug is in the catalogue (`class: Antidepressant`, `subclass: TCA`, and its own
overview reads "Tricyclic Antidepressant (also known as Dothiepin)"), so the lexicon was written
against the older Australian/UK name while the catalogue uses the current INN.

Consequence: Dosulepin fires **none** of the 20 severe `tcas` rows. Its own catalogue record flags
`Toxicity in OD: FATAL` and `Anticholinergic: HIGH`.

**Your call:** confirm Dosulepin should be a TCA for interaction purposes (I expect yes), and the
fix is a one-word slug correction plus a regenerate. I have not made it — `#318` says do not change
the lexicon.

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

### 2.3 `maois` excludes Moclobemide — missed-alert direction, 17 severe rows

Moclobemide **is** in the catalogue: `class: Antidepressant`, `subclass: RIMA`. Phenelzine and
Tranylcypromine are `Irreversible MAOI`. The selector is `subclassIncludes: ["MAOI"]`, and the
string `RIMA` does not contain `MAOI`, so Moclobemide sits outside all 17 severe rows.

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

## 3. What I did not do

- Did not modify `src/lib/medication-interaction-lexicon.ts` or any catalogue data.
- Did not fill in, or pre-fill, the sign-off block. That is the clinician action `#318` asks for.
- Did not treat `check:medication-lexicon-report` as review. Regeneration was a no-op, which proves
  only that the sheet describes the current lexicon — not that any mapping is correct. `#318`'s stop
  condition is unchanged.

## 4. The review instrument has two blind spots — worth fixing before the next reading pass

The sheet prints "Checks that ran and found nothing: **Missed class members** — no catalogue drug
whose own class or subclass names a term's phrase was left out of that term." For three terms that
sentence is **not true**, because the check could not run.

`missedClassMembers()` in `scripts/build-medication-lexicon-report.ts` (line 442) skips any surface
whose singular stem is shorter than four characters:

```
const stem = surface.toLowerCase().replace(/s$/, "");
if (stem.length < 4) return false;
```

That guard exists to stop short tokens generating false positives, but it silently disables the
whole check for a three-letter class acronym unless some _other_ surface on the same term is long
enough to carry it. I executed the guard's own logic against each term's real surfaces and
haystacks rather than reasoning about it:

| Term   | Usable stems after the `< 4` filter                            | Verdict         | Severe rows | Real miss?                   |
| ------ | -------------------------------------------------------------- | --------------- | ----------- | ---------------------------- |
| `tcas` | `tricyclic`, `tricyclic antidepressant`, `anticholinergic tca` | **cannot fire** | 20          | **Yes — Dosulepin (§2.1)**   |
| `arbs` | _none_                                                         | **cannot fire** | 16          | No — catalogue holds one ARB |
| `ppis` | `proton pump inhibitor`                                        | runs correctly  | 8           | n/a                          |

`ppis` is rescued by its long surface; `tcas` is not, because none of its three usable stems match
the haystack `antidepressant tca`, and `arbs` has no usable stem at all.

Second blind spot: the check reads only `class` and `subclass`, never `tag`. Celecoxib and Parecoxib
carry `tag: "NSAID"` (§2.2) and are invisible to it for that reason.

Neither fix is made here. Both are cheap, and doing them before the clinical pass would mean the
"ran clean" lines can be trusted at face value.
