"use client";

import { useMemo, useState } from "react";

import { focusRing } from "@/components/card-recipes";
import { InformationPageShell } from "@/components/information-page-shell";
import { ModeFactTile, ModeFactTiles } from "@/components/mode-kit/fact-tile";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { ModeNotice } from "@/components/mode-kit/notice";
import { AttendanceChart, attendanceWeeks } from "@/components/teaching/attendance-chart";
import { LogToCpdSheet } from "@/components/teaching/log-to-cpd-sheet";
import { attendanceCsv, csvHref, logbookFigures, logbookGroups } from "@/components/teaching/organise-model";
import { mondayOf, perthDateKey } from "@/components/teaching/teaching-dates";
import { LogbookLedger, TeachingModule } from "@/components/teaching/teaching-modules";
import { withUnit } from "@/components/teaching/teaching-number";
import { TeachingSignInNotice } from "@/components/teaching/teaching-sign-in";
import { TeachingStateNotice } from "@/components/teaching/teaching-states";
import { useTeachingNow } from "@/components/teaching/use-teaching-now";
import { useTeachingResource } from "@/components/teaching/use-teaching-resource";
import { cn } from "@/components/ui-primitives";
import { demoTeachingLogbook } from "@/lib/teaching/demo-programme";
import type { LogbookRow } from "@/lib/teaching/model";

/*
 * Logbook: three figures (this term is the chart's 12 weeks), the attendance
 * chart, the ledger by month (an unlogged row opens Log to CPD, a logged row
 * links to its CPD entry), then Download CSV. The CSV is built from the rows
 * already on screen, so the download sends nothing anywhere and stores nothing.
 * The page name is the pill, so the h1 is sr-only.
 */
export function TeachingLogbook({ demoMode }: { demoMode: boolean }) {
  const now = useTeachingNow();
  const resource = useTeachingResource<{ attendance: LogbookRow[] }>(demoMode ? null : "/api/teaching?view=logbook");
  const rows = useMemo(
    () => (demoMode ? (now ? demoTeachingLogbook(now) : null) : (resource.data?.attendance ?? null)),
    [demoMode, now, resource.data],
  );
  const [logging, setLogging] = useState<LogbookRow | null>(null);
  const [demoNote, setDemoNote] = useState(false);
  // The demo's rows are made up, so nothing is ever sent to CPD from them.
  const onLog = demoMode ? () => setDemoNote(true) : setLogging;

  let body;
  if (resource.status === "signed-out") body = <TeachingSignInNotice />;
  else if (resource.status === "offline" || resource.status === "error" || resource.status === "setup")
    body = <TeachingStateNotice state={resource.status} onRetry={resource.retry} />;
  else if (!now || !rows) body = <ModeModuleSkeleton rows={3} />;
  else if (rows.length === 0) body = <ModeNotice>No check-ins yet. Sessions you check in to show here.</ModeNotice>;
  else {
    const today = perthDateKey(now);
    const weeks = attendanceWeeks(
      rows.map((r) => r.startsAt),
      today,
    );
    body = (
      <>
        <div role="group" aria-label="Your attendance">
          <ModeFactTiles testId="teaching-logbook-figures">
            {logbookFigures(rows, today).map((figure) => (
              <ModeFactTile
                key={figure.id}
                label={figure.label}
                value={figure.unit ? withUnit(figure.value, figure.unit) : figure.value}
              />
            ))}
          </ModeFactTiles>
        </div>
        <TeachingModule title={`Last ${withUnit(12, "weeks")}`}>
          <AttendanceChart weeks={weeks} currentKey={mondayOf(today)} />
        </TeachingModule>
        {demoNote ? <ModeNotice>The demo doesn&apos;t save to CPD.</ModeNotice> : null}
        <LogbookLedger groups={logbookGroups(rows, onLog)} />
        <a
          href={csvHref(attendanceCsv(rows))}
          download="teaching-attendance.csv"
          className={cn(
            "inline-flex min-h-12 items-center self-start px-1 text-sm font-medium text-[color:var(--primary)]",
            focusRing,
          )}
        >
          Download CSV
        </a>
        {logging ? (
          <LogToCpdSheet
            open
            onClose={() => setLogging(null)}
            occurrenceId={logging.occurrenceId}
            startsAt={logging.startsAt}
            endsAt={logging.endsAt}
            onLogged={() => resource.retry()}
          />
        ) : null}
      </>
    );
  }
  return (
    <InformationPageShell width="narrow" gap={false} testId="teaching-logbook">
      <div className="grid gap-3">
        <h1 className="sr-only">Logbook</h1>
        {body}
      </div>
    </InformationPageShell>
  );
}
