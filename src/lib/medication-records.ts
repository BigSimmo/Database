import type { Database } from "@/lib/supabase/database.types";
import type { MedicationRecord } from "@/lib/medications";

export type MedicationSourceStatus = "current" | "review_due" | "outdated" | "unknown";
export type MedicationValidationStatus = "unverified" | "locally_reviewed" | "approved";

export type MedicationRecordRow = Database["public"]["Tables"]["medication_records"]["Row"];
export type MedicationRecordInsert = Database["public"]["Tables"]["medication_records"]["Insert"];

const sourceStatuses: readonly MedicationSourceStatus[] = ["current", "review_due", "outdated", "unknown"];
const validationStatuses: readonly MedicationValidationStatus[] = ["unverified", "locally_reviewed", "approved"];

export function normalizeMedicationSlug(value: string) {
  return value.trim().toLowerCase();
}

export function medicationSourceStatus(value: string | null | undefined): MedicationSourceStatus {
  return sourceStatuses.find((status) => status === value) ?? "unknown";
}

export function medicationValidationStatus(value: string | null | undefined): MedicationValidationStatus {
  return validationStatuses.find((status) => status === value) ?? "unverified";
}

const REVIEW_INTERVAL_DAYS = 365;

export function parseSourceDate(text: string): Date | null {
  if (/\b(?:not\s+checked|unchecked|unverified)\b/i.test(text)) {
    return null;
  }
  const match = text.match(/\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
  if (!match) return null;
  const parsed = new Date(`${match[0]}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // The Date constructor silently normalizes impossible calendar dates (e.g. 2026-02-29
  // in a non-leap year rolls forward to March 1) instead of rejecting them. Confirm the
  // parsed UTC components exactly match what was matched before trusting the result.
  const [, yearText, monthText, dayText] = match;
  if (
    parsed.getUTCFullYear() !== Number(yearText) ||
    parsed.getUTCMonth() + 1 !== Number(monthText) ||
    parsed.getUTCDate() !== Number(dayText)
  ) {
    return null;
  }
  return parsed;
}

export function evaluateSourceStatus(
  checkedDate: Date | null,
  referenceDate: Date = new Date(),
  reviewIntervalDays: number = REVIEW_INTERVAL_DAYS,
): MedicationSourceStatus {
  if (!checkedDate) return "unknown";
  const diffMs = referenceDate.getTime() - checkedDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays <= reviewIntervalDays) {
    return "current";
  }
  return "review_due";
}

export function deriveGovernanceFromSections(
  record: MedicationRecord,
  referenceDate: Date = new Date(),
): {
  source_status: MedicationSourceStatus;
  validation_status: MedicationValidationStatus;
} {
  const sourceSection = record.sections.find((section) => section.type === "src");
  const sourceText = sourceSection?.rows.map((row) => row.val).join(" ") ?? "";
  const parsedDate = parseSourceDate(sourceText);
  const sourceStatus: MedicationSourceStatus = evaluateSourceStatus(parsedDate, referenceDate);
  return {
    source_status: sourceStatus,
    // Derived records carry no evidence of clinical review, so they must not claim it.
    // `locally_reviewed` is not a label: `deriveTrust` accepts it as satisfying the
    // authority gate for high-risk clinical claims, and the registry corpus writes the
    // narrative "status changes require clinical review" alongside it. Asserting it from a
    // literal cleared that gate for every record in the snapshot on the strength of nothing.
    // Promotion belongs to the source-review flow, which records an actual reviewer.
    // Mirrors `registry-records.ts`, which derives its status from recorded verification.
    validation_status: "unverified",
  };
}

export function recordToRow(record: MedicationRecord, ownerId: string): MedicationRecordInsert {
  const governance = deriveGovernanceFromSections(record);
  return {
    owner_id: ownerId,
    slug: normalizeMedicationSlug(record.slug),
    name: record.name,
    class: record.class,
    subclass: record.subclass,
    category: record.category,
    accent: record.accent,
    tag: record.tag,
    schedule: record.schedule,
    stats: record.stats,
    sections: record.sections,
    quick: record.quick,
    source_status: governance.source_status,
    validation_status: governance.validation_status,
  };
}

export function rowToMedicationRecord(row: MedicationRecordRow): MedicationRecord {
  return {
    slug: row.slug,
    name: row.name,
    class: row.class ?? "",
    subclass: row.subclass ?? "",
    category: row.category ?? "",
    accent: row.accent ?? "#0f766e",
    tag: row.tag ?? "",
    schedule: row.schedule ?? "",
    stats: (row.stats ?? []) as MedicationRecord["stats"],
    sections: (row.sections ?? []) as MedicationRecord["sections"],
    quick: (row.quick ?? []) as MedicationRecord["quick"],
  };
}

export function rowGovernance(row: MedicationRecordRow): {
  sourceStatus: MedicationSourceStatus;
  validationStatus: MedicationValidationStatus;
  lastReviewedAt: string | null;
  reviewDueAt: string | null;
} {
  return {
    sourceStatus: medicationSourceStatus(row.source_status),
    validationStatus: medicationValidationStatus(row.validation_status),
    lastReviewedAt: row.last_reviewed_at,
    reviewDueAt: row.review_due_at,
  };
}
