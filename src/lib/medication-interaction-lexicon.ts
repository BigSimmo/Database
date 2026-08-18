// Curated counterparty lexicon for the drug-interaction index.

import type { MedicationRecord } from "@/lib/medications";

export type LexiconTermKind = "catalogue" | "external" | "nonDrug" | "mechanism";

export type CatalogueSelector = {
  slugs?: string[];
  classes?: string[];
  /**
   * Substring match against `record.subclass`. Correct for a family name that
   * legitimately appears inside longer subclasses ("NSAID" inside "NSAID
   * (COX-2 preferential)"), and WRONG for a short acronym that can hide inside
   * an unrelated word — "ARB" sits inside "C-arb-apenem", which put two
   * carbapenem antibiotics in the ARB class across 16 CRITICAL/HIGH rows until
   * the review report surfaced it. Use `subclassEquals` for short acronyms.
   */
  subclassIncludes?: string[];
  /** Exact (case-insensitive) match against `record.subclass`. */
  subclassEquals?: string[];
  denySlugs?: string[];
};

export type LexiconTerm = {
  id: string;
  surfaces: string[];
  kind: LexiconTermKind;
  select?: CatalogueSelector;
  note?: string;
};

const CATALOGUE_TERMS: LexiconTerm[] = [
  {
    id: "benzodiazepines",
    surfaces: ["benzodiazepines", "benzodiazepine", "benzos", "benzo"],
    kind: "catalogue",
    select: { classes: ["Benzodiazepine"], denySlugs: ["clozapine", "olanzapine-wafer-odt"] },
  },
  {
    id: "opioids",
    surfaces: ["opioids", "opioid", "opioid analgesia", "opiates", "full agonists"],
    kind: "catalogue",
    select: { subclassIncludes: ["Opioid"], denySlugs: ["naltrexone", "naloxone", "loperamide"] },
  },
  { id: "ssris", surfaces: ["ssris", "ssri"], kind: "catalogue", select: { subclassIncludes: ["SSRI"] } },
  { id: "snris", surfaces: ["snris", "snri"], kind: "catalogue", select: { subclassIncludes: ["SNRI"] } },
  {
    id: "maois",
    surfaces: ["maois", "maoi", "monoamine oxidase inhibitors"],
    kind: "catalogue",
    select: { subclassIncludes: ["MAOI"] },
  },
  {
    id: "tcas",
    surfaces: ["tcas", "tca", "tricyclics", "tricyclic antidepressants", "anticholinergic tcas"],
    kind: "catalogue",
    // `dosulepin`, not `dothiepin`: same drug, and the catalogue keys it on the
    // current INN. The old spelling matched no record, so a TCA the catalogue
    // marks FATAL in overdose fired none of this term's 20 CRITICAL/HIGH rows.
    // tests/medication-interaction-lexicon-coverage.test.ts now fails on any slug
    // that resolves to nothing, so a dead selector cannot ship again.
    select: { slugs: ["amitriptyline", "nortriptyline", "imipramine", "clomipramine", "doxepin", "dosulepin"] },
  },
  {
    id: "antipsychotics",
    surfaces: ["antipsychotics", "antipsychotic"],
    kind: "catalogue",
    select: { classes: ["Antipsychotic", "LAI Antipsychotic"] },
  },
  { id: "nsaids", surfaces: ["nsaids", "nsaid"], kind: "catalogue", select: { subclassIncludes: ["NSAID"] } },
  {
    id: "beta-blockers",
    surfaces: ["beta-blockers", "beta blockers", "beta-blocker", "beta blocker", "non-selective beta-blockers"],
    kind: "catalogue",
    select: { subclassIncludes: ["Beta Blocker", "Beta-Blocker"] },
  },
  {
    id: "acei",
    surfaces: ["acei", "aceis", "ace inhibitors", "ace inhibitor"],
    kind: "catalogue",
    select: { subclassIncludes: ["ACE Inhibitor"] },
  },
  // Exact, not substring: "ARB" is a substring of "Carbapenem", which put
  // ertapenem and meropenem in the ARB class across 16 CRITICAL/HIGH rows.
  { id: "arbs", surfaces: ["arbs", "arb"], kind: "catalogue", select: { subclassEquals: ["ARB"] } },
  {
    id: "diuretics",
    surfaces: ["diuretics", "diuretic"],
    kind: "catalogue",
    select: { subclassIncludes: ["Diuretic"] },
  },
  {
    id: "thiazide-diuretics",
    surfaces: ["thiazide diuretics", "thiazides", "thiazide"],
    kind: "catalogue",
    select: { subclassIncludes: ["Thiazide"] },
  },
  {
    id: "loop-diuretics",
    surfaces: ["loop diuretics", "loop diuretic"],
    kind: "catalogue",
    select: { subclassIncludes: ["Loop Diuretic"] },
  },
  {
    id: "antihypertensives",
    surfaces: ["antihypertensives", "antihypertensive"],
    kind: "catalogue",
    select: { classes: ["Antihypertensive"] },
  },
  {
    id: "anticoagulants",
    surfaces: ["anticoagulants", "anticoagulant", "doacs", "doac"],
    kind: "catalogue",
    select: { classes: ["Anticoagulant"], denySlugs: ["aspirin"] },
  },
  {
    id: "antiplatelets",
    surfaces: ["antiplatelets", "antiplatelet"],
    kind: "catalogue",
    select: { subclassIncludes: ["Antiplatelet"] },
  },
  {
    id: "macrolides",
    surfaces: ["macrolides", "macrolide"],
    kind: "catalogue",
    select: { subclassIncludes: ["Macrolide"] },
  },
  {
    id: "fluoroquinolones",
    surfaces: ["fluoroquinolones", "fluoroquinolone", "quinolones"],
    kind: "catalogue",
    select: { subclassIncludes: ["Fluoroquinolone"] },
  },
  {
    id: "aminoglycosides",
    surfaces: ["aminoglycosides", "aminoglycoside"],
    kind: "catalogue",
    select: { subclassIncludes: ["Aminoglycoside"] },
  },
  {
    id: "ppis",
    surfaces: ["ppis", "ppi", "proton pump inhibitors"],
    kind: "catalogue",
    select: { subclassIncludes: ["Proton Pump"] },
  },
  {
    id: "antacids",
    surfaces: ["antacids", "antacid"],
    kind: "catalogue",
    select: { slugs: ["magnesium-oxide", "calcium-carbonate"] },
  },
  {
    id: "statins",
    surfaces: ["statins", "statin"],
    kind: "catalogue",
    select: { subclassIncludes: ["Statin", "HMG"] },
  },
  {
    id: "gabapentinoids",
    surfaces: ["gabapentinoids", "gabapentinoid"],
    kind: "catalogue",
    select: { slugs: ["gabapentin", "pregabalin"] },
  },
  {
    id: "anticholinergics",
    surfaces: ["anticholinergics", "anticholinergic", "atropine-like medicines"],
    kind: "catalogue",
    select: { subclassIncludes: ["Anticholinergic"] },
  },
  {
    id: "antihistamines",
    surfaces: ["antihistamines", "antihistamine"],
    kind: "catalogue",
    select: { subclassIncludes: ["Antihistamine"] },
  },
  {
    id: "corticosteroids",
    surfaces: ["corticosteroids", "corticosteroid", "steroids", "steroid"],
    kind: "catalogue",
    select: { classes: ["Steroid"] },
  },
  {
    // Not a class — a name alias, and the most consequential one in the file.
    //
    // The catalogue record is "Lithium carbonate (IR/SR)", but every row that
    // names lithium as a counterparty just says "Lithium". Drug-name matching
    // derives its surfaces from the record name, and `stripDosageForm` only
    // removes bare trailing tokens, so a parenthesised "(IR/SR)" survives and
    // the generated surfaces are "Lithium carbonate (IR/SR)" and friends —
    // never "Lithium". The result was that lithium was named in eight HIGH
    // rows and reachable from none of them: NSAIDs (diclofenac, meloxicam,
    // naproxen), diuretics (frusemide, hydrochlorothiazide, indapamide),
    // psyllium and iodine. In a psychiatry catalogue that is close to the worst
    // possible drug to be silent about.
    //
    // Fixed here rather than by loosening `stripDosageForm`, because the
    // generic first-word fallback that would catch this also matches "Sodium"
    // in a row about sodium content, "Vitamin" against Vitamin K in the
    // warfarin rows, and "Potassium" against hyperkalaemia prose. A name alias
    // is precise, and unlike a matcher change it shows up in the review sheet
    // for a clinician to confirm.
    id: "lithium",
    surfaces: ["lithium", "lithium carbonate"],
    kind: "catalogue",
    select: { slugs: ["lithium-carbonate-ir-sr"] },
  },
  // No `z-drugs` term. It existed until the review sheet showed it firing on
  // zero catalogue rows: nothing in the corpus says "Z-drugs", "zolpidem-type
  // hypnotics" or even "hypnotics". Keeping a term that can never match implied
  // z-drug coverage the tool does not have.
  //
  // Zolpidem and zopiclone ARE reachable in the catalogue, but they are named
  // only through "CNS depressants" (10 rows) and "sedatives" (2 rows), both of
  // which are deliberately `mechanism` terms — unenumerable, so those rows stay
  // unresolved and the medication holds at grey rather than green. Enumerating
  // them would turn a fail-safe grey into a confident red across a large and
  // ill-defined class, which is a clinical decision, not a lexicon edit.
  // Recorded in the review sheet's coverage section instead.
];

