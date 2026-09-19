"use client";

import {
  AlarmClock,
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  Copy,
  FileText,
  Lock,
  MoonStar,
  Phone,
  PhoneOutgoing,
  QrCode,
  Search,
  ShieldAlert,
  Stethoscope,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * On Call — shift, cover and escalation study (2026-09-19).
 *
 * Design scratch. Nothing here is wired, nothing reads the real entry store,
 * and every name, number and roster in this file is invented. It exists to put
 * four proposals in front of the owner beside the screens they would replace.
 *
 * The four boards answer four findings from the review of the shipped hub:
 *
 *  A. The home never says WHO is on, or where you are in the shift. It lists
 *     role numbers. At 03:00 the question is "who is the registrar tonight and
 *     does she pick up", not "what number does a registrar have". The Shift
 *     module has been parked on the database change since 2026-09-12; this
 *     board draws it together with a cover strip, which is the part that
 *     changes what a caller does.
 *  B. A Contacts row truncates the contact's NAME to make room for a number
 *     and two round controls, and rows whose trailing controls differ end at
 *     different x positions, so the list has no right-hand edge to scan down.
 *  C. A Playbook step shows a phone glyph whether or not it can dial, prints
 *     the escalation CONDITION — the clinically load-bearing half — on one
 *     truncated line, and repeats a five-line "no local guideline linked"
 *     paragraph under every scenario.
 *  D. The printed pocket card omits `details.extension`, so every ward on it
 *     prints with no number at all.
 *
 * Tokens only: this must survive dark mode and forced colours, which is where
 * a hand-tuned mockup normally falls over first.
 */

/* ══════════════════════════  scaffold  ══════════════════════════ */

export const PHONE_WIDTH = 390;

/** A 390px artboard — the width every On Call screen is drawn and tested at. */
export function PhoneFrame({
  caption,
  note,
  height = 760,
  children,
}: {
  caption: string;
  note?: string;
  height?: number;
  children: ReactNode;
}) {
  return (
    // The figure is the artboard's width plus its bezel, so a caption never
    // stretches the column and the boards tile predictably however many fit.
    <figure className="m-0 shrink-0" style={{ width: PHONE_WIDTH + 12 }}>
      <figcaption className="mb-2 grid gap-1">
        <span className="text-2xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">{caption}</span>
        {note ? <span className="text-xs leading-5 text-[color:var(--text-muted)]">{note}</span> : null}
      </figcaption>
      {/* A fixed width, not a max-width. These boards are drawn and tested at
          390px, and a grid column narrower than that silently re-wraps every
          row — which would make the study argue about wrapping the real page
          does not do. The page scrolls instead. */}
      <div style={{ width: PHONE_WIDTH }}>
        <div
          style={{ height, borderRadius: "1.85rem", borderWidth: 6 }}
          className="relative flex flex-col overflow-hidden border-[color:var(--border-strong)] bg-[color:var(--background)] shadow-[var(--shadow-elevated)]"
        >
          {children}
        </div>
      </div>
    </figure>
  );
}

/** The universal top bar, drawn so a board reads at its real vertical budget. */
export function TopBar({ title }: { title: string }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-chrome)] px-3 py-2">
      <span aria-hidden="true" className="grid gap-1">
        <span className="block h-0.5 w-4 rounded-pill bg-[color:var(--text-muted)]" />
        <span className="block h-0.5 w-4 rounded-pill bg-[color:var(--text-muted)]" />
        <span className="block h-0.5 w-4 rounded-pill bg-[color:var(--text-muted)]" />
      </span>
      <span className="flex items-center gap-2 rounded-pill border border-[color:var(--border)] bg-[color:var(--surface-raised)] py-1 pl-1 pr-3">
        <span className="grid size-7 place-items-center rounded-pill bg-[color:var(--clinical-accent)]">
          <MoonStar aria-hidden="true" className="size-icon-sm text-[color:var(--clinical-accent-contrast)]" />
        </span>
        <span className="grid">
          <span className="text-sm font-bold leading-4 text-[color:var(--text-heading)]">{title}</span>
          <span className="text-3xs font-bold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            On Call
          </span>
        </span>
      </span>
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-pill border border-[color:var(--border)] text-[color:var(--text-muted)]"
      >
        <span className="text-sm font-bold leading-none">···</span>
      </span>
    </div>
  );
}

