import { describe, expect, it } from "vitest";

import {
  buildPackedCrossDocumentFusionBrief,
  contextPackTokenCeiling,
  createGenerationContextPacker,
  packClaimOrientedContext,
  packModelContextEvidencePair,
  packedEvidenceResults,
  packedContextCacheKey,
} from "@/lib/rag/rag-context-pack";
import { issueContextPackAdmissionReceipt, restoreCachedContextPackAdmission } from "@/lib/rag/rag-context-admission";
import { selectModelContextEvidence } from "@/lib/rag/rag-context-selection";
import { buildEvidencePreviewUnit } from "@/lib/answer-preview";
import { parseAnswerJson } from "@/lib/rag/rag";
import { retainRelatedDocumentsForResults } from "@/lib/retrieval-selection";
import { buildPackedRagSourceBlock, estimatePackedRagSourceBlockTokens } from "@/lib/rag/rag-source-block";
import type { CoverageEvidenceSelection } from "@/lib/rag/rag-coverage";
import type { RagContextSnapshot } from "@/lib/site-content/site-content-contracts";
import type {
  AnswerCoveragePlan,
  ClinicalClaimRole,
  ClinicalSourceRole,
  RagQueryPlan,
  SearchResult,
  SourcePolicyConflict,
  SourceCorpusScope,
} from "@/lib/types";

function evidence(
  id: string,
  content: string,
  overrides: Partial<SearchResult> & {
    corpusScope?: SourceCorpusScope;
    sourceRole?: ClinicalSourceRole;
    generation?: string;
    ownerId?: string | null;
    contentHash?: string;
  } = {},
): SearchResult {
  const {
    corpusScope = "australian_public",
    sourceRole = "clinical_guideline",
    generation = "generation-current",
    ownerId = null,
    contentHash = `hash-${id}`,
    ...resultOverrides
  } = overrides;
  return {
    id,
    document_id: resultOverrides.document_id ?? "doc-guideline",
    title: "WA guideline",
    file_name: "wa-guideline.pdf",
    page_number: 1,
    chunk_index: 1,
    section_heading: "Management",
    content,
    image_ids: [],
    similarity: 0.95,
    images: [],
    corpus_scope: corpusScope,
    site_content_domain: corpusScope === "clinical_kb_site" ? "medications" : null,
    context_pack_admission: issueContextPackAdmissionReceipt(
      corpusScope === "clinical_kb_site"
        ? {
            ownerId,
            sourcePolicyVersion: "source-policy-v1",
            indexGeneration: null,
            document: null,
            siteContent: {
              releaseId: currentReleaseId,
              releaseDigest: currentReleaseDigest,
              changeEpoch: "7",
            },
          }
        : {
            ownerId,
            sourcePolicyVersion: "source-policy-v1",
            indexGeneration: generation,
            document:
              corpusScope === "australian_public"
                ? {
                    corpusScope: "australian_public",
                    documentId: resultOverrides.document_id ?? "doc-guideline",
                    chunkId: id,
                  }
                : null,
            siteContent: null,
          },
    ),
    source_metadata: {
      source_kind: corpusScope === "clinical_kb_site" ? "registry_record" : "document",
      source_title: "WA guideline",
      publisher: corpusScope === "australian_public" ? "Office of the Chief Psychiatrist WA" : "WA Health",
      publisher_code: corpusScope === "australian_public" ? "OCPWA" : null,
      jurisdiction: "Australia/WA",
      version: "1",
      publication_date: "2026-01-01",
      review_date: "2027-01-01",
      uploaded_at: "2026-01-01",
      indexed_at: "2026-01-01",
      uploaded_by: ownerId,
      corpus_scope: corpusScope,
      source_role: sourceRole,
      content_mode: "indexed_content",
      source_catalogue_key: corpusScope === "australian_public" ? "wa-chief-psychiatrist" : `catalogue:${id}`,
      source_policy_version: corpusScope === "australian_public" ? "australian-source-policy-v1" : "source-policy-v1",
      content_hash: contentHash,
      change_state: "unchanged",
      licence_policy: "public_index_permitted",
      document_status: "current",
      clinical_validation_status: "approved",
      extraction_quality: "good",
      index_generation_id: generation,
      row_owner_id: ownerId,
    } as SearchResult["source_metadata"],
    relevance: {
      verdict: "direct",
      label: "direct",
      matchedTerms: ["clinical"],
      missingTerms: [],
      directSourceCount: 1,
      weakSourceCount: 0,
      score: 1,
      supportReason: "direct test evidence",
      isSourceBacked: true,
      coverageScore: 1,
      rankScore: 1,
      titleMatchedTerms: [],
      contentMatchedTerms: ["clinical"],
      metadataMatchedTerms: [],
      chips: [],
    },
    ...resultOverrides,
  };
}

function selection(
  subquestionId: string,
  orderedEvidence: SearchResult[],
  claimRole: ClinicalClaimRole = "treatment",
  conflicts: SourcePolicyConflict[] = [],
): CoverageEvidenceSelection {
  return {
    subquestionId,
    claimRole,
    orderedEvidence,
    collapsedEvidenceFamilyIds: [],
    conflicts,
    sourcePolicyReview: "not_applicable",
    coverageReason: "direct",
  };
}

