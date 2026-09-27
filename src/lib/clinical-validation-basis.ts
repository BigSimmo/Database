/**
 * Honest evidence bases for a document's clinical validation.
 *
 * `clinical_validation_status` answers one question: did someone review this document here?
 * The 2026-06-30 source-metadata backfill answered a different one — "does the document's own
 * document-control text show that the issuing WA health service endorsed or approved it?" — and
 * stored the answer as `locally_reviewed` (#JYH1FH). That fact is real, and the WA-first
 * authority tier was built on it, but it is not a review done here.
 *
 * `wa_document_control_endorsement` records that fact without claiming a review. It follows
 * the BMJ attestation precedent in `source-review.ts`: the status stays `unverified` and
 * `clinical_validation_evidence.basis` names the non-review fact.
 *
 * What the basis does, and does not, unlock:
 * - Authority tier and claim-evidence eligibility: kept, exactly as for `locally_reviewed`
 *   (`source-authority-registry.ts` `isLocallyValidated`, `source-governance.ts`
 *   `isClaimEvidenceGovernanceEligible`). This keeps retrieval ordering unchanged when
 *   documents move from the old stamp to this shape.
 * - Reviewed authority for the answer trust cap and the "Strong support" wording: NOT unlocked
 *   (`answer-client-payload.ts`, `WA_ENDORSEMENT_COUNTS_AS_REVIEWED_AUTHORITY`).
 * - Labels say "endorsed by the issuing WA service, not reviewed here", never "reviewed".
 *
 * This module has no imports so the browser-rendered `source-metadata.ts` and the server-only
 * authority registry can both depend on it without a cycle.
 */
export const WA_DOCUMENT_CONTROL_ENDORSEMENT_BASIS = "wa_document_control_endorsement" as const;

export const WA_DOCUMENT_CONTROL_ENDORSEMENT_LABEL = "Endorsed by issuing WA service, not reviewed here";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * True only for an explicitly `unverified` document whose validation evidence names the WA
 * document-control endorsement basis. Accepts raw `documents.metadata` or normalized source
 * metadata (normalization keeps this basis, see `normalizeClinicalSourceMetadata`). Any other
 * status — including a missing one — returns false, so a genuine review or approval is never
 * relabelled and an unrecorded status never gains the tier.
 */
export function hasWaDocumentControlEndorsement(metadata: unknown): boolean {
  const value = record(metadata);
  if (value.clinical_validation_status !== "unverified") return false;
  return record(value.clinical_validation_evidence).basis === WA_DOCUMENT_CONTROL_ENDORSEMENT_BASIS;
}

/**
 * True when metadata carries a marker that the auditable review RPCs (`record_source_review`,
 * `record_source_review_v2`) write alongside a genuine review or approval: a reviewer-verified
 * provenance basis, a reviewed/approved governance disposition, or the reviewer's id in
 * `governance_updated_by`. The immutable `source_review_events` row is the authoritative record;
 * this is its metadata echo, readable offline.
 */
export function hasRecordedReviewerMarker(metadata: unknown): boolean {
  const value = record(metadata);
  const updatedBy = value.governance_updated_by;
  return (
    value.provenance_basis === "reviewer_verified" ||
    value.governance_disposition === "locally_reviewed" ||
    value.governance_disposition === "approved" ||
    (typeof updatedBy === "string" && updatedBy.trim().length > 0)
  );
}
