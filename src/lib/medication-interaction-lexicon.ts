// Curated counterparty lexicon for the drug-interaction index.
//
// The medication catalogue's `Key Interactions` rows are prose, not structured
// drug pairs: "CRITICAL — MAOIs, Tramadol, Tapentadol, St John's Wort. Massive
// risk of Serotonin Syndrome." Roughly 58% of rows name a catalogue drug
// literally; the rest name a class ("NSAIDs", "CNS depressants"), a mechanism
// ("CYP3A4 inhibitors"), or something that is not a medicine at all ("alcohol",
// "grapefruit juice", "smoking").
//
// This module is the hand-maintained source of truth that turns those surface
// terms into catalogue targets. It is deliberately NOT derived by substring
// matching, because substring matching is wrong in ways that matter clinically:
//
//   - Clozapine's subclass is "SGA / Dibenzodiazepine" and olanzapine's is
//     "SGA / Thienobenzodiazepine". Both contain "benzodiazepine"; neither is a
//     benzodiazepine. The real benzodiazepines are `class === "Benzodiazepine"`.
//   - Naltrexone's subclass is "Opioid Antagonist". It is an opioid *blocker*,
//     not an opioid, and must never satisfy the term "opioids".
//   - The catalogue spells beta blockers both "Beta Blocker" and "Beta-Blocker".
//
// Every predicate therefore carries an explicit `denySlugs` escape hatch, and
// `tests/medication-interaction-lexicon-coverage.test.ts` pins the two traps
// above by name so a future edit cannot quietly reintroduce them.
//
// Resolution outcomes are three-valued on purpose — see `LexiconTermKind`.

import type { MedicationRecord } from "@/lib/medications";

/**
 * How a surface term resolves.
 *
 * - `catalogue` — resolves to one or more of the 328 catalogue medications, so
 *   it can genuinely match a patient's entered medication list.
 * - `external` — a real drug/class that is deliberately outside this catalogue
 *   (ketoconazole, St John's Wort, barbiturates). A patient's list is
 *   catalogue-only by construction, so this can never match — but it is a
 *   *known* quantity, not a parsing failure, and so does not force the grey
 *   "needs manual review" verdict.
 * - `nonDrug` — not a medicine (alcohol, grapefruit, coffee, smoking, dietary
 *   timing). Must never produce a patient-medication match. Still rendered as
 *   static content on the medication page.
 * - `mechanism` — a pharmacokinetic class we cannot enumerate from catalogue
 *   data ("CYP3A4 inhibitors", "P-gp inhibitors"). Deliberately UNRESOLVED: a
 *   row whose only counterparty is a bare mechanism forces the grey verdict,
 *   because it could include catalogue drugs we have not enumerated.
 */
export type LexiconTermKind = "catalogue" | "external" | "nonDrug" | "mechanism";

export type CatalogueSelector = {
  /** Explicit catalogue slugs. */
  slugs?: string[];
  /** Match on `record.class` (exact, case-insensitive). */
  classes?: string[];
  /** Match on `record.subclass` (substring, case-insensitive). */
  subclassIncludes?: string[];
  /** Removed after the selector runs — the trap guard. Always wins. */
  denySlugs?: string[];
};

export type LexiconTerm = {
  /** Canonical id, used in the generated index and in test pins. */
  id: string;
  /** Surface forms found in the prose. Matched whole-word, case-insensitive. */
  surfaces: string[];
  kind: LexiconTermKind;
  /** Required when `kind === "catalogue"`. */
  select?: CatalogueSelector;
  /** Why this term is external/nonDrug/mechanism — kept for auditability. */
  note?: string;
};

// ---------------------------------------------------------------------------
// Catalogue classes
// ---------------------------------------------------------------------------

const CATALOGUE_TERMS: LexiconTerm[] = [
  {
    id: "benzodiazepines",
    surfaces: ["benzodiazepines", "benzodiazepine", "benzos", "benzo"],
    kind: "catalogue",
    // `class`, NOT a subclass substring — see the Dibenzodiazepine trap above.
    select: { classes: ["Benzodiazepine"], denySlugs: ["clozapine", "olanzapine-wafer-odt"] },
  },
  {
    id: "opioids",
    surfaces: ["opioids", "opioid", "opioid analgesia", "opiates", "full agonists"],
    kind: "catalogue",
    select: {
      subclassIncludes: ["Opioid"],
      // Antagonists block opioid receptors; they are not opioids.
      denySlugs: ["naltrexone", "naloxone"],
    },
  },
  {
    id: "ssris",
    surfaces: ["ssris", "ssri"],
    kind: "catalogue",
    select: { subclassIncludes: ["SSRI"] },
  },
  {
    id: "snris",
    surfaces: ["snris", "snri"],
    kind: "catalogue",
    select: { subclassIncludes: ["SNRI"] },
  },
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
    select: { slugs: ["amitriptyline", "nortriptyline", "imipramine", "clomipramine", "doxepin", "dothiepin"] },
  },
  {
    id: "antipsychotics",
    surfaces: ["antipsychotics", "antipsychotic"],
    kind: "catalogue",
    select: { classes: ["Antipsychotic", "LAI Antipsychotic"] },
  },
  {
    id: "nsaids",
    surfaces: ["nsaids", "nsaid"],
    kind: "catalogue",
    select: { subclassIncludes: ["NSAID"] },
  },
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
  {
    id: "arbs",
    surfaces: ["arbs", "arb"],
    kind: "catalogue",
    select: { subclassIncludes: ["ARB"] },
  },
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
    id: "z-drugs",
    surfaces: ["z-drugs", "z drugs", "zolpidem-type hypnotics"],
    kind: "catalogue",
    select: { subclassIncludes: ["Z-Drug"] },
  },
];

// ---------------------------------------------------------------------------
// Non-catalogue terms
// ---------------------------------------------------------------------------

const NON_CATALOGUE_TERMS: LexiconTerm[] = [
  // --- Not medicines. Never a patient-medication match. ---
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
  {
    id: "food",
    surfaces: ["food", "dairy", "milk", "high-fat meals", "tyramine"],
    kind: "nonDrug",
    note: "Dietary.",
  },

  // --- Real drugs deliberately outside this catalogue. ---
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

  // --- Mechanism classes we cannot enumerate. Force the grey verdict. ---
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
  {
    id: "pgp",
    surfaces: ["p-gp", "p-gp inhibitors", "p-glycoprotein", "oatp"],
    kind: "mechanism",
  },
  {
    id: "cns-depressants",
    surfaces: ["cns depressants", "cns depressant", "sedatives", "sedative", "sedating drugs"],
    kind: "mechanism",
    note:
      "Deliberately unenumerable: the surface spans benzodiazepines, opioids, " +
      "antihistamines, alcohol and more. Rows that mean a specific class name it.",
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

/** Surfaces sorted longest-first so "thiazide diuretics" wins over "diuretics". */
export const LEXICON_SURFACES_BY_LENGTH: readonly { surface: string; term: LexiconTerm }[] = Object.freeze(
  INTERACTION_LEXICON.flatMap((term) =>
    term.surfaces.map((surface) => ({ surface: surface.toLowerCase(), term })),
  ).sort((a, b) => b.surface.length - a.surface.length),
);

/** Resolve a catalogue selector against the medication catalogue. */
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
    if (classHit || subclassHit) matched.add(record.slug);
  }

  for (const slug of deny) matched.delete(slug);
  return Array.from(matched).sort();
}
