import { z } from "zod";

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

// A source date ahead of the reading clock cannot describe a check that has already
// happened. One day of slack absorbs the ordinary timezone gap between the machine
// that wrote the entry (Perth, UTC+8) and the machine reading it in UTC; anything
// further ahead is a typo or a bad import and must not be trusted as a check date.
const FUTURE_DATE_TOLERANCE_DAYS = 1;

export function parseSourceDate(text: string): Date | null {
  if (/\b(?:not\s+checked|unchecked|unverified)\b/i.test(text)) {
    return null;
  }

  // A source block can carry several dates — one per cited publication. The only
  // freshness a record can honestly claim is that of its OLDEST source: taking the
  // first (or newest) match lets one recently re-checked line vouch for every other
  // source beside it, which is the optimistic direction this module must never take.
  let oldest: Date | null = null;
  // Declared inline: a shared /g regex carries `lastIndex` state, and one future
  // `.test()`/`.exec()` call against it elsewhere would silently start skipping dates.
  for (const match of text.matchAll(/\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g)) {
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
      // An unreadable date anywhere in the block makes the whole block untrustworthy.
      // Skipping it and reporting one of its neighbours would present a date the source
      // text does not actually say, so the entire record degrades to "unknown" instead.
      return null;
    }
    if (!oldest || parsed.getTime() < oldest.getTime()) {
      oldest = parsed;
    }
  }
  return oldest;
}

export function evaluateSourceStatus(
  checkedDate: Date | null,
  referenceDate: Date = new Date(),
  reviewIntervalDays: number = REVIEW_INTERVAL_DAYS,
): MedicationSourceStatus {
  if (!checkedDate) return "unknown";
  const diffMs = referenceDate.getTime() - checkedDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  // A future date produces a large negative age, which passes the interval test below
  // and would read as freshly checked forever — a "2126" typo would never age out.
  // Treat it as an unusable date rather than a fresh one.
  if (diffDays < -FUTURE_DATE_TOLERANCE_DAYS) {
    return "unknown";
  }
  if (diffDays <= reviewIntervalDays) {
    return "current";
  }
  return "review_due";
}

export type MedicationSourceGovernance = {
  sourceStatus: MedicationSourceStatus;
  /**
   * ISO calendar date (yyyy-mm-dd) the sources were last checked, when that is
   * known. Null whenever the status is `unknown`, so no caller can render a
   * "checked on" date the derivation itself does not stand behind.
   */
  sourceCheckedAt: string | null;
  /**
   * Whether the record carries any source text at all. `unknown` covers two
   * materially different deficiencies — a source block whose date could not be
   * read, and no recorded sources whatsoever — and a prescribing tool must not
   * present the second as the first. Three snapshot records (alimemazine,
   * edoxaban, levomepromazine) carry no `src` section at all.
   */
  sourcesRecorded: boolean;
};

/**
 * Derive source freshness from a record's own `src` section. This is the single
 * implementation for both the write path and the read path — see `rowGovernance`
 * for why the read path must never trust a stored status column.
 */
export function deriveMedicationSourceGovernance(
  sections: MedicationRecord["sections"],
  referenceDate: Date = new Date(),
): MedicationSourceGovernance {
  const sourceSection = sections.find((section) => section.type === "src");
  const sourceText = sourceSection?.rows.map((row) => row.val).join(" ") ?? "";
  const parsedDate = parseSourceDate(sourceText);
  const sourceStatus = evaluateSourceStatus(parsedDate, referenceDate);
  return {
    sourceStatus,
    sourceCheckedAt: parsedDate && sourceStatus !== "unknown" ? parsedDate.toISOString().slice(0, 10) : null,
    // A `src` section holding only empty rows records no more than a missing one.
    sourcesRecorded: sourceText.trim().length > 0,
  };
}

