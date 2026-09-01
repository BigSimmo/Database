import { classifySourceAuthority } from "@/lib/source-authority-registry";
import { isClaimEvidenceGovernanceEligible } from "@/lib/source-governance";
import { normalizeClinicalSourceMetadata } from "@/lib/source-metadata";
import type {
  ClinicalClaimRole,
  ClinicalSourceMetadata,
  ClinicalSourceRole,
  EvidencePrimaryDecision,
  RagSubquestionPurpose,
  SearchResult,
  SourceEligibilityDecision,
  SourcePolicyConflict,
  SourcePolicyConflictSide,
  VerifiedSourcePolicyDifference,
} from "@/lib/types";

export type {
  ClinicalClaimRole,
  EvidencePrimaryDecision,
  SourceEligibilityDecision,
  SourcePolicyConflict,
  SourcePolicyConflictSide,
  VerifiedSourcePolicyDifference,
} from "@/lib/types";

const eligibleRolesByClaim: Record<ClinicalClaimRole, ReadonlySet<ClinicalSourceRole>> = {
  treatment: new Set(["local_guideline", "clinical_guideline", "clinical_reference", "professional_review"]),
  dose_or_monitoring: new Set([
    "local_guideline",
    "clinical_guideline",
    "clinical_reference",
    "safety_alert",
    "regulatory",
    "professional_review",
  ]),
  safety: new Set([
    "local_guideline",
    "clinical_guideline",
    "clinical_reference",
    "safety_alert",
    "regulatory",
    "quality_standard",
    "professional_review",
    "service_policy",
  ]),
  legal: new Set(["legal", "regulatory", "service_policy"]),
  subsidy: new Set(["subsidy"]),
  quality: new Set([
    "local_guideline",
    "clinical_guideline",
    "clinical_reference",
    "quality_standard",
    "professional_review",
    "service_policy",
  ]),
  service_workflow: new Set([
    "service_directory",
    "form_reference",
    "tool_reference",
    "service_policy",
    "local_guideline",
  ]),
};

export function sourceRoleEligibleForClaim(
  sourceRole: ClinicalSourceRole | null | undefined,
  claimRole: ClinicalClaimRole,
) {
  return Boolean(sourceRole && eligibleRolesByClaim[claimRole].has(sourceRole));
}

/** Deterministically route a request-local subquestion to the narrow source-role policy it can use. */
export function classifyClaimRoleForSubquestion(args: {
  question: string;
  purpose: RagSubquestionPurpose;
}): ClinicalClaimRole {
  const question = args.question.normalize("NFKC");

  if (
    /\bPBS\b|\bpharmaceutical benefits scheme\b|\bsubsid(?:y|ies|ised|ized|isation|ization)\b|\bauthority[\s-]+restriction\b|\b(?:medicine|medication|drug|item)\b.{0,40}\b(?:listed|listing)\b|\b(?:listed|listing)\b.{0,40}\b(?:medicine|medication|drug|item)\b/i.test(
      question,
    )
  )
    return "subsidy";
  if (/\b(?:legislation|statutory|legal)\b|\bmental health act\b/i.test(question)) return "legal";
  if (/\bNSQHS\b|\baccreditation\b|\bquality[\s-]+standards?\b/i.test(question)) return "quality";
  if (
    /\breferral\b|\bservice[\s-]+directory\b|\bworkflow\b|\bnavigation\b|\b(?:find|open|submit|complete|use)\s+(?:the\s+)?forms?\b|\bforms?\s+(?:should|do|can|must|would)\s+(?:i|we|you)\s+(?:submit|complete|open|use)\b/i.test(
      question,
    )
  )
    return "service_workflow";

  if (args.purpose === "monitoring") return "dose_or_monitoring";
  if (args.purpose === "risk") return "safety";
  if (/\b(?:dose|doses|dosage|dosing|threshold|thresholds)\b|\bmonitor(?:ing|ed|s)?\b/i.test(question))
    return "dose_or_monitoring";
  if (/\b(?:risk|risks|safety)\b|\bescalat(?:e|es|ed|ing|ion)\b/i.test(question)) return "safety";
  return "treatment";
}

