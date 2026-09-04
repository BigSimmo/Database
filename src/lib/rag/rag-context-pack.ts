import { createHash } from "node:crypto";

import {
  retrievalAccessScopeKey,
  retrievalAccessScopeMatchesOwner,
  type RetrievalAccessScope,
} from "@/lib/owner-scope";
import { ragContextSnapshotCacheKey } from "@/lib/rag/rag-context-snapshot";
import type { ModelContextEvidenceSelection } from "@/lib/rag/rag-context-selection";
import { evidenceFamilyIdsForResult, type CoverageEvidenceSelection } from "@/lib/rag/rag-coverage";
import {
  buildRagSourceBlock,
  buildPackedRagSourceBlock,
  compactContextText,
  estimatePackedRagSourceBlockTokens,
  ragSourceSerializationPreservesAtomicEvidence,
} from "@/lib/rag/rag-source-block";
import { committedIndexGeneration } from "@/lib/reindex-pipeline";
import { searchResultEligibilityForClaim, sourceRoleEligibleForClaim } from "@/lib/source-role-policy";
import type { RagContextSnapshot } from "@/lib/site-content/site-content-contracts";
import type { createAdminClient } from "@/lib/supabase/admin";
import type {
  AnswerCoveragePlan,
  ClinicalClaimRole,
  RagQueryClass,
  SearchResult,
  SourceCorpusScope,
} from "@/lib/types";

export const ragContextPackVersion = "rag-context-pack-v1";

export type PackedEvidenceGroup = {
  id: string;
  subquestionIds: string[];
  required: boolean;
  claimRole: ClinicalClaimRole;
  evidenceFamilyIds: string[];
  corpusScope: SourceCorpusScope;
  accessIdentity: string;
  generationIdentity: string;
  releaseIdentity: string;
  members: SearchResult[];
  atomicFeatures: {
    hasPopulation: boolean;
    hasException: boolean;
    hasAction: boolean;
    hasUnitsOrQualifier: boolean;
    hasStructuredTableContext: boolean;
  };
};

export type ClaimOrientedContextPack = {
  packId: string;
  groups: PackedEvidenceGroup[];
  usedTokens: number;
  omittedOptionalGroupIds: string[];
};

export type ClaimOrientedContextPackInput = {
  selections: CoverageEvidenceSelection[];
  coverage: AnswerCoveragePlan;
  tokenBudget: number;
  queryClass?: RagQueryClass;
  planVersion?: string;
  snapshot: RagContextSnapshot;
  accessScope: RetrievalAccessScope;
};

