"use client";

import {
  AlarmClock,
  ArrowRight,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  GraduationCap,
  Info,
  MapPin,
  PlayCircle,
  Repeat,
  ShieldAlert,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import { MockupPageShell, ModuleLabel, PhoneFrame, TopBar } from "@/components/on-call-shift-cover-mockups";

/**
 * On Call — calendars and shift memory study (2026-09-19).
 *
 * Design scratch, second of two. Study 1 rebuilds screens that exist; this one
 * proposes four surfaces that do not, chosen because each answers a question
 * the hub is asked and cannot currently answer:
 *
 *  A. **Cover calendar.** "Who is on next Tuesday night?" The hub holds role
 *     numbers with no time dimension at all, so the answer lives in a PDF roster
 *     in somebody's email.
 *  B. **Teaching calendar and CPD log.** The Teaching page is a flat list of two
 *     cards with a date chip. There is no month, no term, no way to put a
 *     session in your own phone calendar, and no record that you attended —
 *     which is the thing a registrar is actually asked for at the end of the
 *     year.
 *  C. **Shift log.** The one artefact every on-call shift generates and this hub
 *     throws away: the jobs still outstanding at handover. Drawn deliberately
 *     de-identified, because `AGENTS.md` forbids this mode becoming a patient
 *     list, and that constraint is a design input here rather than a footnote.
 *  D. **Who covers this?** Referrals already stores catchment, hours,
 *     exclusions and a number per service. Today that is a list you read. Asked
 *     as a question — an age, a suburb, a time — it becomes the answer to "who
 *     takes this patient at 2am", which is the single most common out-of-hours
 *     administrative question there is.
 *
 * Every date, name and roster below is invented. Tokens only.
 */

/* ══════════════════════  board A — cover calendar  ══════════════════════ */

type Cover = { c: string; r: string };

/**
 * A month of invented cover, keyed by day of month.
 *
 * Generated from two short repeating cycles rather than typed out, because the
 * point of the board is a FULL month — three blank weeks would have the grid
 * judged on how it handles missing data, which is not the question.
 */
const CONSULTANTS = ["AE", "DE", "FE"];
const REGISTRARS = ["BE", "CE"];
const COVER_BY_DAY: Record<number, Cover> = Object.fromEntries(
  Array.from({ length: 30 }, (_unused, index) => [
    index + 1,
    { c: CONSULTANTS[Math.floor(index / 3) % CONSULTANTS.length], r: REGISTRARS[index % REGISTRARS.length] },
  ]),
);

/** Days this invented reader is rostered, so "Mine" has something to mark. */
const MY_NIGHTS = new Set([16, 17, 23, 24]);

const TODAY = 19;

/**
 * A month of cover, two roles deep.
 *
 * The hard part of a rota on a 390px screen is that a month grid gives each day
 * about 48×56px, and a name does not fit in it. Initials do, and initials are
 * how a roster is read aloud on a ward anyway. The full names are one tap away
 * in the day sheet below, and the legend at the foot expands them — so nothing
 * depends on decoding two letters.
 *
 * No colour coding by person. Seventeen consultants would need seventeen hues
 * and the design system reserves colour for category identity; more to the
 * point, "status never by colour alone" applies doubly to a surface where the
 * status IS who to ring. Today is a ring, my nights are a filled disc under the
 * date, and both carry a word in the legend.
 */
function MonthGrid() {
  const cells: ReactNode[] = [];
  // 1 Sep 2026 is invented as a Tuesday, so the grid opens with one blank.
  for (let blank = 0; blank < 1; blank += 1) cells.push(<span key={`blank-${blank}`} />);
  for (let day = 1; day <= 30; day += 1) {
    const cover = COVER_BY_DAY[day];
    const mine = MY_NIGHTS.has(day);
    const today = day === TODAY;
    cells.push(
      <span
        key={day}
        className={`grid min-h-[3.25rem] content-start gap-0.5 rounded-sm border p-1 ${
          today
            ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)]"
            : mine
              ? "border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)]"
              : "border-[color:var(--border)] bg-[color:var(--surface-raised)]"
        }`}
      >
        <span className="flex items-center justify-between">
          <span
            className={`nums text-2xs font-bold ${today ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-muted)]"}`}
          >
            {day}
          </span>
          {mine ? <span aria-hidden="true" className="size-1.5 rounded-pill bg-[color:var(--text-heading)]" /> : null}
        </span>
        {cover ? (
          <>
            <span className="nums block truncate text-3xs font-bold text-[color:var(--text-heading)]">{cover.c}</span>
            <span className="nums block truncate text-3xs text-[color:var(--text-muted)]">{cover.r}</span>
          </>
        ) : (
          <span className="text-3xs text-[color:var(--text-soft)]">—</span>
        )}
      </span>,
    );
  }
  return <div className="grid grid-cols-7 gap-1">{cells}</div>;
}

function BoardCoverCalendar() {
  return (
    <PhoneFrame
      caption="A · Cover calendar — who is on, which night"
      note="The hub has no time dimension at all today. A month of cover, two roles deep, with the full names one tap away."
      heightClass="h-[850px]"
    >
      <TopBar title="Cover" />
      <Screen>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <ChevronLeft aria-hidden="true" className="size-icon-md text-[color:var(--text-muted)]" />
            <span className="text-base font-bold text-[color:var(--text-heading)]">September 2026</span>
            <ChevronRight aria-hidden="true" className="size-icon-md text-[color:var(--text-muted)]" />
          </span>
          <span className="flex gap-1">
            {["All", "Mine"].map((chip, index) => (
              <span
                key={chip}
                className={`rounded-sm border px-2 py-1 text-2xs font-bold ${
                  index === 0
                    ? "border-[color:var(--text-heading)] bg-[color:var(--text-heading)] text-[color:var(--surface-raised)]"
                    : "border-[color:var(--border)] text-[color:var(--text-muted)]"
                }`}
              >
                {chip}
              </span>
            ))}
          </span>
        </div>
        <div className="mb-1 grid grid-cols-7 gap-1">
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
            <span
              key={`${day}-${index}`}
              className="text-center text-3xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]"
            >
              {day}
            </span>
          ))}
        </div>
        <MonthGrid />
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-3xs text-[color:var(--text-muted)]">
          <span className="inline-flex items-center gap-1">
            <span
              aria-hidden="true"
              className="size-2 rounded-sm border border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)]"
            />
            Tonight
          </span>
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true" className="size-1.5 rounded-pill bg-[color:var(--text-heading)]" />
            You are on
          </span>
          <span>Top line consultant · second line registrar</span>
        </p>

        {/* The day sheet. Tapping a cell opens this; it is drawn open because
            the two-letter grid is only defensible if the way out of it is
            visibly one tap. */}
        <div className="mt-4 rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--e2)]">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-[color:var(--text-heading)]">Sat 19 September · nights</p>
            <span className="nums text-2xs text-[color:var(--text-muted)]">20:30 – 08:30</span>
          </div>
          <div className="mt-2 grid gap-1.5">
            {[
              ["Consultant", "Dr A. Example", "0000 000 007"],
              ["Registrar", "Dr B. Example", "0000 000 002"],
              ["Nurse co-ordinator", "By roster", "0000 000 001"],
            ].map(([role, person, number]) => (
              <span
                key={role}
                className="flex min-h-tap items-center gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-3xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
                    {role}
                  </span>
                  <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">
                    {person}
                  </span>
                </span>
                <span className="nums shrink-0 text-xs font-bold text-[color:var(--text)]">{number}</span>
                <ChevronRight aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
              </span>
            ))}
          </div>
          <span className="mt-2 inline-flex min-h-tap items-center gap-1.5 text-xs font-bold text-[color:var(--clinical-accent)]">
            <CalendarPlus aria-hidden="true" className="size-icon-sm" />
            Add my nights to my phone calendar
          </span>
        </div>

        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5 text-2xs leading-4 text-[color:var(--text-muted)]">
          <Info aria-hidden="true" className="mt-px size-icon-sm shrink-0" />
          <span>
            A roster is an administrative fact, like a phone number — so it belongs in this mode. It is also the one
            kind of entry that names individuals, so it would default to private and never print on the pocket card.
          </span>
        </p>
      </Screen>
    </PhoneFrame>
  );
}