function isInactive(source: ClinicalSourceMetadata, authority: ReturnType<typeof classifySourceAuthority>) {
  return (
    source.change_state === "withdrawn" ||
    source.change_state === "superseded" ||
    authority.eligibilityReasons.includes("catalogue_inactive")
  );
}

function catalogueMismatch(source: ClinicalSourceMetadata, authority: ReturnType<typeof classifySourceAuthority>) {
  if (source.corpus_scope !== "australian_public") return false;
  return !authority.cataloguePolicyResolved || !authority.australianAugmentationEligible;
}

export function sourceEligibilityForClaim(args: {
  source: ClinicalSourceMetadata;
  claimRole: ClinicalClaimRole;
}): SourceEligibilityDecision {
  const source = normalizeClinicalSourceMetadata(args.source);
  const authority = classifySourceAuthority(source);

  if (source.content_mode === "link_only" || source.source_role === "reference_link") {
    return { eligible: false, reason: "link_only" };
  }
  if (isInactive(source, authority)) return { eligible: false, reason: "inactive" };
  if (source.document_status !== "current") return { eligible: false, reason: "not_current" };
  if (!isClaimEvidenceGovernanceEligible(source)) return { eligible: false, reason: "governance_block" };
  if (catalogueMismatch(source, authority)) return { eligible: false, reason: "catalogue_mismatch" };
  if (!sourceRoleEligibleForClaim(source.source_role, args.claimRole)) {
    return { eligible: false, reason: "role_mismatch" };
  }
  return { eligible: true, reason: "eligible" };
}

export function searchResultEligibilityForClaim(result: SearchResult, claimRole: ClinicalClaimRole) {
  return sourceEligibilityForClaim({
    source: normalizeClinicalSourceMetadata(result.source_metadata),
    claimRole,
  });
}

function uniqueChunkIds(chunkIds: string[]) {
  return [...new Set(chunkIds.filter((chunkId) => chunkId.trim().length > 0))];
}

function resultsForVerifiedChunks(resultsByChunkId: Map<string, SearchResult>, chunkIds: string[]) {
  const verifiedChunkIds = uniqueChunkIds(chunkIds);
  if (verifiedChunkIds.length === 0) return null;
  const results = verifiedChunkIds.map((chunkId) => resultsByChunkId.get(chunkId));
  if (results.some((result) => !result)) return null;
  const present = results as SearchResult[];
  if (new Set(present.map((result) => result.document_id)).size !== 1) return null;
  return { results: present, verifiedChunkIds };
}

function completeConflictSide(args: {
  results: SearchResult[];
  verifiedChunkIds: string[];
  expectedCorpusScope: "uploaded_local" | "australian_public";
}): SourcePolicyConflictSide | null {
  const first = args.results[0];
  if (!first || args.results.some((result) => result.document_id !== first.document_id)) return null;
  const sources = args.results.map((result) => normalizeClinicalSourceMetadata(result.source_metadata));
  const source = sources[0];
  if (!source) return null;
  const title = first.title.trim();
  const identity = JSON.stringify([
    source.source_catalogue_key,
    source.publisher,
    source.publication_date,
    source.effective_date,
    source.jurisdiction,
    source.source_role,
    source.corpus_scope,
  ]);
  if (
    sources.some(
      (candidate) =>
        JSON.stringify([
          candidate.source_catalogue_key,
          candidate.publisher,
          candidate.publication_date,
          candidate.effective_date,
          candidate.jurisdiction,
          candidate.source_role,
          candidate.corpus_scope,
        ]) !== identity,
    ) ||
    args.results.some((result) => result.title.trim() !== title) ||
    source.corpus_scope !== args.expectedCorpusScope ||
    !source.source_catalogue_key ||
    !title ||
    !source.publisher ||
    (!source.publication_date && !source.effective_date) ||
    !source.jurisdiction ||
    !source.source_role
  ) {
    return null;
  }
  return {
    documentId: first.document_id,
    catalogueKey: source.source_catalogue_key,
    title,
    publisher: source.publisher,
    publicationDate: source.publication_date,
    effectiveFrom: source.effective_date ?? null,
    jurisdiction: source.jurisdiction,
    sourceRole: source.source_role,
    corpusScope: source.corpus_scope,
    supportingChunkIds: args.verifiedChunkIds,
  };
}

