import { type OnCallEntry } from "@/lib/on-call/entry-model";

/**
 * The facet filtering for the On Call section pages.
 *
 * Every section board in the drawing carries a chip row above the list —
 * Contacts filters by area, Referrals and Orientation by tag, Logistics by
 * category. One helper rather than four: the sections already disagree about
 * where their grouping key lives, and four copies of "distinct, ordered, with
 * All in front" is four chances for one of them to offer a chip that filters
 * to nothing.
 *
 * The options are DERIVED from the entries on the page, never a fixed list.
 * A chip for a category the hub holds nothing in is a promise the tap breaks,
 * and a hub read at 3am cannot afford a control that appears to do nothing.
 */
export const ON_CALL_FILTER_ALL = "All";

/** How a section reads the facet values off one of its entries. */
export type OnCallFacetReader = (entry: OnCallEntry) => readonly string[];

/**
 * The chip row for a set of entries: `All`, then every facet value present,
 * in first-seen order.
 *
 * First-seen rather than alphabetical, because the entries arrive in the
 * repository's own order (`sort_order`, then title) and that order is the
 * owner's. Sorting here would reshuffle the chips every time an entry is
 * renamed.
 *
 * Returns an EMPTY array when there is nothing to choose between — one facet
 * value, or none. A chip row reading "All | Wards" when every entry is a ward
 * is furniture, and the drawing only ever shows a row with real choices in it.
 */
export function onCallFilterOptions(entries: readonly OnCallEntry[], facetOf: OnCallFacetReader): string[] {
  const seen: string[] = [];
  for (const entry of entries) {
    for (const value of facetOf(entry)) {
      const trimmed = value.trim();
      if (trimmed.length === 0 || seen.includes(trimmed)) continue;
      seen.push(trimmed);
    }
  }
  return seen.length > 1 ? [ON_CALL_FILTER_ALL, ...seen] : [];
}

/**
 * Whether an entry survives the active chip.
 *
 * An entry carrying NO facet value survives every filter rather than
 * disappearing. Withholding a number because nobody tagged it is the failure
 * this mode exists to prevent; showing it under a narrower chip than it
 * deserves is not.
 */
export function onCallEntryMatchesFilter(
  entry: OnCallEntry,
  facetOf: OnCallFacetReader,
  active: string | null,
): boolean {
  if (active === null || active === ON_CALL_FILTER_ALL) return true;
  const values = facetOf(entry)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (values.length === 0) return true;
  return values.includes(active);
}

/** Tags, the facet Referrals and Orientation file their entries under. */
export const onCallTagFacet: OnCallFacetReader = (entry) => entry.tags;
