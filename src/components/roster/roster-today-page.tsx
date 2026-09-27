"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { InformationPageShell } from "@/components/information-page-shell";
import { ModeFactTile, ModeFactTiles } from "@/components/mode-kit/fact-tile";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { ModeNotice } from "@/components/mode-kit/notice";
import {
  modeDot,
  modeIconTile,
  modeIdentityIcon,
  modeModuleSurface,
  modeSummaryHairline,
  modeSummaryMutedText,
  modeSummarySurface,
} from "@/components/mode-kit/recipes";
import { modeDisplayNumberText, modeNumberText } from "@/components/mode-kit/type";
import { Button } from "@/components/ui/button";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { SHIFT_KIND_LABEL } from "@/lib/roster/shift-kind";
import type { OnCallShift } from "@/lib/roster/shifts/model";
import { formatPerthDay, perthDateOf, perthTimeOf } from "@/lib/roster/shifts/perth-time";
import { summariseToday, type TodaySummary } from "@/lib/roster/today";

import { RosterAddSheet, type RosterAddView } from "./roster-add-sheet";
import { formatDateSpan, formatDuration, kindOf, shiftTimes, useRosterNow } from "./roster-format";
import { RosterImportFlow } from "./roster-import-flow";
import { RosterNightDial } from "./roster-night-dial";
import { RosterWeekStrip } from "./roster-week-strip";
import { hasFreshLink, useRosterLinks } from "./use-roster-links";
import { useRosterSettings } from "./use-roster-settings";
import { useRosterShifts } from "./use-roster-shifts";

/**
 * Roster Today: where am I working, when, answered with no taps. The lead
 * comes from `summariseToday`: on now, before today's shift, a day off leading
 * with the next shift, or empty with both ways in. Between 00:00 and 06:00 on a
 * night the lead becomes the night dial.
 */

const MODE = "roster";
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "Up to date": a 6px green dot and the words, shown only while a calendar
 * link refreshed in the last six hours. One 600ms pulse when it changes to
 * fresh while the page is open, never on first load, never with reduced motion.
 */
function RosterFreshness({ fresh }: { readonly fresh: boolean }) {
  const dot = useRef<HTMLSpanElement>(null);
  const previous = useRef<boolean | null>(null);
  useEffect(() => {
    const was = previous.current;
    previous.current = fresh;
    if (!fresh || was !== false || !dot.current?.animate) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    dot.current.animate(
      [
        { boxShadow: "0 0 0 0 var(--success)", opacity: 1 },
        { boxShadow: "0 0 0 6px transparent", opacity: 1 },
      ],
      { duration: 600, easing: "ease-out", iterations: 1 },
    );
  }, [fresh]);
  if (!fresh) return null;
  return (
    <p className="flex items-center gap-1.5 px-3 text-xs text-[color:var(--text-muted)]" data-testid="roster-fresh">
      <span ref={dot} aria-hidden="true" className={cn(modeDot, "bg-[color:var(--success)]")} />
      Up to date
    </p>
  );
}

function DayLine({ shift, now }: { readonly shift: OnCallShift; readonly now: Date }) {
  const today = perthDateOf(now);
  const dayStart = Date.parse(`${today}T00:00:00+08:00`);
  const start = Math.max(0, (Date.parse(shift.startsAt) - dayStart) / DAY_MS);
  const end = Math.min(1, (Date.parse(shift.endsAt) - dayStart) / DAY_MS);
  const at = (now.getTime() - dayStart) / DAY_MS;
  return (
    <div className="grid gap-1" aria-hidden="true">
      <span className="relative block h-2 rounded-full bg-[color:var(--surface-summary-line)]">
        {end > start ? (
          <span
            className="absolute inset-y-0 rounded-full bg-[color:var(--surface-summary-muted)]"
            style={{ left: `${start * 100}%`, width: `${(end - start) * 100}%` }}
          />
        ) : null}
        <span
          className="absolute -inset-y-1 w-px bg-[color:var(--surface-summary-ink)]"
          style={{ left: `${at * 100}%` }}
        />
      </span>
      <span className={cn("nums flex justify-between text-xs", modeSummaryMutedText)}>
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </span>
    </div>
  );
}

function ShiftTimes({ shift }: { readonly shift: OnCallShift }) {
  const { start, end, plusOne } = shiftTimes(shift);
  return (
    <span className={cn(modeDisplayNumberText, "flex flex-wrap items-baseline gap-x-1 text-hero")}>
      <span>{start}</span>
      <span aria-hidden="true">–</span>
      <span className="sr-only">to</span>
      <span>{end}</span>
      {plusOne ? <span className={cn(modeSummaryMutedText, "text-sm")}>+1</span> : null}
    </span>
  );
}

