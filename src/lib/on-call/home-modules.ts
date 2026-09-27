import { onCallDetailsSchemaFor, type OnCallEntry } from "@/lib/on-call/entry-model";
import { isComplianceEntry } from "@/lib/on-call/compliance";
import { msUntilOnCallPeriodChange, resolveOnCallNumber } from "@/lib/on-call/number-resolver";
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

export {
  ON_CALL_IN_HOURS_END_HOUR,
  ON_CALL_IN_HOURS_START_HOUR,
  isOnCallOutOfHours,
  onCallDialableNumber,
  onCallTelHref,
} from "@/lib/on-call/number-resolver";

/**
 * How long until the offered number would change.
 *
 * A screen that picked its number at render keeps that number until something
 * re-renders it, and a phone lying on a desk re-renders nothing. So the On Call
 * home opened at 16:55 went on offering the daytime desk line all night — the
 * precise wrong-number failure the after-hours precedence exists to prevent.
 * Callers schedule one timer on this and re-read the clock when it fires.
 *
 * Always strictly positive, so a timer built on it can never spin. Standing
 * exactly on 17:00 returns the time to the NEXT flip, not zero.
 *
 * Now counts WA public holidays too: it is `msUntilOnCallPeriodChange`, so the
 * timer agrees with the number `onCallPrimaryNumber` offers on a holiday and
 * crosses the Christmas run the old four-day cap could not.
 */
export const msUntilOnCallHoursBoundary = msUntilOnCallPeriodChange;

/**
 * The one number a row rings, and what to call it.
 *
 * The precedence depends on WHEN the screen is being read, and the promise that
 * every screen uses the same one still holds — it is one rule, evaluated against
 * one clock, rather than one fixed order:
 *
 *   in hours (Mon–Fri 08:00–17:00, not a WA public holiday)   direct → after hours → pager → extension
 *   out of hours (everything else)                             after hours → direct → pager → extension
 *
 * Why it changes: this is a hub for a junior doctor on a night shift. Offering
 * the daytime direct line at 3am — a desk nobody is sitting at — is offering the
 * one number that cannot help, and the after-hours number was only ever small
 * grey text further down the Contacts page. Pager and extension stay below both,
 * unchanged: they are how you reach someone when neither line answers.
 *
 * The `label` always names the number actually returned ("After hours" for an
 * after-hours line, "Direct" for a direct one), so no screen can show a number
 * under the wrong name — which would be worse than showing no number at all.
 *
 * `now` is injectable so callers and tests pin the window explicitly instead of
 * faking the clock; it defaults to the real one.
 */
export function onCallPrimaryNumber(
  entry: OnCallEntry,
  now: Date = new Date(),
): { label: string; value: string } | null {
  const details = contactDetails(entry);
  if (!details) return null;
  // Existing callers compute `tel` themselves, so the shape stays `{ label, value }`.
  const resolved = resolveOnCallNumber(details, now);
  return resolved ? { label: resolved.label, value: resolved.value } : null;
}

export function onCallAvailability(entry: OnCallEntry): string | null {
  return contactDetails(entry)?.availability ?? null;
}

const bySortOrder = (a: OnCallEntry, b: OnCallEntry) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);

/**
 * A contact the home may show a number for.
 *
 * Role explainers are excluded even if tagged: they are Who's who rows and have
 * no number, so one on this module would be a call card that cannot call.
 * Personal contacts are excluded too — Contacts already withholds their digits
 * so a private mobile is not readable over a shoulder at the nurses' station,
 * and the home (the most-looked-at screen in the mode) must not re-print them.
 */
function isHomeDialContact(entry: OnCallEntry): boolean {
  return entry.section === "contacts" && !entry.isPersonal && !isRoleExplainerEntry(entry);
}

/**
 * Contacts to ring first.
 */
export function selectCallFirstContacts(entries: readonly OnCallEntry[]): OnCallEntry[] {
  return entries
    .filter(
      (entry) =>
        isHomeDialContact(entry) && hasTag(entry, ON_CALL_HOME_TAGS.callFirst) && onCallPrimaryNumber(entry) !== null,
    )
    .sort(bySortOrder)
    .slice(0, ON_CALL_CALL_FIRST_LIMIT);
}

/** The quieter row beneath the call cards — the way to reach anyone not on them. */
export function selectSwitchboardContact(entries: readonly OnCallEntry[]): OnCallEntry | null {
  return (
    entries
      .filter((entry) => isHomeDialContact(entry) && hasTag(entry, ON_CALL_HOME_TAGS.switchboard))
      .sort(bySortOrder)[0] ?? null
  );
}

/** Tonight's wards, as a one-tap strip. A ward with no number is not in it. */
export function selectWardContacts(entries: readonly OnCallEntry[]): OnCallEntry[] {
  return entries
    .filter(
      (entry) =>
        isHomeDialContact(entry) && hasTag(entry, ON_CALL_HOME_TAGS.ward) && onCallPrimaryNumber(entry) !== null,
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

/**
 * How many entries each PAGE holds — which is not the same as how many each
 * stored section holds, and the difference is the whole point of this function.
 *
 * Two of this mode's pages are views over a section rather than sections of
 * their own, because `section` is a database CHECK constraint and a new value
 * costs a migration that reaches the live clinical database within seconds.
 * Who's who is `contacts` rows carrying `details.kind: "role-explainer"`;
 * Compliance is `logistics` rows carrying `details.kind: "compliance"`. Counting
 * by `entry.section` therefore over-counts the two host sections by exactly the
 * rows their own pages do not render.
 *
 * Both are subtracted here and returned beside the map. Role explainers were
 * already handled this way; compliance was not, and the asymmetry showed as an
 * Admin tile promising eight rows the Admin page refuses to show. A caller that
 * wants a page's number can now take it from one place.
 */
export function countOnCallEntriesBySection(entries: readonly OnCallEntry[]) {
  const counts = new Map<string, number>();
  let roleExplainers = 0;
  let compliance = 0;
  for (const entry of entries) {
    if (isRoleExplainerEntry(entry)) {
      roleExplainers += 1;
      continue;
    }
    if (isComplianceEntry(entry)) {
      compliance += 1;
      continue;
    }
    counts.set(entry.section, (counts.get(entry.section) ?? 0) + 1);
  }
  return { counts, roleExplainers, compliance };
}
