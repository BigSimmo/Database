import { AlertTriangle, CalendarDays, Clock } from "lucide-react";
import Link from "next/link";

import {
  CARING_CONTACTS_SCHEDULE_DAY_QUERY_PARAM,
  patientRoute,
  scheduleDayRoute,
} from "@/lib/caring-contacts-routes";
import { toAwstParts } from "@/lib/caring-contacts/clock";
import { isAwstCalendarDay } from "@/lib/caring-contacts/schedule";
import type {
  PlanSendingHold,
  ScheduleCounts,
  ScheduleDay,
  ScheduleEntry,
  ScheduleGroup,
  ScheduleNotSendingReason,
  ScheduleRangeView,
} from "@/lib/caring-contacts/schedule-view";

import { AutomatedState } from "./automated-state";
import { CONTACT_STATE_LABELS, MESSAGE_TYPE_LABELS } from "./contact-vocabulary";
import { ListEmptyState } from "./list-empty-state";

/**
 * The Schedule screen -- what this team's caring-contact plans put on one AWST day, and what the
 * days either side of it hold.
 *
 * IT DERIVES NOTHING. Every fact rendered here comes off a `ScheduleRangeView` that
 * `schedule-view.ts` built: which of the three approved windows a contact sends in, whether its own
 * plan is holding it, whether it still goes out, why it will not, and whether it is a named
 * exception. This file chooses WORDS and LAYOUT for those facts and computes no schedule rule of
 * its own -- a screen that re-derived one would be free to go on grouping by a window the domain
 * had moved, on the surface that tells a coordinator what a discharged patient is about to receive.
 *
 * THE ONE THING IT MUST NOT DO IS COLLAPSE TWO DAYS INTO ONE. `disposition` alone cannot separate a
 * quiet day from a stopped one, and `nothingDue` covers three different days: one where everything
 * has already gone out, one where everything was stopped, and one where a plan nobody started is
 * holding the lot. A screen that rendered the disposition and stopped would show all three as "no
 * work today" -- and the third of those is a discharged patient receiving nothing while the record
 * looks complete. So the day's statement is derived from `counts`, which partition the day exactly:
 * with nothing due, `alreadySent + held + willNotBeSent` is the whole of it.
 *
 * A HELD PLAN IS NOT AN EXCEPTION AND IS NOT A QUIET DAY EITHER. Task 12 deliberately kept held
 * contacts out of the named-exceptions panel -- nothing failed, nothing is overdue, the plan was
 * never started -- and put `counts.held` and each entry's `planHold` on the wire so a screen could
 * still say so. The day-level notice `SelectedDay` renders from `distinctHoldsOf` is that, and it
 * appears whether or not anything on the day is due.
 *
 * NO PATIENT IDENTITY IS READ HERE, and that is a decision rather than an omission -- see the page.
 * A row is headed by the synthetic patient identifier and links to the patient record, which is the
 * screen that holds the name and is audited for it in its own right.
 *
 * A Server Component with no hooks and no client boundary (Ruling 13): the day being looked at
 * travels in the URL, every day control is a `<Link>`, and nothing on this screen needs JavaScript
 * to work. The accessible names below come from the strings the components already render rather
 * than from ids, because an id would need `useId` and `useId` is a hook.
 */

/** How many days the strip offers, and how many of them sit before the day being looked at. */
export const SCHEDULE_STRIP_DAYS = 7;
export const SCHEDULE_STRIP_DAYS_BEFORE = 3;

/**
 * Which AWST calendar day the URL asks for, or today when it asks for none.
 *
 * The one place a query value becomes a day -- never re-derived in a component. A repeated
 * `?day=a&day=b` arrives as an array and names no single day; an unrecognised or impossible value
 * (`2026-02-30`, which a `\d{4}-\d{2}-\d{2}` pattern would accept) is refused by the domain's own
 * `isAwstCalendarDay` rather than by a second copy of the format written here. Both fall back to
 * today rather than throwing: a mistyped URL must land a clinician on a real day, never on an error
 * page and never on a day nothing was read for.
 */