export function deriveGovernanceFromSections(
  record: MedicationRecord,
  referenceDate: Date = new Date(),
): {
  source_status: MedicationSourceStatus;
  validation_status: MedicationValidationStatus;
} {
  const { sourceStatus } = deriveMedicationSourceGovernance(record.sections, referenceDate);
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

const medicationStatSchema = z.looseObject({
  label: z.string(),
  value: z.string(),
  cls: z.string().optional(),
  flag: z.string().optional(),
});

const medicationPatientSchema = z
  .looseObject({
    factors: z.array(z.string()).optional(),
    action: z.string().optional(),
    severity: z.string().optional(),
    match: z.record(z.string(), z.unknown()).optional(),
    note: z.string().optional(),
  })
  .nullable();

const medicationSectionRowSchema = z.looseObject({
  key: z.string(),
  val: z.string(),
  tags: z.array(z.string()).optional(),
  patient: medicationPatientSchema.optional(),
});

const medicationSectionSchema = z.looseObject({
  title: z.string(),
  type: z.string(),
  rows: z.array(medicationSectionRowSchema),
});

const medicationQuickRowSchema = z.looseObject({
  label: z.string(),
  value: z.string(),
});

const medicationStatsSchema = z.array(medicationStatSchema);
const medicationSectionsSchema = z.array(medicationSectionSchema);
const medicationQuickSchema = z.array(medicationQuickRowSchema);

function parseMedicationJsonbArray<T>(schema: z.ZodType<T[]>, value: unknown): T[] {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function rowToMedicationRecord(row: MedicationRecordRow): MedicationRecord {
  return {
    slug: row.slug,
    name: row.name,
    class: row.class ?? "",
    subclass: row.subclass ?? "",
    category: row.category ?? "",
    // Per-record user colour (Postgres medications.accent default). Stored as a
    // hex swatch for inline styles; not --clinical-accent (app chrome).
    accent: row.accent ?? "#0f766e",
    tag: row.tag ?? "",
    schedule: row.schedule ?? "",
    stats: parseMedicationJsonbArray(medicationStatsSchema, row.stats),
    sections: parseMedicationJsonbArray(medicationSectionsSchema, row.sections),
    quick: parseMedicationJsonbArray(medicationQuickSchema, row.quick),
  };
}

/**
 * Read-time governance for a stored medication row.
 *
 * Source freshness is RE-DERIVED here from the row's own `sections`, never read back
 * from the stored `source_status` column. That column is written once, by
 * `recordToRow` at insert time, and then never ages: a row written while its sources
 * were fresh keeps claiming `current` indefinitely. Only the snapshot/demo path
 * re-derived per request, so ageing worked in exactly the environment that has no
 * patients and never worked against the live database.
 *
 * The column stays in place (it is applied migration history and is still what the
 * write path stores); it simply stops being the answer this function returns.
 */
export function rowGovernance(row: MedicationRecordRow, referenceDate: Date = new Date()): MedicationRowGovernance {
  return governanceForSections(row, parseMedicationJsonbArray(medicationSectionsSchema, row.sections), referenceDate);
}

/**
 * The same read-time governance for a caller that has ALREADY parsed the row into a
 * `MedicationRecord`. The list route maps every row twice — once to a record, once to
 * governance — and Zod-parsing the identical `sections` payload a second time cost about
 * 6 ms per 330 rows, roughly 9 ms of synchronous event-loop time per request at the
 * `MEDICATION_MAX_RECORDS` cap. `rowGovernance` above keeps its fail-closed row-only
 * behaviour for callers that hold nothing but a row.
 */
export function rowGovernanceForRecord(
  row: MedicationRecordRow,
  record: MedicationRecord,
  referenceDate: Date = new Date(),
): MedicationRowGovernance {
  return governanceForSections(row, record.sections, referenceDate);
}

type MedicationRowGovernance = {
  sourceStatus: MedicationSourceStatus;
  validationStatus: MedicationValidationStatus;
  sourceCheckedAt: string | null;
  sourcesRecorded: boolean;
  lastReviewedAt: string | null;
  reviewDueAt: string | null;
};

function governanceForSections(
  row: MedicationRecordRow,
  sections: MedicationRecord["sections"],
  referenceDate: Date,
): MedicationRowGovernance {
  const storedStatus = medicationSourceStatus(row.source_status);
  const derived = deriveMedicationSourceGovernance(sections, referenceDate);
  // `outdated` asserts that the guidance has been superseded. That is a recorded
  // clinical judgement, not something age can establish or refute, so a stored
  // `outdated` survives re-derivation rather than being quietly downgraded. Every
  // other stored value is only ever a frozen age calculation, which the fresh
  // derivation replaces.
  const sourceStatus = storedStatus === "outdated" ? "outdated" : derived.sourceStatus;
  return {
    sourceStatus,
    validationStatus: medicationValidationStatus(row.validation_status),
    sourceCheckedAt: derived.sourceCheckedAt,
    sourcesRecorded: derived.sourcesRecorded,
    lastReviewedAt: row.last_reviewed_at,
    reviewDueAt: row.review_due_at,
  };
}

/**
 * Governance for a record served straight from the curated snapshot (demo mode and
 * the anonymous public payload), shaped exactly like the camelCase governance the
 * API returns for owner rows so the client renders one thing, not two.
 */
export function publicMedicationGovernance(
  record: MedicationRecord,
  referenceDate: Date = new Date(),
): {
  sourceStatus: MedicationSourceStatus;
  validationStatus: MedicationValidationStatus;
  sourceCheckedAt: string | null;
  sourcesRecorded: boolean;
} {
  const columns = deriveGovernanceFromSections(record, referenceDate);
  const derived = deriveMedicationSourceGovernance(record.sections, referenceDate);
  return {
    sourceStatus: columns.source_status,
    validationStatus: columns.validation_status,
    sourceCheckedAt: derived.sourceCheckedAt,
    sourcesRecorded: derived.sourcesRecorded,
  };
}