function Hero({
  summary,
  byId,
  now,
  canEdit,
  onImport,
  onAddShift,
}: {
  readonly summary: TodaySummary;
  readonly canEdit: boolean;
  readonly byId: ReadonlyMap<string, OnCallShift>;
  readonly now: Date;
  readonly onImport: () => void;
  readonly onAddShift: () => void;
}) {
  const lead = summary.lead;
  if (lead.state === "empty") {
    return (
      <section className={cn(modeModuleSurface, "grid gap-3 p-4")} data-testid="roster-today-empty">
        <h2 className="text-lg-minus font-medium text-[color:var(--text-heading)]">Get your shifts in</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={onImport} disabled={!canEdit}>
            Import a file
          </Button>
          <Button variant="secondary" onClick={onAddShift} disabled={!canEdit}>
            Add a shift
          </Button>
        </div>
        <p className="text-sm text-[color:var(--text-muted)]">
          In a hospital team? Your roster manager will invite you.
        </p>
      </section>
    );
  }

  const leadShift =
    lead.state === "day_off"
      ? lead.next
        ? (byId.get(lead.next.id) ?? null)
        : null
      : (byId.get(lead.shift.id) ?? null);

  if (lead.state === "on_now" && lead.isNight && leadShift && Number(perthTimeOf(now).slice(0, 2)) < 6) {
    return <RosterNightDial shift={leadShift} now={now} workplace={leadShift.workplace ?? leadShift.location} />;
  }

  const eyebrow =
    lead.state === "day_off"
      ? "Day off"
      : `${leadShift ? SHIFT_KIND_LABEL[kindOf(leadShift)] : "Shift"}${
          leadShift?.workplace ? ` · ${leadShift.workplace}` : ""
        }`;
  const place = leadShift?.location && leadShift.location !== leadShift.workplace ? leadShift.location : null;
  let when: string | null = null;
  if (leadShift && lead.state === "before")
    when = `Starts in ${formatDuration(Date.parse(leadShift.startsAt) - now.getTime())}`;
  if (leadShift && lead.state === "on_now")
    when = `Ends in ${formatDuration(Date.parse(leadShift.endsAt) - now.getTime())}`;

  return (
    <section className={cn(modeSummarySurface, "grid gap-3 p-4")} data-testid="roster-today-hero" aria-label="Today">
      <h2 className={cn(eyebrowText, modeSummaryMutedText)}>{eyebrow}</h2>
      {leadShift ? (
        <>
          {lead.state === "day_off" ? (
            <span className="text-base-minus" data-testid="roster-today-next">
              {`Next: ${SHIFT_KIND_LABEL[kindOf(leadShift)]}, `}
              <span>{formatPerthDay(perthDateOf(leadShift.startsAt))}</span>
            </span>
          ) : null}
          <ShiftTimes shift={leadShift} />
          {when || place ? (
            <span className={cn(modeSummaryMutedText, "text-sm")}>{[when, place].filter(Boolean).join(" · ")}</span>
          ) : null}
          {lead.state !== "day_off" ? <DayLine shift={leadShift} now={now} /> : null}
        </>
      ) : (
        <span className={cn(modeSummaryMutedText, "text-sm")}>No more shifts in your roster.</span>
      )}
      {summary.nextWeekendOff ? (
        <div className={cn("border-t pt-3", modeSummaryHairline)}>
          <span className={cn(modeSummaryMutedText, "text-xs")}>Weekend off</span>
          <span className={cn(modeNumberText, "block text-base-minus")}>
            {formatDateSpan(summary.nextWeekendOff.saturday, summary.nextWeekendOff.sunday)}
          </span>
        </div>
      ) : null}
    </section>
  );
}

