import { describe, expect, it } from "vitest";
import {
  classifyClaimRoleForSubquestion,
  resolveLocalAndAustralianEvidence,
  sourceEligibilityForClaim,
} from "../src/lib/source-role-policy";
import type { ClinicalClaimRole, ClinicalSourceMetadata, RagSubquestionPurpose, SearchResult } from "../src/lib/types";

const australianPolicy = {
  source_kind: "document",
  corpus_scope: "australian_public",
  content_mode: "indexed_content",
  source_catalogue_key: "pbs",
  source_policy_version: "australian-source-policy-v1",
  licence_policy: "public_index_permitted",
  publisher: "Pharmaceutical Benefits Scheme",
  publisher_code: "PBS",
  jurisdiction: "Australia",
} as const;

function metadata(overrides: Partial<ClinicalSourceMetadata> = {}): ClinicalSourceMetadata {
  return {
    source_kind: "document",
    source_title: "Local guideline",
    publisher: "Local health service",
    publisher_code: "WACHS",
    jurisdiction: "Australia/WA",
    version: "1",
    publication_date: "2025-01-01",
    review_date: "2027-01-01",
    uploaded_at: "2026-01-01T00:00:00Z",
    indexed_at: "2026-01-01T00:00:00Z",
    uploaded_by: "clinical-governance",
    corpus_scope: "uploaded_local",
    source_role: "local_guideline",
    content_mode: "indexed_content",
    source_catalogue_key: "local-guideline",
    source_policy_version: "local-source-policy-v1",
    canonical_url: "https://example.test/guideline",
    effective_date: "2025-01-01",
    expiry_date: null,
    supersedes_document_id: null,
    superseded_by_document_id: null,
    retrieved_at: "2026-01-01T00:00:00Z",
    content_hash: "a".repeat(64),
    change_state: "unchanged",
    licence_policy: "public_index_permitted",
    document_status: "current",
    clinical_validation_status: "approved",
    extraction_quality: "good",
    ...overrides,
  };
}

function result(
  overrides: Partial<SearchResult> & Pick<SearchResult, "id" | "document_id">,
  sourceOverrides: Partial<ClinicalSourceMetadata> = {},
): SearchResult {
  return {
    title: overrides.document_id === "local" ? "Local guideline" : "Australian guideline",
    file_name: `${overrides.document_id}.pdf`,
    page_number: 1,
    chunk_index: 0,
    section_heading: "Treatment",
    content: "Directly supporting clinical evidence.",
    image_ids: [],
    similarity: 0.8,
    relevance: {
      verdict: "direct",
      label: "Direct evidence",
      matchedTerms: ["treatment"],
      missingTerms: [],
      directSourceCount: 1,
      weakSourceCount: 0,
      score: 1,
      supportReason: "Directly supports the claim.",
      isSourceBacked: true,
      coverageScore: 1,
      rankScore: 1,
      titleMatchedTerms: ["treatment"],
      contentMatchedTerms: ["treatment"],
      metadataMatchedTerms: [],
      chips: [],
    },
    images: [],
    source_metadata: metadata(sourceOverrides),
    ...overrides,
  };
}

describe("classifyClaimRoleForSubquestion", () => {
  it.each([
    ["Is lithium listed on the PBS and what authority restriction applies?", "monitoring", "subsidy"],
    ["Is this medication listed?", "primary", "subsidy"],
    ["What does the Mental Health Act legislation require?", "risk", "legal"],
    ["Which NSQHS accreditation quality standard applies?", "primary", "quality"],
    ["Which referral form and service-directory workflow should I use?", "primary", "service_workflow"],
    ["Review the follow-up requirements", "monitoring", "dose_or_monitoring"],
    ["Review the follow-up requirements", "risk", "safety"],
    ["What lithium dose threshold applies?", "primary", "dose_or_monitoring"],
    ["When should risk escalation occur for this safety concern?", "primary", "safety"],
    ["What treatment is recommended by the local service?", "primary", "treatment"],
    ["Which authority recommends this standard treatment?", "primary", "treatment"],
    ["How can treatment improve quality of life?", "primary", "treatment"],
    ["Which formulation is the standard treatment?", "primary", "treatment"],
    ["What form of lithium is preferred for maintenance treatment?", "primary", "treatment"],
    ["Which form for lithium maintenance treatment?", "primary", "treatment"],
    ["Which referral form should I submit?", "primary", "service_workflow"],
    ["Which form should I submit to the clinic?", "primary", "service_workflow"],
    ["Are the adverse effects listed in the guideline?", "primary", "treatment"],
  ] satisfies Array<[string, RagSubquestionPurpose, ClinicalClaimRole]>)(
    "classifies %s with %s purpose as %s",
    (question, purpose, expected) => {
      expect(classifyClaimRoleForSubquestion({ question, purpose })).toBe(expected);
    },
  );
});

