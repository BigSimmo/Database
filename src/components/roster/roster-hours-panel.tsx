"use client";

import { useMemo, useState } from "react";

import { ModeFactTile, ModeFactTiles } from "@/components/mode-kit/fact-tile";
import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { ModeNotice } from "@/components/mode-kit/notice";
import { modeModuleSurface } from "@/components/mode-kit/recipes";
import { modeNumberText, modeSecondaryText } from "@/components/mode-kit/type";
import { Button } from "@/components/ui/button";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { fortnightFor, summariseHours, type HoursExtra } from "@/lib/roster/hours";
import { isWorkedKind } from "@/lib/roster/shift-kind";
import type { RosterDisplayShift as OnCallShift } from "@/lib/roster/team/team-view";
import { formatPerthDay, perthDateOf } from "@/lib/roster/shifts/perth-time";

import { formatDateSpan, formatHours, kindOf } from "./roster-format";

/**
 * Hours: the fortnight as fourteen bars, extra time as a dark cap, and the
 * facts beside them. Rostered hours, not pay. There are no limits to show a
 * doctor on their own, so there is no score and no colour for "too many".
 *
 * "Stayed late" records the time from the end of the shift that just finished
 * until now, in the extra-time record Admin uses for claims. That record is
 * written here but never read back, so the extra time shown is only what was
 * recorded on this visit, and the copy says so: after a reload it starts at
 * 0 h again while the saved records stay in Admin.
 */

/** A late finish is offered for this long after a shift ends. */
const STAYED_LATE_WINDOW_MS = 8 * 60 * 60 * 1000;

export type RosterExtraTime = HoursExtra;

/** The worked shift that finished most recently, if it ended in the last eight hours. */
export function justFinished(shifts: readonly OnCallShift[], now: Date): OnCallShift | null {
  const at = now.getTime();
  let best: OnCallShift | null = null;
  for (const shift of shifts) {
    const end = Date.parse(shift.endsAt);
    if (!isWorkedKind(kindOf(shift)) || end > at || at - end > STAYED_LATE_WINDOW_MS) continue;
    if (!best || end > Date.parse(best.endsAt)) best = shift;
  }
  return best;
}

export function RosterHoursPanel({
  shifts,
  now,
  extras,
  onExtra,
  payFortnightAnchor = null,
}: {
  readonly shifts: readonly OnCallShift[];
  readonly now: Date;
  /** Extra time recorded in this visit. */
  readonly extras: readonly RosterExtraTime[];
  readonly onExtra: (extra: RosterExtraTime) => void;
  readonly payFortnightAnchor?: string | null;
}) {
  const today = perthDateOf(now);
  const summary = useMemo(
    () =>
      summariseHours(
        shifts.map((shift) => ({ startsAt: shift.startsAt, endsAt: shift.endsAt, kind: kindOf(shift) })),
        extras,
        fortnightFor(today, payFortnightAnchor),
      ),
    [shifts, extras, today, payFortnightAnchor],
  );
  const scale = Math.max(12, ...summary.days.map((day) => day.hours + day.extraHours));
  const finished = justFinished(shifts, now);
  const alreadyLogged = finished ? extras.some((extra) => extra.startedAt === finished.endsAt) : false;
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "neutral" | "warning"; text: string } | null>(null);

  async function stayedLate() {
    if (!finished) return;
    const extra = { startedAt: finished.endsAt, endedAt: now.toISOString() };
    setSaving(true);
    try {
      const response = await fetch("/api/roster/extra-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "stayed_late", ...extra }),
      });
      if (!response.ok) setMessage({ tone: "warning", text: "Extra time could not be saved. Try again." });
      else {
        onExtra(extra);
        setMessage({ tone: "neutral", text: "Saved" });
      }
    } catch {
      setMessage({ tone: "warning", text: "Extra time could not be saved. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-5" data-testid="roster-hours">
      <section className={cn(modeModuleSurface, "grid gap-3 p-3")} aria-label="Rostered hours">
        <div className="grid gap-0.5">
          <span className={cn(modeNumberText, "text-lg-minus text-[color:var(--text-heading)]")}>
            {formatHours(summary.totalHours)} <span className={modeSecondaryText}>rostered, not pay</span>
          </span>
          <span className={modeSecondaryText}>{formatDateSpan(summary.start, summary.end)}</span>
        </div>
        <ol className="grid h-28 grid-cols-14 items-end gap-1" aria-label="Hours each day">
          {summary.days.map((day) => (
            <li
              key={day.date}
              className="flex h-full flex-col justify-end"
              aria-label={`${formatPerthDay(day.date)}: ${formatHours(day.hours)}${
                day.extraHours ? `, extra ${formatHours(day.extraHours)}` : ""
              }`}
            >
              {day.extraHours ? (
                <span
                  aria-hidden="true"
                  className="w-full rounded-t-sm bg-[color:var(--command)]"
                  style={{ height: `${(day.extraHours / scale) * 100}%` }}
                />
              ) : null}
              <span
                aria-hidden="true"
                className={cn(
                  "w-full bg-[color:var(--border-strong)]",
                  day.extraHours ? "" : "rounded-t-sm",
                  day.date === today && "bg-[color:var(--text-muted)]",
                )}
                style={{ height: `${(day.hours / scale) * 100}%` }}
              />
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-14 gap-1" aria-hidden="true">
          {summary.days.map((day) => (
            <span key={day.date} className="nums text-center text-xs text-[color:var(--text-muted)]">
              {Number(day.date.slice(8, 10))}
            </span>
          ))}
        </div>
      </section>

      <ModeFactTiles testId="roster-hours-facts">
        <ModeFactTile
          label="Shortest break"
          value={summary.shortestBreakHours === null ? "–" : formatHours(summary.shortestBreakHours)}
        />
        <ModeFactTile label="Most in any 7 days" value={formatHours(summary.maxHoursIn7Days)} />
        <ModeFactTile label="Most days in a row" value={summary.maxDaysInRow} />
        <ModeFactTile label="Extra time recorded this visit" value={formatHours(summary.extraHours)} />
      </ModeFactTiles>

      <section className="grid gap-2" aria-label="Extra time">
        <h2 className={cn(eyebrowText, "px-3")}>Extra time</h2>
        <Button
          variant="secondary"
          disabled={!finished || alreadyLogged || saving}
          busy={saving}
          busyLabel="Saving…"
          onClick={() => void stayedLate()}
        >
          Stayed late
        </Button>
        <p className={cn(modeSecondaryText, "px-3")}>
          Only extra time recorded on this visit is counted here. Saved extra time is kept in Admin, where you claim it.
        </p>
        {message ? <ModeNotice tone={message.tone}>{message.text}</ModeNotice> : null}
      </section>

      <ModeGroupedList testId="roster-hours-claim">
        <ModeRow title="Claim in Admin" href="/my-work" testId="roster-hours-claim-link" />
      </ModeGroupedList>
    </div>
  );
}