function sameConflictSide(left: SourcePolicyConflictSide, right: SourcePolicyConflictSide) {
  const leftChunkIds = [...new Set(left.supportingChunkIds)].sort();
  const rightChunkIds = [...new Set(right.supportingChunkIds)].sort();
  return (
    left.documentId === right.documentId &&
    left.catalogueKey === right.catalogueKey &&
    left.title === right.title &&
    left.publisher === right.publisher &&
    left.publicationDate === right.publicationDate &&
    left.effectiveFrom === right.effectiveFrom &&
    left.jurisdiction === right.jurisdiction &&
    left.sourceRole === right.sourceRole &&
    left.corpusScope === right.corpusScope &&
    leftChunkIds.length === rightChunkIds.length &&
    leftChunkIds.every((chunkId, index) => chunkId === rightChunkIds[index])
  );
}

/** Keep only upstream canonical conflicts whose complete identities still match the eligible request-local rows. */
export function retainCanonicalSourcePolicyConflicts(args: {
  conflicts: readonly SourcePolicyConflict[];
  local: SearchResult[];
  australian: SearchResult[];
  claimRole: ClinicalClaimRole;
}) {
  const localByChunkId = new Map(args.local.map((result) => [result.id, result]));
  const australianByChunkId = new Map(args.australian.map((result) => [result.id, result]));
  return args.conflicts.filter((conflict) => {
    if (
      conflict.version !== "source-policy-conflict-v1" ||
      conflict.claimRole !== args.claimRole ||
      conflict.reviewTargetDocumentId !== conflict.local.documentId ||
      conflict.localPrimaryDecision.selected !== "uploaded_local" ||
      conflict.localPrimaryDecision.reason !== "current_valid_accessible_directly_supportive"
    )
      return false;
    const localEvidence = resultsForVerifiedChunks(localByChunkId, conflict.local.supportingChunkIds);
    const australianEvidence = resultsForVerifiedChunks(australianByChunkId, conflict.australian.supportingChunkIds);
    if (!localEvidence || !australianEvidence) return false;
    const local = completeConflictSide({ ...localEvidence, expectedCorpusScope: "uploaded_local" });
    const australian = completeConflictSide({ ...australianEvidence, expectedCorpusScope: "australian_public" });
    return Boolean(
      local &&
      australian &&
      sameConflictSide(conflict.local, local) &&
      sameConflictSide(conflict.australian, australian),
    );
  });
}

function conflictId(args: {
  difference: VerifiedSourcePolicyDifference;
  localDocumentId: string;
  australianDocumentId: string;
}) {
  return [
    "source-policy-conflict-v1",
    args.difference.claimRole,
    args.difference.topicKey,
    args.difference.overlapReason,
    args.difference.materialDifferenceReason,
    args.localDocumentId,
    args.australianDocumentId,
  ]
    .map(encodeURIComponent)
    .join(":");
}