/** The scrolling body of an artboard. */
function Screen({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--background)] p-4">{children}</div>;
}

export function ModuleLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex min-h-6 items-center justify-between gap-2">
      <span className="text-2xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">{children}</span>
      {action ? (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--text-muted)]">
          {action}
        </span>
      ) : null}
    </div>
  );
}

/** A dial control, drawn at the production 48px floor. */
function DialButton({ label, tone = "command" }: { label: string; tone?: "command" | "quiet" }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={
        tone === "command"
          ? "grid size-11 shrink-0 place-items-center rounded-pill bg-[color:var(--command)] text-[color:var(--command-contrast)]"
          : "grid size-11 shrink-0 place-items-center rounded-pill border border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]"
      }
    >
      <Phone aria-hidden="true" className="size-icon-md" />
    </span>
  );
}

/* ═══════════════════  board A — shift and cover  ═══════════════════ */

/**
 * The shift band.
 *
 * Purple, and this is the carve-out `category-identity.ts` already allows: it
 * is page CONTENT on a home rather than a navigation channel, and the colour is
 * never the only signal — it carries a heading, a clock glyph and words.
 *
 * The progress bar is the piece worth arguing for. A night shift has no natural
 * landmarks; "3h 42m to handover" is the number that decides whether you ring
 * the consultant now or let it wait for the morning round.
 */
function ShiftBand() {
  return (
    <section
      data-category-accent="purple"
      className="mb-4 rounded-xl border border-[color:var(--cat-border)] bg-[color:var(--cat-soft)] p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[color:var(--text-heading)]">Demo Hospital · Nights</p>
          <p className="nums text-xs text-[color:var(--text)]">Fri 19 Sep · 20:30 – 08:30</p>
        </div>
        <span className="inline-flex min-h-tap items-center gap-1 rounded-sm px-1.5 text-xs font-semibold text-[color:var(--cat-accent)]">
          Change site
          <ChevronRight aria-hidden="true" className="size-icon-xs" />
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-pill bg-[color:var(--surface-raised)]">
          <span className="block h-full w-[38%] rounded-pill bg-[color:var(--cat-accent)]" />
        </span>
        <span className="nums inline-flex items-center gap-1 text-2xs font-bold text-[color:var(--text)]">
          <AlarmClock aria-hidden="true" className="size-icon-xs" />
          3h 42m to handover
        </span>
      </div>
    </section>
  );
}

type CoverRow = {
  role: string;
  person: string;
  icon: LucideIcon;
  number: string;
  numberLabel: string;
  until: string;
  /** True when the roster itself, not just the number, was confirmed today. */
  confirmed: boolean;
};

const COVER: CoverRow[] = [
  {
    role: "Consultant on call",
    person: "Dr A. Example",
    icon: Stethoscope,
    number: "0000 000 007",
    numberLabel: "Mobile",
    until: "until 08:30",
    confirmed: true,
  },
  {
    role: "Registrar on call",
    person: "Dr B. Example",
    icon: UserRound,
    number: "0000 000 002",
    numberLabel: "After hours",
    until: "until 08:30",
    confirmed: true,
  },
  {
    role: "Nurse co-ordinator",
    person: "By roster — ring the desk",
    icon: UserRound,
    number: "0000 000 001",
    numberLabel: "Direct",
    until: "always",
    confirmed: false,
  },
];

/**
 * Who is on cover, right now.
 *
 * The shipped home answers "what number does a registrar have". This answers
 * "who is the registrar tonight, and is that still true at this hour" — which
 * is the question a caller actually has, and the one that makes the difference
 * between a call answered and a call to a daytime desk.
 *
 * Every row states its own provenance, because a named roster that nobody
 * confirmed is more dangerous than no roster at all: a reader who sees a name
 * stops checking. A row with no confirmed name says so in words and falls back
 * to the role's standing number rather than inventing a person.
 */