const NON_CATALOGUE_TERMS: LexiconTerm[] = [
  {
    id: "alcohol",
    surfaces: ["alcohol", "alcohol-containing preparations", "ethanol"],
    kind: "nonDrug",
    note: "Substance use, not a prescribable catalogue entry.",
  },
  {
    id: "grapefruit",
    surfaces: ["grapefruit", "grapefruit juice"],
    kind: "nonDrug",
    note: "Dietary CYP3A4 inhibitor.",
  },
  {
    id: "acidic-drinks",
    surfaces: ["acidic drinks", "coffee", "juice", "soft drinks", "cola"],
    kind: "nonDrug",
    note: "Buccal/oral absorption timing, not a drug interaction.",
  },
  {
    id: "smoking",
    surfaces: ["smoking", "cigarette smoke", "tobacco smoke"],
    kind: "nonDrug",
    note: "CYP1A2 induction by polycyclic aromatic hydrocarbons, not by nicotine.",
  },
  { id: "food", surfaces: ["food", "dairy", "milk", "high-fat meals", "tyramine"], kind: "nonDrug", note: "Dietary." },
  {
    id: "st-johns-wort",
    surfaces: ["st john's wort", "st johns wort", "hypericum"],
    kind: "external",
    note: "Herbal CYP3A4 inducer; not stocked in the catalogue.",
  },
  {
    id: "azole-antifungals",
    surfaces: ["ketoconazole", "azoles", "azole antifungals"],
    kind: "external",
    note: "Ketoconazole is not in the catalogue; fluconazole/itraconazole resolve by name.",
  },
  {
    id: "barbiturates",
    surfaces: ["barbiturates", "barbiturate", "phenobarbital", "phenobarbitone"],
    kind: "external",
    note: "Not stocked in the catalogue.",
  },
  {
    id: "antiretrovirals",
    surfaces: ["antiretrovirals", "antiretroviral", "protease inhibitors"],
    kind: "external",
    note: "Ritonavir and relatives are outside the catalogue.",
  },
  {
    id: "cotrimoxazole",
    surfaces: ["bactrim", "co-trimoxazole", "cotrimoxazole"],
    kind: "external",
    note: "Combination product; trimethoprim resolves by name.",
  },
  {
    id: "cyp-inhibitors",
    surfaces: [
      "cyp inhibitors",
      "cyp inhibitor",
      "strong cyp inhibitors",
      "cyp3a4 inhibitors",
      "cyp2d6 inhibitors",
      "cyp1a2 inhibitors",
      "cyp2c19 inhibitors",
    ],
    kind: "mechanism",
    note: "Enumerating inhibitors needs pharmacokinetic data the catalogue does not carry.",
  },
  {
    id: "cyp-inducers",
    surfaces: ["cyp inducers", "cyp inducer", "strong cyp inducers", "cyp3a4 inducers", "enzyme inducers"],
    kind: "mechanism",
    note: "See cyp-inhibitors.",
  },
  {
    id: "cyp-substrates",
    surfaces: ["cyp substrates", "cyp2d6 substrates", "cyp3a4 substrates", "narrow therapeutic index drugs"],
    kind: "mechanism",
  },
  { id: "pgp", surfaces: ["p-gp", "p-gp inhibitors", "p-glycoprotein", "oatp"], kind: "mechanism" },
  {
    id: "cns-depressants",
    surfaces: ["cns depressants", "cns depressant", "sedatives", "sedative", "sedating drugs"],
    kind: "mechanism",
    note: "Deliberately unenumerable: the surface spans benzodiazepines, opioids, antihistamines, alcohol and more.",
  },
  {
    id: "qtc-prolonging",
    surfaces: [
      "qtc prolonging drugs",
      "qt prolonging drugs",
      "concurrent qtc prolonging drugs",
      "qt-prolonging agents",
    ],
    kind: "mechanism",
    note: "The catalogue carries QTc risk per drug but not a curated interacting set.",
  },
  {
    id: "serotonergic",
    surfaces: ["serotonergic drugs", "serotonergic agents", "other serotonergics"],
    kind: "mechanism",
  },
];

