import { createHash } from "node:crypto";

import reviewData from "@/data/dictionary-definition-reviews.json";
import { dictionaryEntries, type DictionaryEntry } from "@/lib/dictionary-data";

/**
 * Reviews of the *existing* dictionary definitions, held as proposals.
 *
 * The trap this module exists to close: a review written against wording that has
 * since been improved will, if applied blindly, quietly restore the older text. So
 * each review records the wording it was written against and a hash of it, and
 * nothing is ever compared by eye. A review whose baseline no longer matches the
 * live entry is `conflict`, which needs a person — not an automatic overwrite and
 * not a silent skip.
 */
export type DictionaryDefinitionVerdict =
  "Verified" | "Verified but wording should be improved" | "Unable to verify" | "Context-dependent" | "Overgeneralised";

export type DictionaryDefinitionReview = {
  id: string;
  entrySlug: string;
  title: string;
  category: string;
  repositoryLocation: string;
  verdict: DictionaryDefinitionVerdict;
  baselineWording: string;
  baselineWordingSha256: string;
  /** Null for the 68 reviews that record a verdict without rewriting anything. */
  proposedWording: string | null;
  disposition: string;
  rationale: string;
  reviewGate: string;
  legacyCitation: string | null;
  applyAutomatically: false;
  publicationAllowed: false;
  reviewer: null;
  /**
   * Written by `npm run clinical:review -- --kind dictionary` when a clinician signs off a
   * proposed rewrite; absent until then. It records the sign-off only: it does not apply the
   * wording to the live dictionary, and `applyAutomatically` / `publicationAllowed` stay false.
   */
  clinicalApproval?: DictionaryDefinitionClinicalApproval;
  provenance: {
    document: string;
    documentSha256: string;
    anchor: string;
    lineStart: number;
    lineEnd: number;
    rawBlockSha256: string;
  };
};

export type DictionaryDefinitionClinicalApproval = {
  status: "approved";
  reviewer: string;
  /** UTC ISO timestamp of the sign-off. */
  reviewedAt: string;
  /** SHA-256 (64 hex) of the review content the clinician signed. */
  reviewedContentSha256: string;
};

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Why a `clinicalApproval` value is malformed, or null when it is a complete approval.
 * Fails closed: anything other than status "approved", a non-empty reviewer, a parseable ISO
 * timestamp and a 64-hex pin is a defect, never a partial sign-off.
 */
export function definitionReviewApprovalDefect(approval: unknown): string | null {
  if (typeof approval !== "object" || approval === null || Array.isArray(approval)) {
    return "clinicalApproval must be an object";
  }
  const record = approval as Record<string, unknown>;
  const allowed = new Set(["status", "reviewer", "reviewedAt", "reviewedContentSha256"]);
  const unknownKey = Object.keys(record).find((key) => !allowed.has(key));
  if (unknownKey) return `clinicalApproval has an unexpected field "${unknownKey}"`;
  if (record.status !== "approved") return 'clinicalApproval.status must be "approved"';
  if (typeof record.reviewer !== "string" || !record.reviewer.trim()) {
    return "clinicalApproval.reviewer must name the clinician";
  }
  if (
    typeof record.reviewedAt !== "string" ||
    !ISO_TIMESTAMP.test(record.reviewedAt) ||
    !Number.isFinite(Date.parse(record.reviewedAt))
  ) {
    return "clinicalApproval.reviewedAt must be an ISO timestamp";
  }
  if (typeof record.reviewedContentSha256 !== "string" || !SHA256_HEX.test(record.reviewedContentSha256)) {
    return "clinicalApproval.reviewedContentSha256 must be a 64-character lowercase hex SHA-256";
  }
  return null;
}

/** True only for a review carrying a complete, well-formed clinical approval. */
export function isDefinitionReviewClinicallyApproved(
  review: Pick<DictionaryDefinitionReview, "clinicalApproval">,
): boolean {
  return review.clinicalApproval !== undefined && definitionReviewApprovalDefect(review.clinicalApproval) === null;
}

/**
 * True when the live wording is exactly this review's clinically approved proposal: the
 * rewrite has been applied (by `scripts/apply-dictionary-rewrites.ts`). Deliberately derived
 * rather than recorded: the review keeps its `baselineWording` (the sign-off pin covers it)
 * and gains no "applied" field, so the live dictionary itself is the record that it happened.
 * An unapproved review whose proposal somehow went live is not "applied" — it stays a conflict.
 */