export function parseScheduleDay(
  searchParams: Readonly<Record<string, string | string[] | undefined>>,
  todayCalendarDay: string,
): string {
  const raw = searchParams[CARING_CONTACTS_SCHEDULE_DAY_QUERY_PARAM];
  return typeof raw === "string" && isAwstCalendarDay(raw) ? raw : todayCalendarDay;
}

const sectionId = "caring-contacts-schedule";

/**
 * Weekday and month names, written out rather than formatted by `Intl`.
 *
 * A screen's date wording has to be the same in a test, in CI and on the machine of whoever reads
 * it, and `Intl.DateTimeFormat` is none of those things: its output depends on the ICU data the
 * runtime was built with, down to whether a comma follows the weekday. These arrays are three lines
 * and cannot drift.
 */
const WEEKDAY_NAMES = Object.freeze([
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]);

const MONTH_NAMES = Object.freeze([
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]);

function partsOfCalendarDay(calendarDay: string): { year: number; month: number; day: number; weekday: number } {
  const [year, month, day] = calendarDay.split("-").map(Number);
  return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

/** "Monday 31 August 2026" -- the whole date, for the day being looked at. */
export function scheduleDayLabel(calendarDay: string): string {
  const { year, month, day, weekday } = partsOfCalendarDay(calendarDay);
  return `${WEEKDAY_NAMES[weekday]} ${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

/** "Mon 31 Aug" -- one day of the strip, where the whole date does not fit. */
function stripDayLabel(calendarDay: string): string {
  const { month, day, weekday } = partsOfCalendarDay(calendarDay);
  return `${WEEKDAY_NAMES[weekday].slice(0, 3)} ${day} ${MONTH_NAMES[month - 1].slice(0, 3)}`;
}

/**
 * The AWST wall-clock time an instant sends at, in the shape `./schedule`'s window `sendTime`
 * already uses.
 *
 * Needed only for a contact that sends at no approved time -- the three windows publish their own
 * `sendTime`, and this screen renders those rather than recomputing them. This formats an instant;
 * it decides nothing about which times are approved.
 */
function awstClockLabel(instant: Date): string {
  const { hour, minute } = toAwstParts(instant);
  const suffix = hour < 12 ? "am" : "pm";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:${String(minute).padStart(2, "0")} ${suffix} AWST`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Plain words for what a plan's own state is doing to its contacts. */
const PLAN_HOLD_LABELS: Readonly<Record<PlanSendingHold, string>> = Object.freeze({
  planNotStarted: "Plan not started",
  planPaused: "Plan paused",
  planEnded: "Plan ended",
});

/**
 * Why a plan is holding its contacts, and what would change it.
 *
 * An exhaustive switch rather than a lookup with a fallback, for the same reason the domain's own
 * classifications are: a fourth hold added later and left unworded here must not compile into a
 * silent blank on a screen that says what the service will and will not send.
 *
 * `planNotStarted` is the one that matters most. A plan created and never started is a completed
 * sign-up that nobody finished -- the record looks whole and the patient hears nothing -- so its
 * wording says what is happening rather than only what the plan's state is called.
 */
function planHoldExplanation(hold: PlanSendingHold): { because: string; changedBy: string } {
  switch (hold) {
    case "planNotStarted":
      return {
        because:
          "A plan on this day was created and never started. Its schedule says a message falls here, and nothing will be sent for it, so a patient who has been discharged is receiving nothing while the plan record looks complete.",
        changedBy:
          "Starting the plan, from that patient's record, puts its remaining contacts back into the sending windows.",
      };
    case "planPaused":
      return {
        because:
          "A plan on this day is paused. A coordinator stopped it deliberately, so nothing is sent for it while the pause stands, and its contacts stay in the schedule rather than being cancelled.",
        changedBy: "Resuming the plan, from that patient's record, puts its remaining contacts back into the windows.",
      };
    case "planEnded":
      return {
        because:
          "A plan on this day has ended. Its remaining contacts are still in the schedule and none of them is sent.",
        changedBy: "Nothing here. An ended plan is not restarted; that patient's record holds how it ended.",
      };
    default: {
      const unclassified: never = hold;
      return unclassified;
    }
  }
}

/**
 * Why one contact will not be sent, and what would change it.
 *
 * Exhaustive for the same reason. `absorbedByFirstContact` is the only one of the four with a
 * remedy: the plan is working exactly as designed and the coordinator can undo it by choosing a
 * different first-contact date. The other three are terminal and say so rather than inventing a
 * control.
 */
function notSendingExplanation(reason: ScheduleNotSendingReason): {
  state: string;
  because: string;
  changedBy: string;
} {
  switch (reason) {
    case "absorbedByFirstContact":
      return {
        state: "Suppressed",
        because:
          "This plan's first contact falls on the same calendar day as its Week 1 message, and two caring contacts must never land on one day, so the schedule kept one of them.",
        changedBy: "Choosing a different first-contact date for this plan puts the Week 1 message back.",
      };
    case "suppressed":
      return {
        state: "Suppressed",
        because: "The system marked this message suppressed, and this screen does not hold what caused that.",
        changedBy:
          "Nothing here. A suppressed message is final and is never sent later; the plan continues with the messages that remain.",
      };
    case "cancelled":
      return {
        state: "Cancelled",
        because: "This message was cancelled, so it is not sent on this day or on any later one.",
        changedBy:
          "Nothing here. A cancelled message is never sent later; that patient's record holds what happened to the plan.",
      };
    case "missed":
      return {
        state: "Missed",
        because: "The sending window closed before this message went out, and a missed message is never retried.",
        changedBy:
          "Nothing here, and nothing is sent later. It is listed as a named exception so a coordinator can decide what to do instead.",
      };
    default: {
      const unclassified: never = reason;
      return unclassified;
    }
  }
}

/**
 * What the day's numbers say, in words, when nothing on it is due.
 *
 * `alreadySent`, `held` and `willNotBeSent` PARTITION a day with nothing due -- `total` is their
 * sum, because `stillToSend` splits into `due` and `held` and `due` is zero here. So this covers
 * every such day without a fallback clause, and each part is named only when it is actually
 * present. The "every"/"some" distinction is derived from the same counts rather than assumed.
 *
 * Ruling 94: no number appears in this prose. The numbers themselves are rendered as a data
 * readout directly above the lists they count, where they cannot decay away from what they describe.
 */
function quietDayClauses(counts: ScheduleCounts): string[] {
  const clauses: string[] = [];
  if (counts.alreadySent > 0) {
    clauses.push(
      counts.alreadySent === counts.total
        ? "Every contact on this day has already been sent."
        : "Some have already been sent.",
    );
  }
  if (counts.held > 0) {
    clauses.push(
      counts.held === counts.total
        ? "Every contact on this day belongs to a plan that is not sending."
        : "Some belong to a plan that is not sending.",
    );
  }
  if (counts.willNotBeSent > 0) {
    clauses.push(
      counts.willNotBeSent === counts.total
        ? "No contact on this day will be sent at all."
        : "Some will not be sent at all.",
    );
  }
  return clauses;
}

/** The day's statement, which must read differently for each of the days `nothingDue` covers. */
function dayStatement(day: ScheduleDay): string {
  const clauses =
    day.disposition === "contactsDue"
      ? ["Contacts still to go out on this day are grouped below by the window they send in."]
      : ["Nothing on this day is waiting to go out.", ...quietDayClauses(day.counts)];
  if (day.counts.needsReview > 0) {
    clauses.push("Named exceptions are listed separately below, out of their sending window.");
  }
  return clauses.join(" ");
}

export type ScheduleScreenProps = {
  /**
   * The whole day strip, from ONE `buildScheduleRange` call. The selected day is one of these days
   * rather than a second read, so the strip and the day open below it can never disagree.
   */
  view: ScheduleRangeView;
  /** Which day of `view.days` is open. */
  selectedCalendarDay: string;
  /** Today in AWST, resolved by the page from the server's clock -- this component holds no clock. */
  todayCalendarDay: string;
  /** False when the acting role does not include viewing plans. Decided by the page, from the actor. */
  mayViewPlans: boolean;
};

export function ScheduleScreen({ view, selectedCalendarDay, todayCalendarDay, mayViewPlans }: ScheduleScreenProps) {
  const selected = view.days.find((day) => day.calendarDay === selectedCalendarDay) ?? null;

  return (
    <section aria-labelledby={`${sectionId}-heading`} className="min-w-0">
      <h2 id={`${sectionId}-heading`} className="text-base font-semibold text-[color:var(--text-heading)]">
        Contacts due, day by day
      </h2>
      <p className="mt-2 max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
        What this team&rsquo;s caring-contact plans put on one day, grouped by the approved sending windows. Every
        patient here is invented and nothing on this screen is ever sent to a real number.
      </p>

      {!mayViewPlans ? (
        <div className="mt-5 min-w-0">
          <ListEmptyState
            kind="not-permitted"
            heading="The schedule is not visible in this role"
            because="Viewing plans is not part of the role you are acting in, and a schedule is built entirely from this team's plans. This says nothing about how many contacts fall on any day: a read you may not make and a day with nothing on it look identical on purpose, so that nobody can find out a record exists by being refused it."
            changedBy="Nothing on this screen changes it, and there is no control for it anywhere in this workspace yet. The role this demonstration acts in is set outside the interface; a coordinator sees this team's schedule."
          />
        </div>
      ) : selected === null ? (
        // Unreachable while the page picks the selected day from inside the range it asked for, and
        // stated rather than left to render nothing: an empty screen is the one outcome that would
        // read as "no contacts on this day", which is a claim nothing here has made.
        <div className="mt-5 min-w-0">
          <ListEmptyState
            kind="no-data"
            heading="This day was not read"
            explanation="The schedule was read for a range that does not contain the day asked for, so nothing about that day is known here. Choosing a day in the strip above reads it."
          />
        </div>
      ) : (
        <>
          <DayStrip view={view} selectedCalendarDay={selectedCalendarDay} todayCalendarDay={todayCalendarDay} />
          <SelectedDay day={selected} view={view} todayCalendarDay={todayCalendarDay} />
        </>
      )}
    </section>
  );
}

/**
 * The days either side of the one being looked at, each a link.
 *
 * Each day carries what it HOLDS, not only what is due on it. A strip that showed `due` alone would
 * put a zero on a day whose every contact is a named exception or is held by a plan nobody started
 * -- the exact collapse this screen exists to prevent, moved one level up into the navigation.
 */
function DayStrip({
  view,
  selectedCalendarDay,
  todayCalendarDay,
}: {
  view: ScheduleRangeView;
  selectedCalendarDay: string;
  todayCalendarDay: string;
}) {
  return (
    <nav aria-label="Choose a day" className="mt-5 grid min-w-0 grid-cols-4 gap-2 sm:grid-cols-7">
      {view.days.map((day) => {
        const current = day.calendarDay === selectedCalendarDay;
        return (
          <Link
            key={day.calendarDay}
            href={scheduleDayRoute(day.calendarDay)}
            data-internal-link="true"
            data-schedule-day={day.calendarDay}
            aria-current={current ? "page" : undefined}
            aria-label={`${scheduleDayLabel(day.calendarDay)}${day.calendarDay === todayCalendarDay ? " (today)" : ""}. ${plural(day.counts.total, "contact", "contacts")}, ${plural(day.counts.due, "still to send", "still to send")}.`}
            className="flex min-h-tap min-w-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-1 py-2 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] aria-[current]:border-[color:var(--clinical-accent)] aria-[current]:bg-[color:var(--surface-subtle)] forced-colors:border-[CanvasText]"
          >
            <span aria-hidden="true" className="block truncate text-2xs font-medium text-[color:var(--text-muted)]">
              {stripDayLabel(day.calendarDay)}
            </span>
            <span
              aria-hidden="true"
              className="block text-sm font-semibold tabular-nums text-[color:var(--text-heading)]"
            >
              {day.counts.total}
            </span>
            {day.calendarDay === todayCalendarDay ? (
              <span aria-hidden="true" className="block text-3xs font-medium text-[color:var(--clinical-accent)]">
                Today
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function SelectedDay({
  day,
  view,
  todayCalendarDay,
}: {
  day: ScheduleDay;
  view: ScheduleRangeView;
  todayCalendarDay: string;
}) {
  const heldHolds = distinctHoldsOf(day);

  return (
    <div className="mt-6 min-w-0">
      <h3 className="text-sm font-semibold text-[color:var(--text-heading)]">
        {scheduleDayLabel(day.calendarDay)}
        {day.calendarDay === todayCalendarDay ? " (today)" : ""}
      </h3>

      {day.counts.total === 0 ? (
        <div className="mt-4 min-w-0">
          <EmptyDay day={day} view={view} />
        </div>
      ) : (
        <>
          <p className="mt-2 max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
            {dayStatement(day)}
          </p>

          <DayCounts counts={day.counts} />

          {heldHolds.length > 0 ? (
            <div className="mt-4 flex min-w-0 flex-col gap-3">
              {heldHolds.map((hold) => {
                const explanation = planHoldExplanation(hold);
                return (
                  <AutomatedState
                    key={hold}
                    state={PLAN_HOLD_LABELS[hold]}
                    because={explanation.because}
                    changedBy={explanation.changedBy}
                  />
                );
              })}
            </div>
          ) : null}

          <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-3">
            {day.windows.map((window) => (
              <WindowColumn
                key={window.preference}
                heading={window.label}
                sendTime={window.sendTime}
                group={window}
                emptyText="Nothing sends in this window on this day."
              />
            ))}
          </div>

          {day.outsideApprovedWindows.entries.length > 0 ? <OutsideApprovedWindows group={day.outsideApprovedWindows} /> : null}

          <NamedExceptions group={day.exceptions} />
        </>
      )}
    </div>
  );
}

/**
 * Every distinct plan hold acting on this day, in a fixed order.
 *
 * Read off the entries the day already carries rather than off `counts.held`, because the count
 * says how many are held and not by WHAT -- and a coordinator's next move differs completely
 * between a plan nobody started and a plan somebody paused. Only entries that would otherwise go
 * out are considered: `planHold` is reported on a sent contact too, and telling a reader that an
 * ended plan is holding a message it already sent would be false.
 */
function distinctHoldsOf(day: ScheduleDay): PlanSendingHold[] {
  const present = new Set<PlanSendingHold>();
  for (const entry of allEntriesOf(day)) {
    if (entry.sendability === "stillToSend" && entry.planHold !== null) present.add(entry.planHold);
  }
  return (Object.keys(PLAN_HOLD_LABELS) as PlanSendingHold[]).filter((hold) => present.has(hold));
}

/** Every entry the day holds, in whichever group it landed in. */
function allEntriesOf(day: ScheduleDay): ScheduleEntry[] {
  return [
    ...day.windows.flatMap((window) => window.entries),
    ...day.outsideApprovedWindows.entries,
    ...day.exceptions.entries,
  ];
}

/**
 * What the day holds, as numbers, directly above the lists those numbers count.
 *
 * The first four rows PARTITION the day: due, held, already sent and will-not-be-sent add up to the
 * total, because `summariseStoredContacts` splits a day into sent / still-to-send / never and
 * `schedule-view.ts` splits still-to-send into due and held. Named exceptions cut ACROSS that
 * partition -- a missed contact will not be sent and a contact whose transport receipt never
 * arrived has already been sent, and both are exceptions -- so that row is separated from the four
 * and labelled as the panel it matches rather than as another part of the split.
 */
function DayCounts({ counts }: { counts: ScheduleCounts }) {
  const partition: readonly [string, number][] = [
    ["Due to send", counts.due],
    ["Held by their plan", counts.held],
    ["Already sent", counts.alreadySent],
    ["Will not be sent", counts.willNotBeSent],
  ];

  return (
    <dl
      data-testid="caring-contacts-schedule-day-counts"
      className="mt-4 grid min-w-0 grid-cols-2 gap-3 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 sm:grid-cols-3 forced-colors:border-[CanvasText]"
    >
      <div className="min-w-0">
        <dt className="text-xs font-medium text-[color:var(--text-muted)]">On this day</dt>
        <dd className="text-sm font-semibold tabular-nums text-[color:var(--text-heading)]">{counts.total}</dd>
      </div>
      {partition.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-medium text-[color:var(--text-muted)]">{label}</dt>
          <dd className="text-sm font-semibold tabular-nums text-[color:var(--text-heading)]">{value}</dd>
        </div>
      ))}
      <div className="min-w-0">
        <dt className="text-xs font-medium text-[color:var(--text-muted)]">Named exceptions</dt>
        <dd className="text-sm font-semibold tabular-nums text-[color:var(--text-heading)]">{counts.needsReview}</dd>
      </div>
    </dl>
  );
}

/**
 * The two ways a day can hold nothing, which read as different facts.
 *
 * A day with nothing on it while other days in the strip do hold contacts is the day CHOICE hiding
 * the work, and the remedy is the strip itself -- a control that exists, directly above (Ruling 93).
 * A strip with nothing anywhere in it is the other fact entirely, and offering "try another day"
 * there would send a clinician hunting through days that are all empty.
 */
function EmptyDay({ day, view }: { day: ScheduleDay; view: ScheduleRangeView }) {
  const elsewhere = view.days.filter((other) => other.calendarDay !== day.calendarDay && other.counts.total > 0);

  if (elsewhere.length === 0) {
    return (
      <ListEmptyState
        kind="no-data"
        heading="No contacts in these days"
        explanation="This team's plans put no caring contact on any of the days above. A day fills once a coordinator starts a plan whose schedule reaches it."
      />
    );
  }

  return (
    <ListEmptyState
      kind="filtered"
      heading="Nothing is scheduled on this day"
      because={`You are looking at ${scheduleDayLabel(day.calendarDay)}, and this team's plans put no caring contact on it. Other days above do hold contacts.`}
      changedBy="Choosing another day in the strip above opens it."
      action={
        <Link
          href={scheduleDayRoute(elsewhere[0].calendarDay)}
          data-internal-link="true"
          className="inline-flex min-h-tap shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 text-sm font-semibold text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] forced-colors:border-[CanvasText]"
        >
          <span className="truncate">Open {scheduleDayLabel(elsewhere[0].calendarDay)}</span>
        </Link>
      }
    />
  );
}

/** One of the three approved sending windows, with the wording and send time the domain publishes. */
function WindowColumn({
  heading,
  sendTime,
  group,
  emptyText,
  description,
  icon: Icon = Clock,
}: {
  heading: string;
  sendTime: string;
  group: ScheduleGroup;
  emptyText: string;
  description?: string;
  icon?: typeof Clock;
}) {
  return (
    <section
      aria-label={heading}
      className="min-w-0 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4 forced-colors:border-[CanvasText]"
    >
      <h4 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[color:var(--text-heading)]">
        <Icon aria-hidden="true" className="size-icon-md shrink-0" />
        <span className="min-w-0 truncate">{heading}</span>
      </h4>
      <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">{sendTime}</p>
      {description ? (
        <p className="mt-2 max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">{description}</p>
      ) : null}
      {group.entries.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">{emptyText}</p>
      ) : (
        <ul className="mt-3 flex min-w-0 flex-col gap-3">
          {group.entries.map((entry) => (
            <ContactRow key={entry.contactId} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Ruling [126] -- contacts sitting at a time none of the three named windows covers.
 *
 * NAMED BY THEIR TIME, NEVER AS "MOVED". A deliberate move is the only way to reach an off-window
 * time, but the converse is false and that is the whole point: a morning plan's contact moved to
 * 2:00 pm lands silently inside the afternoon window, because nothing in the record says a move
 * happened. Calling this group "moved" would therefore be true of everything in it and would miss
 * every moved contact that landed on an approved hour -- a label claiming more than the system can
 * attest. It also does not invent a fourth window: adding a sending window to a suicide-prevention
 * schedule by implementation accident is exactly what Task 12 refused to do.
 */
function OutsideApprovedWindows({ group }: { group: ScheduleGroup }) {
  return (
    <div className="mt-5 min-w-0">
      <WindowColumn
        heading="Not at an approved send time"
        sendTime="Each contact is shown at the time it sends"
        description="These contacts sit inside the approved 9:00 am to 6:00 pm AWST sending window, at a time none of the three windows above covers. They are listed here rather than filed under a window they do not send in."
        group={group}
        emptyText="No contact on this day sends outside the three windows."
        icon={CalendarDays}
      />
    </div>
  );
}

/**
 * The named-exceptions panel.
 *
 * Its contents are Task 12's definition -- the four provider outcomes that are not a delivery, plus
 * a contact the window closed on -- classified there by an exhaustive switch so nothing can default
 * in. That definition is stated in its report as a judgement rather than a rule the domain held,
 * and this screen renders it rather than re-deciding it.
 *
 * An empty panel says what it means. "No named exceptions" on a day whose contacts were all
 * cancelled is true and would be read as reassurance, so the empty wording points back at the day's
 * own statement instead of standing alone.
 */
function NamedExceptions({ group }: { group: ScheduleGroup }) {
  return (
    <section
      aria-label="Named exceptions"
      className="mt-5 min-w-0 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4 forced-colors:border-[CanvasText]"
    >
      <h4 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[color:var(--text-heading)]">
        <AlertTriangle aria-hidden="true" className="size-icon-md shrink-0" />
        <span className="min-w-0">Named exceptions</span>
      </h4>
      <p className="mt-2 max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
        Contacts a person has to look at: a message the provider did not deliver, and a message the
        sending window closed on. They are kept out of the windows above so one patient is never counted twice.
      </p>
      {group.entries.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">
          Nothing on this day needs a decision. That is not the same as nothing happening on it &mdash; what the day
          holds is stated above.
        </p>
      ) : (
        <ul className="mt-3 flex min-w-0 flex-col gap-3">
          {group.entries.map((entry) => (
            <ContactRow key={entry.contactId} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * One contact, on one day.
 *
 * Headed by the synthetic patient identifier, which is what this read releases, and linked to the
 * patient record, which is the screen that holds the name and is audited for reading it.
 *
 * Spec §4.4: a state the system reached on its own states, in place, why and what would change it.
 * Two scopes of that are possible on this row and they are answered in different places. Why THIS
 * contact will not be sent is a fact about the contact and is stated here. Why its PLAN is holding
 * it is a fact about the plan, whose remedy is on the plan, and is stated once for the day above --
 * so the row names the hold and points at it rather than repeating the whole explanation per row.
 */
function ContactRow({ entry }: { entry: ScheduleEntry }) {
  const notSending = entry.notSendingReason === null ? null : notSendingExplanation(entry.notSendingReason);
  const held = entry.sendability === "stillToSend" && entry.planHold !== null ? entry.planHold : null;

  return (
    <li className="min-w-0 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3 forced-colors:border-[CanvasText]">
      <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--text-muted)]">
        Synthetic patient identifier
      </p>
      <h5 className="mt-0.5 truncate text-sm font-semibold text-[color:var(--text-heading)]">{entry.patientId}</h5>
      <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
        {MESSAGE_TYPE_LABELS[entry.messageType]} &middot; {entry.cadenceLabel}
      </p>
      <p className="text-sm leading-6 text-[color:var(--text-muted)]">
        <span className="font-medium text-[color:var(--text)]">Sends at: </span>
        {awstClockLabel(entry.sendAt)}
      </p>
      <p className="text-sm leading-6 text-[color:var(--text-muted)]">
        <span className="font-medium text-[color:var(--text)]">State: </span>
        {CONTACT_STATE_LABELS[entry.state]}
      </p>
      {held === null ? null : (
        <p className="text-sm leading-6 text-[color:var(--text-muted)]">
          <span className="font-medium text-[color:var(--text)]">Not sending: </span>
          {PLAN_HOLD_LABELS[held]} &mdash; stated in full above this day&rsquo;s windows.
        </p>
      )}
      <Link
        href={patientRoute(entry.patientId)}
        data-internal-link="true"
        className="mt-2 inline-flex min-h-tap min-w-0 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm font-medium text-[color:var(--text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      >
        <span className="truncate">Patient record &mdash; {entry.patientId}</span>
      </Link>
      {notSending === null ? null : (
        <div className="mt-3 min-w-0">
          <AutomatedState
            state={notSending.state}
            because={notSending.because}
            changedBy={notSending.changedBy}
          />
        </div>
      )}
    </li>
  );
}
