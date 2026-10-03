"use client";

import { BookPlus, CalendarDays, ChevronLeft, ChevronRight, GraduationCap, Phone, Sunrise, Users } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

import { focusRing } from "@/components/card-recipes";
import { DashCard } from "@/components/dashboard-kit/dash-card";
import { IconChip, type DashTint } from "@/components/dashboard-kit/icon-chip";
import { DashItemList, DashItemRow } from "@/components/dashboard-kit/item-row";
import { DashPill } from "@/components/dashboard-kit/pill";
import { DashQuickActions, type DashQuickAction } from "@/components/dashboard-kit/quick-actions";
import { dashFigure, dashLink, dashMuted } from "@/components/dashboard-kit/recipes";
import { ProgressRing, RingStack } from "@/components/dashboard-kit/rings";
import { DashSegmented } from "@/components/dashboard-kit/segmented";
import { DashWeekTiles, type DashDayTileKind, type DashWeekDay } from "@/components/dashboard-kit/week-tiles";
import { listNames } from "@/components/my-day/my-day-page-parts";
import { kindOf } from "@/components/roster/roster-format";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui-primitives";
import { cmeCategories, type CmeCategory } from "@/lib/cme/types";
import { formatCountdown, formatRingFigure, type MyDayTimedEvent } from "@/lib/my-day/dashboard";
import {
  addMonths,
  monthTitle,
  monthWeeks,
  myDayActionLabel,
  shortDayMonth,
  spreadLabels,
  WEEKDAY_LETTERS,
  type DayRibbon,
  type RunwayPoint,
} from "@/lib/my-day/figures";
import { duePerthDate } from "@/lib/my-day/merge";
import type { MyDayItem, MyDaySourceMode } from "@/lib/my-day/model";
import { withMyDayReturn } from "@/lib/my-day/return-link";
import { SHIFT_KIND_LABEL, type ShiftKind } from "@/lib/roster/shift-kind";
import { formatPerthDay, perthDateOf, perthTimeOf } from "@/lib/roster/shifts/perth-time";
import type { RosterDisplayShift } from "@/lib/roster/team/team-view";

/*
 * The Today page's cards, built on the dashboard kit
 * (`src/components/dashboard-kit/`). Each takes already-selected data from
 * `MyDayDashboard`, which decides whether a card shows at all.
 */

const HOUR_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------- shared words

export const MODE_CHIP: Readonly<Record<MyDaySourceMode, { readonly code: string; readonly tint: DashTint }>> = {
  cme: { code: "CPD", tint: "blue" },
  "my-work": { code: "ADM", tint: "amber" },
  "on-call": { code: "OC", tint: "green" },
  teaching: { code: "TCH", tint: "blue-2" },
  roster: { code: "ROS", tint: "blue-2" },
};

const MODE_NAME: Readonly<Record<MyDaySourceMode, string>> = {
  cme: "CPD",
  "my-work": "Admin",
  "on-call": "On Call",
  teaching: "Teaching",
  roster: "Roster",
};

/** "Overdue · 15 Sep" / "Date passed · 21 Sep" / "Due 5 Oct" / "Teaching". */
function itemStateLine(item: MyDayItem): { readonly text: string; readonly passed: boolean } {
  const date = duePerthDate(item.due);
  if (item.severity === "overdue") {
    const word = item.mode === "my-work" ? "Date passed" : "Overdue";
    return { text: date ? `${word} · ${shortDayMonth(date)}` : word, passed: true };
  }
  if (date) return { text: `Due ${shortDayMonth(date)} · ${MODE_NAME[item.mode]}`, passed: false };
  return { text: item.detail ?? MODE_NAME[item.mode], passed: false };
}

export function shiftName(kind: ShiftKind): string {
  return kind === "on_call" ? "On call" : `${SHIFT_KIND_LABEL[kind]} shift`;
}

// ---------------------------------------------------------------- hero

function heroEyebrow(shift: RosterDisplayShift, running: boolean, now: Date): string {
  if (running) return "On now";
  const day = perthDateOf(shift.startsAt);
  if (day !== perthDateOf(now)) return formatPerthDay(day);
  return Number(perthTimeOf(shift.startsAt).slice(0, 2)) >= 17 ? "Tonight" : "Today";
}

