/**
 * Pin the clock of a spawned Node process, for tests that run a governance CLI end to end.
 *
 * The register checks compare review dates with "today". A test that spawns one against the real
 * clock turns red on a calendar date whatever the change is (organisation framework suggestion 6,
 * "defuse the date traps"). Passing this specifier to `node --import` replaces `Date` in the child
 * before the script loads, so `new Date()` and `Date.now()` return `instant` and explicit dates
 * still parse normally. It is test-only: nothing in the scripts reads a clock override.
 */
export function fixedClockImport(instant: Date): string {
  const ms = instant.getTime();
  if (!Number.isFinite(ms)) throw new TypeError("fixedClockImport needs a valid date");
  const source = [
    `const fixed = ${ms};`,
    "const RealDate = Date;",
    "globalThis.Date = class extends RealDate {",
    "  constructor(...args) { super(...(args.length ? args : [fixed])); }",
    "  static now() { return fixed; }",
    "};",
  ].join("\n");
  return `data:text/javascript,${encodeURIComponent(source)}`;
}

/** Midday in Perth on an ISO date: the registers judge dates in Australia/Perth (UTC+8, no DST). */
export function perthMidday(isoDate: string): Date {
  return new Date(`${isoDate}T04:00:00Z`);
}

/** The ISO date `days` after `isoDate` (negative for before). */
export function shiftIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The latest of a list of ISO dates, ignoring anything that is not one. */
export function latestIsoDate(values: unknown[]): string {
  const dates = values.filter(
    (value): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value),
  );
  if (!dates.length) throw new Error("no ISO dates to choose from");
  return dates.sort().at(-1) as string;
}
