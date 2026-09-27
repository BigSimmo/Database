/** Hours as typed: "1.5", "1,5" (a decimal comma), ".5", with an optional "h", "hr", "hrs", "hour" or "hours". */
const HOURS_TEXT = /^(\d+(?:[.,]\d+)?|[.,]\d+)\s*(?:h|hr|hrs|hour|hours)?$/i;
/** Whole minutes as typed: "90 min", "90min", "45 minutes", "30 m". */
const MINUTES_TEXT = /^(\d+)\s*(?:m|min|mins|minute|minutes)$/i;

/** Hours are compared to the hundredth everywhere (`isAllocationBalanced`), so they are read to the hundredth too. */
function toHundredth(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Reads the hours a doctor typed for one activity — "1.5", "1,5", "1.5 h",
 * "90 min" — as a positive number of hours to the hundredth ("20 min" is
 * 0.33). Returns null for anything else, including zero, a sign, and exponent
 * notation, so "1e10" can never become an hour count. The 24-hour ceiling is
 * the entry schema's (`cmeEntryCreateSchema`), not this reader's.
 */
export function parseCmeHours(text: string): number | null {
  const trimmed = text.trim();
  const minutes = MINUTES_TEXT.exec(trimmed);
  if (minutes) {
    const hours = toHundredth(Number(minutes[1]) / 60);
    return hours > 0 ? hours : null;
  }
  const hoursMatch = HOURS_TEXT.exec(trimmed);
  if (!hoursMatch) return null;
  const hours = toHundredth(Number(hoursMatch[1].replace(",", ".")));
  return Number.isFinite(hours) && hours > 0 ? hours : null;
}
