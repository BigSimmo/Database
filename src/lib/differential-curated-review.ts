import differentialCuratedReview from "../../data/differential-curated-review.json";

/**
 * The clinician sign-off for each locally authored differential overlay.
 *
 * Kept in `data/differential-curated-review.json` rather than beside the prose in
 * `differential-curated.ts`, for the same reason the forms keep theirs in
 * `data/forms-content-review.json`: only `npm run clinical:review` writes it, and it
 * pins each sign-off to the exact overlay text. An edit to a signed overlay turns
 * `tests/clinical-signoff-kinds.test.ts` red until it is signed again, so the page
 * can never say "reviewed" about words nobody reviewed.
 *
 * The runtime rule matches `formContentReviewStatus`: status, reviewedBy and
 * reviewedAt must all be present, or the overlay reads as unreviewed.
 */
export type DifferentialCuratedReview = { reviewedBy: string; reviewedAt: string };

type ReviewRow = {
  slug: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

const rows = (differentialCuratedReview as { entries: ReviewRow[] }).entries;

export function curatedReviewFor(slug: string): DifferentialCuratedReview | null {
  const row = rows.find((entry) => entry.slug === slug);
  if (!row || row.status !== "reviewed") return null;
  const reviewedBy = row.reviewedBy?.trim();
  const reviewedAt = row.reviewedAt?.trim();
  if (!reviewedBy || !reviewedAt || !Number.isFinite(Date.parse(reviewedAt))) return null;
  return { reviewedBy, reviewedAt };
}
