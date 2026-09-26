import { describe, expect, it, vi } from "vitest";

import { clinicalValidationEvidenceFor, deriveMetadata } from "../scripts/backfill-source-metadata";
import { extractReviewerAttribution } from "../scripts/audit-source-governance";
import { authorityTrustCapRequired, toClientAnswerPayload } from "@/lib/answer-client-payload";
import { australianSourceTier } from "@/lib/australian-source-priority";
import {
  WA_DOCUMENT_CONTROL_ENDORSEMENT_BASIS,
  hasRecordedReviewerMarker,
  hasWaDocumentControlEndorsement,
} from "@/lib/clinical-validation-basis";
import { buildRagSourceBlock } from "@/lib/rag/rag-source-block";
import { classifySourceAuthority } from "@/lib/source-authority-registry";
import {
  groupSourceGovernanceWarnings,
  isClaimEvidenceGovernanceEligible,
  sourceGovernanceWarnings,
} from "@/lib/source-governance";
import {
  normalizeClinicalSourceMetadata,
  normalizeOptionalSourceMetadata,
  normalizeSourceMetadata,
  sourceProvenanceSummary,
  validationStatusLabel,
} from "@/lib/source-metadata";
import { countOperationalUnattestedReviewDebt } from "@/lib/source-review";
import { searchResultEligibilityForClaim, sourceEligibilityForClaim } from "@/lib/source-role-policy";
import type { ClinicalSourceMetadata, RagAnswer, SearchResult } from "@/lib/types";

// #JYH1FH: documents a regex backfill stamped `locally_reviewed` because their own document-control
// text showed endorsement by the issuing WA service. The honest shape is `unverified` plus the
// `wa_document_control_endorsement` basis. No live document carries it yet, so these tests pin
// that the new shape keeps today's retrieval role while never claiming a review.

const waDocument = {
  source_kind: "document",
  publisher_code: "FSH",
  publisher: "Fiona Stanley Hospital",
  jurisdiction: "Australia/WA",
  corpus_scope: "uploaded_local",
  source_role: "local_guideline",
  content_mode: "indexed_content",
  document_status: "current",
  extraction_quality: "good",
} as const;

const endorsementEvidence = {
  status: "unverified",
  basis: WA_DOCUMENT_CONTROL_ENDORSEMENT_BASIS,
  evidence_type: "committee_endorsement",
  evidence_text: "Endorsed by: Drug and Therapeutics Committee",
  reviewed_here: false,
};

/** Raw `documents.metadata` in the new, honest shape. */
const endorsedRaw = {
  ...waDocument,
  clinical_validation_status: "unverified",
  clinical_validation_evidence: endorsementEvidence,
};
/** Raw metadata as the backfill stamped it before this change. */
const stampedRaw = {
  ...waDocument,
  clinical_validation_status: "locally_reviewed",
  clinical_validation_evidence: {
    status: "locally_reviewed",
    basis: "local WA source with document-control committee endorsement evidence",
    evidence_type: "committee_endorsement",
    evidence_text: "Endorsed by: Drug and Therapeutics Committee",
  },
};
const plainUnverifiedRaw = { ...waDocument, clinical_validation_status: "unverified" };

function searchResult(id: string, sourceMetadata: unknown): SearchResult {
  return {
    id,
    document_id: `doc-${id}`,
    title: "Clozapine titration procedure",
    file_name: "clozapine.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: null,
    content: "Increase the dose by 25 mg daily.",
    image_ids: [],
    similarity: 0.9,
    source_metadata: sourceMetadata as ClinicalSourceMetadata,
    images: [],
  };
}

