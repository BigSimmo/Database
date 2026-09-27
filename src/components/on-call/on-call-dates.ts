// On Call dates are rendered on the server (UTC) and again in the browser. A
// bare toLocaleDateString() uses each side's own time zone, so an entry saved
// in the Perth morning could read as the previous day and fail hydration
// (ledger #5K1788). Pin every On Call date to Perth and one "12 Aug 2026" style.
const PERTH_DATE = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Australia/Perth",
});

const PERTH_DATE_TIME = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Perth",
});

export function formatOnCallDate(value: string | number | Date): string {
  return PERTH_DATE.format(new Date(value));
}

export function formatOnCallDateTime(value: string | number | Date): string {
  return PERTH_DATE_TIME.format(new Date(value));
}
