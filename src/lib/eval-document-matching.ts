import type { SearchResult } from "@/lib/types";

export type ExpectedFileCoverage = {
  expectedFiles: string[];
  matchedFiles: string[];
  missingFiles: string[];
  anyHit: boolean;
  allHit: boolean;
};

export function normalizedDocumentName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// TIERING — deliberately WIDER than scripts/lib/clinical-aliases.ts, and kept separate on
// purpose. This table serves captured-case coverage (rag-eval-cases / eval-utils), where the
// goal is absorbing corpus renames and near-equivalents so auto-captured expectations keep
// matching. The scripts/lib module is the STRICT tier consumed by the zero-tolerance golden
// gates and the ranking-snapshot relevance grades — entries there need a per-entry evidence
// trail. Never bulk-merge this table into the strict tier: looser entries here (e.g.
// "Clozapine GP Shared Care") would let adjacent documents satisfy pinned golden expectations.
const clinicalDocumentAliases: Record<string, string[]> = {
  Acamprosate: ["Acamprosate"],
  ActiveCommunityPtED: [
    "Active Community Patients in the Emergency Department",
    "Active Community Patients Emergency Department",
  ],
  AdmissionCommunityPts: [
    "Admission of Community Patients",
    "Admission Community Patients",
    // Ground-truth widening (user-approved 2026-07-21, eval baseline run #57 triage): the live
    // corpus carries several legitimately on-point admission policies; the NMHS
    // admission-to-discharge pair satisfies the admission expectation for the
    // admission-discharge comparison cases. Deliberately EXCLUDES discharge-only documents
    // (they must not satisfy the admission slot) and the HITH programme policy (too narrow).
    "Admission to Discharge for Community Mental Health",
    "Admission to Discharge for Mental Health Inpatients",
  ],
  AgitationArousalPharmaMgt: [
    "Agitation and Arousal Pharmacological Management",
    "Pharmacological Management of Acute Agitation and Arousal",
    "Medication for Agitation and Arousal",
    "Mental Health Pharmacological Management of Agitation and Arousal",
  ],
  AssessmentDocumentation: ["Assessment Documentation", "Clinical Assessment", "Mental Health Assessment"],
  ADHD: ["ADHD", "Attention Deficit Hyperactivity Disorder"],
  BestPracticePrescription: ["Best Practice Prescription", "Best Practice Prescribing", "Prescription"],
  ClozapinePresAdminMonitor: [
    "Clozapine Prescribing Administration Monitoring",
    "Clozapine Prescribing Administration and Monitoring",
    "Clozapine Prescribing Administering Monitoring",
    "Clozapine Prescribing Administering Monitoring and Capillary Sampling",
    "Clozapine Prescribing",
    "Clozapine Prescribing NMHS",
    "Clozapine GP Shared Care",
    "Clozapine Management by GP",
    "Clozapine Therapy",
  ],
  CommunityHomeVisit: ["Community Home Visit", "Home Visit", "Community Visits"],
  Discharge: [
    "Admission to Discharge for Mental Health Inpatients",
    "Admission to Discharge for Community Mental Health",
    "Referral Admission and Discharge Mental Health Hospital in the Home",
    "Mental Health Hospital in the Home",
    "Mental Health Medically Cleared for Discharge",
    "Mental Health Inpatient Triage to Discharge",
    "ACMHS and OACMHS Triage to Discharge",
    // The synthetic MHSP.Discharge.pdf was superseded by real named discharge documents;
    // "Discharge Planning for Community Patients / Inpatients" is the discharge counterpart
    // that ranks for the admission-vs-discharge comparison, so recognize it as a real hit.
    "Discharge Planning",
  ],
  Duress: ["Duress", "Duress Procedure", "Duress Response"],
  ECTProcedure: ["ECT Procedure", "Electroconvulsive Therapy", "Electroconvulsive Therapy ECT"],
  IllegalSubstances: ["Illegal Substances", "Substances", "Contraband"],
  LongActingInjectable: [
    "Long Acting Injectable",
    "Long-Acting Injectable",
    "Depot",
    "Olanzapine LAI",
    "Long Acting Injectable Antipsychotic",
  ],
  Lithium: ["Lithium", "Lithium Clinical Guideline", "Lithium CAMHS"],
  Metformin: ["Metformin"],
  MetabolicScreening: ["Metabolic Screening", "Metabolic Monitoring", "Physical Health Monitoring"],
  MHATMHCTTreatmentTeamProcess: ["Mental Health Treatment Team Process", "Treatment Team Process", "MHAT", "MHCT"],
  NeurolepticSideEffect: ["Neuroleptic Side Effects", "Neuroleptic Side Effect", "Neuroleptic Effects"],
  NOCC: ["NOCC", "National Outcomes and Casemix Collection", "Outcome Measures Completion"],
  Naltrexone: ["Naltrexone"],
  PtSafetyPlan: ["Patient Safety Plan", "Safety Planning", "Safety Plan"],
  Sertraline: ["Sertraline"],
};

