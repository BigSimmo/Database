import { classifySourceAuthority } from "@/lib/source-authority-registry";
import { isClaimEvidenceGovernanceEligible } from "@/lib/source-governance";
import { normalizeClinicalSourceMetadata } from "@/lib/source-metadata";
import type {
  ClinicalClaimRole,
  ClinicalSourceMetadata,
  ClinicalSourceRole,
  EvidencePrimaryDecision,
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
  if (!source.source_role || !eligibleRolesByClaim[args.claimRole].has(source.source_role)) {
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
  const conflicts: SourcePolicyConflict[] = [];

  for (const difference of args.verifiedDifferences) {
    if (difference.claimRole !== args.claimRole || !difference.topicKey.trim()) continue;
    const localEvidence = resultsForVerifiedChunks(localByChunkId, difference.localChunkIds);
    const australianEvidence = resultsForVerifiedChunks(australianByChunkId, difference.australianChunkIds);
    if (!localEvidence || !australianEvidence) continue;
    const local = completeConflictSide({ ...localEvidence, expectedCorpusScope: "uploaded_local" });
    const australian = completeConflictSide({ ...australianEvidence, expectedCorpusScope: "australian_public" });
    if (!local || !australian) continue;

    const conflict: SourcePolicyConflict = {
      version: "source-policy-conflict-v1",
      id: conflictId({
        difference,
        localDocumentId: local.documentId,
        australianDocumentId: australian.documentId,
      }),
      claimRole: difference.claimRole,
      topicKey: difference.topicKey,
      local: { ...local, corpusScope: "uploaded_local" },
      australian: { ...australian, corpusScope: "australian_public" },
      overlapReason: difference.overlapReason,
      materialDifferenceReason: difference.materialDifferenceReason,
      localPrimaryDecision: {
        selected: "uploaded_local",
        reason: "current_valid_accessible_directly_supportive",
      },
      reviewTargetDocumentId: local.documentId,
    };
    if (!conflicts.some((candidate) => candidate.id === conflict.id)) conflicts.push(conflict);
  }

  return conflicts;
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