describe("WA document-control endorsement: predicate", () => {
  it("matches only unverified metadata with the endorsement basis", () => {
    expect(hasWaDocumentControlEndorsement(endorsedRaw)).toBe(true);
    expect(hasWaDocumentControlEndorsement(stampedRaw)).toBe(false);
    expect(hasWaDocumentControlEndorsement(plainUnverifiedRaw)).toBe(false);
    expect(hasWaDocumentControlEndorsement({ ...endorsedRaw, clinical_validation_status: undefined })).toBe(false);
    expect(hasWaDocumentControlEndorsement({ ...endorsedRaw, clinical_validation_status: "approved" })).toBe(false);
    expect(hasWaDocumentControlEndorsement(null)).toBe(false);
  });

  it("survives normalization, and adds nothing to any other metadata", () => {
    const normalized = normalizeSourceMetadata(endorsedRaw);
    expect(normalized.clinical_validation_status).toBe("unverified");
    expect(normalized.clinical_validation_evidence).toEqual({ basis: WA_DOCUMENT_CONTROL_ENDORSEMENT_BASIS });
    expect(hasWaDocumentControlEndorsement(normalized)).toBe(true);
    expect(hasWaDocumentControlEndorsement(normalizeOptionalSourceMetadata(endorsedRaw))).toBe(true);

    for (const raw of [stampedRaw, plainUnverifiedRaw, { ...waDocument, clinical_validation_status: "approved" }]) {
      expect(normalizeClinicalSourceMetadata(raw)).not.toHaveProperty("clinical_validation_evidence");
    }
  });
});

describe("WA document-control endorsement: ranking tier and claim eligibility are unchanged", () => {
  it.each([
    ["raw metadata", endorsedRaw],
    ["normalized metadata", normalizeSourceMetadata(endorsedRaw)],
  ])("keeps the wa_validated tier from %s", (_label, metadata) => {
    const endorsed = classifySourceAuthority(metadata);
    const stamped = classifySourceAuthority(stampedRaw);
    expect(stamped.tier).toBe("wa_validated");
    expect(endorsed.tier).toBe("wa_validated");
    expect(endorsed.eligible).toBe(stamped.eligible);
    expect(endorsed.eligibilityReasons).toEqual(stamped.eligibilityReasons);
  });

  it("still demotes a plain unverified WA document, as before", () => {
    const plain = classifySourceAuthority(plainUnverifiedRaw);
    expect(plain.tier).toBe("supplementary");
    expect(plain.eligibilityReasons).toContain("wa_source_not_locally_validated");
  });

  it("keeps the tier through the context-selection path", () => {
    expect(australianSourceTier(searchResult("a", normalizeOptionalSourceMetadata(endorsedRaw)))).toBe(
      australianSourceTier(searchResult("b", normalizeOptionalSourceMetadata(stampedRaw))),
    );
    expect(australianSourceTier(searchResult("c", normalizeOptionalSourceMetadata(plainUnverifiedRaw)))).not.toBe(
      australianSourceTier(searchResult("d", normalizeOptionalSourceMetadata(stampedRaw))),
    );
  });

  it("keeps claim-evidence eligibility, and blocks plain unverified as before", () => {
    expect(isClaimEvidenceGovernanceEligible(normalizeSourceMetadata(endorsedRaw))).toBe(true);
    expect(isClaimEvidenceGovernanceEligible(normalizeSourceMetadata(stampedRaw))).toBe(true);
    expect(isClaimEvidenceGovernanceEligible(normalizeSourceMetadata(plainUnverifiedRaw))).toBe(false);

    const endorsedDecision = sourceEligibilityForClaim({
      source: normalizeSourceMetadata(endorsedRaw),
      claimRole: "dose_or_monitoring",
    });
    const stampedDecision = sourceEligibilityForClaim({
      source: normalizeSourceMetadata(stampedRaw),
      claimRole: "dose_or_monitoring",
    });
    expect(endorsedDecision).toEqual(stampedDecision);
    expect(searchResultEligibilityForClaim(searchResult("e", endorsedRaw), "dose_or_monitoring")).toEqual(
      stampedDecision,
    );
    expect(
      sourceEligibilityForClaim({
        source: normalizeSourceMetadata(plainUnverifiedRaw),
        claimRole: "dose_or_monitoring",
      }),
    ).toEqual({ eligible: false, reason: "governance_block" });
  });
});

