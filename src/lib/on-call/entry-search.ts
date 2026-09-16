import { onCallDetailsSchemaFor, type OnCallEntry, type OnCallSection } from "@/lib/on-call/entry-model";

/**
 * Local search across every On Call entry the viewer already holds.
 *
 * The mode has seven pages and no search of any kind, so finding a number means
 * knowing which page it is on and scrolling. That is the wrong shape of work at
 * 3am, and it is the only thing this module is for: it narrows an already-loaded
 * list in memory. There is no request, no ranking model and no clinical
 * judgement anywhere in it — the answer is always one of the owner's own rows.
 *
 * Three decisions are worth stating, because each of them is the kind that gets
 * "tidied" back the other way by someone reading the code cold:
 *
 * 1. **An empty query returns NOTHING, not everything.** This is a search box,
 *    not a filter. The section pages already show their full list; a box that
 *    silently renders every entry in the mode the moment it mounts is a second
 *    copy of six pages, and on a phone it buries the thing the reader came for.
 *
 * 2. **Numbers match with their punctuation ignored, in both directions.** A
 *    number is stored the way the owner wrote it — "(08) 9224 1000" — and typed
 *    the way a keypad produces it: "0892241000". Plain substring matching finds
 *    neither from the other, so every field is compared a second time in
 *    digits-only form. Without this the single most likely query in the whole
 *    mode — a number you half-remember — misses.
 *
 * 3. **Personal entries are searched like any other row.** They reach this
 *    module only when the viewer is their owner; `repository.ts` withholds them
 *    from everyone else, and re-filtering here would hide the owner's own
 *    contacts from the owner. Not printing a personal number is the UI's job
 *    (`OnCallSearchBox`, the same treatment `on-call-home.tsx` uses), not this
 *    module's.
 */

/**
 * The most rows one query may return.
 *
 * A one-letter query matches most of the hub, and a list of two hundred rows
 * under a search box is a slower way to find a number than the page you already
 * had. Exported so the UI can say when it has trimmed rather than pretending the
 * list is complete.
 */
export const ON_CALL_SEARCH_RESULT_LIMIT = 20;

/**
 * Where a term was found, as a rank. Lower sorts first.
 *
 * Three tiers, not five: the title is what the reader is almost always typing,
 * a tag is the owner's own filing, and everything else is supporting text.
 * `subtitle` sits in the last tier with the body deliberately — it is a second
 * line of description, not a second name.
 */
const RANK_TITLE = 0;
const RANK_TAG = 1;
const RANK_TEXT = 2;

export interface OnCallSearchResult {
  entry: OnCallEntry;
  /** Duplicated from the entry so a caller can group without re-reading it. */
  section: OnCallSection;
  /** 0 title, 1 tag, 2 body/subtitle/details. Exposed so ordering is inspectable. */
  rank: number;
}

/** Digits only, for comparing a stored number with a typed one. */
function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Whether one search term appears in one field.
 *
 * The digits comparison needs at least two digits in the term. A single digit
 * would otherwise match every number on the hub through the punctuation-stripped
 * form — "2" finding "Ward 42" is fine, "2" finding "(08) 9224 1000" because the
 * brackets vanished is noise the reader cannot explain.
 */
function fieldMatches(field: string, term: string, termDigits: string): boolean {
  if (field.toLowerCase().includes(term)) return true;
  if (termDigits.length < 2) return false;
  return digitsOf(field).includes(termDigits);
}

function matchesAny(fields: readonly string[], term: string, termDigits: string): boolean {
  return fields.some((field) => fieldMatches(field, term, termDigits));
}

/**
 * The human-meaningful strings inside a section's `details`.
 *
 * Parsed with the section's own Zod schema rather than read off the raw JSON,
 * for the reason every other reader of `details` does it: the column is
 * `unknown`, nothing stops a row holding a shape from an older version of the
 * app, and a hand-read of `details.escalationSteps[0].whoToCall` throws on the
 * first row that disagrees. A row whose details cannot be parsed is not dropped
 * — it simply searches on its title, subtitle, body and tags, which is strictly
 * better than vanishing from the one screen that exists to find it.
 */