/* ═════════════════  board B — teaching calendar and CPD  ═════════════════ */

type Session = {
  date: string;
  weekday: string;
  day: string;
  month: string;
  title: string;
  presenter?: string;
  where: string;
  repeat?: string;
  state: "next" | "upcoming" | "past";
  attended?: boolean;
  recording?: boolean;
};

const SESSIONS: Session[] = [
  {
    date: "2026-09-15",
    weekday: "Tue",
    day: "15",
    month: "Sep",
    title: "Clozapine monitoring in practice",
    presenter: "Dr C. Example",
    where: "Seminar room",
    repeat: "Weekly in term",
    state: "past",
    attended: true,
    recording: true,
  },
  {
    date: "2026-09-22",
    weekday: "Tue",
    day: "22",
    month: "Sep",
    title: "Registrar teaching — the agitated patient",
    presenter: "Dr D. Example",
    where: "Seminar room",
    repeat: "Weekly in term",
    state: "next",
  },
  {
    date: "2026-10-01",
    weekday: "Thu",
    day: "1",
    month: "Oct",
    title: "Journal club",
    where: "Seminar room",
    repeat: "Monthly",
    state: "upcoming",
  },
];

/**
 * Teaching as a term, not a list of two cards.
 *
 * Three things the shipped page has no room for, each cheap:
 *
 *  - **A week rail.** A teaching programme is read by week — "is there anything
 *    on before my nights start" — and the shipped page cannot answer that
 *    without reading every card.
 *  - **Attendance.** One tap, stored in the browser, totalled at the foot. A
 *    registrar is asked for this at the end of the year and currently keeps it
 *    in a notebook. It records attendance at a session, which is training
 *    administration, not a clinical record.
 *  - **Into your own calendar.** The one action that makes a teaching programme
 *    actually attended. An `.ics` file needs no account, no provider and no
 *    integration — it is a text file the phone already knows how to open.
 *
 * The date chip is also fixed here. Today it reads "Next: Tue 22 Sep 2026, Next
 * week, 08:00" — a computed date and the owner's free-text sentence glued
 * together, saying the same thing twice and neither of them cleanly. The
 * computed date becomes the rail; the owner's own words stay as the pattern
 * chip, where they carry the exceptions a three-value enum cannot.
 */
