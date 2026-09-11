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
  let sourceStatus = storedStatus;

  const verification = (
    row.verification && typeof row.verification === "object" ? row.verification : {}
  ) as ServiceVerification;

  if (storedStatus === "outdated") {
    // `outdated` asserts that guidance was superseded. Supersession is a clinical
    // judgement, so a stored `outdated` is preserved against normal age degradation.
    // However, if the record was subsequently updated or re-verified (e.g.
    // `row.last_reviewed_at` is newer than reference or an explicit re-verification
    // timestamp is present in verification or source), `sourceStatus` is re-evaluated
    // rather than being permanently stuck in "outdated" forever.
    const reviewedAt = row.last_reviewed_at ? new Date(row.last_reviewed_at) : null;
    const hasValidReviewDate = reviewedAt !== null && !Number.isNaN(reviewedAt.getTime());
    const isNewerThanReference = hasValidReviewDate && reviewedAt.getTime() >= referenceDate.getTime();
    const sourceObj = row.source && typeof row.source === "object" ? (row.source as ServiceSource) : null;
    const hasExplicitReverification =
      hasValidReviewDate || Boolean(verification.lastVerifiedAt) || Boolean(sourceObj?.reviewed);

    if (hasExplicitReverification || isNewerThanReference) {
      const record = rowToServiceRecord(row);
      const derived = deriveGovernanceColumns(record);
      if (
        row.review_due_at &&
        !Number.isNaN(new Date(row.review_due_at).getTime()) &&
        new Date(row.review_due_at).getTime() < referenceDate.getTime()
      ) {
        sourceStatus = "review_due";
      } else if (derived.source_status !== "unknown") {
        sourceStatus = derived.source_status;
      } else {
        sourceStatus = "current";
      }
    }
  }

  const validationStatus =
    verification.locallyVerified === true ? "locally_reviewed" : registryValidationStatus(row.validation_status);

  return {
    sourceStatus,
    validationStatus,
    lastReviewedAt: row.last_reviewed_at ?? verification.lastVerifiedAt ?? null,
    reviewDueAt: row.review_due_at,
  };
}
