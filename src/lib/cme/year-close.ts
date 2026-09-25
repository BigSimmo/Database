import { daysRemainingInCpdYear, cpdYearOf, formatCalendarDateLong } from "@/lib/cme/cpd-year";
import { evaluateYear } from "@/lib/cme/evaluate";
import type {
  CmeAllocation,
  CmeAmendedEntryVersion,
  CmeCategory,
  CmeClosedRequirementStatus,
  CmeEntry,
  CmeRequirementSet,
  CmeYearAmendment,
  CmeYearClose,
} from "@/lib/cme/types";

/**
 * The last fortnight of a CPD year: when the dashboard turns into the year-end checklist,
 * and from when the year can be closed. A past year can be closed at any time.
 */
export const CME_CLOSE_WINDOW_DAYS = 14;

export const CME_SHORTFALL_NOTE_MAX = 2000;
export const CME_AMENDMENT_REASON_MIN = 3;
export const CME_AMENDMENT_REASON_MAX = 1000;

/** True in the last fortnight of `year` (Perth) and at any time after it ends. */
export function canCloseCmeYear(now: Date, year: number): boolean {
  const current = cpdYearOf(now);
  if (current > year) return true;
  return current === year && daysRemainingInCpdYear(now, year) <= CME_CLOSE_WINDOW_DAYS;
}

/** "17 December 2026": the first Perth date on which `year` can be closed. */
export function cmeYearClosableFromLabel(year: number): string {
  return formatCalendarDateLong(`${year}-12-${31 - CME_CLOSE_WINDOW_DAYS}`);
}

export type CmeCloseEvaluation = {
  readonly totalHours: number;
  readonly entryCount: number;
  readonly requirements: readonly CmeClosedRequirementStatus[];
};

/**
 * The app's reading of the year at closing. The database checks the total and the count
 * against its own rows before accepting it, so a stale screen cannot close a different record.
 */
export function buildCmeCloseEvaluation(set: CmeRequirementSet, entries: readonly CmeEntry[]): CmeCloseEvaluation {
  const active = entries.filter((entry) => !entry.archivedAt);
  const { totalHours, statuses } = evaluateYear({ set, entries: active });
  return {
    totalHours,
    entryCount: active.length,
    requirements: statuses.map((status) => ({
      requirementId: status.requirementId,
      label: set.requirements.find((requirement) => requirement.id === status.requirementId)?.label ?? "",
      met: status.met,
      summary: status.summary,
    })),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toAllocations(value: unknown): CmeAllocation[] {
  return Array.isArray(value)
    ? value.map((item) => {
        const allocation = asRecord(item);
        return { category: String(allocation.category) as CmeCategory, hours: Number(allocation.hours) };
      })
    : [];
}

function toVersion(value: unknown): CmeAmendedEntryVersion {
  const version = asRecord(value);
  return {
    date: String(version.date ?? ""),
    title: String(version.title ?? ""),
    allocations: toAllocations(version.allocations),
  };
}

/** Rows from `cme_year_snapshots` / `cme_year_amendments` -> `CmeYearClose`. */
export function rowsToCmeYearClose(
  snapshot: {
    closed_at: string;
    shortfall_note: string | null;
    total_hours: number;
    target_hours: number;
    record: unknown;
    evaluation: unknown;
  },
  amendments: readonly {
    id: string;
    entry_id: string;
    amended_at: string;
    reason: string;
    before: unknown;
    after: unknown;
  }[],
): CmeYearClose {
  const evaluation = asRecord(snapshot.evaluation);
  const record = asRecord(snapshot.record);
  const requirements = Array.isArray(evaluation.requirements) ? evaluation.requirements : [];
  return {
    closedAt: snapshot.closed_at,
    shortfallNote: snapshot.shortfall_note,
    totalHours: Number(snapshot.total_hours),
    targetHours: Number(snapshot.target_hours),
    entryCount: Array.isArray(record.entries) ? record.entries.length : Number(evaluation.entryCount ?? 0),
    requirements: requirements.map((item) => {
      const status = asRecord(item);
      return {
        requirementId: String(status.requirementId ?? ""),
        label: String(status.label ?? ""),
        met: status.met === true,
        summary: String(status.summary ?? ""),
      };
    }),
    amendments: amendments.map((row): CmeYearAmendment => ({
      id: row.id,
      entryId: row.entry_id,
      amendedAt: row.amended_at,
      reason: row.reason,
      before: toVersion(row.before),
      after: toVersion(row.after),
    })),
  };
}

/** Sum of one version's allocations, for "2 h -> 4 h" in the amendment history. */
export function amendedVersionHours(version: CmeAmendedEntryVersion): number {
  return Math.round(version.allocations.reduce((sum, allocation) => sum + allocation.hours, 0) * 100) / 100;
}
