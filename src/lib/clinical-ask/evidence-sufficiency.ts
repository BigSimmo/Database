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

/**
 * The dimension a section asserts, as the words a passage would have to contain
 * to be evidence FOR that section rather than merely relevant to the question.
 *
 * `annotateEvidenceCoverage` used to compute one `directlySupports` verdict
 * against the whole request and map it onto every section in `sectionOrder`. So
 * a passage stating a duration threshold was recorded as direct support for
 * impairment and for exclusions too, every section came back covered, and the
 * answer was declared sufficient on a single passage that spoke to one of six
 * things it claimed to establish.
 *
 * Only sections that assert a specific dimension appear here. A section absent
 * from this table is request-scoped — it restates or frames the question
 * (`candidate_mapping`, `potential_matches`) or reports what is missing or
 * contradicted (`missing_information`, `differential_gaps`, `evidence_against`),
 * and a gap section is not something a source is cited FOR. Those keep the
 * request-level verdict, which is the right test for them.
 *
 * A cue that is too narrow leaves a section uncovered, which seeks corroboration;
 * one that is too broad is no worse than the behaviour this replaces. Both
 * failure directions are safe, which is why a lexical cue is enough here and no
 * cue is allowed to turn an unsupported section into a supported one on its own:
 * request-level support is still required as well.
 */
const SECTION_TOPIC_CUES: Readonly<Record<string, RegExp>> = {
  duration: /\b(?:durat|lasts?\b|lasted\b|lasting\b|persist|weeks?\b|months?\b|years?\b|days?\b|hours?\b|minutes?\b|at least \d)/i,
  impairment: /\b(?:impair|function|distress|disabilit|interfere|occupational|social)/i,
  exclusions: /\b(?:exclu|not better explained|ruled? out\b|attributable|due to another|never been|absence of)/i,
  eligibility: /\b(?:eligib|accepts? referral|accepting referral|inclusion|exclusion|age range|catchment|qualif)/i,
  access_pathway: /\b(?:referr|pathway|access|intake|triage|how to (?:get|obtain)|contact|self-refer)/i,
  jurisdiction_stage: /\b(?:jurisdiction|states?\b|territor|act\b|section \d|schedule|stage|commonwealth)/i,
  prerequisites: /\b(?:prerequisite|before\b|prior to\b|must (?:first|already)|required?\b|requires\b|precondition)/i,
  responsibility: /\b(?:responsib|who (?:may|can|must)|authoris|delegat|practitioner|clinician|officer|roles?\b)/i,
  submission_pathway: /\b(?:submit|submission|lodge|sends?\b|returned? to\b|upload|forwarded? to\b|files?\b|filed\b)/i,
  purpose: /\b(?:purpose|used to\b|is for\b|intended|in order to\b|enables?\b)/i,
  cautions: /\b(?:caution|contraindicat|adverse|side.effect|risk|warning|monitor|avoid|not recommended)/i,
  practical_requirements: /\b(?:sessions?\b|training|supervis|resource|costs?\b|fund|frequency|per week\b|deliver)/i,
  population_setting_fit: /\b(?:adults?\b|child|adolescen|older\b|inpatient|outpatient|community|setting|population|aged?\b)/i,
  base_diagnosis_applicability: /\b(?:applies\b|applicable\b|only (?:in|for|when)\b|requires the diagnosis|specifier for)/i,
  must_not_miss: /\b(?:emergenc|urgent|life.threatening|red flag|must not (?:be )?miss|deteriorat|immediate)/i,
  discriminators: /\b(?:distinguish|differentiat|discriminat|versus\b|unlike\b|in contrast\b|rather than\b|whereas\b)/i,
  incompatibilities: /\b(?:incompatib|cannot (?:be|co-?occur)|mutually exclusive|not (?:be )?(?:used|applied) with)/i,
};

function sectionAddressed(sectionId: string, extract: string) {
  const cue = SECTION_TOPIC_CUES[sectionId];
  // No cue means the section is request-scoped, so the request-level verdict is
  // already the right answer and nothing further is required of the passage.
  return cue ? cue.test(extract) : true;
}

