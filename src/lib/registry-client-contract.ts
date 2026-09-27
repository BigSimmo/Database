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
  /**
   * The list was answered from the in-bundle catalogue because the canonical read could not be
   * completed. The records are real; the list may not include the most recent publication. Kept
   * on every view, counts included, because a count from the seed list is exactly as capable of
   * being out of date as the rows are.
   */
  degraded?: boolean;
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

function pickKnownKeys(value: JsonRecord, keys: readonly string[]): JsonRecord {
  const projected: JsonRecord = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(value, key) && value[key] !== undefined) {
      projected[key] = value[key];
    }
  }
  return projected;
}

function projectObjectKeys(value: unknown, keys: readonly string[]): unknown {
  const candidate = object(value);
  return candidate ? pickKnownKeys(candidate, keys) : value;
}

const serviceRecordKeys = [
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
] as const;

const sourceKeys = ["label", "status", "url", "published", "reviewed", "notes", "allUrls"] as const;
const statusChipKeys = ["label", "tone"] as const;
const contactKeys = ["label", "value", "detail", "kind"] as const;
const summaryCardKeys = ["id", "label", "title", "detail"] as const;
const infoRowKeys = ["label", "value"] as const;
const criterionKeys = ["label", "tone"] as const;
const verificationKeys = [
  "locallyVerified",
  "confidence",
  "notes",
  "availabilityStatus",
  "lastVerifiedAt",
  "nextReviewAt",
  "reviewer",
  "riskLevel",
  "unresolvedIssues",
] as const;

/**
 * Strip a registry render payload down to the keys the shared client parser accepts.
 *
 * Published `render_payload` rows can carry nested fields the publication projector still
 * allows (for example `source.summary` / `source.lastUpdated`) that the client contract
 * never lists. Before 2026-09-25 that mismatch made `parseRegistryListResponse` return null
 * for an otherwise healthy HTTP 200, and Services/Forms rendered "Could not load …".
 * Medications already keep record shape checks identity-deep for the same reason; this
 * projection is the registry equivalent, shared by the API respond path and the client parser.
 */
export function projectServiceRecordForClient(value: unknown): unknown {
  const candidate = object(value);
  if (!candidate) return value;
  const projected = pickKnownKeys(candidate, serviceRecordKeys);
  if (Array.isArray(projected.statusChips)) {
    projected.statusChips = projected.statusChips.map((entry) => projectObjectKeys(entry, statusChipKeys));
  }
  if (projected.primaryContact !== undefined) {
    projected.primaryContact = projectObjectKeys(projected.primaryContact, contactKeys);
  }
  if (Array.isArray(projected.contacts)) {
    projected.contacts = projected.contacts.map((entry) => projectObjectKeys(entry, contactKeys));
  }
  if (Array.isArray(projected.summaryCards)) {
    projected.summaryCards = projected.summaryCards.map((entry) => projectObjectKeys(entry, summaryCardKeys));
  }
  if (Array.isArray(projected.referralInfo)) {
    projected.referralInfo = projected.referralInfo.map((entry) => projectObjectKeys(entry, infoRowKeys));
  }
  if (Array.isArray(projected.criteria)) {
    projected.criteria = projected.criteria.map((entry) => projectObjectKeys(entry, criterionKeys));
  }
  if (projected.verification !== undefined) {
    projected.verification = projectObjectKeys(projected.verification, verificationKeys);
  }
  if (projected.source !== undefined) {
    projected.source = projectObjectKeys(projected.source, sourceKeys);
  }
  return projected;
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
    hasOnlyKnownKeys(candidate, [
      "locallyVerified",
      "confidence",
      "notes",
      "availabilityStatus",
      "lastVerifiedAt",
      "nextReviewAt",
      "reviewer",
      "riskLevel",
      "unresolvedIssues",
    ]) &&
    (candidate.locallyVerified === undefined ||
      candidate.locallyVerified === null ||
      typeof candidate.locallyVerified === "boolean") &&
    (candidate.confidence === undefined ||
      candidate.confidence === null ||
      oneOf(candidate.confidence, confidenceLevels)) &&
    optionalStringList(candidate.notes) &&
    optionalNullableString(candidate.availabilityStatus) &&
    optionalNullableString(candidate.lastVerifiedAt) &&
    optionalNullableString(candidate.nextReviewAt) &&
    optionalNullableString(candidate.reviewer) &&
    optionalNullableString(candidate.riskLevel) &&
    optionalStringList(candidate.unresolvedIssues),
  );
}