export function documentExpectationAlternatives(expectation: string) {
  const normalizedExpectation = normalizedDocumentName(expectation);
  const compactExpectation = normalizedExpectation.replace(/\s+/g, "");
  const aliasValues = Object.entries(clinicalDocumentAliases).flatMap(([key, values]) => {
    const normalizedKey = normalizedDocumentName(key);
    const compactKey = normalizedKey.replace(/\s+/g, "");
    if (!compactExpectation.includes(compactKey) && !normalizedExpectation.includes(normalizedKey)) return [];
    return values;
  });
  return Array.from(new Set([expectation, ...aliasValues].map(normalizedDocumentName).filter(Boolean)));
}

function resultDocumentText(source: Pick<SearchResult, "file_name" | "title">) {
  return normalizedDocumentName(`${source.title} ${source.file_name}`);
}

type ExpectedFileSource = Pick<SearchResult, "file_name" | "title"> & Partial<Pick<SearchResult, "document_id">>;

function distinctSourceDocuments(sources: ExpectedFileSource[], limit: number) {
  const documents = new Map<string, string>();
  sources.slice(0, limit).forEach((source, index) => {
    const identity =
      normalizedDocumentName(source.document_id ?? "") ||
      normalizedDocumentName(source.file_name) ||
      normalizedDocumentName(source.title) ||
      `source ${index}`;
    const text = resultDocumentText(source);
    const previous = documents.get(identity);
    documents.set(identity, previous ? `${previous} ${text}` : text);
  });
  return [...documents.values()];
}

// Coverage is a one-to-one assignment, not independent substring checks: a broad alias may
// match several expectations, but one retrieved document can provide evidence for only one slot.
// The augmenting-path pass avoids a greedy false miss when a flexible expectation can move to a
// second source and free the only valid source for a narrower expectation.
function matchExpectedFilesToDistinctSources(expectedFiles: string[], sourceDocuments: string[]) {
  const alternatives = expectedFiles.map(documentExpectationAlternatives);
  const sourceForExpected = Array<number>(expectedFiles.length).fill(-1);
  const expectedForSource = Array<number>(sourceDocuments.length).fill(-1);

  function assign(expectedIndex: number, visitedSources: Set<number>): boolean {
    for (let sourceIndex = 0; sourceIndex < sourceDocuments.length; sourceIndex += 1) {
      if (visitedSources.has(sourceIndex)) continue;
      if (!alternatives[expectedIndex]?.some((alternative) => sourceDocuments[sourceIndex]?.includes(alternative))) {
        continue;
      }

      visitedSources.add(sourceIndex);
      const currentExpected = expectedForSource[sourceIndex] ?? -1;
      if (currentExpected !== -1 && !assign(currentExpected, visitedSources)) continue;

      expectedForSource[sourceIndex] = expectedIndex;
      sourceForExpected[expectedIndex] = sourceIndex;
      return true;
    }
    return false;
  }

  expectedFiles.forEach((_, expectedIndex) => {
    assign(expectedIndex, new Set());
  });

  return expectedFiles.filter((_, expectedIndex) => sourceForExpected[expectedIndex] !== -1);
}

export function expectedFileCoverage(
  expectedFiles: string[],
  sources: ExpectedFileSource[],
  limit = 3,
): ExpectedFileCoverage {
  const matchedFiles = matchExpectedFilesToDistinctSources(expectedFiles, distinctSourceDocuments(sources, limit));

  return {
    expectedFiles,
    matchedFiles,
    missingFiles: expectedFiles.filter((expected) => !matchedFiles.includes(expected)),
    anyHit: matchedFiles.length > 0,
    allHit: expectedFiles.length > 0 && matchedFiles.length === expectedFiles.length,
  };
}
