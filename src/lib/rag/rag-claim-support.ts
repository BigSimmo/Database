import { extractClinicalValueAtoms, type ClinicalValueAtom } from "@/lib/answer-verification";
import { SOURCE_BACKED_REVIEW_FALLBACK_REASON } from "@/lib/rag/rag-routing";
import type { CitationProvenance, EvidenceAssessment, RagAnswer, SearchResult, SupportedClaim } from "@/lib/types";

const acceptedProvenance = new Set<CitationProvenance>([
  "model_selected",
  "section_selected",
  "exact_quote",
  "deterministic_support",
]);

const highRiskPattern =
  /\b(?:contraindicat(?:ed|ion)?|must\s+not|do\s+not\s+use|withhold|cease|stop|discontinue|continue|do\s+not\s+stop|urgent(?:ly)?|immediate(?:ly)?|emergency|pregnan(?:cy|t)|renal|hepatic|dose|dosage|route|oral(?:ly)?|intramuscular(?:ly)?|subcutaneous(?:ly)?|sublingual(?:ly)?|intravenous(?:ly)?|\bim\b|\bpo\b|daily|weekly|hourly|nightly|fortnightly|monthly|threshold|cut-?off|monitor(?:ing)?|repeat|review interval|mg|mcg|mmol|x10)\b/i;

const entityPattern =
  /\b(?:clozapine|lithium|valproate|sodium valproate|olanzapine|quetiapine|risperidone|aripiprazole|haloperidol|lamotrigine|carbamazepine|fluoxetine|sertraline|escitalopram|venlafaxine|drug\s+[a-z])\b/gi;

const topicStopwords = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "is",
  "are",
  "be",
  "when",
  "below",
  "above",
  "at",
  "do",
  "not",
  "must",
  "use",
  "give",
  "includes",
  "include",
  "offers",
  "source",
]);

const triggerTopicStopwords = new Set([
  "clinical",
  "clinically",
  "develop",
  "developed",
  "developing",
  "develops",
  "indicated",
  "indication",
  "necessary",
  "needed",
  "occur",
  "occurred",
  "occurring",
  "occurs",
  "patient",
  "patients",
  "present",
  "presenting",
  "required",
  "sign",
  "signs",
  "symptom",
  "symptoms",
]);

