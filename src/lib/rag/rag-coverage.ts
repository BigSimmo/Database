import { evaluateEvidenceCoverageGate } from "@/lib/rag/rag-coverage-gate";
import type { RagCandidateMatchCounts } from "@/lib/rag/rag-contracts";
import { classifyRagQuery, medicationDoseEvidenceQueryIntent } from "@/lib/clinical-search";
import { annotateSearchResults, buildEvidenceRelevance } from "@/lib/evidence-relevance";
import { selectAustralianClinicalContext } from "@/lib/australian-source-priority";
import { evidenceFamilyKeys, siteContentClaimPolicy } from "@/lib/site-content/site-content-registry";
import type { SiteContentRecord } from "@/lib/site-content/site-content-contracts";
import { normalizeClinicalSourceMetadata } from "@/lib/source-metadata";
import {
  resolveLocalAndAustralianEvidence,
  retainCanonicalSourcePolicyConflicts,
  searchResultEligibilityForClaim,
} from "@/lib/source-role-policy";
import type {
  AnswerCoveragePlan,
  ClinicalAmbiguity,
  ClinicalClaimRole,
  RagAnswer,
  RagInsufficiencyReason,
  RagQueryPlan,
  SearchResult,
  SiteContentDomain,
  SiteContentPartitionState,
  SourceCorpusScope,
  SourcePolicyConflict,
  SmartRagAnswerPlan,
} from "@/lib/types";

const knownCorpusScopes = new Set<SourceCorpusScope>([
  "uploaded_local",
  "clinical_kb_site",
  "australian_public",
  "international_supplementary",
]);

const knownSiteDomains = new Set<SiteContentDomain>([
  "services",
  "forms",
  "medications",
  "differentials",
  "specifiers",
  "dsm",
  "formulation",
  "therapies",
  "dictionary",
  "factsheets",
  "calculators",
  "tools",
]);

export type SubquestionEvidenceInput = {
  subquestionId: string;
  selectedChunkIds: readonly string[];
  citedChunkIds: readonly string[];
  /** Explicit output of the existing role/governance selection. Omission fails closed at runtime. */
  eligibleChunkIds: readonly string[];
  /** Explicit direct-support decision for query classes without a canonical evidence gate. */
  support: "direct" | "partial";
  reasonCodes?: readonly string[];
  insufficiencyReason?: RagInsufficiencyReason | null;
};

export type EvaluateAnswerCoverageInput = {
  plan: RagQueryPlan;
  selectedEvidence: readonly SearchResult[];
  evidenceBySubquestion: readonly SubquestionEvidenceInput[];
  conflicts?: readonly SourcePolicyConflict[];
  ambiguity?: ClinicalAmbiguity | null;
  insufficiencyReason?: RagInsufficiencyReason | null;
};

export type CoverageMergeInput = {
  plan: RagQueryPlan;
  candidates: readonly SearchResult[];
  claimRole?: ClinicalClaimRole;
  sourcePolicyConflicts?: readonly SourcePolicyConflict[];
  siteContentState?: SiteContentPartitionState;
  maxPerSubquestion?: number;
  maxPerDocument?: number;
};

export type CoverageEvidenceSelection = {
  subquestionId: string;
  orderedEvidence: SearchResult[];
  collapsedEvidenceFamilyIds: string[];
  conflicts: SourcePolicyConflict[];
  sourcePolicyReview: "not_applicable" | "not_evaluated" | "verified_conflict";
  coverageReason:
    "direct" | "partial" | "not_in_corpus" | "site_content_updating" | "site_content_stale" | "source_role_mismatch";
};

type CandidateWithOrder = { result: SearchResult; inputIndex: number };

function metadataRecord(result: SearchResult): Record<string, unknown> {
  return result.source_metadata && typeof result.source_metadata === "object"
    ? (result.source_metadata as unknown as Record<string, unknown>)
    : {};
}

function stableTextHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function candidateFamilyIds(result: SearchResult) {
  const metadata = metadataRecord(result);
  const contentHash = typeof metadata.content_hash === "string" && metadata.content_hash ? metadata.content_hash : null;
  const lineage: SiteContentRecord["sourceLineage"] = Array.isArray(metadata.site_content_lineage)
    ? metadata.site_content_lineage.flatMap((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
        const value = entry as Record<string, unknown>;
        if (
          typeof value.sourceId !== "string" ||
          typeof value.sourceHash !== "string" ||
          (value.relationship !== "derived_from" && value.relationship !== "references")
        )
          return [];
        return [
          {
            sourceId: value.sourceId,
            sourceHash: value.sourceHash,
            relationship: value.relationship,
          },
        ];
      })
    : [];
  if (contentHash || lineage.length) {
    return evidenceFamilyKeys({
      sourceId: result.document_id,
      sourceHash: contentHash ?? `document-${stableTextHash(result.document_id)}`,
      sourceLineage: lineage,
    });
  }
  // No lineage means no safe cross-row family decision. Keep the candidate distinct;
  // exact public-release admission and document crowding remain the outer bounds.
  return [`source-family:chunk-${stableTextHash(result.id)}`];
}

function productIntent(plan: RagQueryPlan, question: string, result: SearchResult) {
  if (result.corpus_scope !== "clinical_kb_site" || !result.site_content_domain) return false;
  if (plan.targetSiteDomains.length > 0 && !plan.targetSiteDomains.includes(result.site_content_domain)) return false;
  const intent = `${plan.originalQuery} ${question}`;
  return (
    /\bclinical\s+kb\b/i.test(intent) ||
    /\bcatalog(?:ue)?\b/i.test(intent) ||
    /\b(?:medication|differential|specifier|service|form|therapy|dictionary|calculator|tool)\s+(?:record|page)\b/i.test(
      intent,
    )
  );
}

function legacySiteCandidateRejected(result: SearchResult) {
  if (result.corpus_scope !== "clinical_kb_site") return false;
  const metadata = metadataRecord(result);
  return (
    (typeof metadata.row_owner_id === "string" && metadata.row_owner_id.length > 0) ||
    metadata.explicitly_reconciled === false ||
    (typeof metadata.publication_state === "string" && metadata.publication_state !== "published")
  );
}

function claimRoleForSubquestion(input: CoverageMergeInput, purpose: RagQueryPlan["subquestions"][number]["purpose"]) {
  if (purpose === "monitoring") return "dose_or_monitoring" as const;
  if (purpose === "risk") return "safety" as const;
  return input.claimRole ?? "treatment";
}

function eligibilityForCandidate(args: {
  input: CoverageMergeInput;
  question: string;
  claimRole: ClinicalClaimRole;
  result: SearchResult;
}) {
  const { input, question, claimRole, result } = args;
  if (!candidateHasKnownServerScope(result) || legacySiteCandidateRejected(result)) {
    return { eligible: false, roleMismatch: false };
  }
  const metadata = normalizeClinicalSourceMetadata(result.source_metadata);
  if (metadata.corpus_scope !== result.corpus_scope) return { eligible: false, roleMismatch: false };
  if (productIntent(input.plan, question, result) && metadata.source_role) {
    const policy = siteContentClaimPolicy({
      claimKind: "product_catalogue",
      siteSourceRole: metadata.source_role,
      directlyRelevantUploadedGuideline: false,
    });
    const eligibleProductRecord =
      policy.primaryCorpus === "clinical_kb_site" &&
      metadata.source_kind === "registry_record" &&
      metadata.content_mode === "indexed_content" &&
      metadata.document_status === "current" &&
      (metadata.clinical_validation_status === "approved" ||
        metadata.clinical_validation_status === "locally_reviewed") &&
      metadata.extraction_quality === "good";
    return { eligible: eligibleProductRecord, roleMismatch: !eligibleProductRecord };
  }
  const decision = searchResultEligibilityForClaim(result, claimRole);
  if (decision.eligible) return { eligible: true, roleMismatch: false };
  return { eligible: false, roleMismatch: decision.reason === "role_mismatch" || decision.reason === "link_only" };
}

function annotateSubquestionRelevance(question: string, candidate: CandidateWithOrder): CandidateWithOrder {
  const withoutPriorRelevance = { ...candidate.result };
  delete withoutPriorRelevance.relevance;
  return {
    ...candidate,
    result: annotateSearchResults(question, [withoutPriorRelevance])[0] ?? withoutPriorRelevance,
  };
}

