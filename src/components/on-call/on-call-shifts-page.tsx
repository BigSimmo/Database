"use client";

import { BriefcaseMedical, Trash2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";

import { cardSurface } from "@/components/card-recipes";
import { InformationPageShell } from "@/components/information-page-shell";
import { OnCallToolNavHeader } from "@/components/on-call/on-call-nav-header";
import { describeRosterChangeCounts, useOnCallShifts } from "@/components/on-call/use-on-call-shifts";
import { EmptyState, InlineNotice } from "@/components/primitive-recipes/feedback";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn, textMuted } from "@/components/ui-primitives";
import { rosterWindow } from "@/lib/on-call/shifts/diff";
import type { OnCallShift, OnCallShiftChange, OnCallShiftFormat, OnCallShiftInput } from "@/lib/on-call/shifts/model";
import { shiftHours } from "@/lib/on-call/shifts/next-shift";
import { parseRosterCsv } from "@/lib/on-call/shifts/parse-csv";
import { parseRosterIcs, plural } from "@/lib/on-call/shifts/parse-ics";
import { addDaysToDate, formatPerthDay, perthDateOf } from "@/lib/on-call/shifts/perth-time";

/**
 * MY SHIFTS — the doctor's own roster.
 *
 * The file is read on this device and only the parsed times, titles and sites
 * are sent, after the reader has seen them. Saving replaces the shifts inside
 * the file's dates; anything outside them stays.
 */

const MAX_FILE_BYTES = 1024 * 1024;

type Preview = {
  readonly format: OnCallShiftFormat;
  readonly shifts: OnCallShiftInput[];
  readonly notes: string[];
  readonly window: { start: string; end: string };
};

/** Monday of the Perth week a date falls in. */
function weekOf(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDaysToDate(date, -((weekday + 6) % 7));
}

function groupByWeek(shifts: readonly OnCallShift[]): Array<{ week: string; shifts: OnCallShift[] }> {
  const groups = new Map<string, OnCallShift[]>();
  for (const shift of shifts) {
    const week = weekOf(perthDateOf(shift.startsAt));
    groups.set(week, [...(groups.get(week) ?? []), shift]);
  }
  return [...groups.entries()].map(([week, items]) => ({ week, shifts: items }));
}

function describeShift(shift: Pick<OnCallShiftInput, "startsAt" | "endsAt" | "title" | "location">): string {
  return `${formatPerthDay(perthDateOf(shift.startsAt))}, ${shiftHours(shift)}, ${shift.title}${shift.location ? `, ${shift.location}` : ""}`;
}

function describeChange(change: OnCallShiftChange): string {
  if (change.kind === "added") return `Added: ${describeShift(change.after)}`;
  if (change.kind === "removed") return `Removed: ${describeShift(change.before)}`;
  return `Moved: ${describeShift(change.before)} → ${describeShift(change.after)}`;
}