function Ribbon({ ribbon }: { readonly ribbon: DayRibbon }) {
  return (
    <div className="grid gap-1" aria-hidden="true" data-testid="my-day-ribbon">
      <svg viewBox="0 0 100 16" preserveAspectRatio="none" className="block h-4 w-full overflow-visible">
        <rect x="0" y="4" width="100" height="8" rx="4" className="fill-[color:var(--dash-hero-track)]" />
        {ribbon.segments.map((segment) => (
          <rect
            key={segment.key}
            x={segment.from * 100}
            y="4"
            width={Math.max(1.5, (segment.to - segment.from) * 100)}
            height="8"
            rx="4"
            data-tone={segment.tone}
            className={
              segment.tone === "other"
                ? "fill-[color:var(--dash-hero-ribbon-other)]"
                : "fill-[color:var(--dash-hero-ink)] opacity-75"
            }
          />
        ))}
        {ribbon.now !== null ? (
          <rect
            x={Math.min(99, ribbon.now * 100)}
            y="0"
            width="1"
            height="16"
            rx="0.5"
            data-testid="my-day-ribbon-now"
            className="fill-[color:var(--dash-hero-ink)]"
          />
        ) : null}
      </svg>
      <div className="flex justify-between text-3xs font-dash-title nums opacity-80">
        {ribbon.labels.map((label) => (
          <span key={`${label.at}-${label.text}`}>{label.text}</span>
        ))}
      </div>
    </div>
  );
}

function HeroUpNext({
  event,
  state,
  now,
}: {
  readonly event: MyDayTimedEvent;
  readonly state: "upcoming" | "on-now";
  readonly now: Date;
}) {
  const countdown =
    state === "upcoming"
      ? formatCountdown(Date.parse(event.startsAt) - now.getTime())
      : formatCountdown(Date.parse(event.endsAt) - now.getTime());
  const eyebrow = state === "upcoming" ? `Up next · in ${countdown.short}` : `On now · ${countdown.short} left`;
  const spoken =
    state === "upcoming"
      ? `Up next, in ${countdown.spoken}: ${event.title} at ${perthTimeOf(event.startsAt)}.`
      : `On now, ends in ${countdown.spoken}: ${event.title}.`;
  return (
    <div
      className="grid gap-2 rounded-2xl border border-[color:var(--dash-hero-glass-line)] bg-[color:var(--dash-hero-glass)] px-3 py-2.5"
      data-testid="my-day-up-next"
    >
      <p className="sr-only">{spoken}</p>
      <div aria-hidden="true" className="grid gap-0.5">
        <span className="text-3xs font-dash-title uppercase tracking-widest opacity-80">{eyebrow}</span>
        <span className="break-words font-dash-figure text-base-minus leading-snug">
          {`${perthTimeOf(event.startsAt)} ${event.title}`}
        </span>
        {event.where ? <span className="break-words text-xs opacity-90">{event.where}</span> : null}
      </div>
      <div className="-my-2 flex gap-2">
        <Link
          href={withMyDayReturn(event.href)}
          data-testid="my-day-up-next-open"
          className={cn(focusRing, "inline-flex min-h-12 items-center rounded-full no-underline")}
        >
          <span className="rounded-full bg-[color:var(--dash-hero-ink)] px-4 py-1.5 text-sm font-dash-title text-[color:var(--dash-hero-button-ink)] forced-colors:border">
            {event.actionLabel}
          </span>
        </Link>
      </div>
    </div>
  );
}

/**
 * The hero: the shift ring (time to the shift, or left in it), the day ribbon
 * with a now marker, and "Up next" nested inside. Drawn only when there is a
 * shift ahead or something timed today.
 */