function relevanceRank(result: SearchResult) {
  return result.relevance?.verdict === "direct"
    ? 0
    : result.relevance?.verdict === "partial"
      ? 1
      : result.relevance?.verdict === "nearby"
        ? 2
        : 3;
}

function orderedByPolicy(args: {
  input: CoverageMergeInput;
  question: string;
  candidates: CandidateWithOrder[];
  claimRole: ClinicalClaimRole;
}) {
  const local = args.candidates
    .filter(({ result }) => result.corpus_scope === "uploaded_local")
    .map(({ result }) => result);
  const australian = args.candidates
    .filter(({ result }) => result.corpus_scope === "australian_public")
    .map(({ result }) => result);
  const conflictDecision = resolveLocalAndAustralianEvidence({
    local,
    australian,
    claimRole: args.claimRole,
    verifiedDifferences: [],
  });
  const conflicts = retainCanonicalSourcePolicyConflicts({
    conflicts: args.input.sourcePolicyConflicts ?? [],
    local,
    australian,
    claimRole: args.claimRole,
  });
  const localPrimary = conflictDecision.primaryDecision.selected === "uploaded_local";
  const ordered: SearchResult[] = [];
  const add = (items: CandidateWithOrder[]) =>
    items.forEach(({ result }) => !ordered.includes(result) && ordered.push(result));

  for (const band of [0, 1, 2]) {
    const inBand = args.candidates.filter(({ result }) => relevanceRank(result) === band);
    const site = inBand.filter(({ result }) => result.corpus_scope === "clinical_kb_site");
    const uploaded = inBand.filter(({ result }) => result.corpus_scope === "uploaded_local");
    const au = inBand.filter(({ result }) => result.corpus_scope === "australian_public");
    const international = inBand.filter(({ result }) => result.corpus_scope === "international_supplementary");
    if (site.some(({ result }) => productIntent(args.input.plan, args.question, result))) add(site);
    if (localPrimary) {
      add(uploaded);
      add(au);
    } else {
      add(au);
      add(uploaded);
    }
    add(site);
    add(international);
  }
  const directlyRelevantLocal = args.candidates.some(
    ({ result }) => result.corpus_scope === "uploaded_local" && result.relevance?.verdict === "direct",
  );
  const directlyRelevantAustralian = args.candidates.some(
    ({ result }) => result.corpus_scope === "australian_public" && result.relevance?.verdict === "direct",
  );
  return {
    ordered,
    conflicts,
    sourcePolicyReview: conflicts.length
      ? ("verified_conflict" as const)
      : directlyRelevantLocal && directlyRelevantAustralian
        ? ("not_evaluated" as const)
        : ("not_applicable" as const),
  };
}

function collapseEvidenceFamilies(results: SearchResult[]) {
  const seenFamilies = new Set<string>();
  const seenLogicalIds = new Set<string>();
  const orderedEvidence: SearchResult[] = [];
  const collapsedEvidenceFamilyIds: string[] = [];
  for (const result of results) {
    const families = candidateFamilyIds(result);
    const newFamilies = families.filter((family) => !seenFamilies.has(family));
    const logicalId = metadataRecord(result).site_content_logical_id;
    if (newFamilies.length === 0) continue;
    if (typeof logicalId === "string" && logicalId && seenLogicalIds.has(logicalId)) continue;
    newFamilies.forEach((family) => seenFamilies.add(family));
    if (typeof logicalId === "string" && logicalId) seenLogicalIds.add(logicalId);
    orderedEvidence.push(result);
    collapsedEvidenceFamilyIds.push(...newFamilies);
  }
  return { orderedEvidence, collapsedEvidenceFamilyIds: [...new Set(collapsedEvidenceFamilyIds)] };
}

function retainedSelectionConflicts(conflicts: SourcePolicyConflict[], results: SearchResult[]) {
  const retainedIds = new Set(results.map((result) => result.id));
  return conflicts.filter(
    (conflict) =>
      conflict.local.supportingChunkIds.some((id) => retainedIds.has(id)) &&
      conflict.australian.supportingChunkIds.some((id) => retainedIds.has(id)),
  );
}

