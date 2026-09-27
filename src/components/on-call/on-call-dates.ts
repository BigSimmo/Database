// Re-export canonical Perth date formatters from @/lib/on-call/display-dates.
// This guarantees deterministic, hydration-safe (no Node 24 ICU "Sept" vs "Sep" mismatch)
// formatting across SSR and browser environments, and prevents RangeErrors on invalid dates.
export { formatOnCallDate, formatOnCallDateTime } from "@/lib/on-call/display-dates";
