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
  };
}

/** Governance metadata surfaced alongside a registry record in API responses. */
export function rowGovernance(row: RegistryRecordRow): {
  sourceStatus: RegistrySourceStatus;
  validationStatus: RegistryValidationStatus;
  lastReviewedAt: string | null;
  reviewDueAt: string | null;
} {
  return {
    sourceStatus: registrySourceStatus(row.source_status),
    validationStatus: registryValidationStatus(row.validation_status),
    lastReviewedAt: row.last_reviewed_at,
    reviewDueAt: row.review_due_at,
  };
}