export function RosterTodayPage({ now: pinnedNow }: { readonly now?: Date } = {}) {
  const now = useRosterNow(pinnedNow);
  const shifts = useRosterShifts();
  const links = useRosterLinks();
  const settings = useRosterSettings();
  const [importing, setImporting] = useState(false);
  const [addView, setAddView] = useState<RosterAddView | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const today = perthDateOf(now);
  const byId = useMemo(() => new Map(shifts.shifts.map((shift) => [shift.id, shift])), [shifts.shifts]);
  const summary = useMemo(
    () =>
      summariseToday(
        shifts.shifts.map((shift) => ({
          id: shift.id,
          startsAt: shift.startsAt,
          endsAt: shift.endsAt,
          kind: kindOf(shift),
        })),
        now,
      ),
    [shifts.shifts, now],
  );
  const workplaces = useMemo(
    () => [...new Set(shifts.shifts.flatMap((shift) => (shift.workplace ? [shift.workplace] : [])))],
    [shifts.shifts],
  );

  const leadIsNight =
    (summary.lead.state === "before" || summary.lead.state === "on_now") && summary.lead.shift.kind === "night"
      ? summary.lead.shift
      : summary.lead.state === "day_off" && summary.lead.next?.kind === "night"
        ? summary.lead.next
        : null;
  const nextNight = shifts.shifts
    .filter((shift) => kindOf(shift) === "night" && Date.parse(shift.startsAt) > now.getTime())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
  const shownNextNight = nextNight && nextNight.id !== leadIsNight?.id ? nextNight : null;
  const canEdit = shifts.status === "ready" && !shifts.demoMode;

  return (
    <InformationPageShell testId="roster-today-main" width="narrow">
      <h1 className="sr-only">Today</h1>

      {importing ? (
        <RosterImportFlow
          shifts={shifts}
          settings={settings}
          today={today}
          onClose={() => setImporting(false)}
          onSaved={() => {
            setImporting(false);
            setSaved("Saved");
          }}
        />
      ) : (
        <div className="grid min-w-0 gap-5">
          <RosterFreshness fresh={hasFreshLink(links.links, now)} />

          {shifts.status === "loading" ? (
            <ModeModuleSkeleton rows={4} testId="roster-today-loading" />
          ) : shifts.status === "signed-out" ? (
            <ModeNotice testId="roster-today-signed-out">Sign in to see your roster.</ModeNotice>
          ) : shifts.status === "error" ? (
            <ModeNotice tone="warning" testId="roster-today-error">
              Your shifts could not be loaded. Try again later.
            </ModeNotice>
          ) : (
            <>
              {shifts.demoMode ? <ModeNotice>Example only. Sign in to add your own shifts.</ModeNotice> : null}
              {saved ? <ModeNotice>{saved}</ModeNotice> : null}
              <Hero
                summary={summary}
                byId={byId}
                now={now}
                canEdit={canEdit}
                onImport={() => setImporting(true)}
                onAddShift={() => setAddView("shift")}
              />
              {summary.lead.state !== "empty" ? (
                <>
                  {shownNextNight ? (
                    <ModeFactTiles testId="roster-today-next-night">
                      <ModeFactTile label="Next night" value={formatPerthDay(perthDateOf(shownNextNight.startsAt))} />
                    </ModeFactTiles>
                  ) : null}
                  <section className="grid gap-2" aria-labelledby="roster-today-week">
                    <div className="flex items-center gap-2 px-3">
                      <span aria-hidden="true" data-mode-identity={MODE} className={modeIconTile}>
                        <CalendarDays aria-hidden="true" strokeWidth={1.5} className={modeIdentityIcon} />
                      </span>
                      <h2 id="roster-today-week" className={eyebrowText}>
                        This week
                      </h2>
                    </div>
                    <div className={cn(modeModuleSurface, "p-3")}>
                      <RosterWeekStrip week={summary.week} today={today} testId="roster-today-week-strip" />
                    </div>
                  </section>
                  <ModeFactTiles testId="roster-today-facts">
                    <ModeFactTile
                      label="Next leave"
                      value={summary.nextLeave ? formatDateSpan(summary.nextLeave.start, summary.nextLeave.end) : "–"}
                    />
                    <ModeFactTile
                      label="Next nights"
                      value={
                        summary.nextNights ? formatDateSpan(summary.nextNights.start, summary.nextNights.end) : "–"
                      }
                    />
                  </ModeFactTiles>
                </>
              ) : null}
            </>
          )}
        </div>
      )}

      <RosterAddSheet
        open={addView !== null}
        view={addView ?? "shift"}
        onViewChange={setAddView}
        onClose={() => setAddView(null)}
        today={today}
        workplaces={workplaces}
        onImportFile={() => {
          setAddView(null);
          setImporting(true);
        }}
        onAddShift={async (request) => {
          const failure = await shifts.addManual(request);
          if (!failure) {
            setAddView(null);
            setSaved("Saved");
          }
          return failure;
        }}
        onAddLink={async (url, workplace) => {
          const failure = await links.add(url, workplace);
          if (!failure) {
            setAddView(null);
            setSaved("Saved");
          }
          return failure;
        }}
      />
    </InformationPageShell>
  );
}