/** Merge eligible evidence in policy order without numeric authority or locality score boosts. */
export function mergeEvidenceByCoverageAndSourceRole(input: CoverageMergeInput): CoverageEvidenceSelection[] {
  const indexed = input.candidates.map((result, inputIndex) => ({ result, inputIndex }));
  return input.plan.subquestions.map((subquestion) => {
    const claimRole = claimRoleForSubquestion(input, subquestion.purpose);
    let roleMismatch = false;
    const eligible = indexed.flatMap((candidate) => {
      const decision = eligibilityForCandidate({
        input,
        question: subquestion.question,
        claimRole,
        result: candidate.result,
      });
      roleMismatch ||= decision.roleMismatch;
      return decision.eligible ? [annotateSubquestionRelevance(subquestion.question, candidate)] : [];
    });
    const relevant = eligible.filter(({ result }) => relevanceRank(result) < 2);
    const { ordered, conflicts, sourcePolicyReview } = orderedByPolicy({
      input,
      question: subquestion.question,
      candidates: relevant,
      claimRole,
    });
    const collapsed = collapseEvidenceFamilies(ordered);
    const selectedIds = new Set(
      selectAustralianClinicalContext(collapsed.orderedEvidence, {
        limit: input.maxPerSubquestion ?? 6,
        maxPerDocument: input.maxPerDocument ?? 2,
        sufficientAustralianChunks: 4,
        omitSupplementaryPadding: true,
        preserveInputPolicyOrder: true,
      }).map((result) => result.id),
    );
    const orderedEvidence = collapsed.orderedEvidence.filter((result) => selectedIds.has(result.id));
    const direct = orderedEvidence.some((result) => result.relevance?.verdict === "direct");
    const partial = orderedEvidence.some((result) => result.relevance?.verdict === "partial");
    const coverageReason: CoverageEvidenceSelection["coverageReason"] = direct
      ? "direct"
      : partial
        ? "partial"
        : roleMismatch
          ? "source_role_mismatch"
          : input.siteContentState === "updating"
            ? "site_content_updating"
            : input.siteContentState === "stale"
              ? "site_content_stale"
              : "not_in_corpus";
    return {
      subquestionId: subquestion.id,
      orderedEvidence,
      collapsedEvidenceFamilyIds: collapsed.collapsedEvidenceFamilyIds,
      conflicts: retainedSelectionConflicts(conflicts, orderedEvidence),
      sourcePolicyReview,
      coverageReason,
    };
  });
}

export function answerCoverageFromSelections(args: {
  plan: RagQueryPlan;
  selectedEvidence: readonly SearchResult[];
  selections: readonly CoverageEvidenceSelection[];
  citedChunkIds?: readonly string[];
}) {
  const cited = new Set(args.citedChunkIds ?? args.selectedEvidence.map((result) => result.id));
  return evaluateAnswerCoverage({
    plan: args.plan,
    selectedEvidence: args.selectedEvidence,
    evidenceBySubquestion: args.selections.map((selection) => ({
      subquestionId: selection.subquestionId,
      selectedChunkIds: selection.orderedEvidence.map((result) => result.id),
      citedChunkIds: selection.orderedEvidence.map((result) => result.id).filter((id) => cited.has(id)),
      eligibleChunkIds: selection.orderedEvidence.map((result) => result.id),
      support: selection.coverageReason === "direct" ? "direct" : "partial",
      reasonCodes: [
        selection.coverageReason,
        ...(selection.sourcePolicyReview === "not_evaluated" ? ["source_policy_not_evaluated"] : []),
      ],
      insufficiencyReason:
        selection.coverageReason === "direct" || selection.coverageReason === "partial"
          ? null
          : selection.coverageReason,
    })),
    conflicts: args.selections.flatMap((selection) => selection.conflicts),
  });
}

