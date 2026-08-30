import { evaluateEvidenceCoverageGate } from "@/lib/rag/rag-coverage-gate";
import type { RagCoverageCounts } from "@/lib/rag/rag-contracts";
import { buildEvidenceRelevance } from "@/lib/evidence-relevance";
import type {
  AnswerCoveragePlan,
  ClinicalAmbiguity,
  RagInsufficiencyReason,
  RagQueryPlan,
  SearchResult,
  SiteContentDomain,
  SourceCorpusScope,
  SourcePolicyConflict,
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

export function evaluateShadowCandidateCoverageCounts(
  plan: RagQueryPlan,
  selectedEvidence: readonly SearchResult[],
): RagCoverageCounts {
  const coverage = evaluateAnswerCoverage({
    plan,
    selectedEvidence,
    evidenceBySubquestion: plan.subquestions.map((subquestion) => {
      const candidates = selectedEvidence.filter(
        (candidate) =>
          candidateHasKnownServerScope(candidate) &&
          buildEvidenceRelevance(subquestion.question, [candidate]).isSourceBacked,
      );
      const ids = candidates.map(({ id }) => id);
      const relevance = buildEvidenceRelevance(subquestion.question, candidates);
      return {
        subquestionId: subquestion.id,
        selectedChunkIds: ids,
        citedChunkIds: ids,
        eligibleChunkIds: ids,
        support: relevance.verdict === "direct" ? ("direct" as const) : ("partial" as const),
      };
    }),
  });
  return coverage.coverage.reduce<RagCoverageCounts>(
    (counts, item) => ({ ...counts, [item.status]: counts[item.status] + 1 }),
    { direct: 0, partial: 0, conflicting: 0, absent: 0 },
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
    const gateApplies = gate.reason !== "coverage_gate_not_applicable";
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
