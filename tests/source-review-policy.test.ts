import { describe, expect, it } from "vitest";

import {
  BMJ_THIRD_PARTY_ATTESTATION_BASIS,
  BMJ_THIRD_PARTY_ATTESTATION_EVIDENCE_TYPE,
  BMJ_THIRD_PARTY_ATTESTATION_POLICY_VERSION,
  bmjThirdPartyAttestationRejectionReasons,
  countOperationalUnattestedReviewDebt,
  hasCompleteCurrentBmjThirdPartyAttestation,
  normalizeBmjAttestationAuthorityText,
  type BmjThirdPartyAttestationEvent,
} from "@/lib/source-review";
import { normalizeSourceMetadata, validationStatusLabel } from "@/lib/source-metadata";

const now = new Date("2026-07-27T03:00:00.000Z");
const documentId = "22222222-2222-4222-8222-222222222222";
const reviewerId = "11111111-1111-4111-8111-111111111111";

function bmjMetadata(overrides: Record<string, unknown> = {}) {
  return {
    publisher_code: "BMJ",
    publisher: "BMJ Best Practice",
    jurisdiction: "International",
    document_status: "review_due",
    clinical_validation_status: "unverified",
    review_date: "2025-12-31",
    ...overrides,
  };
}

function structuredEvidence(overrides: Record<string, unknown> = {}) {
  return {
    status: "unverified",
    basis: BMJ_THIRD_PARTY_ATTESTATION_BASIS,
    evidence_type: BMJ_THIRD_PARTY_ATTESTATION_EVIDENCE_TYPE,
    publisher_code: "BMJ",
    policy_version: BMJ_THIRD_PARTY_ATTESTATION_POLICY_VERSION,
    reviewer_qualification: "Consultant psychiatrist, FRANZCP",
    evidence_references: ["BMJ subscription and provenance record 2026-07-26"],
    review_date: "2026-07-26",
    attested_at: "2026-07-27T10:30:00.123456+08:00",
    attested_by: reviewerId,
    ...overrides,
  };
}

function debtDocument(metadata: Record<string, unknown>, id = documentId) {
  return { documentId: id, metadata };
}

function attestationEvent(overrides: Partial<BmjThirdPartyAttestationEvent> = {}): BmjThirdPartyAttestationEvent {
  return {
    document_id: documentId,
    reviewer_id: reviewerId,
    decision: BMJ_THIRD_PARTY_ATTESTATION_BASIS,
    evidence_references: ["BMJ subscription and provenance record 2026-07-26"],
    new_document_status: "current",
    new_validation_status: "unverified",
    review_date: "2026-07-26",
    policy_version: BMJ_THIRD_PARTY_ATTESTATION_POLICY_VERSION,
    reviewer_qualification: "Consultant psychiatrist, FRANZCP",
    created_at: "2026-07-27T10:30:00.123456+08:00",
    ...overrides,
  };
}

