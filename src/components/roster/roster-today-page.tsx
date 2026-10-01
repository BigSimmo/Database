"use client";

import { CalendarDays, CalendarRange, Moon, MoonStar, Plane, Sun } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { InformationPageShell } from "@/components/information-page-shell";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { ModeNotice } from "@/components/mode-kit/notice";
import {
  modeDot,
  modeModuleSurface,
  modeSummaryHairline,
  modeSummaryMutedText,
  modeSummarySurface,
} from "@/components/mode-kit/recipes";
import { modeDisplayNumberText, modeNumberText } from "@/components/mode-kit/type";
import { Button } from "@/components/ui/button";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { SHIFT_KIND_LABEL } from "@/lib/roster/shift-kind";
import type { RosterDisplayShift as OnCallShift } from "@/lib/roster/team/team-view";
import { formatPerthDay, perthDateOf, perthTimeOf } from "@/lib/roster/shifts/perth-time";
import { summariseToday, type TodaySummary } from "@/lib/roster/today";

import { RosterAddSheet, type RosterAddView } from "./roster-add-sheet";
import { RosterSampleShiftsNotice } from "./team/roster-sample-notice";
import { RosterTodayTeam } from "./team/roster-today-team";
import { formatDateSpan, formatDuration, kindOf, shiftTimes, useRosterNow } from "./roster-format";
import { RosterImportFlow } from "./roster-import-flow";
import { RosterNightDial } from "./roster-night-dial";
import { RosterIdentityTile, RosterPageHeader, RosterSection, RosterStat, RosterStats } from "./roster-ui";
import { RosterWeekStrip } from "./roster-week-strip";
import { hasFreshLink, refreshDueRosterLinks, useRosterLinks } from "./use-roster-links";
import { useRosterSettings } from "./use-roster-settings";
import { useRosterShifts } from "./use-roster-shifts";

/**
 * Roster Today: where am I working, when, answered with no taps. The lead
 * comes from `summariseToday`: on now, before today's shift, a day off leading
 * with the next shift, or empty with both ways in. Between 00:00 and 06:00 on a
 * night the lead becomes the night dial.
 */

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
    <p className="flex items-center gap-1.5 text-xs text-[color:var(--text-muted)]" data-testid="roster-fresh">
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
      <span className="relative block h-2.5 rounded-full bg-[color:var(--surface-summary-line)]">
        {end > start ? (
          <span
            className="absolute inset-y-0 rounded-full bg-[color:var(--surface-summary-muted)]"
            style={{ left: `${start * 100}%`, width: `${(end - start) * 100}%` }}
          />
        ) : null}
        <span
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--surface-summary-ink)] ring-4 ring-[color:var(--surface-summary)] forced-colors:border"
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
      <section className={cn(modeModuleSurface, "grid justify-items-start gap-3 p-5")} data-testid="roster-today-empty">
        <RosterIdentityTile icon={CalendarRange} />
        <h2 className="text-lg-minus font-semibold text-[color:var(--text-heading)]">Get your shifts in</h2>
        <p className="text-sm text-[color:var(--text-muted)]">
          Import your roster file or add a shift, and Today will show where you&apos;re working and when.
        </p>
        <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
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
    return (
      <RosterNightDial
        shift={leadShift}
        now={now}
        workplace={leadShift.workplace ?? leadShift.location}
        teamShift={
          leadShift.serviceId && leadShift.assignmentId
            ? { serviceId: leadShift.serviceId, assignmentId: leadShift.assignmentId }
            : null
        }
      />
    );
  }

  const eyebrow =
    lead.state === "day_off"
      ? lead.finishedToday
        ? "Finished for today"
        : "Day off"
      : `${leadShift ? SHIFT_KIND_LABEL[kindOf(leadShift)] : "Shift"}${
          leadShift?.workplace ? ` · ${leadShift.workplace}` : ""
        }`;
  const place = leadShift?.location && leadShift.location !== leadShift.workplace ? leadShift.location : null;
  let when: string | null = null;
  if (leadShift && lead.state === "before")
    when = `Starts in ${formatDuration(Date.parse(leadShift.startsAt) - now.getTime())}`;
  if (leadShift && lead.state === "on_now")
    when = `Ends in ${formatDuration(Date.parse(leadShift.endsAt) - now.getTime())}`;

  // Only a live or upcoming shift earns a pill; a day off already says so in the eyebrow.
  const status = lead.state === "on_now" ? "On now" : lead.state === "before" ? "Later today" : null;
  return (
    <section
      className={cn(modeSummarySurface, "relative isolate grid gap-3 overflow-hidden p-5")}
      data-testid="roster-today-hero"
      aria-label="Today"
    >
      {/* A soft violet glow in the corner: decoration only, never a signal. */}
      <span
        aria-hidden="true"
        data-mode-identity="roster"
        className="pointer-events-none absolute -right-20 -top-24 -z-10 size-56 rounded-full bg-[color:var(--mode-identity)] opacity-40 blur-3xl forced-colors:hidden"
      />
      <div className="flex items-center justify-between gap-2">
        <h2 className={cn(eyebrowText, modeSummaryMutedText)}>{eyebrow}</h2>
        {status ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
              modeSummaryHairline,
              lead.state === "on_now" ? "text-[color:var(--surface-summary-ink)]" : modeSummaryMutedText,
            )}
          >
            {lead.state === "on_now" ? (
              <span aria-hidden="true" className={cn(modeDot, "bg-[color:var(--success)]")} />
            ) : null}
            {status}
          </span>
        ) : null}
      </div>
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

