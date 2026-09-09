import { extractClinicalValueAtoms, type ClinicalValueAtom } from "@/lib/answer-verification";
import type { ClinicalAskEvidence, ClinicalAskRequest } from "@/lib/clinical-ask/contracts";
import type { ClinicalAskModeProfile } from "@/lib/clinical-ask/mode-profiles";
import { sourceDirectlySupportsAnswerText } from "@/lib/rag/rag-claim-support";
import type { SearchResult } from "@/lib/types";

export type ClinicalClaimKind =
  | "numeric"
  | "duration"
  | "threshold"
  | "criterion"
  | "eligibility"
  | "form_requirement"
  | "contact"
  | "therapy"
  | "narrative";

export type EvidenceCoverageAnnotation = {
  evidenceId: string;
  sectionId: string;
  claimKind: ClinicalClaimKind;
  matchedAtoms: string[];
  unmatchedAtoms: string[];
  directlySupports: boolean;
  conflictsWithEvidenceIds: string[];
};

export type EvidenceSufficiencyInput = {
  profile: ClinicalAskModeProfile;
  request: ClinicalAskRequest;
  evidence: readonly ClinicalAskEvidence[];
  coverage: readonly EvidenceCoverageAnnotation[];
};

export type EvidenceSufficiencyDecision = {
  sufficient: boolean;
  coveredSectionIds: string[];
  missingSectionIds: string[];
  unresolvedConflictIds: string[];
  uncoveredRequestAtoms: string[];
  externalFallbackReason: "coverage_gap" | "needs_review" | "stale_or_unknown" | "conflict" | null;
};

function requestSupportText(request: ClinicalAskRequest) {
  const context = Object.values(request.confirmedContext).flatMap((value) =>
    Array.isArray(value) ? value : value ? [value] : [],
  );
  return [request.question, ...context].filter(Boolean).join(" ");
}

function atomKey(atom: ClinicalValueAtom) {
  return [
    atom.kind,
    atom.comparator ?? "",
    atom.canonicalValue,
    atom.canonicalUnit ?? "",
    atom.denominatorUnit ?? "",
    atom.denominatorTime ?? "",
    atom.denominatorWeight ?? "",
    atom.route ?? "",
    atom.frequency ?? "",
  ].join("|");
}

function atomLabel(atom: ClinicalValueAtom) {
  return atom.rawText.trim();
}

function claimKind(text: string, atoms: readonly ClinicalValueAtom[]): ClinicalClaimKind {
  if (/\b(?:duration|week|month|year|day|hour|minute)s?\b/i.test(text)) return "duration";
  if (/\b(?:threshold|cut-?off|score|at least|at most|greater than|less than)\b/i.test(text)) return "threshold";
  if (/\b(?:criterion|criteria|diagnos(?:is|tic))\b/i.test(text)) return "criterion";
  if (/\b(?:eligib|qualif|accepts? referrals?)\b/i.test(text)) return "eligibility";
  if (/\b(?:form|required field|signature|submit|submission|authoris)\b/i.test(text)) return "form_requirement";
  if (/\b(?:contact|phone|telephone|email|address)\b/i.test(text)) return "contact";
  if (/\b(?:therapy|psychotherapy|intervention|treatment)\b/i.test(text)) return "therapy";
  return atoms.length > 0 ? "numeric" : "narrative";
}

function minimalSearchResult(evidence: ClinicalAskEvidence): SearchResult {
  return {
    id: evidence.id,
    document_id: evidence.id,
    title: evidence.title,
    file_name: evidence.title,
    page_number: null,
    chunk_index: 0,
    section_heading: null,
    content: evidence.extract,
    image_ids: [],
    images: [],
    similarity: 0,
  };
}

export function annotateEvidenceCoverage(
  profile: ClinicalAskModeProfile,
  request: ClinicalAskRequest,
  evidence: readonly ClinicalAskEvidence[],
): EvidenceCoverageAnnotation[] {
  const supportText = requestSupportText(request);
  const requiredAtoms = extractClinicalValueAtoms(supportText);
  const kind = claimKind(supportText, requiredAtoms);
  return evidence.flatMap((item) => {
    const sourceAtoms = new Set(extractClinicalValueAtoms(item.extract).map(atomKey));
    const matchedAtoms = requiredAtoms.filter((atom) => sourceAtoms.has(atomKey(atom))).map(atomLabel);
    const unmatchedAtoms = requiredAtoms.filter((atom) => !sourceAtoms.has(atomKey(atom))).map(atomLabel);
    const directlySupports =
      unmatchedAtoms.length === 0 && sourceDirectlySupportsAnswerText(supportText, minimalSearchResult(item));
    return profile.sectionOrder.map((sectionId) => ({
      evidenceId: item.id,
      sectionId,
      claimKind: kind,
      matchedAtoms,
      unmatchedAtoms,
      directlySupports,
      conflictsWithEvidenceIds: [],
    }));
  });
}

export function assessEvidenceSufficiency(input: EvidenceSufficiencyInput): EvidenceSufficiencyDecision {
  const evidenceById = new Map(input.evidence.map((item) => [item.id, item]));
  const coveredSectionIds = input.profile.sectionOrder.filter((sectionId) =>
    input.coverage.some((annotation) => annotation.sectionId === sectionId && annotation.directlySupports),
  );
  const missingSectionIds = input.profile.sectionOrder.filter((sectionId) => !coveredSectionIds.includes(sectionId));
  const unresolvedConflictIds = [
    ...new Set(input.coverage.flatMap((annotation) => annotation.conflictsWithEvidenceIds)),
  ];
  const requiredAtoms = extractClinicalValueAtoms(requestSupportText(input.request));
  const matchedAtomLabels = new Set(
    input.coverage.filter((annotation) => annotation.directlySupports).flatMap((annotation) => annotation.matchedAtoms),
  );
  const uncoveredRequestAtoms = requiredAtoms.map(atomLabel).filter((atom) => !matchedAtomLabels.has(atom));
  const supportingEvidence = input.coverage
    .filter((annotation) => annotation.directlySupports)
    .map((annotation) => evidenceById.get(annotation.evidenceId))
    .filter((item): item is ClinicalAskEvidence => Boolean(item));
  const hasReviewedSupport = supportingEvidence.some((item) => item.reviewState === "reviewed");
  const onlyNeedsReview =
    supportingEvidence.length > 0 && supportingEvidence.every((item) => item.reviewState === "needs_review");
  const onlyUnknown =
    supportingEvidence.length > 0 && supportingEvidence.every((item) => item.reviewState === "unknown");

  let externalFallbackReason: EvidenceSufficiencyDecision["externalFallbackReason"] = null;
  if (unresolvedConflictIds.length > 0) externalFallbackReason = "conflict";
  else if (missingSectionIds.length > 0 || uncoveredRequestAtoms.length > 0) externalFallbackReason = "coverage_gap";
  else if (onlyNeedsReview) externalFallbackReason = "needs_review";
  else if (onlyUnknown) externalFallbackReason = "stale_or_unknown";

  return {
    sufficient:
      missingSectionIds.length === 0 &&
      uncoveredRequestAtoms.length === 0 &&
      unresolvedConflictIds.length === 0 &&
      hasReviewedSupport,
    coveredSectionIds,
    missingSectionIds,
    unresolvedConflictIds,
    uncoveredRequestAtoms,
    externalFallbackReason,
  };
}