/** Replace provisional policy-conflict flags with the post-citation request-local verdict. */
export function reconcileAnswerSourcePolicyConflicts(
  answer: RagAnswer,
  selections: readonly CoverageEvidenceSelection[],
  coveragePlan: AnswerCoveragePlan | null,
) {
  const candidateConflicts = selections.flatMap((selection) => selection.conflicts);
  const nonPolicyFlags = (answer.conflictsOrGaps ?? []).filter(
    (item) =>
      item.type !== "conflict" ||
      !candidateConflicts.some((conflict) => {
        const itemIds = new Set(item.source_chunk_ids ?? []);
        return (
          conflict.local.supportingChunkIds.some((id) => itemIds.has(id)) &&
          conflict.australian.supportingChunkIds.some((id) => itemIds.has(id))
        );
      }),
  );
  const retainedPolicyFlags = (coveragePlan?.conflicts ?? []).slice(0, 4).map((conflict) => {
    const sourceChunkIds = [
      conflict.local.supportingChunkIds[0],
      conflict.australian.supportingChunkIds[0],
      ...conflict.local.supportingChunkIds.slice(1),
      ...conflict.australian.supportingChunkIds.slice(1),
    ].filter((id): id is string => Boolean(id));
    return {
      type: "conflict" as const,
      message: `Current local-primary and Australian sources have a reviewed ${conflict.materialDifferenceReason.replaceAll("_", " ")} difference. Review the local-primary source before acting.`,
      source_chunk_ids: [...new Set(sourceChunkIds)].slice(0, 4),
    };
  });
  answer.conflictsOrGaps = [...nonPolicyFlags, ...retainedPolicyFlags];
}

function boundedPromptToken(value: string, maxLength = 64) {
  const bounded = value.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, maxLength);
  return bounded || "unknown";
}

/** Content-free prompt projection: IDs, statuses and reason codes only. */
export function formatAnswerCoveragePromptLine(plan: AnswerCoveragePlan) {
  const items = plan.coverage.slice(0, 4).map((item) => {
    const reasons = item.reasonCodes
      .slice(0, 4)
      .map((reason) => boundedPromptToken(reason, 48))
      .join(",");
    return `${boundedPromptToken(item.subquestionId)}:${item.status}:${reasons || "none"}`;
  });
  return `answer_plan.coverage: overall=${plan.overall}; items=${items.join("|") || "none"}; insufficiency=${boundedPromptToken(plan.insufficiencyReason ?? "none")}`;
}

export type AdaptiveCoverageBehavior =
  "full_synthesis" | "bounded_partial_synthesis" | "source_gap_only" | "verified_conflict_review";

export type InternalAdaptiveAnswerPlan = SmartRagAnswerPlan & {
  answerCoverage: AnswerCoveragePlan;
  coverageBehavior: AdaptiveCoverageBehavior;
  sourcePolicyReview: "none" | "not_evaluated" | "verified_conflict";
};

/** Consume the full request-local coverage object without attaching it to the public/cached API plan. */
export function adaptSmartAnswerPlanForCoverage(
  basePlan: SmartRagAnswerPlan,
  answerCoverage: AnswerCoveragePlan,
): InternalAdaptiveAnswerPlan {
  const sourcePolicyReview = answerCoverage.conflicts.length
    ? "verified_conflict"
    : answerCoverage.coverage.some((item) => item.reasonCodes.includes("source_policy_not_evaluated"))
      ? "not_evaluated"
      : "none";
  const coverageBehavior: AdaptiveCoverageBehavior = answerCoverage.conflicts.length
    ? "verified_conflict_review"
    : answerCoverage.overall === "absent"
      ? "source_gap_only"
      : answerCoverage.overall === "partial"
        ? "bounded_partial_synthesis"
        : "full_synthesis";
  const adaptiveCriteria =
    coverageBehavior === "verified_conflict_review"
      ? ["preserve_local_primary_source", "surface_verified_source_conflict", "require_source_review"]
      : coverageBehavior === "source_gap_only"
        ? ["report_source_gap_only", "do_not_generate_clinical_advice"]
        : coverageBehavior === "bounded_partial_synthesis"
          ? ["omit_uncovered_subquestions", "surface_source_gaps"]
          : [];
  if (sourcePolicyReview === "not_evaluated") {
    adaptiveCriteria.push("do_not_claim_source_agreement", "require_source_policy_review");
  }
  return {
    ...basePlan,
    retrievalQuality:
      coverageBehavior === "verified_conflict_review"
        ? "conflicting"
        : coverageBehavior === "source_gap_only"
          ? "weak"
          : coverageBehavior === "bounded_partial_synthesis"
            ? "partial"
            : basePlan.retrievalQuality,
    qualityCriteria: [...new Set([...basePlan.qualityCriteria, ...adaptiveCriteria])],
    fallbackBehavior: coverageBehavior === "full_synthesis" ? basePlan.fallbackBehavior : "source_gap",
    answerCoverage,
    coverageBehavior,
    sourcePolicyReview,
  };
}