const knownCorpusScopes = new Set<SourceCorpusScope>([
  "uploaded_local",
  "clinical_kb_site",
  "australian_public",
  "international_supplementary",
]);
const knownSiteDomains = new Set([
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
const populationPattern =
  /\b(?:adult|child|adolescent|older adult|over \d+ years|under \d+ years|pregnan|renal|hepatic|paediatric|geriatric)\b/i;
const exceptionPattern = /\b(?:except|unless|however|but|instead|contraindicat|do not|must not|avoid|withhold)\b/i;
const actionPattern =
  /\b(?:administer|arrange|cease|check|contact|continue|discontinue|escalate|give|monitor|prescribe|refer|repeat|review|start|stop|use|withhold)\b/i;
const unitOrQualifierPattern =
  /\b(?:\d+(?:\.\d+)?\s*(?:mg|mcg|microg|g|kg|mL|L|IU|units?|mmol|%|x10\^?\d+\/L)|daily|nightly|weekly|hourly|maximum|minimum|above|below|at least|no more than)\b/i;
const packedGroupsByResultSet = new WeakMap<SearchResult[], PackedEvidenceGroup[]>();

function metadataRecord(result: SearchResult) {
  return result.source_metadata && typeof result.source_metadata === "object"
    ? (result.source_metadata as unknown as Record<string, unknown>)
    : {};
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function legacyStableHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function stringMetadata(metadata: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function ownerIdForResult(result: SearchResult) {
  const metadata = metadataRecord(result);
  const owner = metadata.row_owner_id;
  return typeof owner === "string" && owner.trim() ? owner.trim() : null;
}

function resultIdentity(result: SearchResult) {
  const metadata = metadataRecord(result);
  const ownerId = ownerIdForResult(result);
  return {
    accessIdentity: ownerId ? `owner:${stableHash(ownerId).slice(0, 16)}` : "public",
    generationIdentity:
      stringMetadata(metadata, "index_generation_id", "publication_reviewed_index_generation_id") ??
      "legacy-current-generation",
    releaseIdentity:
      stringMetadata(
        metadata,
        "site_content_release_digest",
        "site_content_release_id",
        "site_content_change_epoch",
        "release_digest",
      ) ?? "no-site-release",
  };
}

function sanitizeStructuredTableFacts(result: SearchResult): SearchResult {
  if (!result.table_facts?.length) return result;
  const tableFacts = result.table_facts.filter(
    (fact) =>
      Boolean(fact.row_label?.trim()) &&
      Boolean(fact.clinical_parameter?.trim()) &&
      Boolean(fact.threshold_value?.trim() || fact.action?.trim()),
  );
  return tableFacts.length === result.table_facts.length ? result : { ...result, table_facts: tableFacts };
}

function eligibleResult(
  result: SearchResult,
  claimRole: ClinicalClaimRole,
  expected: Pick<ClaimOrientedContextPackInput, "accessScope" | "snapshot">,
) {
  if (!knownCorpusScopes.has(result.corpus_scope as SourceCorpusScope)) return false;
  if (
    result.corpus_scope === "clinical_kb_site"
      ? !knownSiteDomains.has(result.site_content_domain ?? "")
      : result.site_content_domain != null
  )
    return false;
  const metadata = metadataRecord(result);
  if (result.source_metadata?.corpus_scope !== result.corpus_scope) return false;
  if (!Object.hasOwn(metadata, "row_owner_id")) return false;
  if (!retrievalAccessScopeMatchesOwner(expected.accessScope, ownerIdForResult(result))) return false;
  if (stringMetadata(metadata, "source_policy_version") !== expected.snapshot.sourcePolicyVersion) return false;
  if (result.corpus_scope === "clinical_kb_site") {
    const site = expected.snapshot.publicSiteContent;
    if (
      stringMetadata(metadata, "site_content_release_id") !== site.releaseId ||
      stringMetadata(metadata, "site_content_release_digest") !== site.releaseDigest ||
      stringMetadata(metadata, "site_content_change_epoch") !== site.changeEpoch
    )
      return false;
  } else if (
    stringMetadata(metadata, "index_generation_id", "publication_reviewed_index_generation_id") !==
    expected.snapshot.documentIndexGeneration
  ) {
    return false;
  }
  if (result.source_metadata?.source_kind === "registry_record") {
    return (
      result.corpus_scope === "clinical_kb_site" &&
      result.source_metadata.content_mode === "indexed_content" &&
      result.source_metadata.document_status === "current" &&
      (result.source_metadata.clinical_validation_status === "approved" ||
        result.source_metadata.clinical_validation_status === "locally_reviewed") &&
      result.source_metadata.extraction_quality === "good" &&
      sourceRoleEligibleForClaim(result.source_metadata.source_role, claimRole)
    );
  }
  return searchResultEligibilityForClaim(result, claimRole).eligible;
}

function atomicFeatures(members: readonly SearchResult[]) {
  const text = members
    .flatMap((member) => [
      member.content,
      member.retrieval_synopsis,
      ...(member.table_facts ?? []).flatMap((fact) => [
        fact.row_label,
        fact.clinical_parameter,
        fact.threshold_value,
        fact.action,
      ]),
    ])
    .filter(Boolean)
    .join(" ");
  return {
    hasPopulation: populationPattern.test(text),
    hasException: exceptionPattern.test(text),
    hasAction: actionPattern.test(text),
    hasUnitsOrQualifier: unitOrQualifierPattern.test(text),
    hasStructuredTableContext: members.some((member) => Boolean(member.table_facts?.length)),
  };
}

function canJoinAdjacent(group: PackedEvidenceGroup, result: SearchResult, claimRole: ClinicalClaimRole) {
  const last = group.members[group.members.length - 1];
  if (!last || group.claimRole !== claimRole || group.corpusScope !== result.corpus_scope) return false;
  const identity = resultIdentity(result);
  return (
    group.accessIdentity === "public" &&
    identity.accessIdentity === "public" &&
    group.generationIdentity === identity.generationIdentity &&
    group.releaseIdentity === identity.releaseIdentity &&
    last.document_id === result.document_id &&
    Math.abs(last.chunk_index - result.chunk_index) === 1
  );
}

function groupIdPayload(group: Omit<PackedEvidenceGroup, "id" | "atomicFeatures">) {
  return {
    version: ragContextPackVersion,
    subquestionIds: [...group.subquestionIds].sort(),
    required: group.required,
    claimRole: group.claimRole,
    evidenceFamilyIds: [...group.evidenceFamilyIds].sort(),
    corpusScope: group.corpusScope,
    accessIdentity: group.accessIdentity,
    generationIdentity: group.generationIdentity,
    releaseIdentity: group.releaseIdentity,
    members: group.members.map((member) => ({
      id: member.id,
      documentId: member.document_id,
      chunkIndex: member.chunk_index,
      pageNumber: member.page_number,
      role: member.source_metadata?.source_role ?? null,
      currentness: member.source_metadata?.document_status ?? null,
      serializedInputHash: stableHash(
        buildPackedRagSourceBlock([{ ...group, id: "", atomicFeatures: atomicFeatures([member]), members: [member] }]),
      ),
    })),
  };
}

function refreshGroup(group: PackedEvidenceGroup): PackedEvidenceGroup {
  const withoutDerived = {
    subquestionIds: [...new Set(group.subquestionIds)],
    required: group.required,
    claimRole: group.claimRole,
    evidenceFamilyIds: [...new Set(group.evidenceFamilyIds)],
    corpusScope: group.corpusScope,
    accessIdentity: group.accessIdentity,
    generationIdentity: group.generationIdentity,
    releaseIdentity: group.releaseIdentity,
    members: group.members,
  };
  return {
    ...withoutDerived,
    id: `pack-group:${stableHash(groupIdPayload(withoutDerived)).slice(0, 32)}`,
    atomicFeatures: atomicFeatures(group.members),
  };
}

export function contextPackTokenCeiling(queryClass: RagQueryClass, options: { crossDocument?: boolean } = {}) {
  if (options.crossDocument || queryClass === "comparison" || queryClass === "broad_summary") return 6_500;
  if (queryClass === "medication_dose_risk" || queryClass === "table_threshold") return 4_800;
  return queryClass === "document_lookup" ? 4_200 : 3_600;
}

export function packClaimOrientedContext(input: ClaimOrientedContextPackInput): ClaimOrientedContextPack {
  const requiredBySubquestion = new Map(input.coverage.subquestions.map((item) => [item.id, item.required] as const));
  const groups: PackedEvidenceGroup[] = [];
  const groupByFamily = new Map<string, PackedEvidenceGroup>();

  for (const selection of input.selections) {
    for (const rawResult of selection.orderedEvidence) {
      if (!eligibleResult(rawResult, selection.claimRole, input)) continue;
      const result = sanitizeStructuredTableFacts(rawResult);
      const evidenceFamilyIds = evidenceFamilyIdsForResult(result);
      const duplicate = evidenceFamilyIds.map((family) => groupByFamily.get(family)).find(Boolean);
      if (duplicate) {
        duplicate.subquestionIds.push(selection.subquestionId);
        duplicate.required ||= requiredBySubquestion.get(selection.subquestionId) === true;
        continue;
      }
      const previous = groups[groups.length - 1];
      if (previous && canJoinAdjacent(previous, result, selection.claimRole)) {
        previous.members.push(result);
        previous.subquestionIds.push(selection.subquestionId);
        previous.evidenceFamilyIds.push(...evidenceFamilyIds);
        evidenceFamilyIds.forEach((family) => groupByFamily.set(family, previous));
        continue;
      }
      const identity = resultIdentity(result);
      const group = refreshGroup({
        id: "",
        subquestionIds: [selection.subquestionId],
        required: requiredBySubquestion.get(selection.subquestionId) === true,
        claimRole: selection.claimRole,
        evidenceFamilyIds,
        corpusScope: result.corpus_scope!,
        ...identity,
        members: [result],
        atomicFeatures: atomicFeatures([result]),
      });
      groups.push(group);
      evidenceFamilyIds.forEach((family) => groupByFamily.set(family, group));
    }
  }

  const candidates = groups.map(refreshGroup);
  const selected: PackedEvidenceGroup[] = [];
  const selectedIds = new Set<string>();
  const omittedIds = new Set<string>();
  const tryAdd = (group: PackedEvidenceGroup, firstAllocationCeiling?: number) => {
    if (selectedIds.has(group.id)) return true;
    const truncationSensitive =
      group.atomicFeatures.hasException ||
      group.atomicFeatures.hasUnitsOrQualifier ||
      group.atomicFeatures.hasStructuredTableContext;
    if (
      truncationSensitive &&
      group.members.some(
        (member) => !ragSourceSerializationPreservesAtomicEvidence(member, { queryClass: input.queryClass }),
      )
    ) {
      omittedIds.add(group.id);
      return false;
    }
    if (
      firstAllocationCeiling !== undefined &&
      estimatePackedRagSourceBlockTokens([group], { queryClass: input.queryClass }) > firstAllocationCeiling
    ) {
      omittedIds.add(group.id);
      return false;
    }
    const trial = [...selected, group];
    if (estimatePackedRagSourceBlockTokens(trial, { queryClass: input.queryClass }) > Math.max(0, input.tokenBudget)) {
      omittedIds.add(group.id);
      return false;
    }
    selected.push(group);
    selectedIds.add(group.id);
    omittedIds.delete(group.id);
    return true;
  };

  const requiredSubquestions = input.coverage.subquestions.filter((subquestion) => subquestion.required);
  const firstAllocationCeiling = Math.floor(Math.max(0, input.tokenBudget) / Math.max(1, requiredSubquestions.length));
  for (const subquestion of requiredSubquestions) {
    if (selected.some((group) => group.subquestionIds.includes(subquestion.id))) continue;
    for (const candidate of candidates.filter((group) => group.subquestionIds.includes(subquestion.id))) {
      if (tryAdd(candidate, firstAllocationCeiling)) break;
    }
  }
  for (const group of candidates) tryAdd(group);

  const usedTokens = selected.length
    ? estimatePackedRagSourceBlockTokens(selected, { queryClass: input.queryClass })
    : 0;
  const packId = `context-pack:${stableHash({
    version: ragContextPackVersion,
    budget: input.tokenBudget,
    queryClass: input.queryClass ?? "unknown",
    planVersion: input.planVersion ?? "unknown-plan",
    snapshotIdentity: ragContextSnapshotCacheKey(input.snapshot),
    accessScope: stableHash(retrievalAccessScopeKey(input.accessScope)),
    groupIds: selected.map((group) => group.id),
    omittedGroupIds: [...omittedIds],
  }).slice(0, 32)}`;
  return { packId, groups: selected, usedTokens, omittedOptionalGroupIds: [...omittedIds] };
}

export function packedEvidenceResults(pack: ClaimOrientedContextPack) {
  const seen = new Set<string>();
  const results = pack.groups.flatMap((group) =>
    group.members.filter((member) => {
      if (seen.has(member.id)) return false;
      seen.add(member.id);
      return true;
    }),
  );
  packedGroupsByResultSet.set(results, pack.groups);
  return results;
}

export function buildContextSourceBlock(results: SearchResult[], options?: Parameters<typeof buildRagSourceBlock>[1]) {
  const groups = packedGroupsByResultSet.get(results);
  return groups ? buildPackedRagSourceBlock(groups, options) : buildRagSourceBlock(results, options);
}

export function packedContextCacheKey(
  results: SearchResult[],
  queryClass: RagQueryClass,
  options: {
    crossDocument?: boolean;
    documentIds?: string[];
    tokenBudget?: number;
    coverage?: AnswerCoveragePlan | null;
    selections?: CoverageEvidenceSelection[];
    planVersion?: string;
    snapshot?: RagContextSnapshot;
    accessScope?: RetrievalAccessScope;
  } = {},
) {
  const contextLimit = sourceContextPackLimit(queryClass, options);
  if (!options.coverage || !options.selections?.length) {
    const scopeKey = options.documentIds?.length
      ? legacyStableHash([...new Set(options.documentIds)].sort().join("|"))
      : "all-documents";
    return [
      queryClass,
      options.crossDocument ? "cross-document" : "single-document",
      `scope:${scopeKey}`,
      contextLimit,
      ...results
        .slice(0, contextLimit)
        .map((result) => `${result.id}:${result.document_id}:${result.chunk_index}:${result.page_number ?? "na"}`),
    ].join("|");
  }
  if (!options.snapshot || !options.accessScope)
    throw new Error("Governed context packing requires trusted admission.");
  return `${ragContextPackVersion}:${stableHash({
    queryClass,
    crossDocument: Boolean(options.crossDocument),
    scope: [...new Set(options.documentIds ?? [])].sort(),
    tokenBudget: options.tokenBudget ?? contextPackTokenCeiling(queryClass, options),
    planVersion: options.planVersion ?? "legacy-plan",
    snapshotIdentity: ragContextSnapshotCacheKey(options.snapshot),
    accessScope: stableHash(retrievalAccessScopeKey(options.accessScope)),
    coverage: options.coverage
      ? options.coverage.coverage.map((item) => [item.subquestionId, item.status, item.chunkIds, item.reasonCodes])
      : null,
    selections: options.selections?.map((selection) => [
      selection.subquestionId,
      selection.claimRole,
      selection.coverageReason,
      selection.orderedEvidence.map((result) => result.id),
    ]),
    results: results.slice(0, contextLimit).map((result) => ({
      id: result.id,
      documentId: result.document_id,
      chunkIndex: result.chunk_index,
      pageNumber: result.page_number,
      identity: resultIdentity(result),
      role: result.source_metadata?.source_role ?? null,
      currentness: result.source_metadata?.document_status ?? null,
      serializedInputHash: stableHash(
        buildPackedRagSourceBlock([
          refreshGroup({
            id: "",
            subquestionIds: [],
            required: false,
            claimRole: "treatment",
            evidenceFamilyIds: evidenceFamilyIdsForResult(result),
            corpusScope: result.corpus_scope ?? "uploaded_local",
            ...resultIdentity(result),
            members: [sanitizeStructuredTableFacts(result)],
            atomicFeatures: atomicFeatures([result]),
          }),
        ]),
      ),
    })),
  }).slice(0, 40)}`;
}

export function createGenerationContextPacker(options: {
  queryClass: RagQueryClass;
  crossDocument: boolean;
  documentIds?: string[];
  planVersion?: string;
  snapshot: RagContextSnapshot;
  accessScope: RetrievalAccessScope;
  loadLegacy: (results: SearchResult[]) => Promise<SearchResult[]>;
  onCacheHit?: () => void;
  onDuration?: (durationMs: number) => void;
}) {
  const cache = new Map<string, SearchResult[]>();
  return async (selection: ModelContextEvidenceSelection) => {
    const tokenBudget = contextPackTokenCeiling(options.queryClass, options);
    const identity = {
      crossDocument: options.crossDocument,
      documentIds: options.documentIds,
      tokenBudget,
      coverage: selection.coverage,
      selections: selection.coverageSelections,
      planVersion: options.planVersion,
      snapshot: options.snapshot,
      accessScope: options.accessScope,
    };
    const key = packedContextCacheKey(selection.results, options.queryClass, identity);
    const cached = cache.get(key);
    if (cached) {
      options.onCacheHit?.();
      return cached;
    }
    const startedAt = Date.now();
    const packed =
      selection.coverage && selection.coverageSelections.length
        ? packedEvidenceResults(
            packClaimOrientedContext({
              selections: selection.coverageSelections,
              coverage: selection.coverage,
              tokenBudget,
              queryClass: options.queryClass,
              planVersion: options.planVersion,
              snapshot: options.snapshot,
              accessScope: options.accessScope,
            }),
          )
        : await options.loadLegacy(selection.results);
    options.onDuration?.(Date.now() - startedAt);
    cache.set(key, packed);
    return packed;
  };
}

export function sourceContextPackLimit(queryClass: RagQueryClass, options: { crossDocument?: boolean } = {}) {
  return options.crossDocument || queryClass === "comparison" || queryClass === "broad_summary" ? 8 : 5;
}

export async function packAdjacentSourceContext(
  supabase: ReturnType<typeof createAdminClient>,
  results: SearchResult[],
  queryClass: RagQueryClass,
  options: { crossDocument?: boolean } = {},
) {
  const contextLimit = sourceContextPackLimit(queryClass, options);
  const targetResults = results.slice(0, contextLimit);
  const documentIds = Array.from(new Set(targetResults.map((result) => result.document_id)));
  const chunkIndexes = Array.from(
    new Set(
      targetResults.flatMap((result) => [result.chunk_index - 1, result.chunk_index + 1]).filter((index) => index >= 0),
    ),
  );
  if (documentIds.length === 0 || chunkIndexes.length === 0) return results;

  try {
    const { data, error } = await supabase
      .from("document_chunks")
      .select("id,document_id,page_number,chunk_index,section_heading,content,retrieval_synopsis,index_generation_id")
      .in("document_id", documentIds)
      .in("chunk_index", chunkIndexes)
      .order("chunk_index", { ascending: true })
      .limit(80);
    if (error || !data?.length) return results;

    const chunksByDocumentAndIndex = new Map<
      string,
      { id: string; section_heading: string | null; content: string; retrieval_synopsis?: string | null }
    >();
    const committedGenerationByDocument = new Map(
      targetResults.map((result) => [result.document_id, committedIndexGeneration(result.source_metadata)] as const),
    );
    for (const chunk of data) {
      const committedGeneration = committedGenerationByDocument.get(chunk.document_id);
      if (chunk.index_generation_id && chunk.index_generation_id !== committedGeneration) continue;
      chunksByDocumentAndIndex.set(`${chunk.document_id}:${chunk.chunk_index}`, {
        id: chunk.id,
        section_heading: chunk.section_heading,
        content: chunk.content,
        retrieval_synopsis: chunk.retrieval_synopsis ?? null,
      });
    }

    const targetIds = new Set(targetResults.map((result) => result.id));
    return results.map((result) => {
      if (!targetIds.has(result.id)) return result;
      const adjacent = [result.chunk_index - 1, result.chunk_index + 1]
        .map((index) => chunksByDocumentAndIndex.get(`${result.document_id}:${index}`))
        .filter((chunk): chunk is NonNullable<typeof chunk> =>
          Boolean(chunk && chunk.id !== result.id && chunk.content.trim()),
        )
        .map((chunk) => {
          const heading = chunk.section_heading ? `${chunk.section_heading}: ` : "";
          return compactContextText(`${heading}${chunk.retrieval_synopsis || chunk.content}`, 520);
        });
      return adjacent.length ? { ...result, adjacent_context: adjacent.join(" ") } : result;
    });
  } catch {
    return results;
  }
}

export function attachAdjacentContext(results: SearchResult[], packed: SearchResult[]): SearchResult[] {
  const adjacentById = new Map<string, string>();
  for (const source of packed) if (source.adjacent_context) adjacentById.set(source.id, source.adjacent_context);
  if (adjacentById.size === 0) return results;
  return results.map((result) => {
    const adjacent = adjacentById.get(result.id);
    return adjacent && adjacent !== result.adjacent_context ? { ...result, adjacent_context: adjacent } : result;
  });
}