describe("WA document-control endorsement: not reviewed authority for trust or wording", () => {
  const highRiskClaim = {
    claimId: "claim-1",
    text: "Increase the clozapine dose by 25 mg daily.",
    riskClass: "high_risk" as const,
    supportingChunkIds: ["chunk-1"],
    supportStatus: "direct" as const,
  };

  function answerOn(authority: "unverified" | "locally_reviewed", sourceMetadata: unknown): RagAnswer {
    return {
      answer: "Increase the clozapine dose by 25 mg daily.",
      grounded: true,
      confidence: "high",
      citations: [],
      sources: [searchResult("chunk-1", sourceMetadata)],
      supportedClaims: [highRiskClaim],
      evidenceAssessments: {
        "chunk-1": {
          relevance: "direct",
          claimSupport: "direct",
          // rag-claim-support copies the status: the endorsed shape arrives as "unverified".
          authority,
          currency: "current",
          extractionQuality: "good",
        },
      },
    };
  }

  it("caps high-risk render trust and the Strong support word like any unverified source", () => {
    vi.stubEnv("NEXT_PUBLIC_RAG_TRUST_CAP_ALL_CLAIMS", "");
    try {
      const endorsed = answerOn("unverified", normalizeOptionalSourceMetadata(endorsedRaw));
      expect(authorityTrustCapRequired(endorsed)).toBe(true);
      expect(toClientAnswerPayload(endorsed).strongSupportLabelCapped).toBe(true);

      const reviewed = answerOn("locally_reviewed", normalizeOptionalSourceMetadata(stampedRaw));
      expect(authorityTrustCapRequired(reviewed)).toBe(false);
      expect(toClientAnswerPayload(reviewed).strongSupportLabelCapped).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("WA document-control endorsement: honest wording", () => {
  it("labels the badge without claiming a review", () => {
    const label = validationStatusLabel(normalizeSourceMetadata(endorsedRaw));
    expect(label).toBe("Endorsed by issuing WA service, not reviewed here");
    expect(sourceProvenanceSummary(normalizeSourceMetadata(endorsedRaw))).toContain(label);
    expect(validationStatusLabel(normalizeSourceMetadata(stampedRaw))).toBe("Locally reviewed");
    expect(validationStatusLabel(normalizeSourceMetadata(plainUnverifiedRaw))).toBe("Not locally validated");
    expect(validationStatusLabel({ clinical_validation_status: "approved" })).toBe("Approved");
  });

  it("keeps the unverified caveat but counts endorsed sources separately", () => {
    const warnings = sourceGovernanceWarnings({
      results: [
        searchResult("a", normalizeOptionalSourceMetadata(endorsedRaw)),
        searchResult("b", normalizeOptionalSourceMetadata(plainUnverifiedRaw)),
        searchResult("c", normalizeOptionalSourceMetadata(stampedRaw)),
      ],
    });
    const unverified = warnings.filter((warning) => warning.code === "unverified_source");
    expect(unverified.map((warning) => [warning.document_id, warning.severity, warning.message])).toEqual([
      [
        "doc-a",
        "warning",
        "One or more supporting sources are endorsed by the issuing WA service but have not been reviewed here.",
      ],
      ["doc-b", "warning", "One or more supporting sources have not been locally validated."],
    ]);
    expect(groupSourceGovernanceWarnings(unverified).map((group) => [group.count, group.message])).toEqual([
      [1, "1 source is endorsed by the issuing WA service but not reviewed here."],
      [1, "1 source has not been locally validated."],
    ]);
  });

  it("tells the answer model the source is unverified and WA-endorsed", () => {
    const block = buildRagSourceBlock([
      searchResult("a", normalizeOptionalSourceMetadata(endorsedRaw)),
      searchResult("b", normalizeOptionalSourceMetadata(stampedRaw)),
    ]);
    expect(block).toContain("clinical validation: unverified (endorsed by issuing WA service);");
    expect(block).toContain("clinical validation: locally_reviewed;");
  });
});

describe("WA document-control endorsement: backfill writes the honest shape", () => {
  const endorsementText = "Document control. Endorsed by: Drug and Therapeutics Committee, Fiona Stanley Hospital.";

  it("records endorsement evidence as unverified with the basis, not as a local review", () => {
    const evidence = clinicalValidationEvidenceFor({ publisherCode: "FSH", text: endorsementText, existing: "" });
    expect(evidence).toMatchObject({
      status: "unverified",
      basis: WA_DOCUMENT_CONTROL_ENDORSEMENT_BASIS,
      evidence_type: "committee_endorsement",
      reviewed_here: false,
    });
    expect(evidence.evidence_text).toContain("Endorsed by");
  });

  it("re-shapes an old import stamp, and a rerun is stable", () => {
    const document = {
      id: "doc-1",
      title: "FSH clozapine procedure",
      file_name: "FSH clozapine procedure.pdf",
      source_path: null,
      metadata: { ...stampedRaw },
      status: "indexed",
    };
    const quality = { document_id: "doc-1", quality_score: 0.9, extraction_quality: "good", issues: [] };
    const now = new Date("2026-09-26T00:00:00Z");
    const first = deriveMetadata(document, endorsementText, quality, now);
    expect(first.metadata.publisher_code).toBe("FSH");
    expect(first.metadata.clinical_validation_status).toBe("unverified");
    expect(first.metadata.clinical_validation_evidence).toEqual({
      status: "unverified",
      basis: WA_DOCUMENT_CONTROL_ENDORSEMENT_BASIS,
      evidence_type: "committee_endorsement",
      evidence_text: expect.stringContaining("Endorsed by"),
      reviewed_here: false,
    });
    expect(hasWaDocumentControlEndorsement(first.metadata)).toBe(true);

    const rerun = deriveMetadata({ ...document, metadata: first.metadata }, endorsementText, quality, now);
    expect(rerun.changedKeys).not.toContain("clinical_validation_status");
    expect(rerun.changedKeys).not.toContain("clinical_validation_evidence");
  });

  it("preserves approved and reviewer-recorded statuses", () => {
    expect(
      clinicalValidationEvidenceFor({ publisherCode: "FSH", text: endorsementText, existing: "approved" }),
    ).toMatchObject({ status: "approved" });
    expect(
      clinicalValidationEvidenceFor({
        publisherCode: "FSH",
        text: endorsementText,
        existing: "locally_reviewed",
        hasRecordedReviewer: true,
      }),
    ).toMatchObject({ status: "locally_reviewed", evidence_type: "recorded_source_review" });
    expect(hasRecordedReviewerMarker({ governance_updated_by: "11111111-1111-4111-8111-111111111111" })).toBe(true);
    expect(hasRecordedReviewerMarker({ provenance_basis: "reviewer_verified" })).toBe(true);
    expect(hasRecordedReviewerMarker(stampedRaw)).toBe(false);
  });

  it("still records non-WA and evidence-free documents as unverified without the basis", () => {
    expect(clinicalValidationEvidenceFor({ publisherCode: "TGA", text: endorsementText, existing: "" })).toMatchObject({
      status: "unverified",
      basis: "not a local WA source",
    });
    expect(
      clinicalValidationEvidenceFor({ publisherCode: "FSH", text: "No control text.", existing: "" }),
    ).toMatchObject({ status: "unverified", evidence_type: "none" });
  });
});

describe("WA document-control endorsement: governance audit", () => {
  it("excludes the endorsement basis from unattested review debt", () => {
    const counts = countOperationalUnattestedReviewDebt(
      [
        { documentId: "a", metadata: endorsedRaw },
        { documentId: "b", metadata: plainUnverifiedRaw },
        { documentId: "c", metadata: stampedRaw },
      ],
      [],
    );
    expect(counts).toEqual({
      raw_unverified_validation: 2,
      complete_bmj_third_party_attestations: 0,
      wa_document_control_endorsements: 1,
      unattested_review_debt: 1,
    });
  });

  it("recognises the review RPC markers as reviewer attribution", () => {
    const reviewerId = "11111111-1111-4111-8111-111111111111";
    expect(
      extractReviewerAttribution({
        metadata: { clinical_validation_status: "locally_reviewed", governance_updated_by: reviewerId },
      }),
    ).toMatchObject({ hasAttribution: true, attribution: reviewerId });
    expect(
      extractReviewerAttribution({
        metadata: { clinical_validation_status: "locally_reviewed", provenance_basis: "reviewer_verified" },
      }),
    ).toMatchObject({ hasAttribution: true });
    expect(extractReviewerAttribution({ metadata: stampedRaw })).toMatchObject({ hasAttribution: false });
  });
});