describe("sourceEligibilityForClaim", () => {
  it("does not let PBS or legislation answer treatment claims", () => {
    expect(
      sourceEligibilityForClaim({
        source: metadata({ ...australianPolicy, source_role: "subsidy" }),
        claimRole: "treatment",
      }),
    ).toEqual({ eligible: false, reason: "role_mismatch" });
    expect(
      sourceEligibilityForClaim({
        source: metadata({ source_role: "legal" }),
        claimRole: "treatment",
      }),
    ).toEqual({ eligible: false, reason: "role_mismatch" });
  });

  it("never uses link-only references as claim evidence", () => {
    expect(
      sourceEligibilityForClaim({
        source: metadata({ content_mode: "link_only", source_role: "reference_link" }),
        claimRole: "dose_or_monitoring",
      }),
    ).toEqual({ eligible: false, reason: "link_only" });
  });

  it.each([
    [metadata({ change_state: "withdrawn" }), "inactive"],
    [
      metadata({
        ...australianPolicy,
        source_catalogue_key: "nps-medicinewise",
        publisher: "NPS MedicineWise",
        publisher_code: "NPS",
        source_role: "professional_review",
      }),
      "inactive",
    ],
    [metadata({ document_status: "review_due" }), "not_current"],
    [metadata({ content_mode: null }), "governance_block"],
    [metadata({ source_kind: "registry_record", corpus_scope: "clinical_kb_site" }), "governance_block"],
    [metadata({ extraction_quality: "poor" }), "governance_block"],
    [metadata({ clinical_validation_status: "unverified" }), "governance_block"],
    [
      metadata({
        ...australianPolicy,
        source_role: "subsidy",
        source_catalogue_key: "pbs",
        publisher_code: "TGA",
      }),
      "catalogue_mismatch",
    ],
  ] as const)("fails closed before ranking for %s", (source, reason) => {
    expect(sourceEligibilityForClaim({ source, claimRole: "subsidy" })).toEqual({ eligible: false, reason });
  });
});

