"use client";

import { CalendarDays, Clock3, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { announce } from "@/components/ui/live-announcer";

import { ContinuityThreadSpecimen } from "./continuity-thread-specimen";
import { OperationalStatus } from "./mockup-primitives";

type ScheduleDay = {
  id: string;
  label: string;
  tabDetail: string;
  dateLabel: string;
  note: string;
  routineWindows: readonly { name: string; time: string; count: number }[];
  exceptions: readonly { title: string; state: string; detail: string; owner: string }[];
};

const windowRecords = (morning: number, afternoon: number, earlyEvening: number) =>
  [
    { name: "Morning", time: "10:00 am AWST", count: morning },
    { name: "Afternoon", time: "2:00 pm AWST", count: afternoon },
    { name: "Early evening", time: "5:00 pm AWST", count: earlyEvening },
  ] as const;

const scheduleDays: readonly ScheduleDay[] = [
  {
    id: "2026-08-15",
    label: "15 Aug",
    tabDetail: "Today",
    dateLabel: "Saturday 15 August 2026",
    note: "Weekend contacts remain inside the approved service windows.",
    routineWindows: windowRecords(2, 3, 1),
    exceptions: [
      {
        title: "Carrier status unavailable",
        state: "Status unavailable",
        detail:
          "Retrieve transport detail for SYN-CONTACT-07. This system state does not imply safety, receipt or wellbeing.",
        owner: "Alex Example",
      },
    ],
  },
  {
    id: "2026-08-16",
    label: "16 Aug",
    tabDetail: "Sun",
    dateLabel: "Sunday 16 August 2026",
    note: "Weekend contacts remain inside the approved service windows.",
    routineWindows: windowRecords(1, 1, 0),
    exceptions: [],
  },
  {
    id: "2026-08-17",
    label: "17 Aug",
    tabDetail: "Mon",
    dateLabel: "Monday 17 August 2026",
    note: "Routine service day in Australia/Perth.",
    routineWindows: windowRecords(1, 2, 1),
    exceptions: [],
  },
  {
    id: "2026-08-18",
    label: "18 Aug",
    tabDetail: "Tue",
    dateLabel: "Tuesday 18 August 2026",
    note: "Routine service day in Australia/Perth.",
    routineWindows: windowRecords(1, 1, 1),
    exceptions: [],
  },
  {
    id: "2026-08-19",
    label: "19 Aug",
    tabDetail: "Wed",
    dateLabel: "Wednesday 19 August 2026",
    note: "Routine service day in Australia/Perth.",
    routineWindows: windowRecords(2, 2, 1),
    exceptions: [],
  },
  {
    id: "2026-08-20",
    label: "20 Aug",
    tabDetail: "Thu",
    dateLabel: "Thursday 20 August 2026",
    note: "Routine service day in Australia/Perth.",
    routineWindows: windowRecords(1, 1, 0),
    exceptions: [],
  },
  {
    id: "2026-08-21",
    label: "21 Aug",
    tabDetail: "Fri",
    dateLabel: "Friday 21 August 2026",
    note: "Routine service day in Australia/Perth.",
    routineWindows: windowRecords(1, 1, 1),
    exceptions: [],
  },
];

function routineCount(day: ScheduleDay) {
  return day.routineWindows.reduce((sum, window) => sum + window.count, 0);
}

function scheduledContactLabel(count: number) {
  return `${count} scheduled ${count === 1 ? "contact" : "contacts"}`;
}

export function ScheduleScreen() {
  const [selectedDayId, setSelectedDayId] = useState(scheduleDays[0].id);
  const selectedDay = scheduleDays.find((day) => day.id === selectedDayId) ?? scheduleDays[0];
  const selectedRoutineCount = routineCount(selectedDay);

  function selectDay(day: ScheduleDay) {
    setSelectedDayId(day.id);
    announce(
      `${day.dateLabel}. ${routineCount(day)} routine contacts. ${day.exceptions.length === 0 ? "No named exceptions." : `${day.exceptions.length} named exception.`}`,
      { eventId: `caring-contact:schedule:${day.id}` },
    );
  }

  return (
    <section
      className="min-w-0 space-y-[var(--gap-section)] pb-24 md:pb-0"
      data-testid="caring-contact-screen-schedule"
    >
      <div className="min-w-0 rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
        <div className="flex items-start gap-[var(--gap-inline)]">
          <CalendarDays aria-hidden="true" className="mt-1 size-icon-lg shrink-0 text-[color:var(--clinical-accent)]" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[var(--tracking-eyebrow)] text-[color:var(--clinical-accent)]">
              Day-led schedule
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Schedule</h2>
            <p className="mt-2 max-w-[var(--measure)] text-sm text-[color:var(--text-muted)]">
              <span data-testid="schedule-selected-day">{selectedDay.dateLabel}</span> · Australia/Perth.{" "}
              {selectedDay.note}
            </p>
          </div>
        </div>

        <ul
          aria-label="Seven-day schedule strip"
          className="mt-[var(--gap-block)] grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"
        >
          {scheduleDays.map((day) => {
            const selected = selectedDay.id === day.id;
            return (
              <li key={day.label} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectDay(day)}
                  className={`min-h-tap w-full min-w-0 rounded-[var(--radius-md)] border px-2 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] ${selected ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]" : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]"}`}
                >
                  <span className="block font-semibold">{day.label}</span>
                  <span className="mt-1 block text-xs">
                    {day.tabDetail} · {routineCount(day)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-[var(--gap-stack)] text-sm text-[color:var(--text-muted)]">
          Showing {selectedDay.label} · {selectedRoutineCount} routine contacts ·{" "}
          {selectedDay.exceptions.length === 0
            ? "No named exceptions"
            : `${selectedDay.exceptions.length} named exception`}
        </p>
      </div>

      <div className="grid min-w-0 gap-[var(--gap-block)] xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <section className="min-w-0 rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
          <div className="flex items-start gap-[var(--gap-inline)]">
            <Clock3 aria-hidden="true" className="mt-1 size-icon-lg shrink-0 text-[color:var(--clinical-accent)]" />
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Routine sending windows</h2>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                The day list is grouped by the three approved times.
              </p>
            </div>
          </div>
          <ol className="mt-[var(--gap-block)] divide-y divide-[color:var(--border)]">
            {selectedDay.routineWindows.map((window) => (
              <li
                key={window.name}
                className="grid min-w-0 gap-1 py-[var(--gap-stack)] first:pt-0 last:pb-0 sm:grid-cols-[minmax(7rem,0.7fr)_minmax(8rem,0.8fr)_minmax(0,1fr)]"
              >
                <span className="font-semibold">{window.name}</span>
                <span className="tabular-nums">{window.time}</span>
                <span className="text-sm text-[color:var(--text-muted)]">{scheduledContactLabel(window.count)}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="min-w-0 rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)] shadow-[var(--rule-warning)]">
          <div className="flex items-start gap-[var(--gap-inline)]">
            <TriangleAlert
              aria-hidden="true"
              className="mt-1 size-icon-lg shrink-0 text-[color:var(--warning)] forced-colors:text-[CanvasText]"
            />
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Named exceptions</h2>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                Operational exceptions never merge into routine queues.
              </p>
            </div>
          </div>
          {selectedDay.exceptions.length === 0 ? (
            <p className="mt-[var(--gap-block)] border-t border-[color:var(--border)] pt-[var(--gap-stack)] text-sm text-[color:var(--text-muted)]">
              No named exceptions for this day.
            </p>
          ) : (
            selectedDay.exceptions.map((exception) => (
              <article
                key={exception.title}
                className="mt-[var(--gap-block)] border-t border-[color:var(--border)] pt-[var(--gap-stack)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{exception.title}</h3>
                  <OperationalStatus tone="warning">{exception.state}</OperationalStatus>
                </div>
                <p className="mt-2 text-sm text-[color:var(--text-muted)]">{exception.detail}</p>
                <p className="mt-1 text-sm font-medium">Owner: {exception.owner}</p>
              </article>
            ))
          )}
        </section>
      </div>

      <ContinuityThreadSpecimen />
    </section>
  );
}