export function HeroCard({
  shift,
  running,
  upNext,
  ribbon,
  now,
  onHide,
}: {
  readonly shift: RosterDisplayShift | null;
  readonly running: boolean;
  readonly upNext: { readonly event: MyDayTimedEvent; readonly state: "upcoming" | "on-now" } | null;
  readonly ribbon: DayRibbon | null;
  readonly now: Date;
  readonly onHide?: () => void;
}) {
  let top: ReactNode = null;
  if (shift) {
    const kind = kindOf(shift);
    const name = shiftName(kind);
    const start = Date.parse(shift.startsAt);
    const end = Date.parse(shift.endsAt);
    const remaining = running ? end - now.getTime() : start - now.getTime();
    const fraction = running ? remaining / Math.max(1, end - start) : 1 - Math.min(1, remaining / (12 * HOUR_MS));
    const countdown = formatCountdown(remaining);
    const place = shift.workplace ?? shift.location ?? shift.teamName ?? null;
    const spoken = running
      ? `${name} on now, ${countdown.spoken} left, until ${perthTimeOf(shift.endsAt)}.`
      : `${countdown.spoken} until your ${name.toLowerCase()} starts, ${formatPerthDay(perthDateOf(shift.startsAt))} at ${perthTimeOf(shift.startsAt)}, until ${perthTimeOf(shift.endsAt)}.`;
    top = (
      <Link
        href={withMyDayReturn("/roster")}
        data-testid="my-day-shift"
        className={cn(
          focusRing,
          "-m-1 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3.5 rounded-2xl p-1 text-[color:var(--dash-hero-ink)] no-underline",
        )}
      >
        <span className="sr-only">{`${spoken}${place ? ` ${place}.` : ""}`}</span>
        <ProgressRing
          fraction={fraction}
          size={92}
          strokeWidth={7}
          stroke="stroke-[color:var(--dash-hero-ink)]"
          track="stroke-[color:var(--dash-hero-track)]"
          testId="my-day-shift-ring"
        >
          <span className={cn(dashFigure, "block text-2xl-minus")}>{formatRingFigure(remaining)}</span>
          <span className="mt-0.5 block text-3xs font-dash-title opacity-85">
            {running ? "left" : `to ${name.toLowerCase()}`}
          </span>
        </ProgressRing>
        <span aria-hidden="true" className="grid min-w-0 gap-0.5">
          <span className="text-3xs font-dash-title uppercase tracking-widest opacity-80">
            {heroEyebrow(shift, running, now)}
          </span>
          <span className="break-words font-dash-figure text-lg leading-tight">
            {`${name} ${perthTimeOf(shift.startsAt)} to ${perthTimeOf(shift.endsAt)}`}
          </span>
          {place ? <span className="break-words text-sm opacity-90">{place}</span> : null}
        </span>
      </Link>
    );
  }
  return (
    <DashCard title="Up next" showTitle={false} tone="hero" onHide={onHide} testId="my-day-card-up-next">
      {top}
      {ribbon ? <Ribbon ribbon={ribbon} /> : null}
      {upNext ? <HeroUpNext event={upNext.event} state={upNext.state} now={now} /> : null}
    </DashCard>
  );
}

// ---------------------------------------------------------------- the flag

/**
 * The flag: the single most important real item (overdue first) with its one
 * action. With more than one, dots below step through them.
 */
