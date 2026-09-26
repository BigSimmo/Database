/**
 * Dates and times as every mode writes them (mode design standard §2), in
 * Perth time.
 *
 *   date        `12 Mar 2026`, then a muted age: `12 Mar 2026 · 6 months ago`
 *   time        `02:14`, 24-hour
 *
 * A fixed month table rather than `Intl`, which prints "Sept" and "June" on
 * Node 24 — the same approach as `formatPerthDay` in `shifts/perth-time.ts`.
 * Perth keeps UTC+8 all year, so shifting by eight hours and reading the UTC
 * fields is exact and needs no time-zone data.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const PERTH_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function perth(value: string | Date): Date | null {
  const time = typeof value === "string" ? Date.parse(value) : value.getTime();
  return Number.isFinite(time) ? new Date(time + PERTH_OFFSET_MS) : null;
}

const two = (value: number) => String(value).padStart(2, "0");

/** `20 Sep 2026`, or an empty string for a date that cannot be read. */
export function formatModeDate(value: string | Date): string {
  const date = perth(value);
  return date ? `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}` : "";
}

/** `02:14`, 24-hour, or an empty string for a time that cannot be read. */
export function formatModeTime(value: string | Date): string {
  const date = perth(value);
  return date ? `${two(date.getUTCHours())}:${two(date.getUTCMinutes())}` : "";
}

/**
 * How long ago, in words a tired reader takes in at a glance: `today`,
 * `yesterday`, `6 days ago`, `3 weeks ago`, `6 months ago`, `2 years ago`.
 * Counted in Perth calendar days, so "yesterday" means the reader's yesterday.
 */
export function modeAgo(value: string | Date, now: Date = new Date()): string {
  const then = perth(value);
  const today = perth(now);
  if (!then || !today) return "";
  const days = Math.floor(today.getTime() / DAY_MS) - Math.floor(then.getTime() / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  const months =
    (today.getUTCFullYear() - then.getUTCFullYear()) * 12 +
    (today.getUTCMonth() - then.getUTCMonth()) -
    (today.getUTCDate() < then.getUTCDate() ? 1 : 0);
  if (months < 12) return `${Math.max(months, 2)} months ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

/**
 * A phone number as a screen reader should say it: each digit on its own and a
 * pause between groups, so "9000 0000" is never read as "nine thousand, zero".
 * Words ("ext") are kept as they are.
 */
export function spokenModeNumber(display: string): string {
  const tokens = display.replace(/[()]/g, " ").split(/\s+/).filter(Boolean);
  let spoken = "";
  let previousWasNumber = false;
  for (const token of tokens) {
    const bare = token.replace(/,$/, "");
    const isNumber = /^\+?\d+$/.test(bare);
    if (spoken) spoken += previousWasNumber && isNumber ? ", " : " ";
    spoken += isNumber ? bare.split("").join(" ") : bare;
    previousWasNumber = isNumber;
  }
  return spoken;
}
