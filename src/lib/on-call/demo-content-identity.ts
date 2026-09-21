import { DEMO_ON_CALL_ENTRIES } from "@/lib/on-call/demo-entries";

/**
 * Which rows the example-content loader owns.
 *
 * Its own module rather than constants inside the route, so a test can hold
 * them against the corpus without importing a Next.js route handler — and so
 * the delete's notion of "an example row" cannot quietly drift from the
 * corpus it is meant to describe.
 */

/** Every distinct slug the corpus uses. */
export const ON_CALL_DEMO_SLUGS: readonly string[] = [...new Set(DEMO_ON_CALL_ENTRIES.map((entry) => entry.slug))];

/**
 * The same slugs grouped by section — the shape of the table's unique key,
 * `(owner_id, section, slug)`.
 *
 * The delete matches on the PAIR. Matching on slug alone would delete on half
 * of a compound key, so an owner's real row that happened to share a slug with
 * an example row in a DIFFERENT section would be destroyed. Filtering the
 * returned rows afterwards does not help: by then the row is already gone and
 * the filter only decides whether to count it.
 */
export const ON_CALL_DEMO_SLUGS_BY_SECTION: ReadonlyArray<readonly [string, readonly string[]]> = [
  ...DEMO_ON_CALL_ENTRIES.reduce((bySection, entry) => {
    const slugs = bySection.get(entry.section) ?? [];
    slugs.push(entry.slug);
    bySection.set(entry.section, slugs);
    return bySection;
  }, new Map<string, string[]>()),
];

/** How many rows a full load writes. */
export const ON_CALL_DEMO_ENTRY_COUNT = DEMO_ON_CALL_ENTRIES.length;