function subquestionCandidateStatus(question: string, selectedEvidence: readonly SearchResult[]) {
  const candidates = selectedEvidence
    .filter(candidateHasKnownServerScope)
    .map((candidate) => {
      const candidateForSubquestion = { ...candidate };
      delete candidateForSubquestion.relevance;
      return candidateForSubquestion;
    })
    .filter((candidate) => buildEvidenceRelevance(question, [candidate]).isSourceBacked);
  if (candidates.length === 0) return "absent" as const;

  const relevance = buildEvidenceRelevance(question, candidates);
  const gate = evaluateEvidenceCoverageGate(question, candidates);
  if (gate.reason !== "coverage_gate_not_applicable" && !gate.accepted) return "absent" as const;
  if (relevance.verdict === "direct") return "matched" as const;
  if (relevance.verdict === "partial") return "partial_match" as const;
  return "absent" as const;
}

/** Candidate variants are spent only on required subquestions that remain below direct coverage. */
export function uncoveredRagSubquestions(plan: RagQueryPlan, selectedEvidence: readonly SearchResult[]) {
  return plan.subquestions.filter(
    (subquestion) => subquestionCandidateStatus(subquestion.question, selectedEvidence) !== "matched",
  );
}

export function evaluateShadowCandidateMatchCounts(
  plan: RagQueryPlan,
  selectedEvidence: readonly SearchResult[],
): RagCandidateMatchCounts {
  return plan.subquestions.reduce<RagCandidateMatchCounts>(
    (counts, subquestion) => {
      const status = subquestionCandidateStatus(subquestion.question, selectedEvidence);
      return { ...counts, [status]: counts[status] + 1 };
    },
    { matched: 0, partial_match: 0, absent: 0 },
  );
}

function candidateHasKnownServerScope(result: SearchResult) {
  if (!knownCorpusScopes.has(result.corpus_scope as SourceCorpusScope)) return false;
  const hasKnownSiteDomain = knownSiteDomains.has(result.site_content_domain as SiteContentDomain);
  if (result.corpus_scope === "clinical_kb_site" ? !hasKnownSiteDomain : result.site_content_domain != null)
    return false;
  if (result.source_metadata?.source_kind === "registry_record" && result.corpus_scope !== "clinical_kb_site") {
    return false;
  }
  return true;
}

function retainedConflicts(conflicts: readonly SourcePolicyConflict[], directlyCitedIds: ReadonlySet<string>) {
  return conflicts.filter(
    (conflict) =>
      conflict.local.supportingChunkIds.some((id) => directlyCitedIds.has(id)) &&
      conflict.australian.supportingChunkIds.some((id) => directlyCitedIds.has(id)),
  );
}

function inferredInsufficiencyReason(
  input: EvaluateAnswerCoverageInput,
  overall: AnswerCoveragePlan["overall"],
  coverage: AnswerCoveragePlan["coverage"],
): RagInsufficiencyReason | null {
  if (overall === "complete") return null;
  if (overall === "conflicting") return "source_conflict";
  if (
    coverage.some((item) => item.reasonCodes.includes("candidate_scope_rejected")) ||
    input.evidenceBySubquestion.some((item) => item.reasonCodes?.includes("source_governance_block"))
  )
    return "governance_block";
  const selectedReason = input.evidenceBySubquestion.find((item) => item.insufficiencyReason)?.insufficiencyReason;
  const explicitReason = input.insufficiencyReason ?? selectedReason;
  const hasCandidateEvidence =
    input.selectedEvidence.length > 0 ||
    input.evidenceBySubquestion.some(
      (item) => item.selectedChunkIds.length > 0 || item.citedChunkIds.length > 0 || item.eligibleChunkIds?.length > 0,
    );
  const hasMissingDecision = coverage.some((item) =>
    item.reasonCodes.some((reason) =>
      ["eligibility_decision_missing", "direct_support_decision_missing"].includes(reason),
    ),
  );
  if (explicitReason === "not_in_corpus" && (hasCandidateEvidence || hasMissingDecision)) {
    return "insufficient_claim_support";
  }
  if (explicitReason) return explicitReason;
  return "insufficient_claim_support";
}

