import { describe, expect, it } from "vitest";

import {
  contextPackTokenCeiling,
  packClaimOrientedContext,
  packedEvidenceResults,
  packedContextCacheKey,
} from "@/lib/rag/rag-context-pack";
import { buildPackedRagSourceBlock, estimatePackedRagSourceBlockTokens } from "@/lib/rag/rag-source-block";
import type { CoverageEvidenceSelection } from "@/lib/rag/rag-coverage";
import type {
  AnswerCoveragePlan,
  ClinicalClaimRole,
  ClinicalSourceRole,
  SearchResult,
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
    corpusScope = "uploaded_local",
    sourceRole = "local_guideline",
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
    source_metadata: {
      source_kind: corpusScope === "clinical_kb_site" ? "registry_record" : "document",
      source_title: "WA guideline",
      publisher: "WA Health",
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
      source_catalogue_key: `catalogue:${id}`,
      source_policy_version: "source-policy-v1",
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
): CoverageEvidenceSelection {
  return {
    subquestionId,
    claimRole,
    orderedEvidence,
    collapsedEvidenceFamilyIds: [],
    conflicts: [],
    sourcePolicyReview: "not_applicable",
    coverageReason: "direct",
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

describe("claim-oriented context packing", () => {
  it("keeps a population exception, action, dose, unit and qualifier in one atomic group", () => {
    const source = evidence(
      "dose-exception",
      "For adults use 500 mg nightly. For adults over 65 years, use 250 mg nightly and do not exceed 500 mg daily.",
    );
    const pack = packClaimOrientedContext({
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

  it("joins only citable adjacent members with matching document, generation, access and role", () => {
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
    const pack = packClaimOrientedContext({
      selections: [selection("treatment", [primary, adjacent, crossGeneration, privateAdjacent, wrongRole])],
      coverage: coverage(["treatment"]),
      tokenBudget: 2_000,
    });

    expect(pack.groups[0]?.members.map((member) => member.id)).toEqual(["primary", "adjacent"]);
    expect(pack.groups.every((group) => group.members.every((member) => member.id !== "wrong-role"))).toBe(true);
    expect(
      pack.groups.every((group) => new Set(group.members.map((member) => member.id)).size === group.members.length),
    ).toBe(true);
    expect(packedEvidenceResults(pack).map((member) => member.id)).toEqual(
      expect.arrayContaining(["primary", "adjacent", "staged", "private"]),
    );
  });

  it("deduplicates evidence families and gives every required subquestion a bounded first group", () => {
    const monitoring = evidence("monitoring", "Check lithium levels after dose changes.", {
      contentHash: "family-monitoring",
    });
    const derivedDuplicate = evidence("derived-summary", "Summary of lithium monitoring.", {
      corpusScope: "clinical_kb_site",
      sourceRole: "clinical_reference",
      contentHash: "derived-summary-hash",
      source_metadata: {
        ...evidence("template", "template").source_metadata!,
        source_kind: "registry_record",
        corpus_scope: "clinical_kb_site",
        source_role: "clinical_reference",
        content_mode: "indexed_content",
        document_status: "current",
        clinical_validation_status: "approved",
        extraction_quality: "good",
        site_content_lineage: [
          { sourceId: monitoring.document_id, sourceHash: "family-monitoring", relationship: "derived_from" },
        ],
      } as SearchResult["source_metadata"],
    });
    const escalation = evidence("escalation", "Escalate urgently for severe toxicity.", {
      document_id: "doc-escalation",
      contentHash: "family-escalation",
    });
    const pack = packClaimOrientedContext({
      selections: [
        selection("monitoring", [monitoring]),
        selection("escalation", [derivedDuplicate, escalation], "safety"),
      ],
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

  it("uses content-free versioned identities and never exceeds the route ceiling", () => {
    const rawQuestion = "private pregnancy wording 7461";
    const source = evidence("identity", "Current public clinical guidance.");
    const answerCoverage = coverage([rawQuestion]);
    const selections = [selection(rawQuestion, [source])];
    const tokenBudget = contextPackTokenCeiling("broad_summary", { crossDocument: true });
    const pack = packClaimOrientedContext({
      selections,
      coverage: answerCoverage,
      tokenBudget,
      planVersion: "rag-query-plan-v1",
      snapshotIdentity: "public-release-7",
      accessScope: "anonymous_public",
    });
    const key = packedContextCacheKey([source], "broad_summary", {
      crossDocument: true,
      tokenBudget,
      coverage: answerCoverage,
      selections,
      planVersion: "rag-query-plan-v1",
      snapshotIdentity: "public-release-7",
      accessScope: "anonymous_public",
    });
    const changed = packedContextCacheKey([{ ...source, content: "Changed serialized input." }], "broad_summary", {
      crossDocument: true,
      tokenBudget,
      coverage: answerCoverage,
      selections,
      planVersion: "rag-query-plan-v1",
      snapshotIdentity: "public-release-7",
      accessScope: "anonymous_public",
    });

    expect(pack.packId).not.toContain(rawQuestion);
    expect(pack.groups.every((group) => !group.id.includes(rawQuestion))).toBe(true);
    expect(key).not.toContain(rawQuestion);
    expect(changed).not.toBe(key);
    expect(pack.usedTokens).toBeLessThanOrEqual(tokenBudget);
  });
});