function CoverStrip() {
  return (
    <section className="mb-4">
      <ModuleLabel action={<>Roster</>}>On cover now</ModuleLabel>
      <div className="grid gap-1.5">
        {COVER.map((row) => {
          const RowIcon = row.icon;
          return (
            <div
              key={row.role}
              className="flex items-center gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2.5 shadow-[var(--e1)]"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-sm border border-[color:var(--border)] bg-[color:var(--surface-subtle)]">
                <RowIcon aria-hidden="true" className="size-icon-md text-[color:var(--text-muted)]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-2xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
                  {row.role}
                </span>
                <span className="block truncate text-sm font-bold text-[color:var(--text-heading)]">{row.person}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className="nums text-xs font-bold text-[color:var(--text)]">{row.number}</span>
                  <span className="text-2xs text-[color:var(--text-muted)]">
                    {row.numberLabel} · {row.until}
                  </span>
                </span>
              </span>
              <span className="grid shrink-0 gap-1">
                <DialButton label={`Call ${row.role}`} />
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 flex items-start gap-1.5 text-2xs leading-4 text-[color:var(--text-muted)]">
        <BadgeCheck aria-hidden="true" className="mt-px size-icon-xs shrink-0" />
        <span>
          Names confirmed for tonight at 16:40. Un-confirmed roles show the role&apos;s standing number instead of a
          name — never a name nobody checked.
        </span>
      </p>
    </section>
  );
}

function CallCard({
  title,
  number,
  label,
  availability,
}: {
  title: string;
  number: string;
  label: string;
  availability: string;
}) {
  return (
    <span className="grid min-h-tap content-between gap-2 rounded-lg bg-[color:var(--command)] p-3 text-[color:var(--command-contrast)]">
      <span className="flex items-center justify-between gap-2">
        <Phone aria-hidden="true" className="size-icon-md" />
        <span className="text-3xs font-bold uppercase tracking-kicker opacity-80">{label}</span>
      </span>
      <span className="grid gap-0.5">
        <span className="text-sm font-semibold">{title}</span>
        <span className="nums text-lg-minus font-bold tracking-display">{number}</span>
        <span className="text-3xs font-semibold opacity-80">{availability}</span>
      </span>
    </span>
  );
}

function BoardShiftCover() {
  return (
    <PhoneFrame
      caption="A · Tonight — shift band and cover strip"
      note="Adds the two things the shipped home cannot answer: where you are in the shift, and who is actually on."
      height={870}
    >
      <TopBar title="Tonight" />
      <Screen>
        <div className="mb-4 flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3">
          <Search aria-hidden="true" className="size-icon-md text-[color:var(--text-muted)]" />
          <span className="text-sm text-[color:var(--text-placeholder)]">Search numbers, wards, scenarios</span>
        </div>
        <ShiftBand />
        <CoverStrip />
        <section className="mb-4">
          <ModuleLabel>Call first</ModuleLabel>
          <div className="grid grid-cols-2 gap-2">
            <CallCard title="Nurse manager" number="0000 000 001" label="Direct" availability="Always" />
            <CallCard title="Switchboard" number="0000 000 009" label="Direct" availability="Always" />
          </div>
        </section>
        <section>
          <ModuleLabel action={<>All contacts</>}>Your wards</ModuleLabel>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              ["Ward One", "0001"],
              ["Ward Two", "0002"],
              ["Emergency", "0003"],
            ].map(([ward, ext]) => (
              <span
                key={ward}
                className="grid min-h-tap w-28 shrink-0 content-center gap-0.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-2"
              >
                <span className="truncate text-xs font-semibold text-[color:var(--text-heading)]">{ward}</span>
                <span className="nums text-sm font-bold text-[color:var(--text)]">{ext}</span>
                <span className="text-3xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">Ext</span>
              </span>
            ))}
          </div>
        </section>
      </Screen>
    </PhoneFrame>
  );
}

/* ═══════════════════  board B — the contacts row  ═══════════════════ */

type ContactRow = {
  title: string;
  role: string;
  number: string | null;
  numberLabel: string;
  state?: "overdue" | "private";
};

const CONTACTS: ContactRow[] = [
  {
    title: "Bed management, after hours",
    role: "Patient flow",
    number: "0000 000 005",
    numberLabel: "Direct",
    state: "overdue",
  },
  {
    title: "Nurse manager, after hours",
    role: "Site co-ordinator · always",
    number: "0000 000 001",
    numberLabel: "Direct",
  },
  { title: "Registrar on call", role: "Psychiatry · from 17:00", number: "0000 000 002", numberLabel: "After hours" },
  { title: "Hospital switchboard", role: "For anyone off this list", number: "0000 000 009", numberLabel: "Direct" },
  { title: "Consultant, personal mobile", role: "Psychiatry", number: null, numberLabel: "", state: "private" },
  { title: "Demo Ward One", role: "Nurses' station", number: "0001", numberLabel: "Ext" },
];

/**
 * One contact, rebuilt around the two things the shipped row gets wrong.
 *
 * **The name gets the width.** Today the title shares one line with the number
 * and two round controls, so "Demo bed management, after hours" renders as
 * "Demo bed manageme…". The name is how you know you are ringing the right
 * desk; the number is a string of digits you are about to tap, not read. So the
 * name takes the full row width on its own line and the number sits beneath it,
 * where nothing competes for the space.
 *
 * **Every row ends at the same x.** The trailing column is a fixed width and is
 * always present — the dial and copy controls simply go quiet when a row has no
 * number — so the list has a right-hand edge to scan down. Today a row without
 * a copy button is 58px narrower than the row above it and the list reads as
 * ragged.
 *
 * Freshness is a left rule and one word rather than a pill: the pill is wider
 * than some contact names at 390px, and it was pushing the title into a second
 * truncated line to announce a maintenance fact.
 */
function ContactRowCard({ row }: { row: ContactRow }) {
  const overdue = row.state === "overdue";
  const isPrivate = row.state === "private";
  return (
    <div
      className={`flex items-stretch gap-2.5 rounded-lg border bg-[color:var(--surface-raised)] p-2.5 shadow-[var(--e1)] ${
        overdue ? "border-[color:var(--warning)]" : "border-[color:var(--border)]"
      }`}
    >
      {overdue ? (
        <span aria-hidden="true" className="-my-2.5 w-1 shrink-0 rounded-pill bg-[color:var(--warning)]" />
      ) : null}
      <span className="min-w-0 flex-1 self-center">
        <span className="block text-sm font-bold leading-5 text-[color:var(--text-heading)]">{row.title}</span>
        <span className="block text-xs text-[color:var(--text-muted)]">{row.role}</span>
        {row.number ? (
          <span className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
            <span className="nums whitespace-nowrap text-base font-bold tracking-display text-[color:var(--text)]">
              {row.number}
            </span>
            <span className="whitespace-nowrap text-2xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
              {row.numberLabel}
            </span>
          </span>
        ) : null}
        {overdue ? (
          <span className="mt-1 inline-flex items-center gap-1 text-2xs font-bold text-[color:var(--warning)]">
            <ShieldAlert aria-hidden="true" className="size-icon-xs" />
            Never checked · confirm
          </span>
        ) : null}
        {isPrivate ? (
          <span className="mt-1 inline-flex items-center gap-1 text-2xs font-bold text-[color:var(--text-muted)]">
            <Lock aria-hidden="true" className="size-icon-xs" />
            Private · only you
          </span>
        ) : null}
      </span>
      {/* Fixed trailing column: present on every row, so the list has one
          right-hand edge. Controls go quiet rather than disappearing. */}
      <span className="flex w-[104px] shrink-0 items-center justify-end gap-2">
        {row.number ? (
          <>
            <span
              role="img"
              aria-label={`Copy ${row.title}`}
              className="grid size-11 place-items-center rounded-pill border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]"
            >
              <Copy aria-hidden="true" className="size-icon-sm" />
            </span>
            <DialButton label={`Call ${row.title}`} />
          </>
        ) : (
          <span className="text-2xs text-[color:var(--text-soft)]">Sign in</span>
        )}
      </span>
    </div>
  );
}

function BoardContacts() {
  return (
    <PhoneFrame
      caption="B · Contacts — the row, rebuilt"
      note="Name gets the full width; every row ends at the same x; freshness is a rule and a word, not a pill wider than the contact."
      height={780}
    >
      <TopBar title="Contacts" />
      <div className="flex shrink-0 gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface-chrome)] px-4">
        {["Tonight", "Wards", "Services"].map((tab, index) => (
          <span
            key={tab}
            className={`border-b-2 py-2.5 text-sm font-semibold ${
              index === 0
                ? "border-[color:var(--clinical-accent)] text-[color:var(--text-heading)]"
                : "border-transparent text-[color:var(--text-muted)]"
            }`}
          >
            {tab}
          </span>
        ))}
      </div>
      <Screen>
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-[color:var(--warning)] bg-[color:var(--warning-soft)] p-2.5">
          <span className="flex items-center gap-2 text-xs font-semibold text-[color:var(--warning-text)]">
            <ShieldAlert aria-hidden="true" className="size-icon-md shrink-0" />1 number has never been checked
          </span>
          <span className="shrink-0 rounded-sm border border-[color:var(--warning)] px-2 py-1 text-2xs font-bold text-[color:var(--warning-text)]">
            Confirm all
          </span>
        </div>
        <ModuleLabel>On tonight</ModuleLabel>
        <div className="grid gap-1.5">
          {CONTACTS.map((row) => (
            <ContactRowCard key={row.title} row={row} />
          ))}
        </div>
      </Screen>
    </PhoneFrame>
  );
}

/* ═══════════════════  board C — the live ladder  ═══════════════════ */

type LadderStep = {
  order: number;
  who: string;
  when: string;
  number: string | null;
  state: "done" | "active" | "waiting";
  at?: string;
};

const LADDER: LadderStep[] = [
  {
    order: 1,
    who: "Nurse in charge, on the ward",
    when: "First, before any call.",
    number: "0001",
    state: "done",
    at: "02:11",
  },
  {
    order: 2,
    who: "Registrar on call",
    when: "If it is unresolved after five minutes.",
    number: "0000 000 002",
    state: "active",
    at: "02:14",
  },
  {
    order: 3,
    who: "Consultant on call",
    when: "If the registrar is unreachable for ten minutes, or the registrar asks you to.",
    number: "0000 000 007",
    state: "waiting",
  },
];

/**
 * The escalation ladder as something you work down, not a list you read.
 *
 * Three changes, each from a defect on the shipped page:
 *
 *  - **The condition is never truncated.** "If the registrar is unreachable for
 *    ten minute…" is the exact half of the sentence that decides whether you
 *    are allowed to make the next call. It wraps.
 *  - **A phone glyph only where there is a phone.** Today every step wears one,
 *    including "Ward clerk" with no number attached, which advertises a dial
 *    that is not there.
 *  - **The clock is the product.** Once you tap step 2 the step stamps the time
 *    and the next step names the moment it becomes available — "escalate from
 *    02:19". That single line is the difference between a ladder as a policy
 *    document and a ladder as a tool. Local to the browser, no record kept, no
 *    patient anywhere near it.
 */
function LadderStepRow({ step }: { step: LadderStep }) {
  const active = step.state === "active";
  return (
    <div className="flex gap-2.5">
      <div className="flex w-8 shrink-0 flex-col items-center">
        <span
          className={`grid size-8 place-items-center rounded-pill text-xs font-bold ${
            step.state === "done"
              ? "bg-[color:var(--success-soft)] text-[color:var(--success-text)]"
              : active
                ? "bg-[color:var(--command)] text-[color:var(--command-contrast)]"
                : "border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]"
          }`}
        >
          {step.order}
        </span>
        {step.order < LADDER.length ? (
          <span aria-hidden="true" className="mt-1 w-px flex-1 bg-[color:var(--border)]" />
        ) : null}
      </div>
      <div
        className={`mb-2 min-w-0 flex-1 rounded-lg border p-3 ${
          active
            ? "border-[color:var(--command)] bg-[color:var(--surface-raised)] shadow-[var(--e2)]"
            : "border-[color:var(--border)] bg-[color:var(--surface-raised)]"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold leading-5 text-[color:var(--text-heading)]">{step.who}</p>
            {/* Wraps. This sentence is the permission to make the next call. */}
            <p className="mt-0.5 text-xs leading-5 text-[color:var(--text)]">{step.when}</p>
          </div>
          {step.number ? <DialButton label={`Call ${step.who}`} tone={active ? "command" : "quiet"} /> : null}
        </div>
        {step.number ? (
          <p className="nums mt-1.5 text-xs font-bold text-[color:var(--text-muted)]">{step.number}</p>
        ) : null}
        {step.at ? (
          <p className="nums mt-1.5 inline-flex items-center gap-1 rounded-sm bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-2xs font-bold text-[color:var(--text-muted)]">
            <PhoneOutgoing aria-hidden="true" className="size-icon-xs" />
            Called {step.at}
          </p>
        ) : null}
        {step.state === "waiting" ? (
          <p className="nums mt-1.5 inline-flex items-center gap-1 rounded-sm bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-2xs font-bold text-[color:var(--text-muted)]">
            <AlarmClock aria-hidden="true" className="size-icon-xs" />
            Escalate from 02:24
          </p>
        ) : null}
      </div>
    </div>
  );
}

function BoardLadder() {
  return (
    <PhoneFrame
      caption="C · Playbook — the ladder you work down"
      note="Conditions wrap in full, dial affordances appear only where a number exists, and the page keeps the clock so you know when you may escalate."
      height={860}
    >
      <TopBar title="Playbook" />
      <Screen>
        <div className="mb-3">
          <p className="text-base font-bold text-[color:var(--text-heading)]">Waking the consultant overnight</p>
          <p className="text-xs leading-5 text-[color:var(--text-muted)]">
            Administrative escalation order. Not clinical advice.
          </p>
        </div>
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5">
          <AlarmClock aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
          <p className="nums text-xs leading-5 text-[color:var(--text)]">
            Started 02:11 · on step 2 of 3 · this stays on your phone and is cleared when the shift ends.
          </p>
        </div>
        <ModuleLabel>Escalation</ModuleLabel>
        <div>
          {LADDER.map((step) => (
            <LadderStepRow key={step.order} step={step} />
          ))}
        </div>
        <ModuleLabel>Local guidance</ModuleLabel>
        {/* One line, not five. The long paragraph appears once on the page, in
            the footer below, rather than repeating verbatim under every
            scenario — which at two scenarios was already most of the screen. */}
        <div className="flex min-h-tap items-center gap-2.5 rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] px-3">
          <FileText aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
          <span className="min-w-0 flex-1 text-xs font-semibold text-[color:var(--text)]">
            No local guideline linked
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[color:var(--clinical-accent)]">
            Search
            <ArrowRight aria-hidden="true" className="size-icon-xs" />
          </span>
        </div>
        <p className="mt-2 text-2xs leading-4 text-[color:var(--text-muted)]">
          This page never substitutes its own clinical advice. Guidance appears only as a link to a document in your own
          library.
        </p>
      </Screen>
    </PhoneFrame>
  );
}

/* ═══════════════════  board D — the pocket card  ═══════════════════ */

const CARD_BLOCKS: Array<{ heading: string; rows: Array<[string, string]> }> = [
  {
    heading: "Call first",
    rows: [
      ["Nurse manager, after hours", "0000 000 001"],
      ["Registrar on call", "0000 000 002"],
      ["Switchboard", "0000 000 009"],
    ],
  },
  {
    heading: "Wards",
    rows: [
      ["Ward One", "Ext 0001"],
      ["Ward Two", "Ext 0002"],
      ["Emergency", "Ext 0003"],
    ],
  },
  {
    heading: "Services",
    rows: [
      ["Interpreter line", "0000 000 004"],
      ["Bed management", "0000 000 005"],
    ],
  },
];

/**
 * The pocket card, at the size it is actually carried.
 *
 * The finding that drove this board is not a design one. `CARD_NUMBER_FIELDS`
 * in `on-call-card.tsx` reads `phone`, `afterHoursPhone`, `pager` and `fax` —
 * and not `extension`. Wards store their number in `extension` and nothing
 * else, so all three demo wards print as a title and a subtitle with no number
 * on them at all. It is the same omission the Contacts list already fixed and
 * wrote a comment about; the card never got the fix.
 *
 * The design change beside it: two columns at the width of a lanyard card, so
 * the whole thing is one side of one piece of paper rather than a scrolling
 * page that prints to two. A QR to the live page is the honest answer to paper
 * going stale — the card cannot update, but it can carry the way back to the
 * thing that does.
 */
function BoardCard() {
  return (
    <PhoneFrame
      caption="D · Pocket card — one side of one card"
      note="Includes extensions, which the shipped card silently drops; two columns so it prints to one side; a QR back to the live page."
      height={600}
    >
      <TopBar title="Pocket card" />
      <Screen>
        <div className="rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] p-3">
          <div className="flex items-start justify-between gap-2 border-b border-[color:var(--border)] pb-2">
            <div>
              <p className="text-2xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
                On call · Demo Hospital
              </p>
              <p className="text-base font-bold text-[color:var(--text-heading)]">Essentials card</p>
              <p className="nums text-2xs text-[color:var(--text-muted)]">Printed 19 Sep 2026 · checked 16 Sep</p>
            </div>
            <span className="grid size-12 shrink-0 place-items-center rounded-sm border border-[color:var(--border)] bg-[color:var(--surface-subtle)]">
              <QrCode aria-hidden="true" className="size-icon-lg text-[color:var(--text-muted)]" />
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2.5">
            {CARD_BLOCKS.map((block) => (
              <div key={block.heading} className="min-w-0">
                <p className="text-3xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
                  {block.heading}
                </p>
                <ul className="mt-1 grid gap-1">
                  {block.rows.map(([name, number]) => (
                    <li key={name} className="min-w-0">
                      <span className="block text-2xs font-semibold leading-4 text-[color:var(--text-heading)]">
                        {name}
                      </span>
                      <span className="nums block text-xs font-bold text-[color:var(--text)]">{number}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="min-w-0">
              <p className="text-3xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">Ladder</p>
              <ol className="nums mt-1 grid gap-0.5 text-2xs text-[color:var(--text)]">
                <li>1 · Nurse in charge</li>
                <li>2 · Registrar, after 5 min</li>
                <li>3 · Consultant, after 10 min</li>
              </ol>
            </div>
          </div>
          <p className="mt-2.5 border-t border-[color:var(--border)] pt-2 text-3xs leading-4 text-[color:var(--text-muted)]">
            Personal numbers and anything unconfirmed for a year are never printed. Paper cannot show its own age — scan
            the code for the live list.
          </p>
        </div>
        <p className="mt-3 rounded-lg border border-[color:var(--danger)] bg-[color:var(--danger-soft)] p-2.5 text-2xs leading-4 text-[color:var(--danger-text)]">
          <strong className="font-bold">Defect this board exists for.</strong> The shipped card reads phone, after
          hours, pager and fax — not extension. Every ward flagged for the card prints today with no number on it.
        </p>
      </Screen>
    </PhoneFrame>
  );
}

/* ══════════════════════════  the page  ══════════════════════════ */

export function MockupPageShell({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[color:var(--background)] px-4 py-8 sm:px-8">
      <div className="mx-auto grid max-w-[1400px] gap-8">
        <header className="grid max-w-3xl gap-2">
          <p className="text-2xs font-bold uppercase tracking-kicker text-[color:var(--clinical-accent)]">{eyebrow}</p>
          <h1 className="text-2xl-minus font-bold tracking-display text-[color:var(--text-heading)]">{title}</h1>
          <p className="text-sm leading-6 text-[color:var(--text-muted)]">{summary}</p>
          <p className="text-xs leading-5 text-[color:var(--text-soft)]">
            Design scratch. Nothing is wired; every name, number and roster here is invented. Drawn at 390px in the
            app&apos;s own tokens so it survives dark mode and forced colours.
          </p>
        </header>
        {children}
      </div>
    </main>
  );
}

export function OnCallShiftCoverMockups() {
  return (
    <MockupPageShell
      eyebrow="On Call · study 1 of 2"
      title="Shift, cover and escalation"
      summary="Four boards against four findings from the shipped hub: the home never says who is on or where you are in the shift; a contact's name is truncated to make room for its number; an escalation condition is truncated on the line that grants permission to escalate; and the printed card drops every ward extension."
    >
      <div className="flex flex-wrap gap-x-6 gap-y-10">
        <BoardShiftCover />
        <BoardContacts />
        <BoardLadder />
        <BoardCard />
      </div>
    </MockupPageShell>
  );
}
