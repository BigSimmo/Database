import { onCallDetailsSchemaFor, type OnCallEntry } from "@/lib/on-call/entry-model";
import { isRoleExplainerEntry } from "@/lib/on-call/who-is-who";

/**
 * What the On Call home shows, derived from the entries that already exist.
 *
 * Every module here is driven by an owner-controlled **tag**, not a new column.
 * That is one convention rather than four ad-hoc ones, it costs no migration,
 * and — the part that matters at 3am — it means the owner can change what the
 * home shows from inside the app instead of asking for a code change.
 *
 * The tags, all lower-cased before matching so `Ward` and `ward` behave the
 * same:
 *
 *   `call-first`  a contact that belongs in the two graphite call cards
 *   `switchboard` the quieter third row under them
 *   `ward`        a contact that belongs in tonight's ward strip
 *   `pinned`      the playbook scenario whose reminder is pinned to the home
 *
 * Each module's empty state names its tag, so the convention is discoverable
 * from the screen rather than only from here.
 */

export const ON_CALL_HOME_TAGS = {
  callFirst: "call-first",
  switchboard: "switchboard",
  ward: "ward",
  pinned: "pinned",
} as const;

/** Two, because the mockup's pair of call cards is the point: a shift has one
 *  person to ring first and one to ring next, and a list of five is a search. */
export const ON_CALL_CALL_FIRST_LIMIT = 2;

/** Enough to scroll, few enough to stay one thumb-swipe. */
export const ON_CALL_WARD_STRIP_LIMIT = 8;

function hasTag(entry: OnCallEntry, tag: string): boolean {
  return entry.tags.some((candidate) => candidate.trim().toLowerCase() === tag);
}

interface ContactDetails {
  role: string;
  phone?: string;
  extension?: string;
  afterHoursPhone?: string;
  pager?: string;
  availability?: string;
}

function contactDetails(entry: OnCallEntry): ContactDetails | null {
  if (entry.section !== "contacts") return null;
  const result = onCallDetailsSchemaFor("contacts").safeParse(entry.details);
  return result.success ? (result.data as ContactDetails) : null;
}

/**
 * The one number a row rings, and what to call it.
 *
 * Direct beats after-hours beats pager beats extension — the same precedence
 * the Contacts list uses, so a role does not appear to have two different
 * numbers depending on which screen you are looking at.
 */
export function onCallPrimaryNumber(entry: OnCallEntry): { label: string; value: string } | null {
  const details = contactDetails(entry);
  if (!details) return null;
  if (details.phone) return { label: "Direct", value: details.phone };
  if (details.afterHoursPhone) return { label: "After hours", value: details.afterHoursPhone };
  if (details.pager) return { label: "Pager", value: details.pager };
  if (details.extension) return { label: "Ext", value: details.extension };
  return null;
}

export function onCallAvailability(entry: OnCallEntry): string | null {
  return contactDetails(entry)?.availability ?? null;
}

/** `tel:` target for a number, or undefined when there is nothing dialable. */
export function onCallTelHref(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const compact = raw.replace(/[^\d+]/g, "");
  return compact.length > 0 ? `tel:${compact}` : undefined;
}

const bySortOrder = (a: OnCallEntry, b: OnCallEntry) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);

/**
 * Contacts to ring first.
 *
 * Role explainers are excluded even if tagged: they are Who's who rows and have
 * no number, so one on this module would be a call card that cannot call.
 */
export function selectCallFirstContacts(entries: readonly OnCallEntry[]): OnCallEntry[] {
  return entries
    .filter(
      (entry) =>
        entry.section === "contacts" &&
        !isRoleExplainerEntry(entry) &&
        hasTag(entry, ON_CALL_HOME_TAGS.callFirst) &&
        onCallPrimaryNumber(entry) !== null,
    )
    .sort(bySortOrder)
    .slice(0, ON_CALL_CALL_FIRST_LIMIT);
}