export function FlagCard({ items, onHide }: { readonly items: readonly MyDayItem[]; readonly onHide?: () => void }) {
  const [index, setIndex] = useState(0);
  const current = items[Math.min(index, items.length - 1)];
  if (!current) return null;
  const state = itemStateLine(current);
  const action = myDayActionLabel(current);
  return (
    <DashCard
      title="Most important now"
      showTitle={false}
      tone="flag"
      onHide={onHide}
      testId="my-day-card-flag"
      className="gap-1"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5" data-testid="my-day-flag">
        <IconChip tint="green" size="md" className="bg-[color:var(--dash-raised)]">
          !
        </IconChip>
        <span className="grid min-w-0 gap-0.5">
          <span className="break-words font-dash-title text-base-minus leading-snug text-[color:var(--dash-ink)]">
            {current.title}
          </span>
          <span className={dashMuted}>{`${state.text}${state.passed ? ` · ${MODE_NAME[current.mode]}` : ""}`}</span>
        </span>
        <Link
          href={withMyDayReturn(current.href)}
          aria-label={`${action}: ${current.title}`}
          data-testid="my-day-flag-action"
          className={cn(focusRing, "inline-flex min-h-12 items-center rounded-full no-underline")}
        >
          <span className="rounded-full bg-[color:var(--dash-green-solid)] px-4 py-2 text-sm font-dash-title text-[color:var(--dash-green-solid-ink)] forced-colors:border">
            {action}
          </span>
        </Link>
      </div>
      {items.length > 1 ? (
        <div className="flex justify-center gap-1" role="group" aria-label="Flagged items">
          {items.map((item, position) => {
            const selected = position === index;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={`Show flag ${position + 1} of ${items.length}: ${item.title}`}
                aria-current={selected ? "true" : undefined}
                onClick={() => setIndex(position)}
                // A small face with a 48px-tall hit area that overlaps the card padding, not the layout.
                className={cn(
                  focusRing,
                  "relative grid h-3 min-w-4 place-items-center rounded-full before:absolute before:-inset-x-1 before:-inset-y-4",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "block h-1.5 rounded-full forced-colors:border",
                    selected
                      ? "w-5 bg-[color:var(--dash-green)]"
                      : "w-1.5 bg-[color:color-mix(in_srgb,var(--dash-green)_35%,transparent)]",
                  )}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </DashCard>
  );
}

// ---------------------------------------------------------------- quick actions

/** Real destinations only: each opens an existing page of its mode. */
export const MY_DAY_QUICK_ACTIONS: readonly DashQuickAction[] = [
  {
    label: "Log a call",
    hint: "note it for handover",
    href: "/on-call/call#on-call-call-log-heading",
    icon: Phone,
    testId: "my-day-qa-call",
  },
  { label: "Log CPD", hint: "add hours", href: "/cme/new", icon: BookPlus, testId: "my-day-qa-cpd" },
  { label: "Who's on", hint: "team now", href: "/on-call/whos-on", icon: Users, testId: "my-day-qa-whos-on" },
  { label: "Roster", hint: "your shifts", href: "/roster", icon: CalendarDays, testId: "my-day-qa-roster" },
  { label: "Teaching", hint: "this week", href: "/teaching/week", icon: GraduationCap, testId: "my-day-qa-teaching" },
];

export function QuickActionsCard({ onHide }: { readonly onHide?: () => void }) {
  return (
    <DashCard title="Quick actions" showTitle={false} onHide={onHide} testId="my-day-card-quick-actions">
      <DashQuickActions
        actions={MY_DAY_QUICK_ACTIONS.map((action) => ({ ...action, href: withMyDayReturn(action.href) }))}
      />
    </DashCard>
  );
}

// ---------------------------------------------------------------- this week / month

export interface AgendaLine {
  readonly key: string;
  readonly at: number;
  readonly time: string;
  readonly text: string;
  readonly past: boolean;
}

const TILE_CODE: Readonly<Record<ShiftKind, string>> = {
  day: "D",
  evening: "E",
  night: "N",
  on_call: "OC",
  leave: "L",
  other: "W",
};

function tileKind(kinds: readonly ShiftKind[]): { readonly kind: DashDayTileKind; readonly code: string } {
  if (kinds.includes("on_call")) return { kind: "on-call", code: TILE_CODE.on_call };
  if (kinds.includes("night")) return { kind: "night", code: TILE_CODE.night };
  const worked = kinds.find((kind) => kind !== "leave");
  if (worked) return { kind: "work", code: TILE_CODE[worked] };
  if (kinds.includes("leave")) return { kind: "leave", code: TILE_CODE.leave };
  return { kind: "off", code: "off" };
}

export interface DayDetail {
  readonly key: string;
  readonly code: string;
  readonly tint: DashTint;
  readonly title: string;
  readonly subtitle?: string;
  readonly passed?: boolean;
  readonly href?: string;
  readonly actionLabel?: string;
}

const BAR_TONE = {
  day: "fill-[color:var(--dash-line-strong)]",
  night: "fill-[color:var(--dash-night)]",
  call: "fill-[color:var(--dash-blue)]",
  due: "fill-[color:var(--dash-amber)]",
} as const;
type BarTone = keyof typeof BAR_TONE;

function dayBars(kinds: readonly ShiftKind[], due: boolean): BarTone[] {
  const bars: BarTone[] = [];
  if (kinds.includes("on_call")) bars.push("call");
  if (kinds.includes("night")) bars.push("night");
  if (kinds.some((kind) => kind === "day" || kind === "evening" || kind === "other")) bars.push("day");
  if (due) bars.push("due");
  return bars.slice(0, 3);
}

function MonthView({
  today,
  kindsByDate,
  dueByDate,
  detailFor,
}: {
  readonly today: string;
  readonly kindsByDate: ReadonlyMap<string, readonly ShiftKind[]> | null;
  readonly dueByDate: ReadonlyMap<string, number>;
  readonly detailFor: (date: string) => readonly DayDetail[];
}) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const titleId = useId();
  const weeks = monthWeeks(month);
  const details = detailFor(selected);
  return (
    <div className="grid gap-2" data-testid="my-day-month">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((value) => addMonths(value, -1))}
          aria-label="Previous month"
          className={cn(focusRing, "grid size-12 -m-3 place-items-center rounded-full text-[color:var(--dash-blue)]")}
        >
          <ChevronLeft aria-hidden="true" className="size-icon-md" />
        </button>
        <h3 id={titleId} className="font-dash-title text-base-minus text-[color:var(--dash-ink)]">
          {monthTitle(month)}
        </h3>
        {/* The month change is announced from a hidden line, not the visible heading (SPEC §9.2). */}
        <p className="sr-only" aria-live="polite">
          {monthTitle(month)}
        </p>
        <button
          type="button"
          onClick={() => setMonth((value) => addMonths(value, 1))}
          aria-label="Next month"
          className={cn(focusRing, "grid size-12 -m-3 place-items-center rounded-full text-[color:var(--dash-blue)]")}
        >
          <ChevronRight aria-hidden="true" className="size-icon-md" />
        </button>
      </div>
      <table className="w-full table-fixed border-collapse text-center" aria-labelledby={titleId}>
        <thead>
          <tr>
            {WEEKDAY_LETTERS.map((letter, index) => (
              <th key={index} scope="col" className="pb-1 text-3xs font-dash-title text-[color:var(--dash-faint)]">
                <span aria-hidden="true">{letter}</span>
                <span className="sr-only">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][index]}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, row) => (
            <tr key={row}>
              {week.map((date, column) =>
                date ? (
                  <td key={date} className="p-0">
                    <button
                      type="button"
                      aria-pressed={date === selected}
                      aria-current={date === today ? "date" : undefined}
                      aria-label={`${formatPerthDay(date)}${
                        kindsByDate?.get(date)?.length
                          ? `: ${(kindsByDate.get(date) ?? []).map((kind) => SHIFT_KIND_LABEL[kind]).join(" and ")}`
                          : ""
                      }${dueByDate.get(date) ? `, ${dueByDate.get(date)} due` : ""}`}
                      onClick={() => setSelected(date)}
                      className={cn(
                        focusRing,
                        "grid min-h-12 w-full content-center justify-items-center gap-0.5 rounded-xl text-sm nums",
                        date === selected
                          ? "bg-[color:var(--dash-ink)] font-dash-title text-[color:var(--dash-page)] forced-colors:border"
                          : date === today
                            ? "font-dash-title text-[color:var(--dash-blue)]"
                            : "text-[color:var(--dash-ink)]",
                      )}
                    >
                      <span aria-hidden="true">{Number(date.slice(8, 10))}</span>
                      <svg aria-hidden="true" width="34" height="4" viewBox="0 0 34 4" className="block">
                        {dayBars(kindsByDate?.get(date) ?? [], (dueByDate.get(date) ?? 0) > 0).map(
                          (tone, index, all) => (
                            <rect
                              key={tone}
                              x={17 - (all.length * 12 - 2) / 2 + index * 12}
                              y="0.5"
                              width="10"
                              height="3"
                              rx="1.5"
                              className={BAR_TONE[tone]}
                            />
                          ),
                        )}
                      </svg>
                    </button>
                  </td>
                ) : (
                  <td key={`pad-${row}-${column}`} />
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <ul
        role="list"
        aria-label="Key"
        className="flex flex-wrap gap-x-3 gap-y-1 text-2xs text-[color:var(--dash-muted)]"
      >
        {(
          [
            ["day", "Day"],
            ["night", "Night"],
            ["call", "On call"],
            ["due", "Due"],
          ] as const
        ).map(([tone, label]) => (
          <li key={tone} className="inline-flex items-center gap-1">
            <svg aria-hidden="true" width="10" height="3" viewBox="0 0 10 3">
              <rect width="10" height="3" rx="1.5" className={BAR_TONE[tone]} />
            </svg>
            {label}
          </li>
        ))}
      </ul>
      <h3 className="font-dash-title text-sm text-[color:var(--dash-ink)]">{formatPerthDay(selected)}</h3>
      {details.length ? (
        <DashItemList testId="my-day-month-detail">
          {details.map((detail) => (
            <DashItemRow
              key={detail.key}
              chip={<IconChip tint={detail.tint}>{detail.code}</IconChip>}
              title={detail.title}
              subtitle={detail.subtitle}
              subtitleTone={detail.passed ? "passed" : "muted"}
              actions={
                detail.href ? (
                  <DashPill href={detail.href} emphasis="primary" ariaLabel={`${detail.actionLabel}: ${detail.title}`}>
                    {detail.actionLabel}
                  </DashPill>
                ) : undefined
              }
            />
          ))}
        </DashItemList>
      ) : (
        <p className={dashMuted}>Nothing recorded for this day.</p>
      )}
    </div>
  );
}

export function ThisWeekCard({
  week,
  today,
  kindsByDate,
  dueByDate,
  agenda,
  detailFor,
  onHide,
}: {
  readonly week: readonly string[];
  readonly today: string;
  /** Null when no roster is available: then no tile is drawn, rather than a false "off". */
  readonly kindsByDate: ReadonlyMap<string, readonly ShiftKind[]> | null;
  readonly dueByDate: ReadonlyMap<string, number>;
  readonly agenda: readonly AgendaLine[];
  readonly detailFor: (date: string) => readonly DayDetail[];
  readonly onHide?: () => void;
}) {
  const [view, setView] = useState<"week" | "month">("week");
  const days: DashWeekDay[] = week.map((date, index) => {
    const kinds = kindsByDate?.get(date) ?? [];
    const due = dueByDate.get(date) ?? 0;
    const tile = kindsByDate ? tileKind(kinds) : { kind: "none" as const, code: "" };
    const words = [
      kindsByDate ? (kinds.length ? kinds.map((kind) => SHIFT_KIND_LABEL[kind]).join(" and ") : "Off") : "",
      due ? `${due} due` : "",
    ]
      .filter(Boolean)
      .join(", ");
    return {
      date,
      letter: WEEKDAY_LETTERS[index] ?? "",
      code: tile.code,
      kind: tile.kind,
      today: date === today,
      due: due > 0,
      spoken: words ? `${formatPerthDay(date)}: ${words}` : formatPerthDay(date),
    };
  });
  const nextIndex = agenda.findIndex((line) => !line.past);
  return (
    <DashCard
      title={view === "week" ? "This week" : "Calendar"}
      onHide={onHide}
      testId="my-day-card-this-week"
      aside={
        <DashSegmented
          label="Show"
          value={view}
          onChange={setView}
          testId="my-day-week-switch"
          options={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
        />
      }
    >
      {view === "week" ? (
        <>
          <DashWeekTiles days={days} testId="my-day-week" />
          {agenda.length > 0 ? (
            <ul
              role="list"
              aria-label="Today"
              data-testid="my-day-agenda"
              className="-mx-3 flex snap-x scroll-px-3 gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {agenda.map((line, index) => (
                <li
                  key={line.key}
                  className={cn(
                    "grid min-w-26 shrink-0 snap-start gap-0.5 rounded-xl border px-2.5 py-1.5 text-sm forced-colors:border",
                    index === nextIndex
                      ? "border-[color:var(--dash-blue-tint-2)] bg-[color:var(--dash-blue-tint)]"
                      : "border-[color:var(--dash-line)] bg-[color:var(--dash-raised)]",
                    line.past && "text-[color:var(--dash-faint)]",
                  )}
                >
                  <span className="font-dash-title nums">{line.time}</span>
                  <span className="whitespace-nowrap">
                    {line.text}
                    {line.past ? <span className="sr-only"> (finished)</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <MonthView today={today} kindsByDate={kindsByDate} dueByDate={dueByDate} detailFor={detailFor} />
      )}
    </DashCard>
  );
}

// ---------------------------------------------------------------- needs you

export function NeedsYouCard({
  shown,
  waiting,
  total,
  checked,
  undo,
  onLater,
  onUndo,
  onShowAll,
  onRetry,
  onHide,
}: {
  readonly shown: readonly MyDayItem[];
  readonly waiting: number;
  readonly total: number;
  readonly checked: readonly string[];
  readonly undo: { readonly id: string; readonly title: string } | null;
  readonly onLater: (item: MyDayItem) => void;
  readonly onUndo: () => void;
  readonly onShowAll: () => void;
  readonly onRetry: () => void;
  readonly onHide?: () => void;
}) {
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
      <p className={dashMuted} data-testid="my-day-needs-you-snoozed">
        {`Nothing else needs you today. ${total - waiting} moved to tomorrow.`}
      </p>
    );
  } else {
    body = (
      <DashItemList>
        {shown.map((item) => {
          const state = itemStateLine(item);
          const chip = MODE_CHIP[item.mode];
          const action = myDayActionLabel(item);
          return (
            <DashItemRow
              key={item.id}
              testId={`my-day-item-${item.id}`}
              chip={<IconChip tint={chip.tint}>{chip.code}</IconChip>}
              title={item.title}
              subtitle={state.text}
              subtitleTone={state.passed ? "passed" : "muted"}
              actions={
                <>
                  <DashPill
                    href={withMyDayReturn(item.href)}
                    emphasis="primary"
                    ariaLabel={`${action}: ${item.title}`}
                    testId={`my-day-open-${item.id}`}
                  >
                    {action}
                  </DashPill>
                  <DashPill
                    onClick={() => onLater(item)}
                    ariaLabel={`Later: ${item.title}`}
                    testId={`my-day-later-${item.id}`}
                  >
                    Later
                  </DashPill>
                </>
              }
            />
          );
        })}
      </DashItemList>
    );
  }
  return (
    <DashCard
      title={waiting > 0 ? `Needs you · ${waiting}` : "Needs you"}
      onHide={onHide}
      testId="my-day-card-needs-you"
      aside={
        total > 0 ? (
          <button
            type="button"
            onClick={onShowAll}
            data-testid="my-day-show-all"
            className={cn(focusRing, dashLink, "-my-3 inline-flex min-h-12 items-center rounded-md px-1")}
          >
            {`All ${total}`}
          </button>
        ) : null
      }
    >
      {body}
      <div role="status" className="empty:hidden">
        {undo ? (
          <div
            className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-[color:var(--dash-ink)] pl-3 text-sm text-[color:var(--dash-page)]"
            data-testid="my-day-undo"
          >
            <span className="min-w-0 break-words">{`Moved to tomorrow: ${undo.title}`}</span>
            <button
              type="button"
              onClick={onUndo}
              className={cn(
                focusRing,
                "min-h-12 shrink-0 rounded-xl px-3 font-dash-title text-[color:var(--dash-blue-2)]",
              )}
            >
              Undo
            </button>
          </div>
        ) : null}
      </div>
    </DashCard>
  );
}

// ---------------------------------------------------------------- CPD rings

const CPD_TYPE: Readonly<
  Record<CmeCategory, { readonly label: string; readonly stroke: string; readonly dot: string }>
> = {
  educational: {
    label: "Educational",
    stroke: "stroke-[color:var(--dash-blue)]",
    dot: "bg-[color:var(--dash-blue)]",
  },
  reviewing: {
    label: "Performance",
    stroke: "stroke-[color:var(--dash-green)]",
    dot: "bg-[color:var(--dash-green)]",
  },
  measuring: {
    label: "Outcomes",
    stroke: "stroke-[color:var(--dash-amber)]",
    dot: "bg-[color:var(--dash-amber)]",
  },
};

function hoursText(value: number): string {
  return `${Number(value.toFixed(1))}`;
}

/**
 * CPD this year by Medical Board CPD type: one ring per type, each measured
 * against that type's own target when the confirmed set states one, else
 * against the year's total target.
 */
export function CpdRingsCard({
  loggedHours,
  targetHours,
  byCategory,
  categoryTargets,
  onHide,
}: {
  readonly loggedHours: number;
  readonly targetHours: number;
  readonly byCategory: Readonly<Record<CmeCategory, number>>;
  readonly categoryTargets: Readonly<Record<CmeCategory, number | null>>;
  readonly onHide?: () => void;
}) {
  const left = Math.max(0, targetHours - loggedHours);
  return (
    <DashCard
      title="CPD this year"
      onHide={onHide}
      testId="my-day-card-cpd"
      aside={
        <span className="font-dash-title text-2xs uppercase tracking-widest text-[color:var(--dash-faint)] nums">
          {`${hoursText(loggedHours)} / ${hoursText(targetHours)} h`}
        </span>
      }
    >
      <Link
        href={withMyDayReturn("/cme")}
        data-testid="my-day-cpd"
        className={cn(
          focusRing,
          "-m-1 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl p-1 no-underline",
        )}
      >
        <RingStack
          testId="my-day-cpd-rings"
          rings={cmeCategories.map((category) => ({
            key: category,
            fraction: byCategory[category] / Math.max(1, categoryTargets[category] ?? targetHours),
            stroke: CPD_TYPE[category].stroke,
          }))}
        />
        <span className="grid gap-1 text-sm text-[color:var(--dash-ink)]">
          {cmeCategories.map((category) => (
            <span key={category} className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn("size-2 rounded-full forced-colors:border", CPD_TYPE[category].dot)}
                />
                {CPD_TYPE[category].label}
              </span>
              <span className="font-dash-title nums">{`${hoursText(byCategory[category])} h`}</span>
            </span>
          ))}
          <span className="flex items-center justify-between gap-2">
            <span>{left > 0 ? "To go by 31 Dec" : "Target reached"}</span>
            {left > 0 ? <span className="font-dash-title nums">{`${hoursText(left)} h`}</span> : null}
          </span>
        </span>
      </Link>
    </DashCard>
  );
}

// ---------------------------------------------------------------- renewals runway

const RUNWAY_MAX_POINTS = 4;
/** Half a label's width in runway units: labels are centred inside the line's ends. */
const RUNWAY_LABEL_HALF = 42;

/** A short runway label: a long name is cut at a word. The dot's own label carries the full name. */
function runwayLabel(text: string): string {
  if (text.length <= 13) return text;
  const cut = text.slice(0, 13);
  const space = cut.lastIndexOf(" ");
  return `${(space > 5 ? cut.slice(0, space) : cut.slice(0, 12)).trim()}…`;
}

/** Recorded Admin dates over the next six months on one line. Amber only for a date that has passed. */
export function RenewalsRunwayCard({
  points,
  onHide,
}: {
  readonly points: readonly RunwayPoint[];
  readonly onHide?: () => void;
}) {
  const width = 320;
  const inset = 30;
  const span = width - inset * 2;
  // Four dates at most on the line; the rest are counted. Each label gets an
  // equal share of the width so neighbouring names never overlap.
  const shown = points.slice(0, RUNWAY_MAX_POINTS);
  const more = points.length - shown.length;
  const labels = spreadLabels(
    shown.map((point) => point.at),
    1 / 3,
  );
  return (
    <DashCard
      title="Renewals, next 6 months"
      onHide={onHide}
      testId="my-day-card-renewals"
      aside={
        <Link
          href={withMyDayReturn("/admin/renewals")}
          className={cn(focusRing, dashLink, "-my-3 inline-flex min-h-12 items-center rounded-md px-1")}
        >
          Admin
        </Link>
      }
    >
      <svg
        viewBox={`0 0 ${width} 50`}
        className="mx-auto block w-full max-w-md overflow-visible"
        data-testid="my-day-runway"
      >
        <line
          x1={inset}
          x2={width - inset}
          y1="22"
          y2="22"
          strokeWidth="2"
          className="stroke-[color:var(--dash-line-strong)]"
        />
        {shown.map((point, index) => {
          const x = inset + point.at * span;
          const labelX = RUNWAY_LABEL_HALF + (labels[index] ?? point.at) * (width - RUNWAY_LABEL_HALF * 2);
          const spoken = `${point.title}: ${point.passed ? "date has passed" : "recorded date"}, ${formatPerthDay(point.date)}`;
          return (
            <a key={point.entryId} href={withMyDayReturn(point.href)} aria-label={spoken} className={focusRing}>
              <rect x={x - 24} y="0" width="48" height="48" fill="transparent" />
              <circle
                cx={x}
                cy="22"
                r="6"
                strokeWidth="3"
                data-passed={point.passed ? "" : undefined}
                className={cn(
                  "stroke-[color:var(--dash-card)]",
                  point.passed ? "fill-[color:var(--dash-amber)]" : "fill-[color:var(--dash-blue)]",
                )}
              />
              <text
                x={labelX}
                y="44"
                textAnchor="middle"
                aria-hidden="true"
                className="fill-[color:var(--dash-muted)] font-dash-title text-3xs"
              >
                {runwayLabel(point.title)}
              </text>
            </a>
          );
        })}
      </svg>
      <p className={dashMuted}>
        {more > 0 ? `Tap a dot for details. ${more} more in Admin.` : "Tap a dot for details."}
      </p>
    </DashCard>
  );
}