function detailStrings(entry: OnCallEntry): string[] {
  const parsed = onCallDetailsSchemaFor(entry.section).safeParse(entry.details);
  if (!parsed.success) return [];
  const details = parsed.data as Record<string, unknown>;
  const strings: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === "string" && value.trim().length > 0) strings.push(value);
  };
  const pushAll = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(push);
  };

  switch (entry.section) {
    case "contacts":
      for (const key of ["role", "phone", "extension", "afterHoursPhone", "pager", "contactName", "availability"]) {
        push(details[key]);
      }
      break;
    case "playbook":
      push(details.trigger);
      if (Array.isArray(details.escalationSteps)) {
        for (const step of details.escalationSteps as Array<Record<string, unknown>>) {
          push(step.whoToCall);
          push(step.when);
          push(step.phone);
        }
      }
      break;
    case "referrals":
      pushAll(details.accepts);
      pushAll(details.exclusions);
      for (const key of ["catchment", "hours", "howToRefer", "phone", "fax"]) push(details[key]);
      break;
    case "orientation":
      // No named text fields of its own beyond the owner's checklist, whose
      // steps ("collect the phone", "hand back the keycard") are exactly the
      // kind of thing someone searches for on their last shift.
      if (Array.isArray(details.checklist)) {
        for (const item of details.checklist as Array<Record<string, unknown>>) {
          push(item.text);
          push(item.note);
        }
      }
      break;
    case "education":
      for (const key of ["recurrence", "nextOccurrence", "presenter", "location"]) push(details[key]);
      pushAll(details.topics);
      break;
    case "logistics":
      for (const key of ["category", "location", "hours", "phone"]) push(details[key]);
      break;
  }
  return strings;
}

/**
 * The one line under a result's title: the role, the category, the scenario.
 *
 * Section-specific because the sections genuinely disagree about what names a
 * row — a contact is its role, a logistics entry is its category, a playbook
 * entry is the situation that triggers it. Falls back to the subtitle, then to
 * nothing at all rather than to filler.
 */
export function onCallSearchSummary(entry: OnCallEntry): string | null {
  const parsed = onCallDetailsSchemaFor(entry.section).safeParse(entry.details);
  if (parsed.success) {
    const details = parsed.data as Record<string, unknown>;
    const key = entry.section === "contacts" ? "role" : entry.section === "logistics" ? "category" : "trigger";
    const value = details[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  const subtitle = entry.subtitle?.trim();
  return subtitle && subtitle.length > 0 ? subtitle : null;
}

/**
 * Rank one entry against one query, or `null` when it does not match.
 *
 * Every term must be found somewhere (AND, not OR): "ward 4b" is a reader
 * narrowing, and an OR would answer it with every ward AND every 4-something.
 * The entry's rank is the WEAKEST of the per-term ranks, so an entry that only
 * holds half the query in its title cannot outrank one that holds all of it
 * there.
 */
function rankEntry(entry: OnCallEntry, terms: readonly string[]): number | null {
  const titleFields = [entry.title];
  const tagFields = entry.tags;
  const textFields = [entry.subtitle ?? "", entry.body ?? "", ...detailStrings(entry)];

  let worst = RANK_TITLE;
  for (const term of terms) {
    const termDigits = digitsOf(term);
    let best: number | null = null;
    if (matchesAny(titleFields, term, termDigits)) best = RANK_TITLE;
    else if (matchesAny(tagFields, term, termDigits)) best = RANK_TAG;
    else if (matchesAny(textFields, term, termDigits)) best = RANK_TEXT;
    if (best === null) return null;
    if (best > worst) worst = best;
  }
  return worst;
}

/**
 * Matches for `query`, best first, capped at `ON_CALL_SEARCH_RESULT_LIMIT`.
 *
 * Ordering is total and therefore deterministic: rank, then the owner's own
 * `sortOrder`, then title, then the position the entry arrived in. The last two
 * exist so two entries that tie on rank and sort order cannot swap places
 * between renders — a list that reshuffles under the thumb is worse than a list
 * in the wrong order.
 */
export function searchOnCallEntries(entries: readonly OnCallEntry[], query: string): OnCallSearchResult[] {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);
  if (terms.length === 0) return [];

  const matches: Array<OnCallSearchResult & { index: number }> = [];
  entries.forEach((entry, index) => {
    const rank = rankEntry(entry, terms);
    if (rank === null) return;
    matches.push({ entry, section: entry.section, rank, index });
  });

  return matches
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.entry.sortOrder - b.entry.sortOrder ||
        a.entry.title.localeCompare(b.entry.title) ||
        a.index - b.index,
    )
    .slice(0, ON_CALL_SEARCH_RESULT_LIMIT)
    .map(({ entry, section, rank }) => ({ entry, section, rank }));
}
