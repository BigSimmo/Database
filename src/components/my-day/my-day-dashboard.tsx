"use client";

import { ArrowLeftRight, BookPlus, Phone, Plus, Sunrise, Users, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Fragment, useId, useMemo, useState, type ReactNode } from "react";

import { focusRing } from "@/components/card-recipes";
import {
  modeModuleSurface,
  modePressable,
  modeSummaryMutedText,
  modeSummarySurface,
  modeTapArea,
} from "@/components/mode-kit/recipes";
import { modeDisplayNumberText, modeNameText, modeSecondaryText } from "@/components/mode-kit/type";
import { listNames, MyDayItemRow } from "@/components/my-day/my-day-page-parts";
import { useMyDayDeviceState } from "@/components/my-day/my-day-device-state";
import type { MyDayDashboardSources } from "@/components/my-day/use-my-day-dashboard-sources";
import { kindOf } from "@/components/roster/roster-format";
import { RosterLetter } from "@/components/roster/roster-week-strip";
import { ActionStrip } from "@/components/teaching/teaching-actions";
import { sessionHref } from "@/components/teaching/teaching-view-model";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/link";
import { cn, eyebrowText } from "@/components/ui-primitives";
import {
  daysUntil,
  dueCountsByDate,
  formatCountdown,
  formatRingFigure,
  MY_DAY_CARD_LABELS,
  MY_DAY_CARD_SPAN,
  myDayCardIds,
  selectNeedsYou,
  selectUpNext,
  snoozeUntil,
  weekOf,
  type MyDayCardId,
  type MyDayTimedEvent,
} from "@/lib/my-day/dashboard";
import { duePerthDate } from "@/lib/my-day/merge";
import type { MyDayItem, MyDayNextRenewal } from "@/lib/my-day/model";
import { SHIFT_KIND_LABEL, type ShiftKind } from "@/lib/roster/shift-kind";
import { formatPerthDay, perthDateOf, perthTimeOf } from "@/lib/roster/shifts/perth-time";
import { summariseToday } from "@/lib/roster/today";
import type { RosterDisplayShift } from "@/lib/roster/team/team-view";
import type { SessionSummary } from "@/lib/teaching/model";

/**
 * My Day as a dashboard of cards (the owner's chosen "modular dashboard").
 * Phone first: full cards span both columns and half cards sit in pairs; from
 * `lg` the grid has four columns. Every card reads an existing source and
 * hides itself when that source has nothing to show. "Edit" hides or restores
 * cards; the choice stays on this device for this account only.
 *
 * Read-only towards the server: the only action here that changes anything is
 * "Later", which moves a row to tomorrow on this device and can be undone.
 */

const SPAN_CLASS = { full: "col-span-2", half: "col-span-1" } as const;
const HOUR_MS = 60 * 60 * 1000;

const QUICK_ACTIONS: readonly { readonly label: string; readonly href: string; readonly icon: LucideIcon }[] = [
  { label: "Call", href: "/on-call/call", icon: Phone },
  { label: "Handover", href: "/on-call/service", icon: ArrowLeftRight },
  { label: "Log CPD", href: "/cme/new", icon: BookPlus },
  { label: "Who's on", href: "/on-call/whos-on", icon: Users },
];

export interface MyDayDashboardProps {
  readonly now: Date;
  readonly today: string;
  /** The merged items, with any invented ones already removed for a signed-in reader. */
  readonly items: readonly MyDayItem[];
  readonly nextRenewal: MyDayNextRenewal | null;
  readonly sources: MyDayDashboardSources;
  /** Names of the My Day sources that were checked, for the empty "Needs you" line. */
  readonly checked: readonly string[];
  readonly editing: boolean;
  readonly onShowAll: () => void;
  readonly onRetry: () => void;
}

function shiftEvent(shift: RosterDisplayShift): MyDayTimedEvent {
  const kind = kindOf(shift);
  return {
    id: `shift:${shift.id}`,
    source: "shift",
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
    title: kind === "on_call" ? "On call" : `${SHIFT_KIND_LABEL[kind]} shift`,
    where: [shift.workplace ?? shift.location ?? shift.teamName, `until ${perthTimeOf(shift.endsAt)}`]
      .filter(Boolean)
      .join(" · "),
    href: "/roster",
    actionLabel: "Open Roster",
  };
}

