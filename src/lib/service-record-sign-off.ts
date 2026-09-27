import serviceRecordsReview from "../../data/service-records-review.json";

import type { ServiceRecord } from "@/lib/services";

/**
 * The clinician sign-off for each curated WA service record that no published site-content
 * release carries yet (ledger #3E42FH).
 *
 * Kept in `data/service-records-review.json` rather than beside the records in
 * `src/lib/services-canonical-data/`, for the same reason the differential overlays keep
 * theirs in a sidecar: only `npm run clinical:review` writes it, and it pins each sign-off to
 * the exact curated record. An edit to a signed record turns `tests/signoff-services.test.ts`
 * red until it is signed again, so the site can never call reviewed a record nobody reviewed.
 *
 * The runtime rule matches `curatedReviewFor` and `formContentReviewStatus`: the row must be
 * `reviewed` and name a reviewer and a parseable timestamp, or the record reads as unreviewed.
 * Anything missing, malformed or unknown reads as unreviewed.
 */
export type ServiceRecordSignOff = { reviewedBy: string; reviewedAt: string };

type ReviewRow = {
  id: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

const rows: readonly ReviewRow[] = Array.isArray((serviceRecordsReview as { entries?: unknown }).entries)
  ? (serviceRecordsReview as { entries: ReviewRow[] }).entries
  : [];

/** The sign-off for one curated record id (for example SVC-SV-001), or null. */
export function serviceSignOffFor(stableId: string | null | undefined): ServiceRecordSignOff | null {
  if (typeof stableId !== "string" || !stableId.trim()) return null;
  const matches = rows.filter((entry) => entry.id === stableId.trim());
  // A duplicated row is a malformed file; never let either copy vouch for the record.
  if (matches.length !== 1) return null;
  const row = matches[0];
  if (row.status !== "reviewed") return null;
  const reviewedBy = typeof row.reviewedBy === "string" ? row.reviewedBy.trim() : "";
  const reviewedAt = typeof row.reviewedAt === "string" ? row.reviewedAt.trim() : "";
  if (!reviewedBy || !reviewedAt) return null;
  const timestamp = Date.parse(reviewedAt);
  if (!Number.isFinite(timestamp) || timestamp > Date.now()) return null;
  return { reviewedBy, reviewedAt };
}

/** The sign-off for a service record as the app serves it, keyed by its curated stable id. */
export function serviceRecordSignOff(record: Pick<ServiceRecord, "catalogPayload">): ServiceRecordSignOff | null {
  const stableId = record.catalogPayload?.stableId;
  return typeof stableId === "string" ? serviceSignOffFor(stableId) : null;
}
