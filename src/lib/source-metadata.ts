import { logger } from "@/lib/logger";
import { classifySourceAuthority, type SourceDesignation } from "@/lib/source-authority-registry";
import type { ClinicalSourceMetadata } from "@/lib/types";

const knownStatuses = new Set(["current", "review_due", "outdated", "unknown"]);
const knownValidation = new Set(["unverified", "locally_reviewed", "approved"]);
const knownExtraction = new Set(["good", "partial", "poor", "unknown"]);

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function enumOrDefault<T extends string>(value: unknown, allowed: Set<string>, fallback: T, field: string): T {
  if (typeof value === "string" && allowed.has(value)) return value as T;
  // A present-but-unrecognized string is a real data-entry defect (typo, renamed
  // enum, malformed ingest) that would otherwise collapse into the fallback and be
  // indistinguishable from a genuinely-absent value. Trace it so it is fixable.
  // Absent / null / empty values are the legitimate default and stay silent — they
  // are the common case and would drown the signal. The returned value is unchanged,
  // so this is observability only: no ranking/retrieval behaviour changes.
  if (typeof value === "string" && value.trim()) {
    logger.warn(`source-metadata: unrecognized ${field}`, { field, value });
  }
  return fallback;
}

export function normalizeSourceMetadata(input: unknown): ClinicalSourceMetadata {
  const value = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  return {
    source_kind: stringOrNull(value.source_kind),
    registry_record_kind: stringOrNull(value.registry_record_kind),
    registry_record_subkind: stringOrNull(value.registry_record_subkind),
    registry_record_id: stringOrNull(value.registry_record_id),
    registry_record_slug: stringOrNull(value.registry_record_slug),
    source_title: stringOrNull(value.source_title),
    publisher: stringOrNull(value.publisher),
    publisher_code: stringOrNull(value.publisher_code),
    jurisdiction: stringOrNull(value.jurisdiction),
    version: stringOrNull(value.version),
    publication_date: stringOrNull(value.publication_date),
    review_date: stringOrNull(value.review_date),
    uploaded_at: stringOrNull(value.uploaded_at),
    indexed_at: stringOrNull(value.indexed_at),
    uploaded_by: stringOrNull(value.uploaded_by),
    document_status: enumOrDefault(value.document_status, knownStatuses, "unknown", "document_status"),
    clinical_validation_status: enumOrDefault(
      value.clinical_validation_status,
      knownValidation,
      "unverified",
      "clinical_validation_status",
    ),
    extraction_quality: enumOrDefault(value.extraction_quality, knownExtraction, "unknown", "extraction_quality"),
  };
}

export function formatClinicalDate(value: string | null | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Australia/Perth",
  }).format(date);
}

export function sourceStatusLabel(metadata?: ClinicalSourceMetadata | null) {
  const status = metadata?.document_status ?? "unknown";
  if (metadata?.source_kind === "registry_record") {
    if (status === "review_due") return "Registry summary · Review due";
    if (status === "outdated") return "Registry summary · Outdated source";
    return "Registry summary";
  }
  if (status === "current") return "Current source";
  if (status === "review_due") return "Review due";
  if (status === "outdated") return "Outdated source";
  return "Review status unknown";
}

export function validationStatusLabel(metadata?: ClinicalSourceMetadata | null) {
  const status = metadata?.clinical_validation_status ?? "unverified";
  if (status === "approved") return "Approved";
  if (status === "locally_reviewed") return "Locally reviewed";
  return "Not locally validated";
}

export function extractionQualityLabel(metadata?: ClinicalSourceMetadata | null) {
  const status = metadata?.extraction_quality ?? "unknown";
  if (status === "good") return "Good extraction";
  if (status === "partial") return "Partial extraction";
  if (status === "poor") return "Poor extraction";
  return "Extraction unknown";
}

export function sourceProvenanceSummary(metadata?: ClinicalSourceMetadata | null) {
  const source = metadata ?? normalizeSourceMetadata(null);
  const reviewDate = formatClinicalDate(source.review_date);
  // Publisher/jurisdiction/review segments are dropped when unknown — a run of
  // "unknown" fillers is noise. The status and validation labels are always
  // kept: "Review status unknown" / "Not locally validated" are clinical
  // governance warnings, not filler.
  return [
    source.publisher,
    source.jurisdiction,
    reviewDate === "Unknown" ? null : `review ${reviewDate}`,
    sourceStatusLabel(source),
    validationStatusLabel(source),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function clipboardProvenanceLine(metadata?: ClinicalSourceMetadata | null) {
  const source = metadata ?? normalizeSourceMetadata(null);
  // Copied provenance stays fully explicit (including "Unknown" values): the
  // clipboard line is an audit artifact, unlike the visible summary above
  // which drops unknown filler segments for readability.
  return [
    `Designation: ${sourceDesignationSummary(source)}`,
    `Review status: ${sourceStatusLabel(source)}`,
    `Validation: ${validationStatusLabel(source)}`,
    `Review date: ${formatClinicalDate(source.review_date)}`,
    `Jurisdiction: ${source.jurisdiction ?? "Unknown"}`,
  ].join(" | ");
}

export function sourceDesignationLabel(designation: SourceDesignation) {
  if (designation === "official") return "Official";
  if (designation === "trusted") return "Trusted";
  return "Unclassified";
}

export function sourceDesignationDescription(metadata?: ClinicalSourceMetadata | null) {
  const classification = classifySourceAuthority(metadata);
  if (classification.designation === "official") {
    return classification.officialBasis === "wa_hospital"
      ? "Authenticated source issued by a recognised WA hospital. Official does not imply current, locally approved, or clinically relevant."
      : "Authenticated source issued by a recognised WA health-service network. Official does not imply current, locally approved, or clinically relevant.";
  }
  if (classification.designation === "trusted") {
    return "Recognised authority outside the Official WA hospital/network scope. Trusted does not imply current, locally approved, or clinically relevant.";
  }
  return "Source authority is unknown, ambiguous, conflicting, or a registry summary. Treat as unclassified provenance.";
}

export function sourceDesignationSummary(metadata?: ClinicalSourceMetadata | null) {
  const classification = classifySourceAuthority(metadata);
  return sourceDesignationLabel(classification.designation);
}
