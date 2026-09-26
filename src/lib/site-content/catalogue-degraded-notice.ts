/**
 * What a reader is told when a list came from the in-bundle catalogue rather than the published
 * one. Plain, short, and honest about the only thing that matters clinically: the entries are real
 * but the list may not include the most recent publication. Kept in one place so every surface
 * says the same words. The fallback mechanism is in `catalogue-seed-fallback.ts`, which
 * re-exports these; this file has no imports so client components stay light.
 */
export const catalogueDegradedNotice = "may be out of date";

/**
 * Append the notice to a results heading when, and only when, the group was served from seeds.
 * A helper rather than an inline ternary so the wording is asserted in one place and cannot drift
 * between the surfaces that show it.
 */
export function withCatalogueDegradedNotice(heading: string, degraded: boolean | undefined): string {
  return degraded ? `${heading} · ${catalogueDegradedNotice}` : heading;
}
