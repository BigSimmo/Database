import { onCallDigitsOf, onCallFieldMatches, onCallSearchTerms } from "@/lib/on-call/entry-search";
import type { HandbookItem } from "@/lib/on-call/handbook-items";

/**
 * Search over the hospital handbook, on the device only (standard §13): the
 * query never goes to the main search bar or answer mode.
 *
 * It splits and matches exactly as the reader's own entry search does, through
 * that module's exported helpers, so a typed number matches a formatted one the
 * same way on every On Call page. Every term must match somewhere (AND), and an
 * item ranks by its weakest term:
 *
 *   0  title, label or an "Also known as" alias
 *   1  team or category prefix
 *   2  body or number
 */
const RANK_TITLE = 0;
const RANK_GROUP = 1;
const RANK_TEXT = 2;

function rankItem(item: HandbookItem, terms: readonly string[]): number | null {
  const titleFields = [item.title, item.parsed.label, ...item.aliases];
  const groupFields = [item.parsed.team ?? "", item.parsed.prefix ?? ""];
  const textFields = [item.body, item.phone, item.dial.display, item.dial.copy ?? ""];
  let worst = RANK_TITLE;
  for (const term of terms) {
    const termDigits = onCallDigitsOf(term);
    const matches = (fields: readonly string[]) => fields.some((field) => onCallFieldMatches(field, term, termDigits));
    let best: number | null = null;
    if (matches(titleFields)) best = RANK_TITLE;
    else if (matches(groupFields)) best = RANK_GROUP;
    else if (matches(textFields)) best = RANK_TEXT;
    if (best === null) return null;
    if (best > worst) worst = best;
  }
  return worst;
}

/** Matches best first; `[]` for an empty query. Ties keep label order, then arrival order. */
export function searchHandbookItems(items: readonly HandbookItem[], query: string): HandbookItem[] {
  const terms = onCallSearchTerms(query);
  if (terms.length === 0) return [];
  const matches: { item: HandbookItem; rank: number; index: number }[] = [];
  items.forEach((item, index) => {
    const rank = rankItem(item, terms);
    if (rank !== null) matches.push({ item, rank, index });
  });
  return matches
    .sort((a, b) => a.rank - b.rank || a.item.parsed.label.localeCompare(b.item.parsed.label) || a.index - b.index)
    .map(({ item }) => item);
}
