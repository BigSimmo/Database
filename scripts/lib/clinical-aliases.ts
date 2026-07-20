// Sanctioned alias tables for golden-eval expectations — the single source of truth shared by
// the live eval gates (scripts/eval-retrieval.ts) and the offline ranking-snapshot builder
// (scripts/build-ranking-snapshot.ts via scripts/lib/ranking-snapshot-builder.ts).
//
// Every entry is deliberate drift absorption for ground-truth labels: a fixture keys a case on a
// pinned document name or clinical term, and the corpus legitimately serves the same content under
// another name. Adding an alias is a clinical-governance change — it widens what counts as a hit
// for both the live gates and the snapshot's relevance grades — so each entry needs the same
// evidence trail as a fixture edit (see the per-entry comments).

/**
 * Document-name aliases, keyed by the fixture's `expectedDocumentSubstrings` entry (verbatim).
 * Values are alternative title/file-name substrings that identify the same clinical document.
 */
export const clinicalDocumentAliases: Record<string, string[]> = {
  AgitationArousalPharmaMgt: [
    "Agitation and Arousal Pharmacological Management",
    "Pharmacological Management of Acute Agitation and Arousal",
    "Medication for Agitation and Arousal",
    // The corpus has two legitimate agitation IM/PO guidelines. Once the full hybrid stack was
    // restored, "Mental Health Pharmacological Management of Agitation and Arousal Guideline (EMHS)"
    // ranks alongside/above MHSP.AgitationArousalPharmaMgt for agitation-med queries. Both are
    // correct sources, so either satisfies the expectation. (Doc crowding/lexical-weighting for the
    // pinned doc is tracked separately as a ranking item, not a retrieval miss.)
    "Pharmacological Management of Agitation and Arousal",
  ],
  AdmissionCommunityPts: ["Admission of Community Patients", "Admission Community Patients"],
  ActiveCommunityPtED: [
    "Active Community Patients in the Emergency Department",
    "Active Community Patients Emergency Department",
  ],
  ClozapinePresAdminMonitor: [
    "Clozapine Prescribing Administration Monitoring",
    "Clozapine Prescribing Administration and Monitoring",
    "Clozapine Prescribing Administering Monitoring",
    "Clozapine Prescribing Administering Monitoring and Capillary Sampling",
  ],
  PtSafetyPlan: ["Patient Safety Plan"],
};

/**
 * Content-term aliases, keyed by the lowercase whitespace-collapsed form of a fixture
 * `expectedContentTerms` entry. Values are equivalent clinical spellings/expansions.
 */
export const clinicalContentAliases: Record<string, string[]> = {
  anc: ["anc", "absolute neutrophil count", "neutrophil", "neutrophils"],
  // The scale's written name is the hyphenated token "CIWA-Ar"; textContainsClinicalTerm is
  // whitespace-delimited, so the bare fixture term can never match it (canary runs #50/#51:
  // the top-5 included the CIWA-Ar dosing-table region yet the content gate reported a miss).
  ciwa: ["ciwa", "ciwa-ar"],
  fbc: ["fbc", "full blood count", "full blood", "wbc", "white blood cell", "white cell"],
  im: ["im", "intramuscular", "intramuscularly"],
  mg: ["mg", "milligram", "milligrams", "dose", "doses"],
  microgram: ["microgram", "micrograms", "mcg", "dose", "doses"],
  po: ["po", "oral", "orally"],
  prn: ["prn", "as required"],
  red: ["red", "red zone", "high risk", "visual alert", "aggression risk"],
  route: ["route", "oral", "orally", "intramuscular", "intramuscularly", "im", "po"],
  threshold: ["threshold", "below", "drops below", "between", "less than"],
  withhold: ["withhold", "withheld", "withholding", "cease", "ceased", "stop", "stopped", "red"],
};

/** The fixture label plus every sanctioned document alias, in match-priority order. */
export function documentLabelAlternatives(label: string): string[] {
  return [label, ...(clinicalDocumentAliases[label] ?? [])];
}

/** The fixture term plus every sanctioned content alias (alias keys are normalized lowercase). */
export function contentTermAlternatives(term: string): string[] {
  const key = term.toLowerCase().replace(/\s+/g, " ").trim();
  return Array.from(new Set([term, ...(clinicalContentAliases[key] ?? [])]));
}
