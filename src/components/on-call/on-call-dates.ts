// Re-export canonical Perth date formatters from @/lib/on-call/display-dates.
// This guarantees deterministic, hydration-safe (no Node 24 ICU "Sept" vs "Sep" mismatch)
// formatting across SSR and browser environments, and prevents RangeErrors on invalid dates.
export { formatOnCallDate, formatOnCallDateTime } from "@/lib/on-call/display-dates";

/**
 * Stable server-safe anchor for initial two-pass rendering (Wednesday 10:00 AWST).
 * Guarantees zero hydration mismatch between UTC server rendering and AWST client time.
 */
export const ON_CALL_SERVER_ANCHOR = new Date("2026-09-23T02:00:00.000Z");