export function OnCallShiftsPage({ now: nowProp }: { now?: Date } = {}) {
  const state = useOnCallShifts();
  const now = nowProp ?? new Date();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function readFile(file: File) {
    setReadError(null);
    setSaveError(null);
    setPreview(null);
    if (file.size > MAX_FILE_BYTES) {
      setReadError("That file is too big for a roster. Export a shorter date range and try again.");
      return;
    }
    const name = file.name.toLowerCase();
    const format: OnCallShiftFormat | null = name.endsWith(".ics")
      ? "ics"
      : name.endsWith(".csv")
        ? "csv"
        : file.type === "text/calendar"
          ? "ics"
          : file.type === "text/csv"
            ? "csv"
            : null;
    if (!format) {
      setReadError("Choose a calendar file (.ics) or a spreadsheet saved as .csv.");
      return;
    }
    const text = await file.text();
    const result = format === "ics" ? parseRosterIcs(text) : parseRosterCsv(text);
    const window = rosterWindow(result.shifts);
    if (!window) {
      setReadError(["No shifts were found in that file.", ...result.notes].join(" "));
      return;
    }
    setPreview({ format, shifts: result.shifts, notes: result.notes, window });
  }

  async function save() {
    if (!preview) return;
    setSaving(true);
    const error = await state.save({
      format: preview.format,
      windowStart: preview.window.start,
      windowEnd: preview.window.end,
      shifts: preview.shifts,
    });
    setSaving(false);
    if (error) setSaveError(error);
    else setPreview(null);
  }

  async function deleteAll() {
    setDeleting(true);
    const error = await state.deleteAll();
    setDeleting(false);
    setConfirmDelete(false);
    if (error) setSaveError(error);
  }

  const upcoming = state.shifts.filter((shift) => Date.parse(shift.endsAt) > now.getTime());
  const changes = state.latestImport && !state.latestImport.seenAt ? state.latestImport : null;
  const canImport = state.status === "ready" && !state.demoMode;

  return (
    <>
      <OnCallToolNavHeader title="My shifts" testIdPrefix="on-call-shifts" />
      <InformationPageShell testId="on-call-shifts-main" width="narrow">
        <h1 className="sr-only">My shifts</h1>
        <p className={cn(textMuted, "mb-4 text-sm")}>
          Your own roster, visible only to you. The next shift shows at the top of On Call.
        </p>

        {state.status === "loading" ? (
          <EmptyState icon={BriefcaseMedical} title="Loading your shifts" testId="on-call-shifts-loading" />
        ) : state.status === "signed-out" ? (
          <EmptyState
            icon={BriefcaseMedical}
            title="Sign in to add your roster"
            body="Your shifts are private to your account, so they need you to be signed in."
            testId="on-call-shifts-signed-out"
          />
        ) : state.status === "error" ? (
          <InlineNotice tone="warning">Your shifts could not be loaded. Try again later.</InlineNotice>
        ) : null}

        {state.demoMode ? (
          <div className="mb-4">
            <InlineNotice tone="info">These are demo shifts. Sign in to import your own roster.</InlineNotice>
          </div>
        ) : null}

        {canImport ? (
          <section className={cn(cardSurface, "mb-4 grid gap-3 p-4")} data-testid="on-call-shifts-import">
            <h2 className="text-base font-bold text-[color:var(--text-heading)]">Import your roster</h2>
            <p className={cn(textMuted, "text-sm")}>
              Choose the calendar file (.ics) your rostering system exports, or a spreadsheet saved as .csv with columns
              named date, start, end, role and site. The file is read on this device. Only each shift&rsquo;s times,
              role and site are saved; notes and names of other people in the file are left out.
            </p>
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept=".ics,.csv,text/calendar,text/csv"
              className="sr-only"
              data-testid="on-call-shifts-file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void readFile(file);
              }}
            />
            <Button variant="secondary" icon={Upload} onClick={() => inputRef.current?.click()}>
              Choose roster file
            </Button>
            {readError ? <InlineNotice tone="warning">{readError}</InlineNotice> : null}

            {preview ? (
              <div className="grid gap-2" data-testid="on-call-shifts-preview">
                <p className="text-sm font-semibold text-[color:var(--text)]">
                  Found {plural(preview.shifts.length, "shift")} from {formatPerthDay(preview.window.start)} to{" "}
                  {formatPerthDay(preview.window.end)}.
                </p>
                <ul className={cn(textMuted, "grid gap-1 text-sm")}>
                  {preview.shifts.slice(0, 5).map((shift) => (
                    <li key={`${shift.startsAt}-${shift.title}`}>{describeShift(shift)}</li>
                  ))}
                  {preview.shifts.length > 5 ? <li>and {preview.shifts.length - 5} more</li> : null}
                </ul>
                {preview.notes.map((note) => (
                  <p key={note} className={cn(textMuted, "text-sm")}>
                    {note}
                  </p>
                ))}
                <p className="text-sm text-[color:var(--text)]">
                  Saving replaces any shifts you already have between these dates. Shifts outside them stay.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => void save()} busy={saving} busyLabel="Saving…">
                    Save {plural(preview.shifts.length, "shift")}
                  </Button>
                  <Button variant="ghost" onClick={() => setPreview(null)} disabled={saving}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
            {saveError ? <InlineNotice tone="warning">{saveError}</InlineNotice> : null}
          </section>
        ) : null}

        {changes ? (
          <section className={cn(cardSurface, "mb-4 grid gap-2 p-4")} data-testid="on-call-shifts-changes">
            <h2 className="text-base font-bold text-[color:var(--text-heading)]">
              What changed: {describeRosterChangeCounts(changes)}
            </h2>
            <p className={cn(textMuted, "text-sm")}>
              From your latest roster, covering {formatPerthDay(changes.windowStart)} to{" "}
              {formatPerthDay(changes.windowEnd)}.
            </p>
            {changes.changes.length ? (
              <ul className="grid gap-1 text-sm text-[color:var(--text)]">
                {changes.changes.map((change, index) => (
                  <li key={index}>{describeChange(change)}</li>
                ))}
              </ul>
            ) : null}
            <div>
              <Button variant="ghost" size="sm" onClick={() => void state.dismissChanges()}>
                Dismiss
              </Button>
            </div>
          </section>
        ) : null}

        {state.status === "ready" ? (
          upcoming.length === 0 ? (
            <EmptyState
              icon={BriefcaseMedical}
              title="No shifts coming up"
              body={
                canImport ? "Import your roster above and your next shift will show on the On Call home." : undefined
              }
              testId="on-call-shifts-empty"
            />
          ) : (
            <div className="grid gap-4" data-testid="on-call-shifts-list">
              {groupByWeek(upcoming).map((group) => (
                <section key={group.week} className="grid gap-2">
                  <h2 className={cn(textMuted, "text-xs font-bold uppercase tracking-wide")}>
                    Week of {formatPerthDay(group.week)}
                  </h2>
                  <ul className="grid gap-2">
                    {group.shifts.map((shift) => {
                      const onNow = Date.parse(shift.startsAt) <= now.getTime();
                      return (
                        <li
                          key={shift.id}
                          className={cn(
                            cardSurface,
                            "grid gap-0.5 p-3",
                            onNow && "border-[color:var(--clinical-accent)]",
                          )}
                          data-testid="on-call-shifts-row"
                        >
                          <span className="text-sm font-bold text-[color:var(--text-heading)]">
                            {formatPerthDay(perthDateOf(shift.startsAt))}
                            {onNow ? " · on now" : ""}
                          </span>
                          <span className="text-sm text-[color:var(--text)]">{shiftHours(shift)}</span>
                          <span className={cn(textMuted, "break-words text-sm")}>
                            {shift.title}
                            {shift.location ? ` · ${shift.location}` : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )
        ) : null}

        {canImport && state.shifts.length > 0 ? (
          <div className="mt-6">
            <Button variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)}>
              Delete all my shifts
            </Button>
          </div>
        ) : null}

        <ConfirmDialog
          open={confirmDelete}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void deleteAll()}
          title="Delete all your shifts?"
          description="This removes every shift and every roster change record from your account. It cannot be undone, but you can import your roster again."
          confirmLabel="Delete all shifts"
          busy={deleting}
          busyLabel="Deleting…"
        />
      </InformationPageShell>
    </>
  );
}