export const INTERACTION_LEXICON: readonly LexiconTerm[] = Object.freeze([...CATALOGUE_TERMS, ...NON_CATALOGUE_TERMS]);
export const UNENUMERATED_MECHANISM_TERM_IDS: ReadonlySet<string> = new Set(
  INTERACTION_LEXICON.filter((term) => term.kind === "mechanism").map((term) => term.id),
);

export const LEXICON_SURFACES_BY_LENGTH: readonly { surface: string; term: LexiconTerm }[] = Object.freeze(
  INTERACTION_LEXICON.flatMap((term) =>
    term.surfaces.map((surface) => ({ surface: surface.toLowerCase(), term })),
  ).sort((a, b) => b.surface.length - a.surface.length),
);

export function selectCatalogueSlugs(select: CatalogueSelector, records: readonly MedicationRecord[]): string[] {
  const deny = new Set(select.denySlugs ?? []);
  const matched = new Set<string>();

  for (const slug of select.slugs ?? []) {
    if (records.some((record) => record.slug === slug)) matched.add(slug);
  }
  for (const record of records) {
    const recordClass = (record.class ?? "").toLowerCase();
    const recordSubclass = (record.subclass ?? "").toLowerCase();
    const classHit = (select.classes ?? []).some((value) => value.toLowerCase() === recordClass);
    const subclassHit = (select.subclassIncludes ?? []).some((value) => recordSubclass.includes(value.toLowerCase()));
    const subclassExact = (select.subclassEquals ?? []).some((value) => value.toLowerCase() === recordSubclass);
    if (classHit || subclassHit || subclassExact) matched.add(record.slug);
  }

  for (const slug of deny) matched.delete(slug);
  return Array.from(matched).sort();
}