export function isDefinitionReviewApplied(
  review: Pick<DictionaryDefinitionReview, "clinicalApproval" | "proposedWording">,
  liveWording: string,
): boolean {
  return (
    review.proposedWording !== null &&
    isDefinitionReviewClinicallyApproved(review) &&
    liveWording === review.proposedWording
  );
}

export const dictionaryDefinitionReviews: readonly DictionaryDefinitionReview[] = (
  reviewData as { reviews: readonly DictionaryDefinitionReview[] }
).reviews;

/**
 * What reconciling one review against the live dictionary actually yields.
 *
 * `missing_entry` is kept distinct from `conflict` because they need different
 * people: a conflict is an editorial decision about two competing wordings, a
 * missing entry means the slug moved and the crosswalk is wrong.
 */
export type DictionaryDefinitionReconciliation = {
  reviewId: string;
  entrySlug: string;
  /** `applied` — the live wording is the review's clinically approved proposal. */
  outcome: "actionable" | "applied" | "no_change_proposed" | "conflict" | "missing_entry";
  /** Present only when the live entry was found, so a conflict can be read. */
  liveWording: string | null;
  reason: string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Reconcile every review against the dictionary as it stands now.
 *
 * Deliberately returns a decision per review rather than applying anything: all 96
 * reviews carry `applyAutomatically: false`. A `clinicalApproval` records a sign-off of the
 * proposed wording; it does not change this decision or apply anything either.
 */
export function reconcileDefinitionReviews(
  reviews: readonly DictionaryDefinitionReview[] = dictionaryDefinitionReviews,
  entries: readonly Pick<DictionaryEntry, "slug" | "definition">[] = dictionaryEntries,
): readonly DictionaryDefinitionReconciliation[] {
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
  return reviews.map((review) => {
    const entry = bySlug.get(review.entrySlug);
    if (!entry) {
      return {
        reviewId: review.id,
        entrySlug: review.entrySlug,
        outcome: "missing_entry" as const,
        liveWording: null,
        reason: "No dictionary entry with this slug. The crosswalk needs re-checking before the review can be read.",
      };
    }
    if (sha256(entry.definition) !== review.baselineWordingSha256) {
      if (isDefinitionReviewApplied(review, entry.definition)) {
        return {
          reviewId: review.id,
          entrySlug: review.entrySlug,
          outcome: "applied" as const,
          liveWording: entry.definition,
          reason: "The live definition is the clinically approved proposed wording. Nothing further to apply.",
        };
      }
      return {
        reviewId: review.id,
        entrySlug: review.entrySlug,
        outcome: "conflict" as const,
        liveWording: entry.definition,
        reason:
          "The live definition has changed since this review was written. Compare both wordings before acting; do not restore the reviewed text.",
      };
    }
    if (!review.proposedWording) {
      return {
        reviewId: review.id,
        entrySlug: review.entrySlug,
        outcome: "no_change_proposed" as const,
        liveWording: entry.definition,
        reason: review.disposition,
      };
    }
    return {
      reviewId: review.id,
      entrySlug: review.entrySlug,
      outcome: "actionable" as const,
      liveWording: entry.definition,
      reason:
        "Baseline matches the live wording. The proposed rewrite is ready for clinical sign-off, not for automatic application.",
    };
  });
}

/** Structural defects in the review set. An empty array means the layer is sound. */
export function dictionaryDefinitionReviewIssues(
  reviews: readonly DictionaryDefinitionReview[] = dictionaryDefinitionReviews,
): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const review of reviews) {
    if (ids.has(review.id)) issues.push(`${review.id}: duplicate review id`);
    ids.add(review.id);
    if (sha256(review.baselineWording) !== review.baselineWordingSha256) {
      issues.push(`${review.id}: baselineWordingSha256 does not hash the recorded baselineWording`);
    }
    if (review.applyAutomatically !== false) issues.push(`${review.id}: applyAutomatically must stay false`);
    if (review.publicationAllowed !== false) issues.push(`${review.id}: publicationAllowed must stay false`);
    if (review.reviewer !== null) issues.push(`${review.id}: reviewer must stay null until a person signs off`);
    if (review.proposedWording !== null && !review.proposedWording.trim()) {
      issues.push(`${review.id}: proposedWording must be null rather than blank`);
    }
    if (review.clinicalApproval !== undefined) {
      const defect = definitionReviewApprovalDefect(review.clinicalApproval);
      if (defect) issues.push(`${review.id}: ${defect}`);
      if (review.proposedWording === null) {
        issues.push(`${review.id}: clinicalApproval is only recorded against a proposed rewrite`);
      }
    }
  }
  return issues;
}
