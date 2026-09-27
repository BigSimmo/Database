import { z } from "zod";

import { onCallHandbookReportedStorageKey } from "@/lib/on-call/device-state-keys";

/**
 * The fixed reasons a reader may report a handbook number for, and the device
 * memory that stops one fault being reported twice.
 *
 * Only number faults (review F9). "No answer after three tries" was removed: it
 * stored who reported, which role and when, so it became a timed record that a
 * person did not answer — a workforce record, not a number fault, and nothing an
 * editor could fix. "Didn't connect" stays on the phone only (lane B). No reason
 * is free text, so no report can carry patient details.
 */
export const HANDBOOK_REPORT_REASONS = {
  "not-in-service": "Number not in service",
  "wrong-department": "Reaches the wrong department",
} as const;
export type HandbookReportReason = keyof typeof HANDBOOK_REPORT_REASONS;

const REPORT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const reportsSchema = z.array(
  z
    .object({
      entryId: z.string().min(1),
      reason: z.enum(Object.keys(HANDBOOK_REPORT_REASONS) as [HandbookReportReason, ...HandbookReportReason[]]),
      at: z.string().min(1),
    })
    .strict(),
);
type StoredReport = z.infer<typeof reportsSchema>[number];

/** Whole-list rejection, as `recent-storage.ts` does: a foreign payload is no history. */
function readReports(): StoredReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(onCallHandbookReportedStorageKey);
    if (!raw) return [];
    const parsed = reportsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function withinWindow(report: StoredReport, now: Date): boolean {
  const at = Date.parse(report.at);
  return Number.isFinite(at) && now.getTime() - at < REPORT_WINDOW_MS;
}

/** True when this device reported this entry for this reason in the last 30 days. */
export function hasReportedOnThisDevice(
  entryId: string,
  reason: HandbookReportReason,
  now: Date = new Date(),
): boolean {
  return readReports().some(
    (report) => report.entryId === entryId && report.reason === reason && withinWindow(report, now),
  );
}

export function rememberReportOnThisDevice(
  entryId: string,
  reason: HandbookReportReason,
  now: Date = new Date(),
): void {
  if (typeof window === "undefined") return;
  const next = [
    { entryId, reason, at: now.toISOString() },
    ...readReports().filter(
      (report) => withinWindow(report, now) && !(report.entryId === entryId && report.reason === reason),
    ),
  ];
  try {
    window.localStorage.setItem(onCallHandbookReportedStorageKey, JSON.stringify(next));
  } catch {
    // Blocked storage: the server still accepts the report; only the de-dup is lost.
  }
}