describe("BMJ third-party source attestation policy", () => {
  it("accepts only indexed, unverified BMJ sources with complete policy evidence", () => {
    expect(
      bmjThirdPartyAttestationRejectionReasons(
        {
          documentStatus: "indexed",
          metadata: bmjMetadata(),
          evidenceReferences: ["BMJ subscription and provenance record 2026-07-26"],
          reviewDate: "2026-07-26",
          policyVersion: BMJ_THIRD_PARTY_ATTESTATION_POLICY_VERSION,
          reviewerQualification: "Consultant psychiatrist, FRANZCP",
        },
        now,
      ),
    ).toEqual([]);
  });

  it.each([
    ["publisher", bmjMetadata({ publisher: "Example Publisher" }), "incompatible_bmj_authority_metadata"],
    ["jurisdiction", bmjMetadata({ jurisdiction: "Australia/WA" }), "incompatible_bmj_authority_metadata"],
    ["code", bmjMetadata({ publisher_code: "NICE" }), "incompatible_bmj_authority_metadata"],
    ["validation", bmjMetadata({ clinical_validation_status: "approved" }), "clinical_validation_not_unverified"],
  ])("fails closed for incompatible %s metadata", (_field, metadata, reason) => {
    expect(
      bmjThirdPartyAttestationRejectionReasons(
        {
          documentStatus: "indexed",
          metadata,
          evidenceReferences: ["evidence"],
          reviewDate: "2026-07-26",
          policyVersion: BMJ_THIRD_PARTY_ATTESTATION_POLICY_VERSION,
          reviewerQualification: "FRANZCP",
        },
        now,
      ),
    ).toContain(reason);
  });

  it.each([
    ["BMJ--Best   Practice", "United--Kingdom"],
    ["BMJ   Publishing--Group", "United   Kingdom"],
  ])("normalizes approved registry aliases exactly like SQL for %s / %s", (publisher, jurisdiction) => {
    expect(normalizeBmjAttestationAuthorityText(publisher)).toMatch(/^bmj (?:best practice|publishing group)$/);
    expect(
      bmjThirdPartyAttestationRejectionReasons(
        {
          documentStatus: "indexed",
          metadata: bmjMetadata({ publisher, jurisdiction }),
          evidenceReferences: ["evidence"],
          reviewDate: "2026-07-26",
          policyVersion: BMJ_THIRD_PARTY_ATTESTATION_POLICY_VERSION,
          reviewerQualification: "FRANZCP",
        },
        now,
      ),
    ).toEqual([]);
  });

  it("still fails closed when punctuation normalization does not produce an exact registry alias", () => {
    expect(
      bmjThirdPartyAttestationRejectionReasons(
        {
          documentStatus: "indexed",
          metadata: bmjMetadata({ publisher: "BMJ--Best   Practices", jurisdiction: "United--Kingdom" }),
          evidenceReferences: ["evidence"],
          reviewDate: "2026-07-26",
          policyVersion: BMJ_THIRD_PARTY_ATTESTATION_POLICY_VERSION,
          reviewerQualification: "FRANZCP",
        },
        now,
      ),
    ).toContain("incompatible_bmj_authority_metadata");
  });

  it("rejects missing evidence, date, qualification, and the wrong policy version", () => {
    expect(
      bmjThirdPartyAttestationRejectionReasons(
        {
          documentStatus: "processing",
          metadata: bmjMetadata(),
          evidenceReferences: [],
          reviewDate: null,
          policyVersion: "legacy-policy",
          reviewerQualification: "",
        },
        now,
      ),
    ).toEqual([
      "document_not_indexed",
      "missing_evidence_references",
      "invalid_review_date",
      "wrong_policy_version",
      "missing_reviewer_qualification",
    ]);
  });

  it("keeps raw unverified telemetry while excluding only a complete current BMJ attestation from operational debt", () => {
    const complete = bmjMetadata({
      document_status: "current",
      governance_disposition: BMJ_THIRD_PARTY_ATTESTATION_BASIS,
      clinical_validation_evidence: structuredEvidence(),
    });
    const incomplete = bmjMetadata({
      document_status: "current",
      governance_disposition: BMJ_THIRD_PARTY_ATTESTATION_BASIS,
      clinical_validation_evidence: structuredEvidence({ reviewer_qualification: "" }),
    });
    const wrongVersion = bmjMetadata({
      document_status: "current",
      governance_disposition: BMJ_THIRD_PARTY_ATTESTATION_BASIS,
      clinical_validation_evidence: structuredEvidence({ policy_version: "legacy-policy" }),
    });
    const wrongPublisher = bmjMetadata({
      document_status: "current",
      governance_disposition: BMJ_THIRD_PARTY_ATTESTATION_BASIS,
      publisher_code: "NICE",
      publisher: "National Institute for Health and Care Excellence",
      jurisdiction: "United Kingdom",
      clinical_validation_evidence: structuredEvidence(),
    });

    const events = [attestationEvent()];
    expect(hasCompleteCurrentBmjThirdPartyAttestation(debtDocument(complete), events, now)).toBe(true);
    expect(hasCompleteCurrentBmjThirdPartyAttestation(debtDocument(incomplete), events, now)).toBe(false);
    expect(hasCompleteCurrentBmjThirdPartyAttestation(debtDocument(wrongVersion), events, now)).toBe(false);
    expect(hasCompleteCurrentBmjThirdPartyAttestation(debtDocument(wrongPublisher), events, now)).toBe(false);
    const reviewDue = bmjMetadata({
      governance_disposition: BMJ_THIRD_PARTY_ATTESTATION_BASIS,
      clinical_validation_evidence: structuredEvidence(),
    });
    expect(hasCompleteCurrentBmjThirdPartyAttestation(debtDocument(reviewDue), events, now)).toBe(false);
    expect(
      countOperationalUnattestedReviewDebt(
        [complete, incomplete, wrongVersion, wrongPublisher, reviewDue].map((metadata) => debtDocument(metadata)),
        events,
        now,
      ),
    ).toEqual({
      raw_unverified_validation: 5,
      complete_bmj_third_party_attestations: 1,
      unattested_review_debt: 4,
    });
  });

  it("keeps valid-looking BMJ metadata as debt when no immutable attestation event exists", () => {
    const metadata = bmjMetadata({
      document_status: "current",
      governance_disposition: BMJ_THIRD_PARTY_ATTESTATION_BASIS,
      clinical_validation_evidence: structuredEvidence(),
    });

    expect(hasCompleteCurrentBmjThirdPartyAttestation(debtDocument(metadata), [], now)).toBe(false);
    expect(countOperationalUnattestedReviewDebt([debtDocument(metadata)], [], now)).toEqual({
      raw_unverified_validation: 1,
      complete_bmj_third_party_attestations: 0,
      unattested_review_debt: 1,
    });
  });

  it("treats missing and blank validation status as unverified operational debt", () => {
    const missing = debtDocument({ document_status: "current" });
    const blank = debtDocument({ document_status: "current", clinical_validation_status: "   " });

    expect(countOperationalUnattestedReviewDebt([missing, blank], [], now)).toEqual({
      raw_unverified_validation: 2,
      complete_bmj_third_party_attestations: 0,
      unattested_review_debt: 2,
    });
  });

  it.each([
    ["missing attested_at", { attested_at: undefined }],
    ["malformed attested_at", { attested_at: "2026-07-27 02:30:00" }],
    ["future attested_at", { attested_at: "2026-07-27T03:00:00.001Z" }],
    ["missing attested_by", { attested_by: undefined }],
    ["malformed attested_by", { attested_by: "reviewer-1" }],
    ["nil attested_by", { attested_by: "00000000-0000-0000-0000-000000000000" }],
  ])("does not count an otherwise complete attestation with %s", (_case, evidenceOverride) => {
    const metadata = bmjMetadata({
      document_status: "current",
      governance_disposition: BMJ_THIRD_PARTY_ATTESTATION_BASIS,
      clinical_validation_evidence: structuredEvidence(evidenceOverride),
    });

    const events = [attestationEvent()];
    expect(hasCompleteCurrentBmjThirdPartyAttestation(debtDocument(metadata), events, now)).toBe(false);
    expect(countOperationalUnattestedReviewDebt([debtDocument(metadata)], events, now)).toEqual({
      raw_unverified_validation: 1,
      complete_bmj_third_party_attestations: 0,
      unattested_review_debt: 1,
    });
  });

  it("does not alter the source currentness or locally-unverified caveat contract", () => {
    const metadata = bmjMetadata({ clinical_validation_evidence: structuredEvidence() });
    expect(metadata.document_status).toBe("review_due");
    expect(metadata.review_date).toBe("2025-12-31");
    expect(metadata.clinical_validation_status).toBe("unverified");
    expect(validationStatusLabel(normalizeSourceMetadata(metadata))).toBe("Not locally validated");
  });
});
