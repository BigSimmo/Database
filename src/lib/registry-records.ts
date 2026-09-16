import type { Database } from "@/lib/supabase/database.types";
import type {
  ServiceContact,
  ServiceCriterion,
  ServiceInfoRow,
  ServiceRecord,
  ServiceSource,
  ServiceStatusChip,
  ServiceSummaryCard,
  ServiceVerification,
} from "@/lib/services";

export type RegistryRecordKind = "service" | "form";
export type RegistrySourceStatus = "current" | "review_due" | "outdated" | "unknown";
export type RegistryValidationStatus = "unverified" | "locally_reviewed" | "approved";

export type RegistryRecordRow = Database["public"]["Tables"]["clinical_registry_records"]["Row"];
export type RegistryRecordInsert = Database["public"]["Tables"]["clinical_registry_records"]["Insert"];

const sourceStatuses: readonly RegistrySourceStatus[] = ["current", "review_due", "outdated", "unknown"];
const validationStatuses: readonly RegistryValidationStatus[] = ["unverified", "locally_reviewed", "approved"];

export function normalizeRegistrySlug(value: string) {
  return value.trim().toLowerCase();
}

export function registrySourceStatus(value: string | null | undefined): RegistrySourceStatus {
  return sourceStatuses.find((status) => status === value) ?? "unknown";
}

export function registryValidationStatus(value: string | null | undefined): RegistryValidationStatus {
  return validationStatuses.find((status) => status === value) ?? "unverified";
}

/** Conservative governance derivation from the human-readable fixture fields.
 *  Seeding never emits "approved" — that requires an explicit review step. */
export function deriveGovernanceColumns(record: ServiceRecord): {
  source_status: RegistrySourceStatus;
  validation_status: RegistryValidationStatus;
} {
  const status = record.source?.status?.toLowerCase() ?? "";
  if (/\b(?:not\s+checked|unchecked|unverified)\b/i.test(status)) {
    return {
      source_status: "unknown",
      validation_status: "unverified",
    };
  }
  const sourceStatus: RegistrySourceStatus = status.includes("checked")
    ? "current"
    : status.includes("required") || status.includes("review")
      ? "review_due"
      : "unknown";
  const validationStatus: RegistryValidationStatus =
    record.verification?.locallyVerified === true ? "locally_reviewed" : "unverified";
  return { source_status: sourceStatus, validation_status: validationStatus };
}

export function recordToRow(record: ServiceRecord, ownerId: string, kind: RegistryRecordKind): RegistryRecordInsert {
  const governance = deriveGovernanceColumns(record);
  return {
    owner_id: ownerId,
    kind,
    slug: normalizeRegistrySlug(record.slug),
    title: record.title,
    subtitle: record.subtitle ?? null,
    route: record.route ?? null,
    eligibility: record.eligibility ?? null,
    cost: record.cost ?? null,
    referral: record.referral ?? null,
    location: record.location ?? null,
    best_use: record.bestUse ?? null,
    catalogue_label: record.catalogueLabel ?? null,
    navigator_query: record.navigatorQuery ?? null,
    tags: record.tags ?? [],
    catchments: record.catchments ?? [],
    status_chips: record.statusChips ?? [],
    primary_contact: record.primaryContact ?? null,
    contacts: record.contacts ?? [],
    summary_cards: record.summaryCards ?? [],
    referral_info: record.referralInfo ?? [],
    criteria: record.criteria ?? [],
    verification: record.verification ?? {},
    source: record.source ?? {},
    catalog_payload: record.catalogPayload ?? {},
    source_status: governance.source_status,
    validation_status: governance.validation_status,
  };
}

export function rowToServiceRecord(row: RegistryRecordRow): ServiceRecord {
  return {
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    statusChips: (row.status_chips ?? []) as ServiceStatusChip[],
    primaryContact: (row.primary_contact ?? undefined) as ServiceContact | undefined,
    contacts: (row.contacts ?? []) as ServiceContact[],
    route: row.route ?? undefined,
    eligibility: row.eligibility ?? undefined,
    cost: row.cost ?? undefined,
    referral: row.referral ?? undefined,
    location: row.location ?? undefined,
    summaryCards: (row.summary_cards ?? []) as ServiceSummaryCard[],
    referralInfo: (row.referral_info ?? []) as ServiceInfoRow[],
    bestUse: row.best_use ?? undefined,
    criteria: (row.criteria ?? []) as ServiceCriterion[],
    verification: (row.verification ?? undefined) as ServiceVerification | undefined,
    tags: row.tags ?? [],
    catchments: row.catchments ?? [],
    catalogueLabel: row.catalogue_label ?? undefined,
    navigatorQuery: row.navigator_query ?? undefined,
    source: (row.source ?? undefined) as ServiceSource | undefined,
    catalogPayload: (row.catalog_payload ?? {}) as Record<string, unknown>,
  };
}

const REVIEW_INTERVAL_DAYS = 365;
/** A forward-dated review would otherwise read as freshly checked forever. */
const FUTURE_DATE_TOLERANCE_DAYS = 1;

/** Ordered least to most conservative, so a read-time derivation can never promote a
 *  stored status — only confirm it or downgrade it. */
