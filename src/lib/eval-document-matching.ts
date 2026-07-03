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

const clinicalDocumentAliases: Record<string, string[]> = {
  ActiveCommunityPtED: [
    "Active Community Patients in the Emergency Department",
    "Active Community Patients Emergency Department",
  ],
  AdmissionCommunityPts: ["Admission of Community Patients", "Admission Community Patients"],
  AgitationArousalPharmaMgt: [
    "Agitation and Arousal Pharmacological Management",
    "Pharmacological Management of Acute Agitation and Arousal",
    "Medication for Agitation and Arousal",
    "Mental Health Pharmacological Management of Agitation and Arousal",
  ],
  AssessmentDocumentation: ["Assessment Documentation", "Clinical Assessment", "Mental Health Assessment"],
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
  MetabolicScreening: ["Metabolic Screening", "Metabolic Monitoring", "Physical Health Monitoring"],
  MHATMHCTTreatmentTeamProcess: ["Mental Health Treatment Team Process", "Treatment Team Process", "MHAT", "MHCT"],
  NeurolepticSideEffect: ["Neuroleptic Side Effects", "Neuroleptic Side Effect", "Neuroleptic Effects"],
  NOCC: ["NOCC", "National Outcomes and Casemix Collection", "Outcome Measures Completion"],
  PtSafetyPlan: ["Patient Safety Plan", "Safety Planning", "Safety Plan"],
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

export function expectedFileCoverage(
  expectedFiles: string[],
  sources: Array<Pick<SearchResult, "file_name" | "title">>,
  limit = 3,
): ExpectedFileCoverage {
  const topFiles = sources.slice(0, limit).map(resultDocumentText);
  const matchedFiles = expectedFiles.filter((expected) =>
    documentExpectationAlternatives(expected).some((alternative) =>
      topFiles.some((file) => file.includes(alternative)),
    ),
  );

  return {
    expectedFiles,
    matchedFiles,
    missingFiles: expectedFiles.filter((expected) => !matchedFiles.includes(expected)),
    anyHit: matchedFiles.length > 0,
    allHit: expectedFiles.length > 0 && matchedFiles.length === expectedFiles.length,
  };
}