/** A warm line under the date, from the Perth hour. */
function greetingFor(now: Date): { readonly text: string; readonly icon: typeof Sun } {
  const hour = Number(perthTimeOf(now).slice(0, 2));
  if (hour >= 5 && hour < 12) return { text: "Good morning", icon: Sun };
  if (hour >= 12 && hour < 18) return { text: "Good afternoon", icon: Sun };
  return { text: "Good evening", icon: Moon };
}

export function RosterTodayPage({ now: pinnedNow }: { readonly now?: Date } = {}) {
  const now = useRosterNow(pinnedNow);
  const shifts = useRosterShifts();
  const links = useRosterLinks();
  const settings = useRosterSettings();
  const [importing, setImporting] = useState(false);
  const [addView, setAddView] = useState<RosterAddView | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Opening Today refreshes any calendar link that is due (the server decides which). Once per visit, never retried.
  const refreshStarted = useRef(false);
  const { reload: reloadShifts } = shifts;
  const { reload: reloadLinks } = links;
  useEffect(() => {
    if (refreshStarted.current) return;
    refreshStarted.current = true;
    void refreshDueRosterLinks().then((results) => {
      if (!results || results.length === 0) return;
      void reloadLinks();
      if (results.some((result) => result.ok)) void reloadShifts();
    });
  }, [reloadLinks, reloadShifts]);

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
  const greeting = greetingFor(now);

  return (
    <InformationPageShell testId="roster-today-main" width="narrow">
      <RosterPageHeader
        icon={greeting.icon}
        eyebrow={formatPerthDay(today)}
        title="Today"
        subtitle={
          <div className="grid gap-0.5">
            <span>{greeting.text}</span>
            <RosterFreshness fresh={hasFreshLink(links.links, now)} />
          </div>
        }
        testId="roster-today-header"
      />

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
              <RosterSampleShiftsNotice sample={shifts.sample} />
              {saved ? <ModeNotice>{saved}</ModeNotice> : null}
              {shifts.teamMessage ? <ModeNotice tone="warning">{shifts.teamMessage}</ModeNotice> : null}
              <Hero
                summary={summary}
                byId={byId}
                now={now}
                canEdit={canEdit}
                onImport={() => setImporting(true)}
                onAddShift={() => setAddView("shift")}
              />
              <RosterTodayTeam now={now} myShifts={shifts.shifts} sampleNoticeShown={shifts.sample} />
              {summary.lead.state !== "empty" ? (
                <>
                  <RosterSection icon={CalendarDays} title="This week" id="roster-today-week">
                    <div className={cn(modeModuleSurface, "px-2 py-3")}>
                      <RosterWeekStrip week={summary.week} today={today} testId="roster-today-week-strip" />
                    </div>
                  </RosterSection>
                  <RosterStats testId="roster-today-facts">
                    {shownNextNight ? (
                      <RosterStat
                        icon={Moon}
                        label="Next night"
                        value={formatPerthDay(perthDateOf(shownNextNight.startsAt))}
                        testId="roster-today-next-night"
                      />
                    ) : null}
                    <RosterStat
                      icon={MoonStar}
                      label="Next nights"
                      value={
                        summary.nextNights ? formatDateSpan(summary.nextNights.start, summary.nextNights.end) : "–"
                      }
                    />
                    <RosterStat
                      icon={Plane}
                      label="Next leave"
                      value={summary.nextLeave ? formatDateSpan(summary.nextLeave.start, summary.nextLeave.end) : "–"}
                    />
                  </RosterStats>
                </>
              ) : null}
            </>
          )}
        </div>
      )}

      <p className="px-1 pt-2 text-center text-xs text-[color:var(--text-muted)]">
        Your copy of the roster. Check official changes with your service.
      </p>

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
            void shifts.reload();
            setAddView(null);
            setSaved("Saved");
          }
          return failure;
        }}
      />
    </InformationPageShell>
  );
}
