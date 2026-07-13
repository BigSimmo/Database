import { z } from "zod";

export const sourceReviewDecisionSchema = z.enum([
  "locally_reviewed",
  "approved",
  "rejected",
  "decommissioned",
  "superseded",
]);

export type SourceReviewDecision = z.infer<typeof sourceReviewDecisionSchema>;

function perthCalendarDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isValidReviewDate(value: string, now = new Date()) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value <= perthCalendarDate(now)
  );
}