describe("resolveLocalAndAustralianEvidence", () => {
  const local = result({ id: "local-chunk", document_id: "local" });
  const australian = result(
    { id: "national-chunk", document_id: "national" },
    {
      source_title: "Australian guideline",
      ...australianPolicy,
      source_catalogue_key: "ranzcp",
      publisher: "Royal Australian and New Zealand College of Psychiatrists",
      publisher_code: "RANZCP",
      source_role: "clinical_guideline",
      publication_date: "2026-06-01",
      effective_date: "2026-06-01",
    },
  );

  it("keeps a current governed directly-supportive uploaded guideline primary and surfaces a verified conflict", () => {
    const resolved = resolveLocalAndAustralianEvidence({
      local: [local],
      australian: [australian],
      claimRole: "treatment",
      verifiedDifferences: [
        {
          claimRole: "treatment",
          topicKey: "treatment-sequence",
          overlapReason: "same_claim",
          materialDifferenceReason: "recommendation_differs",
          localChunkIds: ["local-chunk"],
          australianChunkIds: ["national-chunk"],
        },
      ],
    });

    expect(resolved.primary.map((source) => source.document_id)).toEqual(["local"]);
    expect(resolved.augmentation.map((source) => source.document_id)).toEqual(["national"]);
    expect(resolved.primaryDecision).toEqual({
      selected: "uploaded_local",
      reason: "current_valid_accessible_directly_supportive",
    });
    expect(resolved.conflicts).toEqual([
      expect.objectContaining({
        version: "source-policy-conflict-v1",
        id: expect.stringMatching(/^source-policy-conflict-v1:/),
        local: expect.objectContaining({
          documentId: "local",
          publicationDate: "2025-01-01",
          jurisdiction: "Australia/WA",
          sourceRole: "local_guideline",
          corpusScope: "uploaded_local",
          supportingChunkIds: ["local-chunk"],
        }),
        australian: expect.objectContaining({
          documentId: "national",
          publicationDate: "2026-06-01",
          jurisdiction: "Australia",
          sourceRole: "clinical_guideline",
          corpusScope: "australian_public",
          supportingChunkIds: ["national-chunk"],
        }),
        materialDifferenceReason: "recommendation_differs",
        localPrimaryDecision: {
          selected: "uploaded_local",
          reason: "current_valid_accessible_directly_supportive",
        },
        reviewTargetDocumentId: "local",
      }),
    ]);
    expect(resolved.reviewDocumentIds).toEqual(["local"]);
  });

  it("does not infer a conflict from a later Australian date without a verified difference", () => {
    const resolved = resolveLocalAndAustralianEvidence({
      local: [local],
      australian: [australian],
      claimRole: "treatment",
      verifiedDifferences: [],
    });

    expect(resolved.conflicts).toEqual([]);
    expect(resolved.reviewDocumentIds).toEqual([]);
  });

  it("carries exactly verified chunk ids and rejects incomplete or cross-document differences", () => {
    const extraLocal = result({ id: "local-extra", document_id: "other-local" });
    const resolved = resolveLocalAndAustralianEvidence({
      local: [local, extraLocal],
      australian: [australian],
      claimRole: "treatment",
      verifiedDifferences: [
        {
          claimRole: "treatment",
          topicKey: "mixed-local-documents",
          overlapReason: "same_claim",
          materialDifferenceReason: "recommendation_differs",
          localChunkIds: ["local-chunk", "local-extra"],
          australianChunkIds: ["national-chunk"],
        },
      ],
    });

    expect(resolved.conflicts).toEqual([]);
  });

  it("requires complete and consistent identity/date metadata before constructing a conflict", () => {
    const incompleteAustralian = result(
      { id: "national-chunk", document_id: "national" },
      {
        source_title: "Australian guideline",
        ...australianPolicy,
        source_catalogue_key: "ranzcp",
        publisher: null,
        publisher_code: "RANZCP",
        source_role: "clinical_guideline",
        publication_date: null,
        effective_date: null,
      },
    );
    const resolved = resolveLocalAndAustralianEvidence({
      local: [local],
      australian: [incompleteAustralian],
      claimRole: "treatment",
      verifiedDifferences: [
        {
          claimRole: "treatment",
          topicKey: "treatment-sequence",
          overlapReason: "same_claim",
          materialDifferenceReason: "recommendation_differs",
          localChunkIds: ["local-chunk"],
          australianChunkIds: ["national-chunk"],
        },
      ],
    });

    expect(resolved.conflicts).toEqual([]);
    expect(resolved.reviewDocumentIds).toEqual([]);
  });

  it("selects Australian evidence with an explicit reason when local evidence is not directly supportive", () => {
    const nearbyLocal = result({
      id: "local-nearby",
      document_id: "local",
      relevance: { ...local.relevance!, verdict: "nearby" },
    });
    const resolved = resolveLocalAndAustralianEvidence({
      local: [nearbyLocal],
      australian: [australian],
      claimRole: "treatment",
      verifiedDifferences: [],
    });

    expect(resolved.primary.map((source) => source.document_id)).toEqual(["national"]);
    expect(resolved.primaryDecision).toEqual({
      selected: "australian_public",
      reason: "uploaded_local_not_directly_supportive",
    });
    expect(resolved.conflicts).toEqual([]);
  });

  it("does not promote Australian no-evidence results into primary, augmentation, or conflicts", () => {
    const noEvidenceAustralian: SearchResult = {
      ...australian,
      relevance: { ...australian.relevance!, verdict: "none" },
    };
    const resolved = resolveLocalAndAustralianEvidence({
      local: [],
      australian: [noEvidenceAustralian],
      claimRole: "treatment",
      verifiedDifferences: [],
    });

    expect(resolved).toEqual({
      primary: [],
      augmentation: [],
      conflicts: [],
      reviewDocumentIds: [],
      primaryDecision: { selected: "none", reason: "no_eligible_evidence" },
    });
  });

  it("merges verified provenance deterministically when canonical conflicts repeat", () => {
    const localSecond: SearchResult = { ...local, id: "local-chunk-2", chunk_index: 1 };
    const australianSecond: SearchResult = { ...australian, id: "national-chunk-2", chunk_index: 1 };
    const differences = [
      {
        claimRole: "treatment" as const,
        topicKey: "treatment-sequence",
        overlapReason: "same_claim" as const,
        materialDifferenceReason: "recommendation_differs" as const,
        localChunkIds: ["local-chunk-2"],
        australianChunkIds: ["national-chunk-2"],
      },
      {
        claimRole: "treatment" as const,
        topicKey: "treatment-sequence",
        overlapReason: "same_claim" as const,
        materialDifferenceReason: "recommendation_differs" as const,
        localChunkIds: ["local-chunk"],
        australianChunkIds: ["national-chunk"],
      },
    ];
    const inputs = {
      local: [local, localSecond],
      australian: [australian, australianSecond],
      claimRole: "treatment" as const,
    };

    const forward = resolveLocalAndAustralianEvidence({ ...inputs, verifiedDifferences: differences });
    const reversed = resolveLocalAndAustralianEvidence({
      ...inputs,
      verifiedDifferences: [...differences].reverse(),
    });

    expect(forward.conflicts).toHaveLength(1);
    expect(forward.conflicts[0]?.local.supportingChunkIds).toEqual(["local-chunk", "local-chunk-2"]);
    expect(forward.conflicts[0]?.australian.supportingChunkIds).toEqual(["national-chunk", "national-chunk-2"]);
    expect(reversed.conflicts).toEqual(forward.conflicts);
    expect(reversed.reviewDocumentIds).toEqual(forward.reviewDocumentIds);
  });
});