function teachingEvent(session: SessionSummary): MyDayTimedEvent {
  return {
    id: `teaching:${session.occurrenceId}`,
    source: "teaching",
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    title: session.title,
    where: [session.isPresenter ? "You're presenting" : null, session.venue].filter(Boolean).join(" · "),
    href: sessionHref(session) ?? "/teaching/week",
    actionLabel: "Open",
  };
}

/** The card frame: a heading, an optional aside, and in edit mode a Hide button. */
function DashboardCard({
  id,
  editing,
  onHide,
  aside,
  summary = false,
  children,
}: {
  readonly id: MyDayCardId;
  readonly editing: boolean;
  readonly onHide: (id: MyDayCardId) => void;
  readonly aside?: ReactNode;
  readonly summary?: boolean;
  readonly children: ReactNode;
}) {
  const headingId = useId();
  const label = MY_DAY_CARD_LABELS[id];
  return (
    <section
      aria-labelledby={headingId}
      data-testid={`my-day-card-${id}`}
      className={cn(
        SPAN_CLASS[MY_DAY_CARD_SPAN[id]],
        "grid min-w-0 content-start gap-2 p-3",
        summary ? modeSummarySurface : cn(modeModuleSurface, "overflow-visible"),
      )}
    >
      <div className="flex min-h-6 min-w-0 items-center justify-between gap-2">
        <h2 id={headingId} className={cn(eyebrowText, summary && modeSummaryMutedText)}>
          {label}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          {aside}
          {editing ? (
            <button
              type="button"
              onClick={() => onHide(id)}
              aria-label={`Hide ${label}`}
              data-testid={`my-day-hide-${id}`}
              className={cn(
                modeTapArea,
                focusRing,
                "-my-3 -mr-3 rounded-md",
                summary ? "text-[color:var(--surface-summary-ink)]" : "text-[color:var(--text-muted)]",
              )}
            >
              <X aria-hidden="true" className="size-icon-md" />
            </button>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function UpNextCard({
  event,
  state,
  now,
  editing,
  onHide,
}: {
  readonly event: MyDayTimedEvent;
  readonly state: "upcoming" | "on-now";
  readonly now: Date;
  readonly editing: boolean;
  readonly onHide: (id: MyDayCardId) => void;
}) {
  const countdown =
    state === "upcoming"
      ? formatCountdown(Date.parse(event.startsAt) - now.getTime())
      : formatCountdown(Date.parse(event.endsAt) - now.getTime());
  const visible = state === "upcoming" ? `in ${countdown.short}` : `On now · ${countdown.short} left`;
  const spoken =
    state === "upcoming"
      ? `Starts in ${countdown.spoken}, at ${perthTimeOf(event.startsAt)}.`
      : `On now, ends in ${countdown.spoken}.`;
  return (
    <DashboardCard
      id="up-next"
      editing={editing}
      onHide={onHide}
      summary
      aside={
        <span className={cn("nums text-sm", modeSummaryMutedText)} aria-hidden="true">
          {visible}
        </span>
      }
    >
      <div className="grid gap-0.5" data-testid="my-day-up-next">
        <p className="sr-only">{spoken}</p>
        <p className="flex flex-wrap items-baseline gap-x-2" aria-hidden="true">
          <span className={cn(modeDisplayNumberText, "text-hero text-[color:var(--surface-summary-ink)]")}>
            {perthTimeOf(event.startsAt)}
          </span>
          <span className={cn("nums text-base-minus", modeSummaryMutedText)}>{`–${perthTimeOf(event.endsAt)}`}</span>
        </p>
        <p className={cn(modeNameText, "break-words text-base-minus text-[color:var(--surface-summary-ink)]")}>
          {event.title}
        </p>
        {event.where ? <p className={cn("break-words text-sm", modeSummaryMutedText)}>{event.where}</p> : null}
      </div>
      <ActionStrip
        surface="summary"
        actions={[
          {
            id: "open",
            label: event.actionLabel,
            href: event.href,
            emphasis: "primary",
            testId: "my-day-up-next-open",
          },
        ]}
      />
    </DashboardCard>
  );
}

const RING_RADIUS = 27;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function CountdownRing({ fraction, figure }: { readonly fraction: number; readonly figure: string }) {
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <span className="relative mx-auto grid size-24 place-items-center" aria-hidden="true" data-mode-identity="roster">
      <svg viewBox="0 0 64 64" className="absolute inset-0 size-full -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="6"
          className="stroke-[color:var(--surface-subtle)]"
        />
        <circle
          cx="32"
          cy="32"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - clamped)}
          data-testid="my-day-shift-ring"
          className="stroke-[color:var(--mode-identity)] motion-safe:transition-[stroke-dashoffset] motion-safe:duration-[var(--duration-slow)]"
        />
      </svg>
      <span className={cn(modeDisplayNumberText, "relative text-xl text-[color:var(--text-heading)]")}>{figure}</span>
    </span>
  );
}

function ShiftCard({
  shift,
  running,
  now,
  editing,
  onHide,
}: {
  readonly shift: RosterDisplayShift;
  readonly running: boolean;
  readonly now: Date;
  readonly editing: boolean;
  readonly onHide: (id: MyDayCardId) => void;
}) {
  const kind: ShiftKind = kindOf(shift);
  const name = kind === "on_call" ? "On call" : `${SHIFT_KIND_LABEL[kind]} shift`;
  const start = Date.parse(shift.startsAt);
  const end = Date.parse(shift.endsAt);
  const at = now.getTime();
  const remaining = running ? end - at : start - at;
  // Running: the ring empties as the shift runs down. Before: it fills over the last 12 hours.
  const fraction = running ? remaining / Math.max(1, end - start) : 1 - Math.min(1, remaining / (12 * HOUR_MS));
  const countdown = formatCountdown(remaining);
  const startDay = perthDateOf(shift.startsAt);
  const endDay = perthDateOf(shift.endsAt);
  const today = perthDateOf(now);
  const startLine = running
    ? `${name} until ${perthTimeOf(shift.endsAt)}`
    : `${name} starts ${startDay === today ? "" : `${formatPerthDay(startDay)} `}${perthTimeOf(shift.startsAt)}`;
  const endLine = `Ends ${perthTimeOf(shift.endsAt)}${endDay === startDay ? "" : ` ${formatPerthDay(endDay)}`}`;
  const spoken = running
    ? `${name} on now, ${countdown.spoken} left. ${endLine}.`
    : `${countdown.spoken} until your ${name.toLowerCase()} starts, ${formatPerthDay(startDay)} at ${perthTimeOf(shift.startsAt)}. ${endLine}.`;
  return (
    <DashboardCard id="shift" editing={editing} onHide={onHide}>
      <Link
        href="/roster"
        data-testid="my-day-shift"
        className={cn(focusRing, modePressable, "-m-1 grid min-h-12 gap-1 rounded-md p-1 no-underline")}
      >
        <span className="sr-only">{spoken}</span>
        <CountdownRing fraction={fraction} figure={formatRingFigure(remaining)} />
        <span aria-hidden="true" className={cn(modeSecondaryText, "text-center")}>
          {running ? "Time left" : name}
          <br />
          {startLine}
          <br />
          {endLine}
        </span>
      </Link>
    </DashboardCard>
  );
}

function QuickActionsCard({
  editing,
  onHide,
}: {
  readonly editing: boolean;
  readonly onHide: (id: MyDayCardId) => void;
}) {
  return (
    <DashboardCard id="quick-actions" editing={editing} onHide={onHide}>
      <ul role="list" className="grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map(({ label, href, icon: ActionIcon }) => (
          <li key={label} className="min-w-0">
            <Link
              href={href}
              className={cn(
                focusRing,
                modePressable,
                "grid min-h-16 place-items-center gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-1 py-2 text-center text-xs font-medium text-[color:var(--text-heading)] no-underline",
              )}
            >
              <ActionIcon aria-hidden="true" className="size-icon-md text-[color:var(--text-muted)]" />
              <span className="break-words">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

const WEEKDAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"] as const;

interface AgendaLine {
  readonly key: string;
  readonly at: number;
  readonly time: string;
  readonly text: string;
  readonly past: boolean;
}

function ThisWeekCard({
  week,
  today,
  kindsByDate,
  dueByDate,
  agenda,
  editing,
  onHide,
}: {
  readonly week: readonly string[];
  readonly today: string;
  /** Null when no roster is available: then no letter is drawn, rather than a false "nothing on". */
  readonly kindsByDate: ReadonlyMap<string, readonly ShiftKind[]> | null;
  readonly dueByDate: ReadonlyMap<string, number>;
  readonly agenda: readonly AgendaLine[];
  readonly editing: boolean;
  readonly onHide: (id: MyDayCardId) => void;
}) {
  return (
    <DashboardCard
      id="this-week"
      editing={editing}
      onHide={onHide}
      aside={
        <TextLink href="/roster/shifts" className="inline-flex min-h-12 items-center px-1 text-sm">
          Calendar
        </TextLink>
      }
    >
      <ol className="grid grid-cols-7 gap-1" data-testid="my-day-week">
        {week.map((date) => {
          const kinds = kindsByDate?.get(date) ?? [];
          const due = dueByDate.get(date) ?? 0;
          const isToday = date === today;
          const words = [
            kindsByDate
              ? kinds.length
                ? kinds.map((kind) => SHIFT_KIND_LABEL[kind]).join(" and ")
                : "Nothing on"
              : "",
            due ? `${due} due` : "",
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <li
              key={date}
              aria-current={isToday ? "date" : undefined}
              aria-label={words ? `${formatPerthDay(date)}: ${words}` : formatPerthDay(date)}
              className="grid justify-items-center gap-1"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "nums text-xs leading-4",
                  isToday ? "font-semibold text-[color:var(--text-heading)]" : "text-[color:var(--text-muted)]",
                )}
              >
                {WEEKDAY_LETTER[new Date(`${date}T00:00:00Z`).getUTCDay()]}
              </span>
              <span
                aria-hidden="true"
                data-mode-identity={isToday ? "roster" : undefined}
                className={cn(
                  "nums grid size-6 place-items-center rounded-full text-xs",
                  isToday
                    ? "bg-[color:var(--mode-identity)] text-[color:var(--mode-identity-contrast)] forced-colors:border"
                    : "text-[color:var(--text-muted)]",
                )}
              >
                {Number(date.slice(8, 10))}
              </span>
              {kindsByDate ? <RosterLetter kind={kinds[0] ?? null} /> : null}
              <span
                aria-hidden="true"
                data-testid={due ? `my-day-week-due-${date}` : undefined}
                className={cn(
                  "size-1.5 rounded-full",
                  due ? "bg-[color:var(--warning)] forced-colors:bg-[CanvasText]" : "bg-transparent",
                )}
              />
            </li>
          );
        })}
      </ol>
      {agenda.length > 0 ? (
        <div className="grid gap-1 border-t border-[color:var(--border)] pt-2">
          <h3 className={eyebrowText}>Today</h3>
          <ul role="list" className="grid gap-1" data-testid="my-day-agenda">
            {agenda.map((line) => (
              <li
                key={line.key}
                className={cn(
                  "grid grid-cols-[3rem_minmax(0,1fr)] gap-2 text-sm",
                  line.past ? "text-[color:var(--text-muted)]" : "text-[color:var(--text)]",
                )}
              >
                <span className="nums font-medium">{line.time}</span>
                <span className="break-words">
                  {line.text}
                  {line.past ? <span className="sr-only"> (finished)</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </DashboardCard>
  );
}

function NeedsYouCard({
  items,
  now,
  today,
  checked,
  editing,
  onHide,
  onShowAll,
  onRetry,
}: {
  readonly items: readonly MyDayItem[];
  readonly now: Date;
  readonly today: string;
  readonly checked: readonly string[];
  readonly editing: boolean;
  readonly onHide: (id: MyDayCardId) => void;
  readonly onShowAll: () => void;
  readonly onRetry: () => void;
}) {
  const device = useMyDayDeviceState(today);
  const [undo, setUndo] = useState<{ readonly id: string; readonly title: string } | null>(null);
  const { shown, waiting, total } = selectNeedsYou(items, device.snoozes, today);
  const later = (item: MyDayItem) => {
    device.snooze(item.id, snoozeUntil(now));
    setUndo({ id: item.id, title: item.title });
  };
  const moved = total - waiting;

  let body: ReactNode;
  if (total === 0) {
    body = (
      <div data-testid="my-day-empty">
        {checked.length > 0 ? (
          <EmptyState icon={Sunrise} title="Nothing needs you right now" body={`Checked ${listNames(checked)}.`} />
        ) : (
          <EmptyState
            icon={Sunrise}
            title="Couldn't check your day"
            body="No source could be checked just now."
            actions={
              <Button variant="secondary" onClick={onRetry}>
                Retry
              </Button>
            }
          />
        )}
      </div>
    );
  } else if (shown.length === 0) {
    body = (
      <p className={modeSecondaryText} data-testid="my-day-needs-you-snoozed">
        {`Nothing else needs you today. ${moved} moved to tomorrow.`}
      </p>
    );
  } else {
    body = (
      <ul role="list" className="-mx-3 grid">
        {shown.map((item) => (
          <MyDayItemRow
            key={item.id}
            item={item}
            now={now}
            action={
              <button
                type="button"
                onClick={() => later(item)}
                aria-label={`Later: ${item.title}`}
                data-testid={`my-day-later-${item.id}`}
                className={cn(
                  modeTapArea,
                  focusRing,
                  "rounded-md px-2 text-sm font-medium text-[color:var(--clinical-accent)]",
                )}
              >
                Later
              </button>
            }
          />
        ))}
      </ul>
    );
  }

  return (
    <DashboardCard
      id="needs-you"
      editing={editing}
      onHide={onHide}
      aside={
        <>
          {waiting > 0 && waiting !== total ? (
            <span className="nums text-sm text-[color:var(--text-muted)]" data-testid="my-day-needs-you-count">
              <span className="sr-only">Waiting: </span>
              {waiting}
            </span>
          ) : null}
          {total > 0 ? (
            <button
              type="button"
              onClick={onShowAll}
              data-testid="my-day-show-all"
              className={cn(
                modeTapArea,
                focusRing,
                "rounded-md px-2 text-sm font-medium text-[color:var(--clinical-accent)]",
              )}
            >
              {`All ${total}`}
            </button>
          ) : null}
        </>
      }
    >
      {body}
      <div role="status" className="empty:hidden">
        {undo ? (
          <div
            className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md bg-[color:var(--surface-subtle)] px-3"
            data-testid="my-day-undo"
          >
            <span className="min-w-0 break-words text-sm text-[color:var(--text)]">{`Moved to tomorrow: ${undo.title}`}</span>
            <button
              type="button"
              onClick={() => {
                device.unsnooze(undo.id);
                setUndo(null);
              }}
              className={cn(
                modeTapArea,
                focusRing,
                "rounded-md px-2 text-sm font-medium text-[color:var(--clinical-accent)]",
              )}
            >
              Undo
            </button>
          </div>
        ) : null}
      </div>
    </DashboardCard>
  );
}

function CpdCard({
  loggedHours,
  targetHours,
  editing,
  onHide,
}: {
  readonly loggedHours: number;
  readonly targetHours: number;
  readonly editing: boolean;
  readonly onHide: (id: MyDayCardId) => void;
}) {
  const hours = (value: number) => Number(value.toFixed(1)).toString();
  const left = Math.max(0, targetHours - loggedHours);
  const percent = Math.min(100, Math.round((loggedHours / targetHours) * 100));
  return (
    <DashboardCard id="cpd" editing={editing} onHide={onHide}>
      <Link
        href="/cme"
        data-testid="my-day-cpd"
        className={cn(focusRing, modePressable, "-m-1 grid min-h-12 gap-1.5 rounded-md p-1 no-underline")}
      >
        <span className="sr-only">{`${hours(loggedHours)} of ${hours(targetHours)} CPD hours logged this year.`}</span>
        <span aria-hidden="true" className="flex items-baseline gap-1">
          <span className={cn(modeDisplayNumberText, "text-2xl text-[color:var(--text-heading)]")}>
            {hours(loggedHours)}
          </span>
          <span className={modeSecondaryText}>{`/ ${hours(targetHours)} h`}</span>
        </span>
        <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-subtle)]">
          <span
            className="block h-full rounded-full bg-[color:var(--clinical-accent)] forced-colors:bg-[CanvasText]"
            style={{ width: `${percent}%` }}
          />
        </span>
        <span className={modeSecondaryText}>{left > 0 ? `${hours(left)} h to go by 31 Dec` : "Target reached"}</span>
      </Link>
    </DashboardCard>
  );
}

function RenewalCard({
  renewal,
  today,
  editing,
  onHide,
}: {
  readonly renewal: MyDayNextRenewal;
  readonly today: string;
  readonly editing: boolean;
  readonly onHide: (id: MyDayCardId) => void;
}) {
  const days = daysUntil(renewal.date, today);
  const figure = days === 0 ? "Today" : `${days} d`;
  const spoken = days === 0 ? "today" : days === 1 ? "in 1 day" : `in ${days} days`;
  return (
    <DashboardCard id="renewal" editing={editing} onHide={onHide}>
      <Link
        href={renewal.href}
        data-testid="my-day-renewal"
        className={cn(focusRing, modePressable, "-m-1 grid min-h-12 gap-1 rounded-md p-1 no-underline")}
      >
        <span className="sr-only">{`Next recorded date ${spoken}: ${renewal.title}, ${formatPerthDay(renewal.date)}.`}</span>
        <span aria-hidden="true" className={cn(modeDisplayNumberText, "text-2xl text-[color:var(--text-heading)]")}>
          {figure}
        </span>
        <span aria-hidden="true" className={cn(modeSecondaryText, "break-words")}>
          {`${renewal.title} · ${formatPerthDay(renewal.date)}`}
        </span>
      </Link>
    </DashboardCard>
  );
}

export function MyDayDashboard({
  now,
  today,
  items,
  nextRenewal,
  sources,
  checked,
  editing,
  onShowAll,
  onRetry,
}: MyDayDashboardProps) {
  const device = useMyDayDeviceState(today);
  const hide = (id: MyDayCardId) => device.setHidden(id, true);

  const rosterReady = sources.roster.status === "ready";
  const summary = useMemo(
    () =>
      rosterReady
        ? summariseToday(
            sources.roster.shifts.map((shift) => ({
              id: shift.id,
              startsAt: shift.startsAt,
              endsAt: shift.endsAt,
              kind: kindOf(shift),
            })),
            now,
          )
        : null,
    [rosterReady, sources.roster.shifts, now],
  );
  const byId = useMemo(() => new Map(sources.roster.shifts.map((shift) => [shift.id, shift])), [sources.roster.shifts]);

  const todaysShifts = useMemo(
    () => sources.roster.shifts.filter((shift) => kindOf(shift) !== "leave" && perthDateOf(shift.startsAt) === today),
    [sources.roster.shifts, today],
  );
  // The source hands over an empty list until its read is ready.
  const teachingSessions = sources.teaching.sessions;
  const events = useMemo(
    () => [...todaysShifts.map(shiftEvent), ...teachingSessions.map(teachingEvent)],
    [todaysShifts, teachingSessions],
  );
  const upNext = selectUpNext(events, now);

  // The Shift card: the shift on now, else the next one (today or later). Nothing ahead hides it.
  const lead = summary?.lead;
  const leadShift =
    lead && lead.state !== "empty"
      ? lead.state === "day_off"
        ? lead.next
          ? (byId.get(lead.next.id) ?? null)
          : null
        : (byId.get(lead.shift.id) ?? null)
      : null;
  const shiftRunning = lead?.state === "on_now";

  const week = useMemo(() => weekOf(today), [today]);
  const kindsByDate = useMemo(
    () => (summary ? new Map(summary.week.map((day) => [day.date, day.kinds as readonly ShiftKind[]])) : null),
    [summary],
  );
  const dueByDate = useMemo(() => dueCountsByDate(items), [items]);
  const weekHasDue = week.some((date) => (dueByDate.get(date) ?? 0) > 0);

  const agenda = useMemo<AgendaLine[]>(() => {
    const at = now.getTime();
    const lines: AgendaLine[] = [];
    for (const event of events) {
      lines.push({
        key: event.id,
        at: Date.parse(event.startsAt),
        time: perthTimeOf(event.startsAt),
        text:
          event.source === "shift"
            ? `${event.title} until ${perthTimeOf(event.endsAt)}`
            : `${event.title}${event.where.startsWith("You're presenting") ? " (you)" : ""}`,
        past: Date.parse(event.endsAt) <= at,
      });
    }
    for (const item of items) {
      if (!item.due || /^\d{4}-\d{2}-\d{2}$/.test(item.due) || duePerthDate(item.due) !== today) continue;
      const due = Date.parse(item.due);
      lines.push({ key: `item:${item.id}`, at: due, time: perthTimeOf(item.due), text: item.title, past: due <= at });
    }
    return lines.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key)).slice(0, 6);
  }, [events, items, now, today]);

  const cpd = sources.cpd;
  const visible: Record<MyDayCardId, boolean> = {
    "up-next": upNext !== null,
    shift: leadShift !== null,
    "quick-actions": true,
    "this-week": rosterReady || agenda.length > 0 || weekHasDue,
    "needs-you": true,
    cpd: cpd.status === "ready" && cpd.targetHours > 0,
    renewal: nextRenewal !== null,
  };

  const failed = [
    sources.roster.status === "failed" ? "Shifts" : null,
    sources.teaching.status === "failed" ? "Teaching sessions" : null,
    cpd.status === "failed" ? "CPD hours" : null,
  ].filter((name): name is string => name !== null);

  const cards: Record<MyDayCardId, () => ReactNode> = {
    "up-next": () =>
      upNext ? (
        <UpNextCard event={upNext.event} state={upNext.state} now={now} editing={editing} onHide={hide} />
      ) : null,
    shift: () =>
      leadShift ? (
        <ShiftCard shift={leadShift} running={shiftRunning} now={now} editing={editing} onHide={hide} />
      ) : null,
    "quick-actions": () => <QuickActionsCard editing={editing} onHide={hide} />,
    "this-week": () => (
      <ThisWeekCard
        week={week}
        today={today}
        kindsByDate={kindsByDate}
        dueByDate={dueByDate}
        agenda={agenda}
        editing={editing}
        onHide={hide}
      />
    ),
    "needs-you": () => (
      <NeedsYouCard
        items={items}
        now={now}
        today={today}
        checked={checked}
        editing={editing}
        onHide={hide}
        onShowAll={onShowAll}
        onRetry={onRetry}
      />
    ),
    cpd: () => <CpdCard loggedHours={cpd.loggedHours} targetHours={cpd.targetHours} editing={editing} onHide={hide} />,
    renewal: () =>
      nextRenewal ? <RenewalCard renewal={nextRenewal} today={today} editing={editing} onHide={hide} /> : null,
  };

  const shownIds = myDayCardIds.filter((id) => visible[id] && !device.hidden.has(id));
  const hiddenIds = myDayCardIds.filter((id) => device.hidden.has(id));

  return (
    <div className="grid gap-3" data-testid="my-day-dashboard">
      {failed.length > 0 ? (
        <p className={modeSecondaryText} data-testid="my-day-card-failed">
          {`Couldn't load ${listNames(failed)}, so ${failed.length === 1 ? "that card is" : "those cards are"} not shown.`}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-editing={editing ? "" : undefined}>
        {shownIds.map((id) => (
          <Fragment key={id}>{cards[id]()}</Fragment>
        ))}
      </div>
      {shownIds.length === 0 && !editing ? (
        <p className={modeSecondaryText} data-testid="my-day-all-hidden">
          Every card is hidden. Choose Edit to bring them back.
        </p>
      ) : null}
      {editing ? (
        <div className="grid gap-2" data-testid="my-day-hidden-cards">
          <p className={modeSecondaryText}>
            {hiddenIds.length > 0
              ? "Hidden cards. Choose one to bring it back."
              : "Choose × on a card to hide it. Hidden cards wait here."}
          </p>
          {hiddenIds.length > 0 ? (
            <ul role="list" className="flex flex-wrap gap-2">
              {hiddenIds.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => device.setHidden(id, false)}
                    aria-label={`Show ${MY_DAY_CARD_LABELS[id]}`}
                    data-testid={`my-day-restore-${id}`}
                    className={cn(
                      focusRing,
                      "inline-flex min-h-12 items-center gap-1 rounded-full border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] px-4 text-sm font-medium text-[color:var(--text)]",
                    )}
                  >
                    <Plus aria-hidden="true" className="size-icon-sm" />
                    {MY_DAY_CARD_LABELS[id]}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