/** The quieter row beneath the call cards — the way to reach anyone not on them. */
export function selectSwitchboardContact(entries: readonly OnCallEntry[]): OnCallEntry | null {
  return (
    entries
      .filter(
        (entry) =>
          entry.section === "contacts" && !isRoleExplainerEntry(entry) && hasTag(entry, ON_CALL_HOME_TAGS.switchboard),
      )
      .sort(bySortOrder)[0] ?? null
  );
}

/** Tonight's wards, as a one-tap strip. A ward with no number is not in it. */
export function selectWardContacts(entries: readonly OnCallEntry[]): OnCallEntry[] {
  return entries
    .filter(
      (entry) =>
        entry.section === "contacts" &&
        !isRoleExplainerEntry(entry) &&
        hasTag(entry, ON_CALL_HOME_TAGS.ward) &&
        onCallPrimaryNumber(entry) !== null,
    )
    .sort(bySortOrder)
    .slice(0, ON_CALL_WARD_STRIP_LIMIT);
}

/**
 * The pinned reminder.
 *
 * A playbook scenario, so the text on the home is the owner's own escalation
 * wording rather than anything the app composed. One at a time: a wall of
 * pinned reminders is a wall nobody reads.
 */
export function selectPinnedPlaybookEntry(entries: readonly OnCallEntry[]): OnCallEntry | null {
  return (
    entries
      .filter((entry) => entry.section === "playbook" && hasTag(entry, ON_CALL_HOME_TAGS.pinned))
      .sort(bySortOrder)[0] ?? null
  );
}

export type OnCallUpcomingSession = {
  entry: OnCallEntry;
  /** `YYYY-MM-DD`, already known to be on or after `today`. */
  date: string;
  /** The owner's own wording for when it runs, if they gave one. */
  when: string | null;
  presenter: string | null;
  location: string | null;
};

interface EducationDetails {
  nextOccurrence?: string;
  nextOccurrenceDate?: string;
  presenter?: string;
  location?: string;
}

/**
 * The next teaching sessions, soonest first.
 *
 * Only dated sessions can be ranked, so only dated sessions appear here;
 * `details.nextOccurrenceDate` exists for exactly this. An undated session is
 * not dropped from the app, it simply stays on the Teaching page where the
 * owner's free-text "Thursday 1pm" is the answer.
 *
 * Comparison is string-on-string against `YYYY-MM-DD`, which sorts
 * lexicographically and needs no timezone: "is this session in the past" must
 * not change answer between a phone in Perth and a server in another zone.
 */
export function selectUpcomingSessions(
  entries: readonly OnCallEntry[],
  today: string,
  limit = 2,
): OnCallUpcomingSession[] {
  const sessions: OnCallUpcomingSession[] = [];
  for (const entry of entries) {
    if (entry.section !== "education") continue;
    const result = onCallDetailsSchemaFor("education").safeParse(entry.details);
    if (!result.success) continue;
    const details = result.data as EducationDetails;
    const date = details.nextOccurrenceDate;
    if (!date || date < today) continue;
    sessions.push({
      entry,
      date,
      when: details.nextOccurrence ?? null,
      presenter: details.presenter ?? null,
      location: details.location ?? null,
    });
  }
  return sessions
    .sort((a, b) => a.date.localeCompare(b.date) || a.entry.title.localeCompare(b.entry.title))
    .slice(0, limit);
}

/** `YYYY-MM-DD` for a date, in the viewer's own zone rather than UTC. */
export function onCallLocalDateKey(now: Date): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** How many entries each section holds, for the home's tile grid. */
export function countOnCallEntriesBySection(entries: readonly OnCallEntry[]) {
  const counts = new Map<string, number>();
  let roleExplainers = 0;
  for (const entry of entries) {
    if (isRoleExplainerEntry(entry)) {
      roleExplainers += 1;
      continue;
    }
    counts.set(entry.section, (counts.get(entry.section) ?? 0) + 1);
  }
  return { counts, roleExplainers };
}