function cleanText(value: string) {
  return value
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitClaims(value: string) {
  // Preserve model-authored line boundaries until after splitting. Calling
  // cleanText first collapses newlines, which can merge independently cited
  // bullet claims into one compound claim that no single chunk can support.
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[*_`#>]/g, "")
    .split(/(?<=[.!?])(?:[ \t]+|\n+)|\n+/)
    .map(cleanText)
    .filter((claim) => claim.length >= 8)
    .slice(0, 24);
}

function splitComparisonClaims(value: string) {
  return splitClaims(value)
    .flatMap((claim) => claim.split(/\s*;\s*|\s+(?:whereas|while)\s+/i))
    .map((claim) => claim.trim())
    .filter((claim) => claim.length >= 8)
    .slice(0, 24);
}

function atomKey(atom: ClinicalValueAtom) {
  return [
    atom.kind,
    atom.canonicalValue,
    atom.comparator ?? "",
    atom.canonicalUnit ?? "",
    atom.denominatorUnit ?? "",
    atom.denominatorTime ?? "",
    atom.denominatorWeight ?? "",
    atom.route ?? "",
    atom.frequency ?? "",
  ].join("|");
}

function entities(value: string) {
  return new Set(Array.from(value.toLowerCase().matchAll(entityPattern), (match) => match[0].replace(/\s+/g, " ")));
}

function topicTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4 && !topicStopwords.has(token) && !/^\d/.test(token)),
  );
}

function highRiskTriggerTokens(value: string) {
  const tokens = new Set<string>();
  const triggerPatterns = [
    /\b(?:when|if|unless|during|after|before)\b\s*([^,;.!?]+?)(?=\s*,|\s+\b(?:administer|avoid|cease|continue|discontinue|escalate|give|prescribe|start|stop|use|withhold)\b|[;.!?]|$)/gi,
    /\b(?:administer|avoid|cease|continue|discontinue|escalate|give|prescribe|start|stop|use|withhold)\b[^,;.!?]{0,80}?\bfor\b\s*([^,;.!?]+?)(?=\s+\bfor\b|\s*,|[;.!?]|$)/gi,
  ];
  for (const pattern of triggerPatterns) {
    for (const match of value.matchAll(pattern)) {
      for (const token of topicTokens(match[1] ?? "")) {
        if (!triggerTopicStopwords.has(token)) tokens.add(token);
      }
    }
  }
  return tokens;
}

function compatibleHighRiskTrigger(claim: string, evidence: string) {
  if (!isHighRiskClaim(claim)) return true;
  const triggerTokens = highRiskTriggerTokens(claim);
  if (triggerTokens.size === 0) return true;
  const evidenceTopics = topicTokens(evidence);
  return [...triggerTokens].every((token) => evidenceTopics.has(token));
}

function isHighRiskClaim(value: string) {
  return highRiskPattern.test(value) || extractClinicalValueAtoms(value).length > 0;
}

type ActionPolarity =
  | "do_not_stop"
  | "stop"
  | "continue"
  | "do_not_use"
  | "use_allowed"
  | "urgent"
  | "urgent_not_required"
  | "routine"
  | "none";

function hasNegatedUrgency(value: string) {
  return /\b(?:not urgent|no urgent escalation|urgent escalation (?:is )?not required|urgent escalation (?:is )?unnecessary)\b/i.test(
    value,
  );
}

function actionPolarity(value: string): ActionPolarity {
  if (/\b(?:(?:do|must|should)\s+not|never)\s+(?:stop|cease|discontinue)\b/i.test(value)) {
    return "do_not_stop";
  }
  if (/\b(?:stop|cease|discontinue|withhold)\b/i.test(value)) return "stop";
  if (/\bcontinue\b/i.test(value)) return "continue";
  if (/\b(?:may|can)\s+(?:be\s+)?use|not\s+contraindicated\b/i.test(value)) return "use_allowed";
  if (/\b(?:contraindicat(?:ed|ion)?|must\s+not|do\s+not\s+use|avoid)\b/i.test(value)) return "do_not_use";
  if (hasNegatedUrgency(value)) return "urgent_not_required";
  if (/\b(?:urgent(?:ly)?|immediate(?:ly)?|emergency)\b/i.test(value)) return "urgent";
  if (/\b(?:next appointment|routine|non-urgent)\b/i.test(value)) return "routine";
  return "none";
}

function compatiblePolarity(claim: string, evidence: string) {
  const expected = actionPolarity(claim);
  if (expected === "none") return true;
  return actionPolarity(evidence) === expected;
}

type SafetyDimension = "pregnancy" | "renal" | "hepatic" | "urgent_escalation" | "urgent_escalation_not_required";

function safetyDimensions(value: string) {
  const dimensions = new Set<SafetyDimension>();
  if (/\bpregnan(?:cy|t)\b/i.test(value)) dimensions.add("pregnancy");
  if (/\b(?:renal|kidney)\b/i.test(value)) dimensions.add("renal");
  if (/\b(?:hepatic|liver)\b/i.test(value)) dimensions.add("hepatic");
  if (hasNegatedUrgency(value)) {
    dimensions.add("urgent_escalation_not_required");
  } else if (/\b(?:immediate(?:ly)?|emergency)\b/i.test(value) || /(?<!non[-\s])\burgent(?:ly)?\b/i.test(value)) {
    dimensions.add("urgent_escalation");
  }
  return dimensions;
}

function compatibleSafetyDimensions(claim: string, evidence: string) {
  const evidenceDimensions = safetyDimensions(evidence);
  return [...safetyDimensions(claim)].every((dimension) => evidenceDimensions.has(dimension));
}

function sourceEvidenceText(source: SearchResult) {
  return [
    source.section_heading,
    source.content,
    source.retrieval_synopsis,
    source.table_facts
      ?.map((fact) =>
        [fact.table_title, fact.row_label, fact.clinical_parameter, fact.threshold_value, fact.action]
          .filter(Boolean)
          .join(" "),
      )
      .join(" "),
    source.index_unit
      ? [source.index_unit.title, source.index_unit.content, JSON.stringify(source.index_unit.metadata ?? {})]
          .filter(Boolean)
          .join(" ")
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function sourceSupportsClaim(claim: string, source: SearchResult) {
  const evidence = sourceEvidenceText(source);
  const claimEntities = entities(claim);
  const evidenceEntities = entities(evidence);
  if (claimEntities.size > 0 && [...claimEntities].some((entity) => !evidenceEntities.has(entity))) return false;
  if (!compatiblePolarity(claim, evidence)) return false;
  if (!compatibleSafetyDimensions(claim, evidence)) return false;
  if (!compatibleHighRiskTrigger(claim, evidence)) return false;

  const evidenceAtoms = new Set(extractClinicalValueAtoms(evidence).map(atomKey));
  if (extractClinicalValueAtoms(claim).some((atom) => !evidenceAtoms.has(atomKey(atom)))) return false;

  const claimTopics = topicTokens(claim);
  const evidenceTopics = topicTokens(evidence);
  const matchedTopics = [...claimTopics].filter((token) => evidenceTopics.has(token)).length;
  return claimTopics.size === 0 || matchedTopics / claimTopics.size >= 0.5;
}

function sourceIsRelated(claim: string, source: SearchResult) {
  const evidence = sourceEvidenceText(source);
  const claimEntities = entities(claim);
  const evidenceEntities = entities(evidence);
  if (claimEntities.size > 0 && [...claimEntities].some((entity) => evidenceEntities.has(entity))) return true;
  const claimTopics = topicTokens(claim);
  const evidenceTopics = topicTokens(evidence);
  return [...claimTopics].some((token) => evidenceTopics.has(token));
}

type ClaimInput = {
  text: string;
  chunkIds: string[];
  provenance: CitationProvenance;
  comparisonEntries?: Array<{ label: string; parameter: string; value: string | null; chunkIds: string[] }>;
  requiresIndividualAttribution?: boolean;
};

function normalizeAttribution(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*:\s*/g, ": ")
    .trim();
}

function attributedEntrySegment(
  claim: string,
  entry: NonNullable<ClaimInput["comparisonEntries"]>[number],
  entries: NonNullable<ClaimInput["comparisonEntries"]>,
) {
  const lowerClaim = claim.toLowerCase();
  const labelToken = `${entry.label.toLowerCase()}:`;
  const labelIndex = lowerClaim.indexOf(labelToken);
  if (labelIndex < 0) return null;
  const start = labelIndex + labelToken.length;
  const boundaries = [lowerClaim.indexOf(";", start)]
    .concat(
      entries
        .filter((candidate) => candidate !== entry)
        .map((candidate) => lowerClaim.indexOf(`${candidate.label.toLowerCase()}:`, start)),
    )
    .filter((index) => index >= start);
  const end = boundaries.length > 0 ? Math.min(...boundaries) : claim.length;
  return claim.slice(start, end).trim();
}

function comparisonClauseHasAttribution(text: string, sources: SearchResult[]) {
  if (entities(text).size > 0) return true;
  const normalized = normalizeAttribution(text);
  return sources.some((source) => {
    const labels = [source.title, source.file_name.replace(/\.[^.]+$/, ""), source.document_id];
    return labels.some((label) => label.length >= 4 && normalized.includes(normalizeAttribution(label)));
  });
}

const clinicalRecommendationPattern =
  /\b(?:administer|avoid|cease|continue|contraindicat(?:ed|ion)?|discontinue|dose|escalat|give|initiat|monitor|recommend|repeat|should|start|stop|urgent|use|withhold|must|may|can)\b/i;

function normalizedGapText(value: string) {
  return value
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isBoundedEvidenceGapSegment(segment: string, parameter: string) {
  const normalized = normalizedGapText(segment);
  const normalizedParameter = normalizedGapText(parameter);
  if (normalized === "no evidence found" || normalized === `no evidence found for ${normalizedParameter}`) {
    return true;
  }
  if (extractClinicalValueAtoms(segment).length > 0 || clinicalRecommendationPattern.test(segment)) return false;
  return true;
}

function comparisonRows(answer: RagAnswer, claim: string) {
  const normalizedClaim = claim.toLowerCase();
  return (answer.comparisonMatrix?.rows ?? []).filter((row) => {
    const parameterTokens = row.parameter
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3);
    return parameterTokens.length > 0 && parameterTokens.every((token) => normalizedClaim.includes(token));
  });
}

function claimInputs(answer: RagAnswer): ClaimInput[] {
  const eligibleCitationIds = (answer.citations ?? [])
    .filter((citation) => acceptedProvenance.has(citation.provenance ?? "model_selected"))
    .map((citation) => citation.chunk_id);
  const scopedInput = (text: string, fallback: string[], provenance: CitationProvenance): ClaimInput => {
    if (!answer.preformatted || answer.responseMode !== "comparison_matrix") {
      return {
        text,
        chunkIds: fallback,
        provenance,
        requiresIndividualAttribution: answer.responseMode === "comparison_matrix",
      };
    }
    const rows = comparisonRows(answer, text);
    const comparisonEntries = rows.flatMap((row) =>
      row.entries.map((entry) => ({
        ...entry,
        parameter: row.parameter,
        label:
          answer.comparisonMatrix?.documents.find((document) => document.documentId === entry.documentId)?.title ??
          entry.documentId,
      })),
    );
    return {
      text,
      chunkIds: [...new Set(comparisonEntries.flatMap((entry) => entry.chunkIds))],
      provenance,
      comparisonEntries,
    };
  };
  const split =
    answer.responseMode === "comparison_matrix" && !answer.preformatted ? splitComparisonClaims : splitClaims;
  const topLevel = split(answer.answer).map((text) => scopedInput(text, eligibleCitationIds, "model_selected"));
  const sections = (answer.answerSections ?? []).flatMap((section) =>
    split(section.body).map((text) => scopedInput(text, section.citation_chunk_ids, "section_selected")),
  );
  return [...topLevel, ...sections];
}

function claimAssessment(
  input: ClaimInput,
  index: number,
  sourceById: Map<string, SearchResult>,
  forceRoutine: boolean,
): SupportedClaim {
  const eligibleSources = input.chunkIds
    .map((id) => sourceById.get(id))
    .filter((source): source is SearchResult => !!source);
  const hasAttribution =
    !input.requiresIndividualAttribution || comparisonClauseHasAttribution(input.text, eligibleSources);
  const directSources = hasAttribution
    ? eligibleSources.filter((source) => sourceSupportsClaim(input.text, source))
    : [];
  const comparisonEntryResults = (input.comparisonEntries ?? []).map((entry) => {
    const segment = attributedEntrySegment(input.text, entry, input.comparisonEntries ?? []);
    if (!segment) return { direct: false, supportingChunkId: null };
    if (entry.value === null) {
      return { direct: isBoundedEvidenceGapSegment(segment, entry.parameter), supportingChunkId: null };
    }
    if (!normalizeAttribution(segment).includes(normalizeAttribution(entry.value))) {
      return { direct: false, supportingChunkId: null };
    }
    const supportingSource = entry.chunkIds
      .map((id) => sourceById.get(id))
      .find((source) => source && sourceSupportsClaim(segment, source));
    return { direct: Boolean(supportingSource), supportingChunkId: supportingSource?.id ?? null };
  });
  const comparisonSupportingChunkIds = comparisonEntryResults
    .map((result) => result.supportingChunkId)
    .filter((id): id is string => Boolean(id));
  const comparisonDirect =
    Boolean(input.comparisonEntries?.length) &&
    comparisonEntryResults.every((result) => result.direct) &&
    comparisonSupportingChunkIds.length > 0;
  const related = eligibleSources.some((source) => sourceIsRelated(input.text, source));
  return {
    claimId: `claim-${index + 1}`,
    text: input.text,
    riskClass: !forceRoutine && isHighRiskClaim(input.text) ? "high_risk" : "routine",
    supportingChunkIds: comparisonDirect ? comparisonSupportingChunkIds : directSources.map((source) => source.id),
    supportStatus: directSources.length || comparisonDirect ? "direct" : related ? "partial" : "unsupported",
  };
}

function evidenceAssessment(source: SearchResult, claims: SupportedClaim[], inputs: ClaimInput[]): EvidenceAssessment {
  const metadata = source.source_metadata;
  const supports = claims.filter((claim) => claim.supportingChunkIds.includes(source.id));
  const mappedInputs = inputs.filter((input) => input.chunkIds.includes(source.id));
  const partial = mappedInputs.some((input) => sourceIsRelated(input.text, source));
  return {
    relevance: source.relevance?.verdict ?? (mappedInputs.length > 0 ? "nearby" : "none"),
    claimSupport: supports.length ? "direct" : partial ? "partial" : "unsupported",
    authority: metadata?.clinical_validation_status ?? "unverified",
    currency: metadata?.document_status ?? "unknown",
    extractionQuality: metadata?.extraction_quality ?? "unknown",
  };
}

export function assessClaimSupport(answer: RagAnswer) {
  const sourceById = new Map(answer.sources.map((source) => [source.id, source]));
  const documentLookupAnswer =
    answer.responseMode === "document_lookup" ||
    answer.queryClass === "document_lookup" ||
    (answer.preformatted &&
      (answer.answerSections?.length ?? 0) > 0 &&
      (answer.answerSections ?? []).every((section) => section.kind === "documentation"));
  const sourceBackedReviewAnswer = (answer.routingReason ?? "").includes(SOURCE_BACKED_REVIEW_FALLBACK_REASON);
  const inputs = claimInputs(answer);
  const claims = inputs.map((input, index) =>
    claimAssessment(input, index, sourceById, Boolean(documentLookupAnswer || sourceBackedReviewAnswer)),
  );
  const evidenceAssessments = Object.fromEntries(
    answer.sources.map((source) => [source.id, evidenceAssessment(source, claims, inputs)]),
  );
  return { claims, evidenceAssessments };
}

export function assessAndEnforceClaimSupport(answer: RagAnswer): RagAnswer {
  const { claims, evidenceAssessments } = assessClaimSupport(answer);
  if (!answer.grounded || answer.confidence === "unsupported" || answer.responseMode === "evidence_gap") {
    return { ...answer, supportedClaims: claims, evidenceAssessments };
  }
  const highRiskGap = claims.some((claim) => claim.riskClass === "high_risk" && claim.supportStatus !== "direct");
  const materialGovernanceGap = claims.some(
    (claim) =>
      claim.riskClass === "high_risk" &&
      claim.supportingChunkIds.some((chunkId) => {
        const assessment = evidenceAssessments[chunkId];
        return assessment?.currency === "outdated" || assessment?.extractionQuality === "poor";
      }),
  );
  if (highRiskGap || materialGovernanceGap) {
    return {
      ...answer,
      answer:
        "The available cited evidence does not directly support every high-risk claim. Review the retrieved source passages before making a clinical decision.",
      grounded: false,
      confidence: "unsupported",
      citations: [],
      answerSections: [],
      quoteCards: [],
      bestSource: null,
      responseMode: "evidence_gap",
      routingMode: "unsupported",
      routingReason: [
        answer.routingReason,
        highRiskGap ? "claim_support_high_risk_gap" : "material_source_governance_gap",
      ]
        .filter(Boolean)
        .join("; "),
      supportedClaims: claims,
      evidenceAssessments,
    };
  }
  const routineGap = claims.some((claim) => claim.supportStatus !== "direct");
  return {
    ...answer,
    confidence: routineGap && answer.confidence === "high" ? "medium" : answer.confidence,
    supportedClaims: claims,
    evidenceAssessments,
  };
}