export function evaluateAnswerCoverage(input: EvaluateAnswerCoverageInput): AnswerCoveragePlan {
  const evidenceById = new Map(input.selectedEvidence.map((result) => [result.id, result]));
  const selectionBySubquestion = new Map(input.evidenceBySubquestion.map((item) => [item.subquestionId, item]));
  const allDirectIds = new Set<string>();

  const coverage: AnswerCoveragePlan["coverage"] = input.plan.subquestions.map((subquestion) => {
    const selection = selectionBySubquestion.get(subquestion.id);
    const selectedIds = new Set(selection?.selectedChunkIds ?? []);
    const citedIds = new Set(selection?.citedChunkIds ?? []);
    const eligibilityDecisionMissing = !selection || !Array.isArray(selection.eligibleChunkIds);
    const supportDecisionMissing = !selection || (selection.support !== "direct" && selection.support !== "partial");
    const eligibleIds = eligibilityDecisionMissing ? new Set<string>() : new Set(selection.eligibleChunkIds);
    let rejectedScope = false;
    const directEvidence = [...selectedIds].flatMap((id) => {
      if (!citedIds.has(id) || !eligibleIds.has(id)) return [];
      const result = evidenceById.get(id);
      if (!result) return [];
      if (!candidateHasKnownServerScope(result)) {
        rejectedScope = true;
        return [];
      }
      return [result];
    });
    const gate = evaluateEvidenceCoverageGate(subquestion.question, directEvidence);
    const queryClass = classifyRagQuery(subquestion.question).queryClass;
    const doseIntent = medicationDoseEvidenceQueryIntent(subquestion.question);
    const gateApplies =
      gate.reason !== "coverage_gate_not_applicable" &&
      !(
        queryClass === "medication_dose_risk" &&
        !doseIntent.asksAmount &&
        !doseIntent.asksRoute &&
        !doseIntent.asksFrequency
      );
    const supportedEvidence = (gateApplies && !gate.accepted) || supportDecisionMissing ? [] : directEvidence;
    for (const result of supportedEvidence) allDirectIds.add(result.id);
    const reasonCodes = [
      ...(selection?.reasonCodes ?? []),
      `evidence_gate:${gate.reason}`,
      ...(rejectedScope ? ["candidate_scope_rejected"] : []),
      ...(eligibilityDecisionMissing ? ["eligibility_decision_missing"] : []),
      ...(supportDecisionMissing ? ["direct_support_decision_missing"] : []),
    ];
    const status: AnswerCoveragePlan["coverage"][number]["status"] =
      supportedEvidence.length === 0 || supportDecisionMissing
        ? "absent"
        : selection.support === "partial"
          ? "partial"
          : "direct";
    return {
      subquestionId: subquestion.id,
      status,
      chunkIds: supportedEvidence.map((result) => result.id),
      reasonCodes: [...new Set(reasonCodes)],
    } satisfies AnswerCoveragePlan["coverage"][number];
  });

  const conflicts = retainedConflicts(input.conflicts ?? [], allDirectIds);
  const conflictChunkIds = new Set(
    conflicts.flatMap((conflict) => [...conflict.local.supportingChunkIds, ...conflict.australian.supportingChunkIds]),
  );
  for (const item of coverage) {
    if (item.chunkIds.some((id) => conflictChunkIds.has(id))) item.status = "conflicting";
  }

  const requiredIds = new Set(input.plan.subquestions.filter((item) => item.required).map((item) => item.id));
  const requiredCoverage = coverage.filter((item) => requiredIds.has(item.subquestionId));
  const directCount = requiredCoverage.filter((item) => item.status === "direct").length;
  const anySupported = requiredCoverage.some((item) => item.status !== "absent");
  const overall: AnswerCoveragePlan["overall"] =
    conflicts.length > 0
      ? "conflicting"
      : requiredCoverage.length > 0 && directCount === requiredCoverage.length
        ? "complete"
        : anySupported
          ? "partial"
          : "absent";

  return {
    interpretation: input.plan.interpretation,
    ambiguity: input.ambiguity ?? null,
    subquestions: input.plan.subquestions.map(({ id, question, required }) => ({ id, question, required })),
    coverage,
    conflicts,
    overall,
    insufficiencyReason: inferredInsufficiencyReason(input, overall, coverage),
  };
}