/**
 * Two supporting passages that state different values of the same measurable
 * thing. `conflictsWithEvidenceIds` was hard-coded to an empty array, so a
 * source saying two weeks and a source saying four weeks were both counted as
 * support and the answer was declared sufficient over the disagreement.
 *
 * The comparison is deliberately narrow: same atom kind, same unit, different
 * canonical value. Different units, different kinds, or a value one source
 * simply does not mention are not conflicts — they are different statements, and
 * treating them as contradictions would send every multi-source answer to the
 * external path for nothing.
 */
function conflictingEvidenceIds(
  item: ClinicalAskEvidence,
  itemAtoms: readonly ClinicalValueAtom[],
  others: ReadonlyArray<{ evidence: ClinicalAskEvidence; atoms: readonly ClinicalValueAtom[] }>,
) {
  const conflicts = new Set<string>();
  for (const other of others) {
    if (other.evidence.id === item.id) continue;
    for (const atom of itemAtoms) {
      for (const candidate of other.atoms) {
        if (candidate.kind !== atom.kind) continue;
        if ((candidate.canonicalUnit ?? null) !== (atom.canonicalUnit ?? null)) continue;
        if (candidate.canonicalValue === atom.canonicalValue) continue;
        conflicts.add(other.evidence.id);
      }
    }
  }
  return [...conflicts];
}

export function annotateEvidenceCoverage(
  profile: ClinicalAskModeProfile,
  request: ClinicalAskRequest,
  evidence: readonly ClinicalAskEvidence[],
): EvidenceCoverageAnnotation[] {
  const supportText = requestSupportText(request);
  const requiredAtoms = extractClinicalValueAtoms(supportText);
  const kind = claimKind(supportText, requiredAtoms);

  const scored = evidence.map((item) => {
    const atoms = extractClinicalValueAtoms(item.extract);
    const sourceAtoms = new Set(atoms.map(atomKey));
    const matchedAtoms = requiredAtoms.filter((atom) => sourceAtoms.has(atomKey(atom))).map(atomLabel);
    const unmatchedAtoms = requiredAtoms.filter((atom) => !sourceAtoms.has(atomKey(atom))).map(atomLabel);
    const supportsRequest =
      unmatchedAtoms.length === 0 && sourceDirectlySupportsAnswerText(supportText, minimalSearchResult(item));
    return { evidence: item, atoms, matchedAtoms, unmatchedAtoms, supportsRequest };
  });

  // Only passages that actually support the request can contradict one another.
  // An unrelated passage carrying a different number is not a disagreement.
  const supporting = scored.filter((entry) => entry.supportsRequest);

  return scored.flatMap((entry) => {
    const conflictsWithEvidenceIds = entry.supportsRequest
      ? conflictingEvidenceIds(entry.evidence, entry.atoms, supporting)
      : [];
    return profile.sectionOrder.map((sectionId) => ({
      evidenceId: entry.evidence.id,
      sectionId,
      claimKind: kind,
      matchedAtoms: entry.matchedAtoms,
      unmatchedAtoms: entry.unmatchedAtoms,
      directlySupports: entry.supportsRequest && sectionAddressed(sectionId, entry.evidence.extract),
      conflictsWithEvidenceIds,
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
  // A mixture of needs_review and unknown used to satisfy neither `every` test
  // and fell through to a null reason, so the orchestrator had no ground to seek
  // corroboration even though nothing behind the answer had been reviewed. The
  // reason now follows from the absence of reviewed support, and names whichever
  // state actually dominates so the reason stays informative.
  const unreviewedSupport = supportingEvidence.length > 0 && !hasReviewedSupport;
  const anyNeedsReview = supportingEvidence.some((item) => item.reviewState === "needs_review");

  let externalFallbackReason: EvidenceSufficiencyDecision["externalFallbackReason"] = null;
  if (unresolvedConflictIds.length > 0) externalFallbackReason = "conflict";
  else if (missingSectionIds.length > 0 || uncoveredRequestAtoms.length > 0) externalFallbackReason = "coverage_gap";
  else if (unreviewedSupport) externalFallbackReason = anyNeedsReview ? "needs_review" : "stale_or_unknown";

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