function queryPlan(ids: string[]): RagQueryPlan {
  return {
    version: "rag-query-plan-v1",
    kind: ids.length > 1 ? "decomposed" : "single",
    originalQuery: "private original query",
    interpretation: "test plan",
    subquestions: ids.map((id) => ({ id, question: `private wording for ${id}`, purpose: "primary", required: true })),
    targetSiteDomains: [],
    siteDomainDecision: "none",
    reasonCodes: [],
  };
}

function conflict(local: SearchResult, australian: SearchResult, claimRole: ClinicalClaimRole): SourcePolicyConflict {
  const side = (result: SearchResult) => ({
    documentId: result.document_id,
    catalogueKey: String(result.source_metadata?.source_catalogue_key),
    title: result.title,
    publisher: result.source_metadata?.publisher ?? "publisher",
    publicationDate: result.source_metadata?.publication_date ?? null,
    effectiveFrom: result.source_metadata?.effective_date ?? null,
    jurisdiction: result.source_metadata?.jurisdiction ?? "Australia",
    sourceRole: result.source_metadata!.source_role!,
    corpusScope: result.corpus_scope!,
    supportingChunkIds: [result.id],
  });
  return {
    version: "source-policy-conflict-v1",
    id: `conflict:${local.id}:${australian.id}`,
    claimRole,
    topicKey: "shared-topic",
    local: { ...side(local), corpusScope: "uploaded_local" },
    australian: { ...side(australian), corpusScope: "australian_public" },
    overlapReason: "same_claim",
    materialDifferenceReason: "recommendation_differs",
    localPrimaryDecision: { selected: "uploaded_local", reason: "current_valid_accessible_directly_supportive" },
    reviewTargetDocumentId: local.document_id,
  };
}

function coverage(ids: string[]): AnswerCoveragePlan {
  return {
    interpretation: "raw clinical question must not enter a pack identifier",
    ambiguity: null,
    subquestions: ids.map((id) => ({ id, question: `private wording for ${id}`, required: true })),
    coverage: ids.map((subquestionId) => ({
      subquestionId,
      status: "direct",
      chunkIds: [],
      reasonCodes: ["direct"],
    })),
    conflicts: [],
    overall: "complete",
    insufficiencyReason: null,
  };
}

const currentReleaseId = "12345678-1234-5678-9234-123456789abc";
const currentReleaseDigest = "a".repeat(64);

function currentSnapshot(): RagContextSnapshot {
  return {
    version: "rag-context-snapshot-v1",
    resolvedAt: "2026-09-01T00:00:00.000Z",
    documentIndexGeneration: "generation-current",
    sourcePolicyVersion: "source-policy-v1",
    rolloutVersion: "rollout-v1",
    siteContentRegistryVersion: "site-content-registry-v1",
    publicSiteContent: {
      releaseId: currentReleaseId,
      staticManifestDigest: "b".repeat(64),
      dynamicStateDigest: "c".repeat(64),
      releaseDigest: currentReleaseDigest,
      changeEpoch: "7",
      state: "current",
    },
  };
}

function trustedAdmission() {
  return {
    accessScope: { includePublic: true },
    snapshot: currentSnapshot(),
  };
}

