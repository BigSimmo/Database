import type { RegistrySourceStatus, RegistryValidationStatus } from "@/lib/registry-records";
import type { ServiceRecord } from "@/lib/services";

/**
 * Runtime contract for the registry endpoints used by shared client surfaces.
 *
 * The server keeps its full Zod request contracts.  This small, exact parser
 * keeps the response boundary fail-closed without loading Zod into the search
 * shell (where it measurably regressed mobile input responsiveness).
 */
export type RegistryListView = "full" | "search" | "summary";

export type RegistryListGovernance = Record<
  string,
  { sourceStatus: RegistrySourceStatus; validationStatus: RegistryValidationStatus }
>;

export type RegistryListResponse = {
  records: ServiceRecord[];
  total: number;
  verifiedCount: number;
  demoMode?: boolean;
  governance: RegistryListGovernance;
};

export type RegistryRecordResponse = {
  record: ServiceRecord;
  linkedDocuments: Array<{ id: string; title: string; file_name: string; status: string }>;
  governance: {
    sourceStatus: RegistrySourceStatus;
    validationStatus: RegistryValidationStatus;
    lastReviewedAt?: string | null;
    reviewDueAt?: string | null;
  };
  demoMode?: boolean;
};

type JsonRecord = Record<string, unknown>;

const sourceStatuses = ["current", "review_due", "outdated", "unknown"] as const;
const validationStatuses = ["unverified", "locally_reviewed", "approved"] as const;
const chipTones = ["danger", "info", "warning", "success", "neutral"] as const;
const contactKinds = ["phone", "email", "web", "text", "unknown"] as const;
const criterionTones = ["meet", "caution", "reject"] as const;
const confidenceLevels = ["High", "Medium", "Low", "Unknown"] as const;

