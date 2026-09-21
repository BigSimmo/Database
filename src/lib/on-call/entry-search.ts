import { complianceExpiresOn, isComplianceEntry } from "@/lib/on-call/compliance";
import { onCallDetailsSchemaFor, type OnCallEntry, type OnCallSection } from "@/lib/on-call/entry-model";
import { onCallTeachingDateParts } from "@/lib/on-call/teaching-schedule";

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
  /**
   * The STORED section, duplicated off the entry. Do not group, label, route or
   * count by it, and do not add a caller that does.
   *
   * It was added so a caller could group without re-reading the entry, and that
   * stated purpose is the trap: two of this mode's pages are views over a
   * stored section behind `details.kind` — Compliance over `logistics`, Who's
   * who over `contacts` — so this field files a compliance requirement under
   * Admin and sends a role explainer to Contacts. `onCallViewForEntry` in
   * `on-call-section-identity.ts` is the only thing that answers "which page is
   * this row on", and `OnCallSearchBox` already reads that instead.
   *
   * Nothing in `src/` reads this any more. It survives only because
   * `tests/on-call-entry-search.test.ts` asserts on it ("carries the section
   * alongside the entry so the caller can group"), and weakening a test to
   * delete a field is not a trade this repository makes. Retire the two
   * together.
   */
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
      // Compliance requirements are `logistics` rows behind `details.kind`, so
      // they land in this arm, and `issuingBody` is the one compliance field a
      // person actually types. The row someone wants is "my Ahpra
      // registration"; until this line "Ahpra" — the word printed on the very
      // page they are trying to reach — matched nothing at all, and so did
      // "RANZCP" and "Department of Communities". A search box exists so that
      // finding something does not require knowing which page it is on, and
      // without this it reinstated exactly that problem for the most natural
      // query Compliance has.
      push(details.issuingBody);
      // The remaining compliance fields are deliberately NOT indexed:
      //
      // - `expiresOn` is a bare `YYYY-MM-DD`, which nobody types to find a
      //   requirement — and indexing it would damage the mode's single most
      //   likely query. `fieldMatches` also compares digits-only, so
      //   "2027-03-12" indexes as "20270312" and a half-remembered number typed
      //   as "0312" would drag back every requirement expiring in March. The
      //   date is shown in the result summary below instead, which is where it
      //   helps.
      // - `consequence` and `provenance` store enum tokens — "stops-work",
      //   "read-from-certificate" — that no reader is ever shown. Indexing the
      //   token makes "work" return every requirement whose lapse stops work,
      //   noise the reader cannot account for. The phrasing they DO see
      //   ("Lapsing stops you working") lives in the component layer, and
      //   copying it down here would be a third copy of a list this mode has
      //   already let drift once.
      // - `url` and `evidenceUrl` are links rather than prose; `url` was
      //   already left out above for the same reason.
      break;
  }
  return strings;
}

/**
 * `YYYY-MM-DD` written the way the Compliance page writes it: "12 Mar 2027".
 *
 * Deliberately the mode's own date formatter rather than a second one, so a
 * registration's expiry does not read one way in a search result and another
 * on the page the result opens. An unparseable value falls back to the stored
 * string rather than to an invented date, exactly as `formatExpiry` does in
 * `on-call-compliance-section.tsx`.
 */
function formatRecordedExpiry(date: string): string {
  const { day, month, year } = onCallTeachingDateParts(date);
  return day && month ? `${day} ${month} ${year}` : date;
}

/**
 * The one line under a result's title: the role, the expiry, the category, the
 * scenario.
 *
 * Section-specific because the sections genuinely disagree about what names a
 * row — a contact is its role, an admin entry is its category, a playbook
 * entry is the situation that triggers it. Falls back to the subtitle, then to
 * nothing at all rather than to filler.
 *
 * A compliance requirement is the exception and is checked first, because it
 * shares `logistics` with the admin entries and the category is the wrong
 * answer for it. "Registration" is the folder the row files under; the reason
 * the row exists at all is the date on it, and a reader scanning results for
 * their registration is scanning for that date. Answering with the folder
 * spends the one line this row gets on the least informative thing about it.
 *
 * Two constraints on the wording, both load-bearing:
 *
 * - "Recorded as expiring", never "Expires" or "Valid to". Nothing in this app
 *   is checked with an issuing body, so no surface built on these rows may
 *   render a verdict — see `src/lib/on-call/compliance.ts`, "What this page may
 *   never say". The phrase here is the Compliance page's own, word for word.
 * - No "that date has passed" suffix, which the page does add. This function
 *   takes no clock and must not read one: it is called during render for every
 *   result, and a summary that silently depends on `new Date()` is a value that
 *   changes underneath a memoised list. Whether the date has passed is the
 *   page's job, where a `now` is already in hand.
 *
 * The expiry is read through `complianceExpiresOn` rather than off the parse
 * below, for the reason that helper exists: `logisticsDetails` is all-or-
 * nothing, so one bad key elsewhere on the row would drop a perfectly good
 * date. A row with no readable date falls through to the category, which is
 * then genuinely the best thing left to say about it.
 */
export function onCallSearchSummary(entry: OnCallEntry): string | null {
  if (isComplianceEntry(entry)) {
    const expiresOn = complianceExpiresOn(entry);
    if (expiresOn) return `Recorded as expiring ${formatRecordedExpiry(expiresOn)}`;
  }
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