describe("claim-oriented context packing", () => {
  it("keeps a population exception, action, dose, unit and qualifier in one atomic group", () => {
    const source = evidence(
      "dose-exception",
      "For adults use 500 mg nightly. For adults over 65 years, use 250 mg nightly and do not exceed 500 mg daily.",
    );
    const pack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [selection("dose", [source], "dose_or_monitoring")],
      coverage: coverage(["dose"]),
      tokenBudget: 1_200,
    });

    expect(pack.groups).toHaveLength(1);
    expect(pack.groups[0]?.atomicFeatures).toMatchObject({
      hasAction: true,
      hasException: true,
      hasPopulation: true,
      hasUnitsOrQualifier: true,
    });
    const rendered = buildPackedRagSourceBlock(pack.groups);
    expect(rendered).toContain("adults over 65 years");
    expect(rendered).toContain("250 mg nightly");
    expect(rendered).toContain("do not exceed 500 mg daily");
    expect(pack.usedTokens).toBe(estimatePackedRagSourceBlockTokens(pack.groups));
  });

  it("drops an atomic numeric or exception group whole when the ceiling cannot fit it", () => {
    const source = evidence(
      "atomic-dose",
      "For pregnancy, do not use Drug A above 25 mg daily; use Drug B 5 mg nightly instead.",
    );
    const pack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [selection("safety", [source], "safety")],
      coverage: coverage(["safety"]),
      tokenBudget: 8,
    });

    expect(pack.groups).toEqual([]);
    expect(pack.usedTokens).toBe(0);
    expect(pack.omittedOptionalGroupIds).toHaveLength(1);
    expect(pack.usedTokens).toBeLessThanOrEqual(8);
  });

  it("omits an atomic claim whose serialized source field would truncate its qualifier or unit", () => {
    const source = evidence(
      "overlong-atomic-dose",
      `${"Background context without a decision. ".repeat(70)} For pregnancy, use 5 mg nightly only.`,
    );
    const pack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [selection("dose", [source], "dose_or_monitoring")],
      coverage: coverage(["dose"]),
      tokenBudget: 2_000,
    });

    expect(pack.groups).toEqual([]);
    expect(pack.omittedOptionalGroupIds).toHaveLength(1);
  });

  it("retains a structured cell only with its required row and column headers", () => {
    const source = evidence("table-threshold", "Use the structured threshold table.", {
      table_facts: [
        {
          id: "valid-row",
          document_id: "doc-guideline",
          source_chunk_id: "table-threshold",
          source_image_id: null,
          page_number: 1,
          table_title: "ANC actions",
          row_label: "Red range",
          clinical_parameter: "ANC",
          threshold_value: "below 1.0 x10^9/L",
          action: "Stop clozapine and contact haematology",
        },
        {
          id: "malformed-row",
          document_id: "doc-guideline",
          source_chunk_id: "table-threshold",
          source_image_id: null,
          page_number: 1,
          table_title: "ANC actions",
          row_label: null,
          clinical_parameter: null,
          threshold_value: "below 0.5 x10^9/L",
          action: "Unscoped action must not be packed",
        },
      ],
    });
    const pack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [selection("threshold", [source], "dose_or_monitoring")],
      coverage: coverage(["threshold"]),
      tokenBudget: 1_200,
      queryClass: "table_threshold",
    });
    const rendered = buildPackedRagSourceBlock(pack.groups, { queryClass: "table_threshold" });

    expect(rendered).toContain("row label: Red range");
    expect(rendered).toContain("clinical parameter: ANC");
    expect(rendered).toContain("below 1.0 x10^9/L");
    expect(rendered).not.toContain("Unscoped action must not be packed");
    expect(rendered).not.toContain("below 0.5 x10^9/L");
    expect(pack.usedTokens).toBe(estimatePackedRagSourceBlockTokens(pack.groups, { queryClass: "table_threshold" }));
  });

  it("rejects staged, private and wrong-release evidence before grouping adjacent members", () => {
    const primary = evidence("primary", "Adults should receive the first action.", { chunk_index: 5 });
    const adjacent = evidence("adjacent", "For pregnancy, use the exception action.", { chunk_index: 6 });
    const crossGeneration = evidence("staged", "Staged generation text.", {
      chunk_index: 7,
      generation: "generation-staged",
    });
    const privateAdjacent = evidence("private", "Private adjacent text.", {
      chunk_index: 4,
      ownerId: "owner-secret",
    });
    const wrongRole = evidence("wrong-role", "Link-only service directory text.", {
      chunk_index: 3,
      sourceRole: "service_directory",
    });
    const wrongRelease = evidence("wrong-release", "Content from a different site release.", {
      corpusScope: "clinical_kb_site",
      sourceRole: "clinical_reference",
      document_id: "site-doc",
      context_pack_admission: issueContextPackAdmissionReceipt({
        ownerId: null,
        sourcePolicyVersion: "source-policy-v1",
        indexGeneration: null,
        document: null,
        siteContent: {
          releaseId: "87654321-4321-5678-9234-cba987654321",
          releaseDigest: "d".repeat(64),
          changeEpoch: "8",
        },
      }),
      source_metadata: {
        ...evidence("site-template", "template", {
          corpusScope: "clinical_kb_site",
          sourceRole: "clinical_reference",
        }).source_metadata!,
        site_content_release_id: "87654321-4321-5678-9234-cba987654321",
        site_content_release_digest: "d".repeat(64),
        site_content_change_epoch: "8",
      } as SearchResult["source_metadata"],
    });
    const pack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [
        selection("treatment", [primary, adjacent, crossGeneration, privateAdjacent, wrongRole, wrongRelease]),
      ],
      coverage: coverage(["treatment"]),
      tokenBudget: 2_000,
    });

    expect(pack.groups[0]?.members.map((member) => member.id)).toEqual(["primary", "adjacent"]);
    expect(pack.groups.every((group) => group.members.every((member) => member.id !== "wrong-role"))).toBe(true);
    expect(
      pack.groups.every((group) => new Set(group.members.map((member) => member.id)).size === group.members.length),
    ).toBe(true);
    expect(packedEvidenceResults(pack).map((member) => member.id)).toEqual(["primary", "adjacent"]);
  });

  it("joins safe same-document adjacency even when another document is interleaved in ranking", () => {
    const first = evidence("same-doc-5", "Assess the current presentation before treatment.", {
      chunk_index: 5,
    });
    const interleaved = evidence("other-doc", "Record the unrelated administrative note.", {
      document_id: "doc-other",
      chunk_index: 2,
    });
    const second = evidence("same-doc-6", "Titrate treatment for elderly patients only after review.", {
      chunk_index: 6,
    });
    const pack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [selection("treatment", [first, interleaved, second])],
      coverage: coverage(["treatment"]),
      tokenBudget: 360,
    });

    const sameDocumentGroup = pack.groups.find((group) => group.members.some((member) => member.id === "same-doc-5"));
    expect(sameDocumentGroup?.members.map((member) => member.id)).toEqual(["same-doc-5", "same-doc-6"]);
    expect(packedEvidenceResults(pack).map((member) => member.id)).toEqual(["same-doc-5", "same-doc-6", "other-doc"]);
    expect(pack.usedTokens).toBeLessThanOrEqual(360);
  });

  it("deduplicates evidence families and gives every required subquestion a bounded first group", () => {
    const monitoring = evidence("monitoring", "Check lithium levels after dose changes.", {
      contentHash: "family-monitoring",
    });
    const derivedDuplicate = evidence("derived-summary", "Summary of lithium monitoring.", {
      corpusScope: "clinical_kb_site",
      sourceRole: "clinical_reference",
      contentHash: "family-monitoring",
      source_metadata: {
        ...evidence("template", "template").source_metadata!,
        source_kind: "registry_record",
        corpus_scope: "clinical_kb_site",
        source_role: "clinical_reference",
        content_mode: "indexed_content",
        document_status: "current",
        clinical_validation_status: "approved",
        extraction_quality: "good",
        content_hash: "family-monitoring",
        site_content_release_id: currentReleaseId,
        site_content_release_digest: currentReleaseDigest,
        site_content_change_epoch: "7",
      } as SearchResult["source_metadata"],
    });
    const escalation = evidence("escalation", "Escalate urgently for severe toxicity.", {
      document_id: "doc-escalation",
      contentHash: "family-escalation",
    });
    const pack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [selection("monitoring", [monitoring]), selection("escalation", [derivedDuplicate, escalation])],
      coverage: coverage(["monitoring", "escalation"]),
      tokenBudget: 1_500,
    });

    expect(
      pack.groups.filter((group) => group.evidenceFamilyIds.includes("source-family:family-monitoring")),
    ).toHaveLength(1);
    expect(new Set(pack.groups.flatMap((group) => group.subquestionIds))).toEqual(
      new Set(["monitoring", "escalation"]),
    );
  });

  it("retains novel overlapping families and never reuses evidence across claim roles", () => {
    const shared = evidence("shared", "Use the treatment pathway.", { contentHash: "family-x" });
    const expanded = evidence("expanded", "Use the pathway and the legal safeguard.", {
      contentHash: "family-z",
      source_metadata: {
        ...evidence("expanded-template", "template").source_metadata!,
        content_hash: "family-z",
        site_content_lineage: [{ sourceId: shared.document_id, sourceHash: "family-x", relationship: "references" }],
      } as SearchResult["source_metadata"],
    });
    const legalBase = evidence("legal", "Confirm the legal authority before proceeding.", {
      sourceRole: "legal",
      contentHash: "family-x",
    });
    const legal = {
      ...legalBase,
      source_metadata: {
        ...legalBase.source_metadata!,
        publisher: "Western Australian Legislation",
        publisher_code: "WALEG",
        source_catalogue_key: "wa-legislation",
      },
    };
    const pack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [selection("treatment", [shared, expanded]), selection("legal", [legal], "legal")],
      coverage: coverage(["treatment", "legal"]),
      tokenBudget: 1_500,
    });

    expect(new Set(packedEvidenceResults(pack).map((result) => result.id))).toEqual(
      new Set(["shared", "expanded", "legal"]),
    );
    expect(pack.groups.find((group) => group.members.some((member) => member.id === "legal"))?.claimRole).toBe("legal");
  });

  it("admits both sides of a verified conflict atomically or omits both", () => {
    const local = evidence("local-conflict", "Use the local action.", {
      contentHash: "same-family",
    });
    const australian = evidence("au-conflict", "Use the national action.", {
      corpusScope: "australian_public",
      sourceRole: "clinical_guideline",
      document_id: "doc-national",
      contentHash: "same-family",
    });
    const lane = selection("treatment", [local, australian], "treatment", [conflict(local, australian, "treatment")]);
    const fittingPack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [lane],
      coverage: coverage(["treatment"]),
      tokenBudget: 1_000,
    });
    const pairTokens = fittingPack.usedTokens;
    const oneSideTokens = estimatePackedRagSourceBlockTokens(
      packClaimOrientedContext({
        ...trustedAdmission(),
        selections: [selection("treatment", [local])],
        coverage: coverage(["treatment"]),
        tokenBudget: 1_000,
      }).groups,
    );
    const constrainedPack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [lane],
      coverage: coverage(["treatment"]),
      tokenBudget: oneSideTokens,
    });

    expect(packedEvidenceResults(fittingPack).map((result) => result.id)).toEqual([local.id, australian.id]);
    expect(pairTokens).toBeGreaterThan(oneSideTokens);
    expect(packedEvidenceResults(constrainedPack)).toEqual([]);
  });

  it("tries the next fitting group so one large first candidate cannot starve another required lane", () => {
    const largeFirst = evidence("large-first", `Background ${"context ".repeat(150)}without a required action.`, {
      document_id: "doc-large",
    });
    const compactFirst = evidence("compact-first", "Use the compact treatment action.", {
      document_id: "doc-compact",
    });
    const compactSecond = evidence("compact-second", "Monitor the compact safety action.", {
      document_id: "doc-safety",
    });
    const pack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [selection("treatment", [largeFirst, compactFirst]), selection("safety", [compactSecond], "safety")],
      coverage: coverage(["treatment", "safety"]),
      tokenBudget: 600,
    });

    expect(pack.groups.flatMap((group) => group.members.map((member) => member.id))).toEqual([
      "compact-first",
      "compact-second",
    ]);
    expect(new Set(pack.groups.flatMap((group) => group.subquestionIds))).toEqual(new Set(["treatment", "safety"]));
    expect(pack.usedTokens).toBeLessThanOrEqual(600);
  });

  it("reserves a fitting required singleton before an oversized adjacent chunk", () => {
    const required = evidence("required-singleton", "Use the required treatment action.", { chunk_index: 5 });
    const oversizedAdjacent = evidence(
      "oversized-adjacent",
      `Context ${"background ".repeat(100)}that is not required to answer the question.`,
      { chunk_index: 6 },
    );
    const requiredOnly = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [selection("treatment", [required])],
      coverage: coverage(["treatment"]),
      tokenBudget: 2_000,
    });
    const tokenBudget = requiredOnly.usedTokens + 8;

    expect(
      estimatePackedRagSourceBlockTokens(
        packClaimOrientedContext({
          ...trustedAdmission(),
          selections: [selection("treatment", [required, oversizedAdjacent])],
          coverage: coverage(["treatment"]),
          tokenBudget: 2_000,
        }).groups,
      ),
    ).toBeGreaterThan(tokenBudget);

    const pack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [selection("treatment", [required, oversizedAdjacent])],
      coverage: coverage(["treatment"]),
      tokenBudget,
    });

    expect(packedEvidenceResults(pack).map((result) => result.id)).toEqual([required.id]);
    expect(pack.groups.flatMap((group) => group.subquestionIds)).toContain("treatment");
    expect(pack.usedTokens).toBeLessThanOrEqual(tokenBudget);
  });

  it("preserves a required singleton when adjacent evidence cannot be serialized losslessly", () => {
    const required = evidence("required-before-lossy", "Use the required treatment action.", { chunk_index: 8 });
    const lossyAdjacent = evidence(
      "lossy-adjacent",
      `${"Neutral background. ".repeat(180)} For newborns, notify the neonatal team immediately.`,
      { chunk_index: 9 },
    );
    const pack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [selection("treatment", [required, lossyAdjacent])],
      coverage: coverage(["treatment"]),
      tokenBudget: 2_000,
    });

    expect(packedEvidenceResults(pack).map((result) => result.id)).toEqual([required.id]);
    expect(pack.groups.flatMap((group) => group.subquestionIds)).toContain("treatment");
  });

  it("uses content-free versioned identities and never exceeds the route ceiling", () => {
    const rawQuestion = "private pregnancy wording 7461";
    const source = evidence("identity", "Current public clinical guidance.");
    const answerCoverage = coverage([rawQuestion]);
    const selections = [selection(rawQuestion, [source])];
    const tokenBudget = contextPackTokenCeiling("broad_summary", { crossDocument: true });
    const pack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections,
      coverage: answerCoverage,
      tokenBudget,
      planVersion: "rag-query-plan-v1",
    });
    const key = packedContextCacheKey([source], "broad_summary", {
      crossDocument: true,
      tokenBudget,
      coverage: answerCoverage,
      selections,
      planVersion: "rag-query-plan-v1",
      ...trustedAdmission(),
    });
    const changed = packedContextCacheKey([{ ...source, content: "Changed serialized input." }], "broad_summary", {
      crossDocument: true,
      tokenBudget,
      coverage: answerCoverage,
      selections,
      planVersion: "rag-query-plan-v1",
      ...trustedAdmission(),
    });

    expect(pack.packId).not.toContain(rawQuestion);
    expect(pack.groups.every((group) => !group.id.includes(rawQuestion))).toBe(true);
    expect(key).not.toContain(rawQuestion);
    expect(changed).not.toBe(key);
    expect(pack.usedTokens).toBeLessThanOrEqual(tokenBudget);
  });

  it("preserves the predecessor cache key bytes when governed packing is inapplicable", () => {
    const source = evidence("legacy-key", "Legacy context.", {
      document_id: "legacy-document",
      chunk_index: 4,
      page_number: 9,
    });

    expect(packedContextCacheKey([source], "broad_summary", { crossDocument: true })).toBe(
      "broad_summary|cross-document|scope:all-documents|8|legacy-key:legacy-document:4:9",
    );
  });

  it("hashes governed candidates beyond the predecessor context limit", () => {
    const results = Array.from({ length: 9 }, (_, index) =>
      evidence(`candidate-${index + 1}`, `Candidate ${index + 1} current content.`, {
        document_id: `doc-${index + 1}`,
      }),
    );
    const answerCoverage = coverage(["summary"]);
    const selections = [selection("summary", results)];
    const identity = {
      crossDocument: true,
      coverage: answerCoverage,
      selections,
      planVersion: "rag-query-plan-v1",
      ...trustedAdmission(),
    };
    const changedNinth = { ...results[8]!, content: "Ninth candidate changed current content." };

    expect(packedContextCacheKey(results, "broad_summary", identity)).not.toBe(
      packedContextCacheKey([...results.slice(0, 8), changedNinth], "broad_summary", {
        ...identity,
        selections: [selection("summary", [...results.slice(0, 8), changedNinth])],
      }),
    );
    expect(packedContextCacheKey(results, "broad_summary", { crossDocument: true })).toBe(
      `broad_summary|cross-document|scope:all-documents|8|${results
        .slice(0, 8)
        .map((result) => `${result.id}:${result.document_id}:${result.chunk_index}:${result.page_number ?? "na"}`)
        .join("|")}`,
    );
  });

  it("partitions governed cache identity by required lanes and verified conflicts", () => {
    const local = evidence("cache-local", "Use the local monitoring schedule.", {
      corpusScope: "uploaded_local",
      sourceRole: "local_guideline",
    });
    const australian = evidence("cache-au", "Use the Australian monitoring schedule.", {
      corpusScope: "australian_public",
      sourceRole: "clinical_guideline",
      document_id: "doc-cache-au",
    });
    const requiredCoverage = coverage(["monitoring"]);
    const optionalCoverage: AnswerCoveragePlan = {
      ...requiredCoverage,
      subquestions: requiredCoverage.subquestions.map((subquestion) => ({ ...subquestion, required: false })),
    };
    const plainSelection = selection("monitoring", [local, australian], "dose_or_monitoring");
    const conflictedSelection = selection("monitoring", [local, australian], "dose_or_monitoring", [
      conflict(local, australian, "dose_or_monitoring"),
    ]);
    const identity = {
      coverage: requiredCoverage,
      selections: [plainSelection],
      planVersion: "rag-query-plan-v1",
      ...trustedAdmission(),
    };
    const requiredKey = packedContextCacheKey([local, australian], "medication_dose_risk", identity);

    expect(
      packedContextCacheKey([local, australian], "medication_dose_risk", {
        ...identity,
        coverage: optionalCoverage,
      }),
    ).not.toBe(requiredKey);
    expect(
      packedContextCacheKey([local, australian], "medication_dose_risk", {
        ...identity,
        selections: [conflictedSelection],
      }),
    ).not.toBe(requiredKey);
  });

  it("partitions governed cache identity and reuse by evidence-family lineage", async () => {
    const original = evidence("lineage-cache", "Use the current treatment action.", {
      contentHash: "shared-content-hash",
    });
    const changedLineage = {
      ...original,
      source_metadata: {
        ...original.source_metadata!,
        site_content_lineage: [
          { sourceId: "upstream-guideline", sourceHash: "upstream-hash", relationship: "derived_from" as const },
        ],
      },
    };
    const answerCoverage = coverage(["treatment"]);
    const identityFor = (result: SearchResult) => ({
      coverage: answerCoverage,
      selections: [selection("treatment", [result])],
      planVersion: "rag-query-plan-v1",
      ...trustedAdmission(),
    });
    const originalKey = packedContextCacheKey([original], "document_lookup", identityFor(original));
    const changedKey = packedContextCacheKey([changedLineage], "document_lookup", identityFor(changedLineage));
    let cacheHits = 0;
    const pack = createGenerationContextPacker({
      queryClass: "document_lookup",
      crossDocument: false,
      planVersion: "rag-query-plan-v1",
      ...trustedAdmission(),
      loadLegacy: async (results) => results,
      onCacheHit: () => {
        cacheHits += 1;
      },
    });
    const modelSelectionFor = (result: SearchResult) => ({
      results: [result],
      coverageSelections: [selection("treatment", [result])],
      coverage: answerCoverage,
    });

    await pack(modelSelectionFor(original));
    await pack(modelSelectionFor(changedLineage));

    expect(changedKey).not.toBe(originalKey);
    expect(cacheHits).toBe(0);
    expect(packedContextCacheKey([changedLineage], "document_lookup")).toBe(
      packedContextCacheKey([original], "document_lookup"),
    );
  });

  it("fails closed when authoritative owner or generation admission is absent", () => {
    const missingOwner = evidence("missing-owner", "Private candidate without a verified owner.", {
      ownerId: "owner-a",
    });
    const nullGeneration = evidence("null-generation", "Public candidate without a committed generation.", {
      generation: "",
    });
    const forgedOwner = { ...missingOwner, context_pack_admission: undefined };
    const forgedGeneration = { ...nullGeneration, context_pack_admission: undefined };
    const pack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [selection("owner", [forgedOwner]), selection("generation", [forgedGeneration])],
      coverage: coverage(["owner", "generation"]),
      tokenBudget: 1_500,
    });

    expect(packedEvidenceResults(pack)).toEqual([]);
  });

  it("restores opaque admission only at the validated cache boundary", () => {
    const source = evidence("cached", "Cached current guidance.", {
      corpusScope: "australian_public",
      sourceRole: "clinical_guideline",
      document_id: "doc-cached",
    });
    const cloned = structuredClone([source]);
    const rejected = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [selection("cached", cloned)],
      coverage: coverage(["cached"]),
      tokenBudget: 1_000,
    });
    const restored = restoreCachedContextPackAdmission(cloned);
    const admitted = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [selection("cached", restored)],
      coverage: coverage(["cached"]),
      tokenBudget: 1_000,
    });

    expect(packedEvidenceResults(rejected)).toEqual([]);
    expect(packedEvidenceResults(admitted).map((result) => result.id)).toEqual(["cached"]);
  });

  it("rejects restored document admission transplanted across corpus, document, or chunk identity", () => {
    const source = evidence("receipt-source", "Current Australian guidance.", {
      corpusScope: "australian_public",
      sourceRole: "clinical_guideline",
      document_id: "receipt-document",
    });
    const cached = structuredClone(source);
    const variants: SearchResult[] = [
      {
        ...cached,
        corpus_scope: "uploaded_local",
        source_metadata: { ...cached.source_metadata!, corpus_scope: "uploaded_local" },
      },
      {
        ...cached,
        corpus_scope: "international_supplementary",
        source_metadata: { ...cached.source_metadata!, corpus_scope: "international_supplementary" },
      },
      { ...cached, document_id: "transplanted-document" },
      { ...cached, id: "transplanted-chunk" },
      {
        ...cached,
        context_pack_admission: {
          ...cached.context_pack_admission!,
          siteContent: {
            releaseId: "12345678-1234-5678-9234-123456789abc",
            releaseDigest: "d".repeat(64),
            changeEpoch: "epoch-transplanted",
          },
        },
      },
    ];

    const restored = restoreCachedContextPackAdmission([cached, ...variants]);

    expect(restored[0]?.context_pack_admission).toBeDefined();
    expect(restored.slice(1).every((result) => result.context_pack_admission === undefined)).toBe(true);
  });

  it("does not synthesize trusted admission provenance during model-context selection", () => {
    const candidate = { ...evidence("unreceipted", "Use the current treatment."), context_pack_admission: undefined };
    const selected = selectModelContextEvidence({
      routeMode: "strong",
      queryClass: "document_lookup",
      crossDocument: false,
      results: [candidate],
      queryPlan: queryPlan(["treatment"]),
      ...trustedAdmission(),
    });

    expect(selected.results[0]?.context_pack_admission).toBeUndefined();
  });

  it.each([
    "Keep systolic pressure below 80 mmHg.",
    "Repeat the tracing after 120 ms.",
    "Hold treatment above 0.5 ng/mL.",
    "Administer 2 tablets.",
    "Give 4 puffs.",
    "Repeat the assessment every 4 hours.",
    "For pregnant adults, contact the specialist immediately.",
  ])("omits an overlong truncation-sensitive instruction: %s", (instruction) => {
    const source = evidence(
      "overlong-instruction",
      `${"Background without an instruction. ".repeat(80)} ${instruction}`,
    );
    const pack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [selection("instruction", [source], "dose_or_monitoring")],
      coverage: coverage(["instruction"]),
      tokenBudget: 2_000,
    });

    expect(packedEvidenceResults(pack)).toEqual([]);
  });

  it.each([
    {
      field: "retrieval synopsis",
      overrides: {
        retrieval_synopsis: `${"Background without a clinical directive. ".repeat(30)} Titrate treatment for elderly patients.`,
      },
    },
    {
      field: "adjacent context",
      overrides: {
        adjacent_context: `${"Background without a clinical directive. ".repeat(38)} Hold treatment for perinatal patients.`,
      },
    },
    {
      field: "memory card",
      overrides: {
        memory_cards: [
          {
            document_id: "doc-guideline",
            card_type: "workflow" as const,
            title: "Workflow",
            content: `${"Background without a clinical directive. ".repeat(14)} Titrate treatment for elderly patients.`,
            normalized_terms: [],
            page_number: 1,
            source_chunk_ids: ["serialized-field-instruction"],
            source_image_ids: [],
            confidence: 1,
          },
        ],
      },
    },
    {
      field: "clinical image table text",
      overrides: {
        images: [
          {
            id: "clinical-table-image",
            page_number: 1,
            storage_path: "clinical-table.png",
            caption: "Treatment table",
            image_type: "table",
            searchable: true,
            clinical_relevance_score: 1,
            tableTextSnippet: `${"Background without a clinical directive. ".repeat(15)} Give 4 puffs for perinatal patients.`,
          },
        ],
      },
    },
  ])("omits action and population atoms truncated from $field", ({ overrides }) => {
    const source = evidence("serialized-field-instruction", "Current contextual evidence.", overrides);
    const pack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [selection("instruction", [source], "treatment")],
      coverage: coverage(["instruction"]),
      tokenBudget: 2_000,
    });

    expect(packedEvidenceResults(pack)).toEqual([]);
  });

  it.each([
    "Assess neonatal patients in NICU and notify the specialist.",
    "Completed screening for a neonate or newborn and informed the treating team.",
    "Ensured youth and teens were supported and observed.",
    "Identified risks for each young person and involved young people in planning.",
    "Include aged care residents and people aged 65 years or older in review.",
    "Managed the presentation, provided care, recorded findings, and reported deterioration.",
    "Consulted the prescriber, recommended follow-up, and screened for adverse effects.",
  ])(
    "omits newly recognised action/population content when an overlong primary field would truncate it: %s",
    (tail) => {
      const source = evidence("expanded-primary-signals", `${"Neutral background. ".repeat(180)} ${tail}`);
      const pack = packClaimOrientedContext({
        ...trustedAdmission(),
        selections: [selection("population", [source])],
        coverage: coverage(["population"]),
        tokenBudget: 2_000,
      });

      expect(packedEvidenceResults(pack)).toEqual([]);
    },
  );

  it("omits newly recognised action/population content when an overlong secondary field would truncate it", () => {
    const source = evidence("expanded-secondary-signals", "Current contextual evidence.", {
      retrieval_synopsis: `${"Neutral background. ".repeat(90)} Provide support to newborns in NICU and notify the neonatal team.`,
    });
    const pack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [selection("population", [source])],
      coverage: coverage(["population"]),
      tokenBudget: 2_000,
    });

    expect(packedEvidenceResults(pack)).toEqual([]);
  });

  it("serializes decisive non-rich table cell context intact or omits the whole group", () => {
    const decisive = "For newborns in NICU, notify neonatology and provide respiratory support.";
    const source = evidence("non-rich-table-cells", "See the current escalation table.", {
      table_facts: [
        {
          id: "non-rich-table-fact",
          document_id: "doc-guideline",
          source_chunk_id: "non-rich-table-cells",
          source_image_id: null,
          page_number: 1,
          table_title: "Escalation",
          row_label: "Neonatal",
          clinical_parameter: "Respiratory distress",
          threshold_value: null,
          action: null,
          metadata: { cells: ["Population: newborn in NICU", decisive] },
        },
      ],
    });
    const pack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [selection("table", [source])],
      coverage: coverage(["table"]),
      queryClass: "document_lookup",
      tokenBudget: 2_000,
    });
    const results = packedEvidenceResults(pack);
    const rendered = buildPackedRagSourceBlock(pack.groups, { queryClass: "document_lookup" });

    expect(results.map((result) => result.id)).toEqual([source.id]);
    expect(rendered).toContain(decisive);
    expect(rendered).toContain("Population: newborn in NICU");
  });

  it("omits a non-rich table group when bounded cell context would truncate its decisive tail", () => {
    const source = evidence("overlong-non-rich-table-cells", "See the current escalation table.", {
      table_facts: [
        {
          id: "overlong-non-rich-table-fact",
          document_id: "doc-guideline",
          source_chunk_id: "overlong-non-rich-table-cells",
          source_image_id: null,
          page_number: 1,
          table_title: "Escalation",
          row_label: "Neonatal",
          clinical_parameter: "Respiratory distress",
          threshold_value: null,
          action: null,
          metadata: {
            cells: [
              "Population: newborn in NICU",
              `${"Neutral table context. ".repeat(70)} Notify neonatology and provide respiratory support.`,
            ],
          },
        },
      ],
    });
    const pack = packClaimOrientedContext({
      ...trustedAdmission(),
      selections: [selection("table", [source])],
      coverage: coverage(["table"]),
      queryClass: "document_lookup",
      tokenBudget: 2_000,
    });

    expect(packedEvidenceResults(pack)).toEqual([]);
  });

  it("reconciles packed selections and downstream outputs to the exact admitted corpus", async () => {
    const admitted = evidence("admitted", "Admitted treatment action.", { document_id: "doc-admitted" });
    const omitted = evidence("omitted", `${"Large omitted background. ".repeat(180)} Stop for unique omitted claim.`, {
      document_id: "doc-omitted",
    });
    const pair = {
      served: {
        results: [admitted, omitted],
        coverageSelections: [selection("treatment", [admitted, omitted])],
        coverage: coverage(["treatment"]),
        queryPlan: queryPlan(["treatment"]),
      },
      strongRetry: {
        results: [admitted, omitted],
        coverageSelections: [selection("treatment", [admitted, omitted])],
        coverage: coverage(["treatment"]),
        queryPlan: queryPlan(["treatment"]),
      },
    };
    const packForGeneration = createGenerationContextPacker({
      queryClass: "document_lookup",
      crossDocument: false,
      ...trustedAdmission(),
      loadLegacy: async (results) => results,
    });
    const packed = await packModelContextEvidencePair(pair, packForGeneration);
    const servedIds = packed.served.results.map((result) => result.id);
    const preview = buildEvidencePreviewUnit({ results: packed.served.results });
    const parsed = parseAnswerJson(
      JSON.stringify({
        answer: "Use the admitted action.",
        confidence: "high",
        grounded: true,
        citations: [
          { chunk_id: admitted.id, document_id: admitted.document_id, title: admitted.title },
          { chunk_id: omitted.id, document_id: omitted.document_id, title: omitted.title },
        ],
      }),
      packed.served.results,
    );
    const related = retainRelatedDocumentsForResults(
      [
        {
          document_id: admitted.document_id,
          title: admitted.title,
          file_name: admitted.file_name,
          labels: [],
          summary: null,
          best_pages: [1],
          best_chunk_ids: [admitted.id],
          image_count: 0,
          match_reason: "test",
          score: 1,
        },
        {
          document_id: omitted.document_id,
          title: omitted.title,
          file_name: omitted.file_name,
          labels: [],
          summary: null,
          best_pages: [1],
          best_chunk_ids: [omitted.id],
          image_count: 0,
          match_reason: "test",
          score: 1,
        },
      ],
      packed.served.results,
    );
    const fusion = buildPackedCrossDocumentFusionBrief("What should I do?", packed.served);

    expect(servedIds).toEqual(["admitted"]);
    expect(preview?.sources.map((source) => source.id)).toEqual(["admitted"]);
    expect(parsed.citations.map((citation) => citation.chunk_id)).toEqual(["admitted"]);
    expect(related.map((document) => document.document_id)).toEqual(["doc-admitted"]);
    expect(fusion.text).not.toContain("unique omitted claim");
    expect(packed.served.coverageSelections[0]?.orderedEvidence.map((result) => result.id)).toEqual(["admitted"]);
  });

  it("loads and deduplicates legacy adjacent context for both served and retry selections", async () => {
    const source = evidence("legacy-source", "Legacy input.");
    const selectionResults = [source];
    const loaded = [{ ...source, adjacent_context: "Legacy adjacent context." }];
    let calls = 0;
    const packForGeneration = createGenerationContextPacker({
      queryClass: "document_lookup",
      crossDocument: false,
      accessScope: { includePublic: true },
      snapshot: currentSnapshot(),
      loadLegacy: async (results) => {
        calls += 1;
        expect(results).toBe(selectionResults);
        return loaded;
      },
    });

    const legacySelection = { results: selectionResults, coverageSelections: [], coverage: null };
    const result = await packModelContextEvidencePair(
      { served: legacySelection, strongRetry: { ...legacySelection } },
      packForGeneration,
    );

    expect(result.served.results).toBe(loaded);
    expect(result.strongRetry.results).toBe(loaded);
    expect(result.served.results[0]?.adjacent_context).toBe("Legacy adjacent context.");
    expect(result.strongRetry.results[0]?.adjacent_context).toBe("Legacy adjacent context.");
    expect(calls).toBe(1);
  });
});
