import { onCallGroupSlug } from "@/components/on-call/on-call-page-anchors";
import type { OnCallFacetReader } from "@/lib/on-call/entry-filters";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

/** One heading on a page, and the entries filed under it. */
export interface OnCallEntryGroup {
  /** The heading, and the label the header's jump list offers. */
  label: string;
  /** Stable anchor fragment, shared by the rendered `id` and the declaration. */
  slug: string;
  entries: OnCallEntry[];
}

/**
 * The entries of a facet-filed section, grouped by that facet.
 *
 * Replaces the chip row those sections used to carry. A chip FILTERED — tapping
 * "Wards" removed Tonight and Services from the page — while what a reader
 * actually wanted was to GET to the wards. Grouping puts every group on the
 * page at once and lets the header's jump list move between them, so a mistap
 * costs a scroll rather than the rest of the list. It also means one navigation
 * idea covers the whole mode instead of two competing ones on the same screen.
 *
 * Returns an EMPTY array when there is nothing to group by — one value, or
 * none. That is the same test `onCallFilterOptions` applied before it: a single
 * heading over the whole list is furniture, and the header then correctly
 * offers no jump list at all.
 *
 * An entry carrying no facet value is never dropped. It lands in a trailing
 * group named by `fallbackLabel`, because withholding a number because nobody
 * tagged it is the failure this mode exists to prevent.
 */
export function onCallEntryGroups(
  entries: readonly OnCallEntry[],
  facetOf: OnCallFacetReader,
  fallbackLabel = "Everything else",
): OnCallEntryGroup[] {
  const byLabel = new Map<string, OnCallEntry[]>();
  const untagged: OnCallEntry[] = [];

  for (const entry of entries) {
    // The FIRST value only. An entry with three tags belongs under one heading
    // — repeating it under three would make the counts lie and the same number
    // appear three times in one scroll.
    const label = facetOf(entry)
      .map((value) => value.trim())
      .find((value) => value.length > 0);
    if (!label) {
      untagged.push(entry);
      continue;
    }
    const existing = byLabel.get(label);
    if (existing) existing.push(entry);
    else byLabel.set(label, [entry]);
  }

  // First-seen order, like the chip row before it: the entries arrive in the
  // owner's own order (`sort_order`, then title), and sorting here would
  // reshuffle the page every time an entry was renamed.
  const groups: OnCallEntryGroup[] = [...byLabel.entries()].map(([label, list]) => ({
    label,
    slug: onCallGroupSlug(label),
    entries: list,
  }));
  if (untagged.length > 0) {
    groups.push({ label: fallbackLabel, slug: onCallGroupSlug(fallbackLabel), entries: untagged });
  }

  return groups.length > 1 ? groups : [];
}