function SessionRow({ session }: { session: Session }) {
  const past = session.state === "past";
  return (
    <div className="flex gap-2.5">
      <span
        className={`grid h-14 w-12 shrink-0 content-center justify-items-center rounded-sm border ${
          session.state === "next"
            ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)]"
            : "border-[color:var(--border)] bg-[color:var(--surface-subtle)]"
        }`}
      >
        <span className="text-3xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
          {session.weekday}
        </span>
        <span className="nums text-lg-minus font-bold leading-5 text-[color:var(--text-heading)]">{session.day}</span>
        <span className="text-3xs font-semibold text-[color:var(--text-muted)]">{session.month}</span>
      </span>
      <div
        className={`min-w-0 flex-1 rounded-lg border p-2.5 ${
          past
            ? "border-[color:var(--border)] bg-[color:var(--surface-subtle)]"
            : "border-[color:var(--border)] bg-[color:var(--surface-raised)]"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-sm font-bold leading-5 text-[color:var(--text-heading)]">{session.title}</p>
          {session.state === "next" ? (
            <span className="shrink-0 rounded-sm bg-[color:var(--clinical-accent)] px-1.5 py-0.5 text-3xs font-bold uppercase tracking-kicker text-[color:var(--clinical-accent-contrast)]">
              Next
            </span>
          ) : null}
        </div>
        <p className="nums mt-0.5 text-xs text-[color:var(--text-muted)]">
          08:00 · {session.where}
          {session.presenter ? ` · ${session.presenter}` : ""}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {session.repeat ? (
            <span className="inline-flex items-center gap-1 rounded-sm border border-[color:var(--border)] px-1.5 py-0.5 text-3xs font-semibold text-[color:var(--text-muted)]">
              <Repeat aria-hidden="true" className="size-icon-xs" />
              {session.repeat}
            </span>
          ) : null}
          {session.recording ? (
            <span className="inline-flex items-center gap-1 rounded-sm border border-[color:var(--border)] px-1.5 py-0.5 text-3xs font-semibold text-[color:var(--text-muted)]">
              <PlayCircle aria-hidden="true" className="size-icon-xs" />
              Recording
            </span>
          ) : null}
          {past ? (
            <span
              className={`inline-flex min-h-tap items-center gap-1 rounded-sm border px-2 text-3xs font-bold ${
                session.attended
                  ? "border-[color:var(--success)] bg-[color:var(--success-soft)] text-[color:var(--success-text)]"
                  : "border-[color:var(--border)] text-[color:var(--text-muted)]"
              }`}
            >
              {session.attended ? (
                <Check aria-hidden="true" className="size-icon-xs" />
              ) : (
                <CircleDashed aria-hidden="true" className="size-icon-xs" />
              )}
              {session.attended ? "Attended" : "Mark attended"}
            </span>
          ) : (
            <span className="inline-flex min-h-tap items-center gap-1 rounded-sm border border-[color:var(--border)] px-2 text-3xs font-bold text-[color:var(--clinical-accent)]">
              <CalendarPlus aria-hidden="true" className="size-icon-xs" />
              Add to calendar
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function BoardTeaching() {
  return (
    <PhoneFrame
      caption="B · Teaching — a term, and a record you attended it"
      note="A week rail instead of a date chip that says the same thing twice, an .ics export, and an attendance total nobody currently keeps anywhere but a notebook."
      heightClass="h-[720px]"
    >
      <TopBar title="Teaching" />
      <Screen>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-base font-bold text-[color:var(--text-heading)]">Term 3 · weeks 6–10</span>
          <span className="flex gap-1">
            {["List", "Month"].map((chip, index) => (
              <span
                key={chip}
                className={`rounded-sm border px-2 py-1 text-2xs font-bold ${
                  index === 0
                    ? "border-[color:var(--text-heading)] bg-[color:var(--text-heading)] text-[color:var(--surface-raised)]"
                    : "border-[color:var(--border)] text-[color:var(--text-muted)]"
                }`}
              >
                {chip}
              </span>
            ))}
          </span>
        </div>

        <div className="mb-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-[color:var(--text-heading)]">
              <GraduationCap aria-hidden="true" className="size-icon-md text-[color:var(--text-muted)]" />
              Attended this year
            </span>
            <span className="nums text-sm font-bold text-[color:var(--text-heading)]">14 of 19</span>
          </div>
          <span
            aria-hidden="true"
            className="mt-2 block h-1.5 overflow-hidden rounded-pill bg-[color:var(--surface-raised)]"
          >
            <span className="block h-full w-[74%] rounded-pill bg-[color:var(--clinical-accent)]" />
          </span>
          <p className="mt-1.5 text-3xs leading-4 text-[color:var(--text-muted)]">
            Kept in this browser only, like Recent. Export it as a list when your training record asks for one.
          </p>
        </div>

        <ModuleLabel action={<>Export term</>}>This term</ModuleLabel>
        <div className="grid gap-2">
          {SESSIONS.map((session) => (
            <SessionRow key={session.date} session={session} />
          ))}
        </div>
      </Screen>
    </PhoneFrame>
  );
}

/* ══════════════════════  board C — the shift log  ══════════════════════ */

type Job = { ward: string; job: string; raised: string; state: "open" | "carried" | "done" };

const JOBS: Job[] = [
  { ward: "Ward 4B", job: "Medication chart to re-write before the round", raised: "21:40", state: "open" },
  { ward: "Emergency", job: "Awaiting bed — flow team to call back", raised: "22:15", state: "open" },
  { ward: "Ward 2A", job: "Family meeting to be arranged by the day team", raised: "19:05", state: "carried" },
  { ward: "Ward 4B", job: "Bloods chased, results back", raised: "20:50", state: "done" },
];

/**
 * The shift log — and the boundary it has to be designed inside.
 *
 * `AGENTS.md` is explicit: "Nothing in this mode may become a patient list or
 * identifiable clinical handover." That rules out the obvious version of this
 * feature and it should. But the constraint does not rule out the useful part,
 * because the thing that gets lost at 08:30 is rarely the clinical detail — it
 * is the administrative tail. Who was going to ring the family. Which chart
 * still needs re-writing. Which bed request is still open.
 *
 * So this board draws a job list with no patient field, by construction rather
 * than by asking people to behave: a job is a WARD plus a TASK plus a TIME, and
 * there is nowhere to type a name, a date of birth or a record number. The
 * banner is not decoration; it is the design telling the user what the form
 * will not accept.
 *
 * Even so this is the one proposal here that should not be built on a product
 * decision alone. An intervention that shapes what gets handed over is a
 * clinical governance question, and the honest place for it is the outstanding
 * issues ledger with a clinician sign-off attached — which is why it is drawn
 * with its blocker on the board rather than without it.
 */
function BoardShiftLog() {
  return (
    <PhoneFrame
      caption="C · Shift log — the jobs, never the patients"
      note="The tail every shift generates and this hub throws away. Drawn with no patient field at all, because the mode's clinical boundary forbids one."
      heightClass="h-[810px]"
    >
      <TopBar title="Shift log" />
      <Screen>
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-[color:var(--warning)] bg-[color:var(--warning-soft)] p-2.5">
          <ShieldAlert aria-hidden="true" className="mt-px size-icon-md shrink-0 text-[color:var(--warning-text)]" />
          <p className="text-2xs leading-4 text-[color:var(--warning-text)]">
            <strong className="font-bold">No patient identifiers.</strong> A job is a ward, a task and a time. There is
            no name field, no date of birth and no record number — not as a rule to follow, as a form that cannot take
            one.
          </p>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          {[
            ["2", "Open"],
            ["1", "Carried over"],
            ["1", "Closed"],
          ].map(([count, label]) => (
            <span
              key={label}
              className="grid gap-0.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2"
            >
              <span className="nums text-lg-minus font-bold text-[color:var(--text-heading)]">{count}</span>
              <span className="text-3xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
                {label}
              </span>
            </span>
          ))}
        </div>

        <ModuleLabel action={<>Add job</>}>Tonight</ModuleLabel>
        <div className="grid gap-1.5">
          {JOBS.map((job) => (
            <div
              key={job.job}
              className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${
                job.state === "done"
                  ? "border-[color:var(--border)] bg-[color:var(--surface-subtle)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface-raised)]"
              }`}
            >
              <span
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-sm border ${
                  job.state === "done"
                    ? "border-[color:var(--success)] bg-[color:var(--success-soft)] text-[color:var(--success-text)]"
                    : "border-[color:var(--border-strong)]"
                }`}
              >
                {job.state === "done" ? <Check aria-hidden="true" className="size-icon-xs" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <MapPin aria-hidden="true" className="size-icon-xs text-[color:var(--text-muted)]" />
                  <span className="text-3xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
                    {job.ward}
                  </span>
                  {job.state === "carried" ? (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-[color:var(--border)] px-1 text-3xs font-bold text-[color:var(--text-muted)]">
                      <Repeat aria-hidden="true" className="size-icon-xs" />
                      From last shift
                    </span>
                  ) : null}
                </span>
                <span
                  className={`mt-0.5 block text-sm leading-5 ${
                    job.state === "done"
                      ? "text-[color:var(--text-muted)] line-through"
                      : "font-semibold text-[color:var(--text-heading)]"
                  }`}
                >
                  {job.job}
                </span>
                <span className="nums mt-0.5 inline-flex items-center gap-1 text-3xs text-[color:var(--text-muted)]">
                  <AlarmClock aria-hidden="true" className="size-icon-xs" />
                  Raised {job.raised}
                </span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex min-h-tap items-center justify-between gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] px-3">
          <span className="flex items-center gap-2 text-xs font-bold text-[color:var(--text-heading)]">
            <Users aria-hidden="true" className="size-icon-md text-[color:var(--text-muted)]" />
            Hand the open jobs to the day team
          </span>
          <ArrowRight aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
        </div>
        <p className="mt-2 rounded-lg border border-[color:var(--danger)] bg-[color:var(--danger-soft)] p-2.5 text-2xs leading-4 text-[color:var(--danger-text)]">
          <strong className="font-bold">Blocked on a decision, not on code.</strong> Anything that shapes what gets
          handed over is a clinical governance question. This one needs a clinician sign-off before it is built, and
          should go to the outstanding-issues ledger rather than straight into a sprint.
        </p>
      </Screen>
    </PhoneFrame>
  );
}

/* ═══════════════════  board D — who covers this?  ═══════════════════ */

type Service = {
  name: string;
  verdict: "takes" | "excludes" | "closed";
  why: string;
  number: string;
  hours: string;
};

const SERVICES: Service[] = [
  {
    name: "Adult mental health emergency response",
    verdict: "takes",
    why: "Covers this suburb · 16+ · open now",
    number: "0000 000 011",
    hours: "24 hours",
  },
  {
    name: "Older adult liaison",
    verdict: "excludes",
    why: "Takes 65+ only",
    number: "0000 000 012",
    hours: "Mon–Fri 08:00–16:30",
  },
  {
    name: "Community follow-up team",
    verdict: "closed",
    why: "Covers this suburb, but closed until 08:00",
    number: "0000 000 013",
    hours: "Mon–Fri 08:30–17:00",
  },
];

const VERDICT: Record<Service["verdict"], { label: string; className: string }> = {
  takes: {
    label: "Takes this",
    className: "border-[color:var(--success)] bg-[color:var(--success-soft)] text-[color:var(--success-text)]",
  },
  excludes: {
    label: "Excluded",
    className: "border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
  },
  closed: {
    label: "Closed now",
    className: "border-[color:var(--warning)] bg-[color:var(--warning-soft)] text-[color:var(--warning-text)]",
  },
};

/**
 * "Who covers this?" — the referrals list, asked as a question.
 *
 * Referrals already stores exactly the four facts this needs: `accepts`,
 * `exclusions`, `catchment` and `hours`. Today they render as a list you read
 * top to bottom at 2am while working out which service takes a 70-year-old in a
 * particular suburb. Turned around, the same four fields answer the question
 * directly.
 *
 * Two design rules make it safe, and both matter more than the feature:
 *
 *  - **It shows its working.** Every row states which stored fact produced its
 *    verdict — "takes 65+ only", "closed until 08:00". A router that gives a
 *    bare answer is a router nobody can check, and an out-of-date catchment
 *    would then be invisible rather than obvious.
 *  - **Excluded services stay on screen.** Hiding them would mean the reader
 *    cannot see that the tool considered and rejected the service they were
 *    about to ring. Ranked, never filtered away.
 *
 * It matches on administrative facts the owner typed. It is not triage, it
 * makes no clinical judgement, and the services it rules out are ruled out by
 * an age range and a postcode, never by anything about a patient.
 */
function BoardCoverage() {
  return (
    <PhoneFrame
      caption="D · Who covers this? — referrals, asked as a question"
      note="The same four stored fields, turned around. Shows its working on every row, and never hides a service it ruled out."
      heightClass="h-[720px]"
    >
      <TopBar title="Referrals" />
      <Screen>
        <div className="mb-3 grid gap-2 rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--e2)]">
          <p className="text-sm font-bold text-[color:var(--text-heading)]">Who covers this?</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Age", "70"],
              ["Suburb", "Demo Bay"],
            ].map(([label, value]) => (
              <span
                key={label}
                className="grid min-h-tap content-center gap-0.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3"
              >
                <span className="text-3xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
                  {label}
                </span>
                <span className="text-sm font-bold text-[color:var(--text-heading)]">{value}</span>
              </span>
            ))}
          </div>
          <span className="flex min-h-tap items-center justify-between gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3">
            <span className="grid gap-0.5">
              <span className="text-3xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">Time</span>
              <span className="nums text-sm font-bold text-[color:var(--text-heading)]">Now · Sat 02:40</span>
            </span>
            <ChevronRight aria-hidden="true" className="size-icon-sm text-[color:var(--text-muted)]" />
          </span>
        </div>

        <ModuleLabel>3 services considered</ModuleLabel>
        <div className="grid gap-1.5">
          {SERVICES.map((service) => {
            const verdict = VERDICT[service.verdict];
            return (
              <div
                key={service.name}
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2.5 shadow-[var(--e1)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm font-bold leading-5 text-[color:var(--text-heading)]">{service.name}</p>
                  <span
                    className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-3xs font-bold uppercase tracking-kicker ${verdict.className}`}
                  >
                    {verdict.label}
                  </span>
                </div>
                {/* The working. A verdict with no reason cannot be checked, and
                    a stale catchment would then be invisible. */}
                <p className="mt-0.5 text-xs leading-5 text-[color:var(--text)]">{service.why}</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="nums text-xs font-bold text-[color:var(--text-muted)]">
                    {service.number} · {service.hours}
                  </span>
                  {service.verdict === "takes" ? (
                    <span className="inline-flex min-h-tap items-center gap-1 rounded-sm bg-[color:var(--command)] px-2.5 text-2xs font-bold text-[color:var(--command-contrast)]">
                      Call
                    </span>
                  ) : (
                    <span className="inline-flex min-h-tap items-center gap-1 rounded-sm border border-[color:var(--border)] px-2.5 text-2xs font-bold text-[color:var(--text-muted)]">
                      Details
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5 text-2xs leading-4 text-[color:var(--text-muted)]">
          <Info aria-hidden="true" className="mt-px size-icon-sm shrink-0" />
          <span>
            Matched against the catchment, age range, exclusions and hours you typed into each service. It is not triage
            and makes no clinical judgement — confirm with the service before referring.
          </span>
        </p>
      </Screen>
    </PhoneFrame>
  );
}

/* ══════════════════════════  scaffolding  ══════════════════════════ */

function Screen({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--background)] p-4">{children}</div>;
}

export function OnCallCalendarsMockups() {
  return (
    <MockupPageShell
      eyebrow="On Call · study 2 of 2"
      title="Calendars, cover and shift memory"
      summary="Four surfaces the hub does not have. A cover calendar, because the hub holds role numbers with no time dimension at all. A teaching term with attendance, because a flat list of two cards is not a programme. A de-identified shift log, drawn inside the mode's clinical boundary rather than around it. And the referrals list asked as a question, which is the most common out-of-hours administrative question there is."
    >
      <div className="flex flex-wrap gap-x-6 gap-y-10">
        <BoardCoverCalendar />
        <BoardTeaching />
        <BoardShiftLog />
        <BoardCoverage />
      </div>
    </MockupPageShell>
  );
}