function source(value: unknown): boolean {
  const candidate = object(value);
  return Boolean(
    candidate &&
    hasOnlyKnownKeys(candidate, ["label", "status", "url", "published", "reviewed", "notes", "allUrls"]) &&
    optionalNullableString(candidate.label) &&
    optionalNullableString(candidate.status) &&
    optionalNullableString(candidate.url) &&
    optionalNullableString(candidate.published) &&
    optionalNullableString(candidate.reviewed) &&
    optionalStringList(candidate.notes) &&
    optionalStringList(candidate.allUrls),
  );
}

function serviceRecord(value: unknown): value is ServiceRecord {
  const candidate = object(value);
  if (
    !candidate ||
    !hasOnlyKnownKeys(candidate, serviceRecordKeys) ||
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
  // List responses historically omitted review dates; detail responses include them.
  // Canonical live governance always carries `lastReviewedAt` / `reviewDueAt` (often null).
  // Rejecting those keys blanked every healthy Services/Forms list after the catalogue read
  // recovered — the exact "Could not load services" fault the seed path did not hit, because
  // seeds only emit the two status fields.
  return Boolean(
    candidate &&
    hasOnlyKnownKeys(candidate, ["sourceStatus", "validationStatus", "lastReviewedAt", "reviewDueAt"]) &&
    oneOf(candidate.sourceStatus, sourceStatuses) &&
    oneOf(candidate.validationStatus, validationStatuses) &&
    optionalNullableString(candidate.lastReviewedAt) &&
    optionalNullableString(candidate.reviewDueAt),
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
    (value.publicAccess === undefined || typeof value.publicAccess === "boolean") &&
    (value.degraded === undefined || typeof value.degraded === "boolean")
  );
}

export function parseRegistryListResponse(value: unknown, view: RegistryListView): RegistryListResponse | null {
  const candidate = object(value);
  if (!candidate || !listBase(candidate)) return null;

  if (view === "summary") {
    if (!hasOnlyKnownKeys(candidate, ["total", "verifiedCount", "demoMode", "publicAccess", "degraded"])) {
      return null;
    }
    return {
      records: [],
      total: candidate.total as number,
      verifiedCount: candidate.verifiedCount as number,
      demoMode: candidate.demoMode as boolean | undefined,
      governance: {},
      degraded: candidate.degraded as boolean | undefined,
    };
  }

  if (
    !Array.isArray(candidate.records) ||
    !hasOnlyKnownKeys(
      candidate,
      // `matches` has to be listed even though nothing here reads it. The route builds it for
      // EVERY non-summary view whenever the request carries `q`, and an unknown key rejects the
      // whole response — so a searched list would have arrived intact and still been reported to
      // the reader as "the registry could not be searched". Accepted and ignored: ranking for
      // these views is done on the client from `records`.
      view === "full"
        ? ["records", "total", "verifiedCount", "governance", "matches", "demoMode", "publicAccess", "degraded"]
        : ["records", "total", "verifiedCount", "matches", "demoMode", "publicAccess", "degraded"],
    )
  ) {
    return null;
  }

  const records = candidate.records.map(projectServiceRecordForClient);
  if (!records.every(serviceRecord)) return null;

  if (view === "full" && !governance(candidate.governance)) return null;
  return {
    records: records as ServiceRecord[],
    total: candidate.total as number,
    verifiedCount: candidate.verifiedCount as number,
    demoMode: candidate.demoMode as boolean | undefined,
    governance: view === "full" ? (candidate.governance as RegistryListGovernance) : {},
    degraded: candidate.degraded as boolean | undefined,
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
    (candidate.demoMode !== undefined && typeof candidate.demoMode !== "boolean") ||
    (candidate.publicAccess !== undefined && typeof candidate.publicAccess !== "boolean") ||
    (candidate.sharedCatalog !== undefined && typeof candidate.sharedCatalog !== "boolean")
  ) {
    return null;
  }
  const projectedRecord = projectServiceRecordForClient(candidate.record);
  if (!serviceRecord(projectedRecord)) return null;
  if (!Array.isArray(candidate.linkedDocuments) || !candidate.linkedDocuments.every(linkedDocument)) return null;
  const parsedGovernance = recordGovernance(candidate.governance);
  if (!parsedGovernance) return null;
  return {
    record: projectedRecord,
    linkedDocuments: candidate.linkedDocuments as RegistryRecordResponse["linkedDocuments"],
    governance: parsedGovernance,
    demoMode: candidate.demoMode as boolean | undefined,
  };
}
