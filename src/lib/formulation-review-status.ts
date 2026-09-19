/**
 * What a Formulation record's own review metadata means on screen.
 *
 * Every Formulation record — 12 mechanisms, 46 concepts, 6 guide modules —
 * already carried its governance state in data: `reviewStatus`/`sourceStatus`
 * on a mechanism, `review.status`/`review.reviewer` on a concept or guide. None
 * of it reached a reader. A clinician opening a mechanism saw the same generic
 * hypothesis caveat whether or not anyone had ever signed the record off, so an
 * unreviewed record was indistinguishable from a reviewed one.
 *
 * The other unsigned clinical surfaces in this repository already say so at the
 * point of reading — differentials carry "Locally authored — verify before
 * use", therapy records carry "Awaiting review", drafted Mental Health Act
 * sections say they await clinical review. This module is the Formulation
 * equivalent, and it exists as a pure function so the decision can be tested
 * without rendering anything.
 *
 * It fails closed. A record counts as reviewed only when its status is a value
 * this module recognises as signed off AND a named reviewer is recorded;
 * anything unrecognised, empty or malformed reads as awaiting review. An
 * unreviewed record shown as reviewed is the failure that matters, so an
 * unfamiliar status must never buy a record the quieter badge.
 */

export type FormulationReviewState = {
  /** True only for a record signed off by a named clinician. */
  reviewed: boolean;
  /** Short badge text, shown beside the record title. */
  label: string;
  /** Plain-English sentence for the note body. */
  detail: string;
};

/**
 * Statuses that mean a named clinician has signed the record off.
 *
 * Deliberately a closed list. Today every record in the corpus is
 * `clinical_review_required`, so nothing matches — that is the correct
 * starting state, not a gap.
 */
const REVIEWED_STATUSES = new Set(["clinically_reviewed", "clinical_review_complete"]);

const AWAITING_LABEL = "Awaiting clinical review";
const REVIEWED_LABEL = "Clinically reviewed";

function trimmed(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function isReviewedStatus(status: string | null | undefined): boolean {
  return REVIEWED_STATUSES.has(trimmed(status).toLowerCase());
}

/** Joins the sentences a record supplied, dropping the ones it left empty. */
function sentences(...parts: (string | null | undefined)[]): string {
  return parts
    .map((part) => trimmed(part))
    .filter(Boolean)
    .map((part) => (part.endsWith(".") ? part : `${part}.`))
    .join(" ");
}

/**
 * The review state of a formulation mechanism record.
 *
 * A mechanism records no reviewer name, so its status alone decides: the
 * corpus convention is that `reviewStatus` is never advanced except by a named
 * clinical reviewer, per `FormulationMechanism.reviewStatus`.
 */
export function mechanismReviewState(mechanism: {
  reviewStatus?: string | null;
  sourceStatus?: string | null;
  sourceConfidence?: string | null;
}): FormulationReviewState {
  if (isReviewedStatus(mechanism.reviewStatus)) {
    return {
      reviewed: true,
      label: REVIEWED_LABEL,
      detail: sentences("A clinician has reviewed this record", mechanism.sourceStatus, mechanism.sourceConfidence),
    };
  }

  return {
    reviewed: false,
    label: AWAITING_LABEL,
    detail: sentences(
      "No clinician has signed off the clinical content of this record. Check it against the linked sources before using it",
      mechanism.sourceStatus,
      mechanism.sourceConfidence,
    ),
  };
}

/**
 * The review state of a formulation concept or guide module.
 *
 * These records carry a reviewer slot, so a sign-off claim without a name in it
 * is not honoured — an unnamed sign-off is not a sign-off.
 */
export function conceptReviewState(record: {
  review?: { status?: string | null; reviewer?: string | null; preparedAt?: string | null } | null;
  releaseNote?: string | null;
}): FormulationReviewState {
  const review = record.review ?? {};
  const reviewer = trimmed(review.reviewer);

  if (isReviewedStatus(review.status) && reviewer) {
    return {
      reviewed: true,
      label: REVIEWED_LABEL,
      detail: sentences(`Reviewed by ${reviewer}`, record.releaseNote),
    };
  }

  const prepared = trimmed(review.preparedAt);
  return {
    reviewed: false,
    label: AWAITING_LABEL,
    detail: sentences(
      "No clinician has signed off the clinical content of this record. Check it against the linked sources before using it",
      prepared ? `Prepared ${prepared}` : null,
      record.releaseNote,
    ),
  };
}
