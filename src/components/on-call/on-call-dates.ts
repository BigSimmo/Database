// Re-export canonical Perth date formatters from @/lib/on-call/display-dates.
// This guarantees deterministic, hydration-safe (no Node 24 ICU "Sept" vs "Sep" mismatch)
// formatting across SSR and browser environments, and prevents RangeErrors on invalid dates.
export { formatOnCallDate, formatOnCallDateTime } from "@/lib/on-call/display-dates";

/**
 * Stable internal value while a time-dependent page shows its neutral hydration placeholder.
 * The page must not render clinical periods, numbers or reminders from this historical instant.
 */
export const ON_CALL_SERVER_ANCHOR = new Date("2026-09-23T02:00:00.000Z");