function object(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function hasOnlyKnownKeys(value: JsonRecord, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function oneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function optionalNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function optionalStringList(value: unknown): value is string[] | null | undefined {
  return (
    value === undefined || value === null || (Array.isArray(value) && value.every((entry) => typeof entry === "string"))
  );
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function statusChip(value: unknown): boolean {
  const candidate = object(value);
  return Boolean(
    candidate &&
    hasOnlyKnownKeys(candidate, ["label", "tone"]) &&
    optionalNullableString(candidate.label) &&
    (candidate.tone === undefined || candidate.tone === null || oneOf(candidate.tone, chipTones)),
  );
}

function contact(value: unknown): boolean {
  const candidate = object(value);
  return Boolean(
    candidate &&
    hasOnlyKnownKeys(candidate, ["label", "value", "detail", "kind"]) &&
    typeof candidate.label === "string" &&
    optionalNullableString(candidate.value) &&
    optionalNullableString(candidate.detail) &&
    oneOf(candidate.kind, contactKinds),
  );
}

function summaryCard(value: unknown): boolean {
  const candidate = object(value);
  return Boolean(
    candidate &&
    hasOnlyKnownKeys(candidate, ["id", "label", "title", "detail"]) &&
    typeof candidate.id === "string" &&
    optionalNullableString(candidate.label) &&
    optionalNullableString(candidate.title) &&
    optionalNullableString(candidate.detail),
  );
}

function infoRow(value: unknown): boolean {
  const candidate = object(value);
  return Boolean(
    candidate &&
    hasOnlyKnownKeys(candidate, ["label", "value"]) &&
    typeof candidate.label === "string" &&
    optionalNullableString(candidate.value),
  );
}

function criterion(value: unknown): boolean {
  const candidate = object(value);
  return Boolean(
    candidate &&
    hasOnlyKnownKeys(candidate, ["label", "tone"]) &&
    typeof candidate.label === "string" &&
    oneOf(candidate.tone, criterionTones),
  );
}

function verification(value: unknown): boolean {
  const candidate = object(value);
  return Boolean(
    candidate &&
    hasOnlyKnownKeys(candidate, ["locallyVerified", "confidence", "notes"]) &&
    (candidate.locallyVerified === undefined ||
      candidate.locallyVerified === null ||
      typeof candidate.locallyVerified === "boolean") &&
    (candidate.confidence === undefined ||
      candidate.confidence === null ||
      oneOf(candidate.confidence, confidenceLevels)) &&
    optionalStringList(candidate.notes),
  );
}

function source(value: unknown): boolean {
  const candidate = object(value);
  return Boolean(
    candidate &&
    hasOnlyKnownKeys(candidate, ["label", "status", "url", "published", "reviewed", "notes"]) &&
    optionalNullableString(candidate.label) &&
    optionalNullableString(candidate.status) &&
    optionalNullableString(candidate.url) &&
    optionalNullableString(candidate.published) &&
    optionalNullableString(candidate.reviewed) &&
    optionalStringList(candidate.notes),
  );
}

function serviceRecord(value: unknown): value is ServiceRecord {
  const candidate = object(value);
  if (
    !candidate ||
    !hasOnlyKnownKeys(candidate, [
      "slug",
      "title",
      "subtitle",
      "statusChips",
      "primaryContact",
      "contacts",
      "route",
      "eligibility",
      "cost",
      "referral",
      "location",
      "summaryCards",
      "referralInfo",
      "bestUse",
      "criteria",
      "verification",
      "tags",
      "catchments",
      "catalogueLabel",
      "navigatorQuery",
      "source",
      "catalogPayload",
    ]) ||
    !nonEmptyString(candidate.slug) ||
    !nonEmptyString(candidate.title) ||
    !optionalString(candidate.subtitle) ||
    (candidate.statusChips !== undefined &&
      (!Array.isArray(candidate.statusChips) || !candidate.statusChips.every(statusChip))) ||
    (candidate.primaryContact !== undefined && !contact(candidate.primaryContact)) ||
    (candidate.contacts !== undefined && (!Array.isArray(candidate.contacts) || !candidate.contacts.every(contact))) ||
    !optionalString(candidate.route) ||
    !optionalString(candidate.eligibility) ||
    !optionalString(candidate.cost) ||
    !optionalString(candidate.referral) ||
    !optionalString(candidate.location) ||
    (candidate.summaryCards !== undefined &&
      (!Array.isArray(candidate.summaryCards) || !candidate.summaryCards.every(summaryCard))) ||
    (candidate.referralInfo !== undefined &&
      (!Array.isArray(candidate.referralInfo) || !candidate.referralInfo.every(infoRow))) ||
    !optionalString(candidate.bestUse) ||
    (candidate.criteria !== undefined &&
      (!Array.isArray(candidate.criteria) || !candidate.criteria.every(criterion))) ||
    (candidate.verification !== undefined && !verification(candidate.verification)) ||
    (candidate.tags !== undefined &&
      (!Array.isArray(candidate.tags) || !candidate.tags.every((entry) => typeof entry === "string"))) ||
    (candidate.catchments !== undefined &&
      (!Array.isArray(candidate.catchments) || !candidate.catchments.every((entry) => typeof entry === "string"))) ||
    !optionalString(candidate.catalogueLabel) ||
    !optionalString(candidate.navigatorQuery) ||
    (candidate.source !== undefined && !source(candidate.source)) ||
    (candidate.catalogPayload !== undefined && !object(candidate.catalogPayload))
  ) {
    return false;
  }
  return true;
}

function governanceEntry(
  value: unknown,
): value is { sourceStatus: RegistrySourceStatus; validationStatus: RegistryValidationStatus } {
  const candidate = object(value);
  return Boolean(
    candidate &&
    hasOnlyKnownKeys(candidate, ["sourceStatus", "validationStatus"]) &&
    oneOf(candidate.sourceStatus, sourceStatuses) &&
    oneOf(candidate.validationStatus, validationStatuses),
  );
}

function governance(value: unknown): value is RegistryListGovernance {
  const candidate = object(value);
  return Boolean(candidate && Object.values(candidate).every(governanceEntry));
}

function listBase(value: JsonRecord): boolean {
  return (
    nonNegativeInteger(value.total) &&
    nonNegativeInteger(value.verifiedCount) &&
    (value.demoMode === undefined || typeof value.demoMode === "boolean") &&
    (value.publicAccess === undefined || typeof value.publicAccess === "boolean")
  );
}

export function parseRegistryListResponse(value: unknown, view: RegistryListView): RegistryListResponse | null {
  const candidate = object(value);
  if (!candidate || !listBase(candidate)) return null;

  if (view === "summary") {
    if (!hasOnlyKnownKeys(candidate, ["total", "verifiedCount", "demoMode", "publicAccess"])) return null;
    return {
      records: [],
      total: candidate.total as number,
      verifiedCount: candidate.verifiedCount as number,
      demoMode: candidate.demoMode as boolean | undefined,
      governance: {},
    };
  }

  if (
    !Array.isArray(candidate.records) ||
    !candidate.records.every(serviceRecord) ||
    !hasOnlyKnownKeys(
      candidate,
      view === "full"
        ? ["records", "total", "verifiedCount", "governance", "demoMode", "publicAccess"]
        : ["records", "total", "verifiedCount", "demoMode", "publicAccess"],
    )
  ) {
    return null;
  }

  if (view === "full" && !governance(candidate.governance)) return null;
  return {
    records: candidate.records,
    total: candidate.total as number,
    verifiedCount: candidate.verifiedCount as number,
    demoMode: candidate.demoMode as boolean | undefined,
    governance: view === "full" ? (candidate.governance as RegistryListGovernance) : {},
  };
}

function linkedDocument(value: unknown): boolean {
  const candidate = object(value);
  return Boolean(
    candidate &&
    hasOnlyKnownKeys(candidate, ["id", "title", "file_name", "status"]) &&
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.file_name === "string" &&
    typeof candidate.status === "string",
  );
}

function recordGovernance(value: unknown): RegistryRecordResponse["governance"] | null {
  const candidate = object(value);
  if (
    !candidate ||
    !hasOnlyKnownKeys(candidate, ["sourceStatus", "validationStatus", "lastReviewedAt", "reviewDueAt"]) ||
    !oneOf(candidate.sourceStatus, sourceStatuses) ||
    !oneOf(candidate.validationStatus, validationStatuses) ||
    !optionalNullableString(candidate.lastReviewedAt) ||
    !optionalNullableString(candidate.reviewDueAt)
  ) {
    return null;
  }
  return candidate as RegistryRecordResponse["governance"];
}

export function parseRegistryRecordResponse(value: unknown): RegistryRecordResponse | null {
  const candidate = object(value);
  if (
    !candidate ||
    !hasOnlyKnownKeys(candidate, [
      "record",
      "linkedDocuments",
      "governance",
      "demoMode",
      "publicAccess",
      "sharedCatalog",
    ]) ||
    !serviceRecord(candidate.record) ||
    !Array.isArray(candidate.linkedDocuments) ||
    !candidate.linkedDocuments.every(linkedDocument) ||
    (candidate.demoMode !== undefined && typeof candidate.demoMode !== "boolean") ||
    (candidate.publicAccess !== undefined && typeof candidate.publicAccess !== "boolean") ||
    (candidate.sharedCatalog !== undefined && typeof candidate.sharedCatalog !== "boolean")
  ) {
    return null;
  }
  const parsedGovernance = recordGovernance(candidate.governance);
  if (!parsedGovernance) return null;
  return {
    record: candidate.record,
    linkedDocuments: candidate.linkedDocuments as RegistryRecordResponse["linkedDocuments"],
    governance: parsedGovernance,
    demoMode: candidate.demoMode as boolean | undefined,
  };
}