const sourceStatusSeverity: Record<RegistrySourceStatus, number> = {
  current: 0,
  review_due: 1,
  unknown: 2,
  outdated: 3,
};

function governanceDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function rowVerification(row: RegistryRecordRow): ServiceVerification {
  return (row.verification && typeof row.verification === "object" ? row.verification : {}) as ServiceVerification;
}

/** The most recent date at which this row records having been reviewed or verified. */
function lastReviewEvidence(row: RegistryRecordRow): Date | null {
  const dates = [governanceDate(row.last_reviewed_at), governanceDate(rowVerification(row).lastVerifiedAt)].filter(
    (date): date is Date => date !== null,
  );
  if (dates.length === 0) return null;
  return dates.reduce((latest, date) => (date.getTime() > latest.getTime() ? date : latest));
}

/**
 * Whether a review date is close enough to the reference to be real evidence.
 *
 * A mistyped year is the only way a review date lands meaningfully in the future, and it
 * must not read as a fresh check. Both the freshness derivation and the outdated-clearing
 * test bound against this, because a date one of them rejects is not evidence for the other.
 */
function plausibleReviewDate(reviewedAt: Date, referenceDate: Date): boolean {
  const ageDays = (referenceDate.getTime() - reviewedAt.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays >= -FUTURE_DATE_TOLERANCE_DAYS;
}

/**
 * Freshness derived from the row's own review dates, ignoring the stored column.
 *
 * `source_status` records what was true when the row was written and never ages on its
 * own, so a service verified in 2024 kept reading as `current`, and so did one carrying
 * no review evidence at all. Services governance requires a recorded verification date
 * and a future review date before a record counts as current, which is what this derives.
 * Mirrors the medication read path in `medication-records.ts`.
 */
export function deriveRegistrySourceFreshness(
  row: RegistryRecordRow,
  referenceDate: Date = new Date(),
): RegistrySourceStatus {
  const reviewedAt = lastReviewEvidence(row);
  // No recorded review is a different deficiency from a lapsed one, and neither is current.
  if (!reviewedAt) return "unknown";
  if (!plausibleReviewDate(reviewedAt, referenceDate)) return "unknown";
  const ageDays = (referenceDate.getTime() - reviewedAt.getTime()) / (1000 * 60 * 60 * 24);

  const dueAt = governanceDate(row.review_due_at);
  if (dueAt) return dueAt.getTime() < referenceDate.getTime() ? "review_due" : "current";
  return ageDays > REVIEW_INTERVAL_DAYS ? "review_due" : "current";
}

/**
 * Whether a stored `outdated` has been cleared by a genuine re-verification.
 *
 * Supersession is a recorded clinical judgement, so age alone can neither establish nor
 * refute it. A leftover review date or a truthy free-text `reviewed` note must not clear
 * it: that is how an outdated record silently became current again. Only a review dated
 * at or after the reference, or a complete recorded review cycle (a review date together
 * with a review-due date), counts.
 */
function outdatedCleared(row: RegistryRecordRow, referenceDate: Date): boolean {
  const reviewedAt = lastReviewEvidence(row);
  if (!reviewedAt) return false;
  // Same bound deriveRegistrySourceFreshness applies, shared rather than restated so the
  // two cannot drift apart again. Defence in depth rather than the load-bearing guard: the
  // caller already refuses to promote a derivation of "unknown", which is what an
  // implausible date derives to.
  if (!plausibleReviewDate(reviewedAt, referenceDate)) return false;
  if (reviewedAt.getTime() >= referenceDate.getTime()) return true;
  return governanceDate(row.review_due_at) !== null;
}

/** Governance metadata surfaced alongside a registry record in API responses. */
export function rowGovernance(
  row: RegistryRecordRow,
  referenceDate: Date = new Date(),
): {
  sourceStatus: RegistrySourceStatus;
  validationStatus: RegistryValidationStatus;
  lastReviewedAt: string | null;
  reviewDueAt: string | null;
} {
  const storedStatus = registrySourceStatus(row.source_status);
  const verification = rowVerification(row);
  const derived = deriveRegistrySourceFreshness(row, referenceDate);

  let sourceStatus: RegistrySourceStatus;
  if (storedStatus === "outdated") {
    if (!outdatedCleared(row, referenceDate)) {
      sourceStatus = "outdated";
    } else {
      const dueAt = governanceDate(row.review_due_at);
      sourceStatus =
        dueAt && dueAt.getTime() < referenceDate.getTime()
          ? "review_due"
          : derived === "unknown"
            ? "outdated"
            : derived;
    }
  } else {
    sourceStatus = sourceStatusSeverity[derived] > sourceStatusSeverity[storedStatus] ? derived : storedStatus;
  }

  // Clinical validation is a separate axis from source freshness and never ages with it.
  const validationStatus =
    verification.locallyVerified === true ? "locally_reviewed" : registryValidationStatus(row.validation_status);

  return {
    sourceStatus,
    validationStatus,
    lastReviewedAt: row.last_reviewed_at ?? verification.lastVerifiedAt ?? null,
    reviewDueAt: row.review_due_at,
  };
}