function buildVerifiedConflicts(args: {
  local: SearchResult[];
  australian: SearchResult[];
  claimRole: ClinicalClaimRole;
  verifiedDifferences: VerifiedSourcePolicyDifference[];
}) {
  const localByChunkId = new Map(args.local.map((result) => [result.id, result]));
  const australianByChunkId = new Map(args.australian.map((result) => [result.id, result]));
  const pending = new Map<
    string,
    {
      difference: VerifiedSourcePolicyDifference;
      localChunkIds: Set<string>;
      australianChunkIds: Set<string>;
    }
  >();

  for (const difference of args.verifiedDifferences) {
    if (difference.claimRole !== args.claimRole || !difference.topicKey.trim()) continue;
    const localEvidence = resultsForVerifiedChunks(localByChunkId, difference.localChunkIds);
    const australianEvidence = resultsForVerifiedChunks(australianByChunkId, difference.australianChunkIds);
    if (!localEvidence || !australianEvidence) continue;
    const id = conflictId({
      difference,
      localDocumentId: localEvidence.results[0]!.document_id,
      australianDocumentId: australianEvidence.results[0]!.document_id,
    });
    const existing = pending.get(id);
    if (existing) {
      localEvidence.verifiedChunkIds.forEach((chunkId) => existing.localChunkIds.add(chunkId));
      australianEvidence.verifiedChunkIds.forEach((chunkId) => existing.australianChunkIds.add(chunkId));
    } else {
      pending.set(id, {
        difference,
        localChunkIds: new Set(localEvidence.verifiedChunkIds),
        australianChunkIds: new Set(australianEvidence.verifiedChunkIds),
      });
    }
  }

  return [...pending.entries()]
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .flatMap(([id, candidate]): SourcePolicyConflict[] => {
      const localEvidence = resultsForVerifiedChunks(localByChunkId, [...candidate.localChunkIds].sort());
      const australianEvidence = resultsForVerifiedChunks(
        australianByChunkId,
        [...candidate.australianChunkIds].sort(),
      );
      if (!localEvidence || !australianEvidence) return [];
      const local = completeConflictSide({ ...localEvidence, expectedCorpusScope: "uploaded_local" });
      const australian = completeConflictSide({ ...australianEvidence, expectedCorpusScope: "australian_public" });
      if (!local || !australian) return [];

      return [
        {
          version: "source-policy-conflict-v1",
          id,
          claimRole: candidate.difference.claimRole,
          topicKey: candidate.difference.topicKey,
          local: { ...local, corpusScope: "uploaded_local" },
          australian: { ...australian, corpusScope: "australian_public" },
          overlapReason: candidate.difference.overlapReason,
          materialDifferenceReason: candidate.difference.materialDifferenceReason,
          localPrimaryDecision: {
            selected: "uploaded_local",
            reason: "current_valid_accessible_directly_supportive",
          },
          reviewTargetDocumentId: local.documentId,
        },
      ];
    });
}

export function resolveLocalAndAustralianEvidence(args: {
  local: SearchResult[];
  australian: SearchResult[];
  claimRole: ClinicalClaimRole;
  verifiedDifferences: VerifiedSourcePolicyDifference[];
}): {
  primary: SearchResult[];
  augmentation: SearchResult[];
  conflicts: SourcePolicyConflict[];
  reviewDocumentIds: string[];
  primaryDecision: EvidencePrimaryDecision;
} {
  const eligibleLocal = args.local.filter((result) => {
    const source = normalizeClinicalSourceMetadata(result.source_metadata);
    return (
      source.corpus_scope === "uploaded_local" &&
      sourceEligibilityForClaim({ source, claimRole: args.claimRole }).eligible
    );
  });
  const directlySupportiveLocal = eligibleLocal.filter((result) => result.relevance?.verdict === "direct");
  const eligibleAustralian = args.australian.filter((result) => {
    const source = normalizeClinicalSourceMetadata(result.source_metadata);
    return (
      result.relevance?.verdict !== "none" &&
      source.corpus_scope === "australian_public" &&
      sourceEligibilityForClaim({ source, claimRole: args.claimRole }).eligible
    );
  });

  if (directlySupportiveLocal.length > 0) {
    const conflicts = buildVerifiedConflicts({
      local: directlySupportiveLocal,
      australian: eligibleAustralian,
      claimRole: args.claimRole,
      verifiedDifferences: args.verifiedDifferences,
    });
    return {
      primary: directlySupportiveLocal,
      augmentation: eligibleAustralian,
      conflicts,
      reviewDocumentIds: [...new Set(conflicts.map((conflict) => conflict.reviewTargetDocumentId))],
      primaryDecision: {
        selected: "uploaded_local",
        reason: "current_valid_accessible_directly_supportive",
      },
    };
  }

  if (eligibleAustralian.length > 0) {
    return {
      primary: eligibleAustralian,
      augmentation: eligibleLocal,
      conflicts: [],
      reviewDocumentIds: [],
      primaryDecision: {
        selected: "australian_public",
        reason: eligibleLocal.length > 0 ? "uploaded_local_not_directly_supportive" : "no_eligible_uploaded_local",
      },
    };
  }

  return {
    primary: [],
    augmentation: eligibleLocal,
    conflicts: [],
    reviewDocumentIds: [],
    primaryDecision: { selected: "none", reason: "no_eligible_evidence" },
  };
}
