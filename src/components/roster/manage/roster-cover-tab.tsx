"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { fetchRosterRead, postRosterAction, useRosterRead } from "@/components/roster/use-roster-team";
import { addDaysToDate, formatPerthDay, perthDateOf } from "@/lib/roster/shifts/perth-time";
import { fairnessCounts } from "@/lib/roster/team/fairness";
import { openShiftCandidates } from "@/lib/roster/team/eligibility";
import type { RosterAssignment, RosterOverview, RosterMaker } from "@/lib/roster/team/model";

function Fairness({ serviceId, overview }: { serviceId: string; overview: RosterOverview }) {
  const period = overview.latestPublication;
  const [result, setResult] = useState<{ key: string; assignments: RosterAssignment[] } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const key = period ? `${serviceId}:${period.id}` : "";
  useEffect(() => {
    if (!period) return;
    let alive = true;
    const windows = [];
    for (let from = period.periodStart; from <= period.periodEnd; from = addDaysToDate(from, 62)) {
      windows.push({
        from,
        to: addDaysToDate(from, 61) < period.periodEnd ? addDaysToDate(from, 61) : period.periodEnd,
      });
    }
    void Promise.all(windows.map((range) => fetchRosterRead(serviceId, "assignments", range))).then((parts) => {
      if (!alive) return;
      if (parts.some((part) => !part.ok)) {
        setError(true);
        return;
      }
      const rows = new Map<string, RosterAssignment>();
      parts.forEach((part) => {
        if (part.ok) part.data.assignments.forEach((row) => rows.set(row.id, row));
      });
      setResult({ key, assignments: [...rows.values()] });
      setError(false);
    });
    return () => {
      alive = false;
    };
  }, [period, serviceId, key, attempt]);
  if (!period) return <p>Fairness counts appear after the first publication.</p>;
  if (error)
    return (
      <div>
        <p>Fairness counts could not be loaded.</p>
        <Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>
          Try again
        </Button>
      </div>
    );
  if (result?.key !== key) return <p>Loading fairness counts…</p>;
  const rows = fairnessCounts(result.assignments, { from: period.periodStart, to: period.periodEnd });
  return (
    <section className="grid gap-2">
      <h2 className="font-normal">
        Nights, weekends and public holidays, {formatPerthDay(period.periodStart)}–{formatPerthDay(period.periodEnd)}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {["Person", "Nights", "Weekend shifts", "Public holidays", "Hours"].map((label) => (
                <th className="p-2 font-normal" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-t" key={row.userId}>
                <th className="p-2 font-normal">{row.name}</th>
                <td className="p-2">{row.nights}</td>
                <td className="p-2">{row.weekendShifts}</td>
                <td className="p-2">{row.publicHolidayShifts}</td>
                <td className="p-2">{row.hours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Counts cover this team&apos;s roster only. Leave and on-call time are excluded from worked hours.
      </p>
    </section>
  );
}

type Need = RosterMaker["needs"][number];
function Gap({
  date,
  need,
  assignments,
  overview,
  serviceId,
  onPosted,
}: {
  date: string;
  need: Need;
  assignments: RosterAssignment[];
  overview: RosterOverview;
  serviceId: string;
  onPosted: () => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (need.kind === "leave") return null;
  if (need.grade === "other")
    return (
      <p>
        Gap: {formatPerthDay(date)} {need.kind}. Clarify the required grade before posting this shift.
      </p>
    );
  const startsAt = start ? `${date}T${start}:00+08:00` : "";
  const endsAt = end ? `${end <= start ? addDaysToDate(date, 1) : date}T${end}:00+08:00` : "";
  const candidates =
    startsAt && endsAt
      ? openShiftCandidates(assignments, { startsAt, endsAt, minGrade: need.grade }, overview.settings, null)
      : [];
  async function post() {
    if (!start || !end || !code.trim() || busy || need.kind === "leave") return;
    setBusy(true);
    const result = await postRosterAction(serviceId, {
      action: "open.post",
      startsAt,
      endsAt,
      shiftCode: code.trim(),
      kind: need.kind,
      siteId: need.siteId,
      minGrade: need.grade as Exclude<Need["grade"], "other">,
    });
    setBusy(false);
    setMessage(result.ok ? "Posted to your team" : result.message);
    if (result.ok) onPosted();
  }
  return (
    <div className="grid gap-3 rounded-xl border border-[color:var(--warning)] p-3">
      <p>
        Gap: {formatPerthDay(date)} {need.kind}
        {need.grade ? ` · ${need.grade}` : ""}. Fewer people rostered than needed.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <TextField label="Starts (Perth)" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        <TextField label="Ends (Perth)" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <TextField label="Shift code" maxLength={12} value={code} onChange={(e) => setCode(e.target.value)} />
      {start && end ? (
        <p className="text-sm">
          {candidates.length
            ? `${candidates.map((person) => person.name ?? "Team member").join(", ")} may be able to take it. Team rules are checked again on acceptance.`
            : "No eligible colleague found in the loaded team roster."}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      <Button variant="secondary" disabled={busy || !start || !end || !code.trim()} onClick={() => void post()}>
        Post gap
      </Button>
    </div>
  );
}

export function RosterCoverTab({ serviceId, overview }: { serviceId: string; overview: RosterOverview }) {
  const today = perthDateOf(new Date());
  const assignments = useRosterRead(serviceId, "assignments", {
    from: addDaysToDate(today, -7),
    to: addDaysToDate(today, 20),
  });
  const maker = useRosterRead(serviceId, "maker");
  const manage = useRosterRead(serviceId, "manage");
  const [reminded, setReminded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDaysToDate(today, 13));
  if (!assignments.data || !maker.data)
    return (
      <div>
        <p>{assignments.message ?? maker.message ?? "Loading cover…"}</p>
        {assignments.status === "error" || maker.status === "error" ? (
          <Button
            onClick={() => {
              assignments.reload();
              maker.reload();
            }}
          >
            Try again
          </Button>
        ) : null}
      </div>
    );
  const shifts = assignments.data.assignments;
  const days = Array.from({ length: 14 }, (_, index) => addDaysToDate(today, index));
  const matchingNeeds = (date: string, kind: string) =>
    maker.data!.needs.filter(
      (need) =>
        need.kind === kind &&
        (need.date ? need.date === date : need.weekday === new Date(`${date}T00:00:00Z`).getUTCDay()),
    );
  const gaps = days.flatMap((date) =>
    maker
      .data!.needs.filter(
        (need) =>
          need.kind !== "leave" &&
          (need.date ? need.date === date : need.weekday === new Date(`${date}T00:00:00Z`).getUTCDay()) &&
          shifts.filter(
            (row) =>
              perthDateOf(row.startsAt) === date &&
              row.kind === need.kind &&
              (!need.grade || row.grade === need.grade) &&
              (!need.siteId || row.siteId === need.siteId),
          ).length < need.needed,
      )
      .map((need) => ({ date, need })),
  );
  async function remind() {
    setBusy(true);
    try {
      const response = await fetch(`/api/roster/team/${encodeURIComponent(serviceId)}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) {
        setMessage("Reminders could not be sent. Try again.");
        return;
      }
      setReminded(true);
    } catch {
      setMessage("Reminders could not be sent. Check your connection.");
    } finally {
      setBusy(false);
    }
  }
  const exportDays = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  return (
    <section className="grid gap-6" aria-label="Cover">
      <h2>Next two weeks</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="p-2 font-normal">Day</th>
              {["day", "evening", "night"].map((kind) => (
                <th key={kind} className="p-2 font-normal capitalize">
                  {kind}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((date) => (
              <tr key={date} className="border-t">
                <th className="p-2 font-normal">{formatPerthDay(date)}</th>
                {["day", "evening", "night"].map((kind) => {
                  const needs = matchingNeeds(date, kind);
                  const count = shifts.filter((row) => perthDateOf(row.startsAt) === date && row.kind === kind).length;
                  return (
                    <td key={kind} className="p-2">
                      {count}
                      {needs.length ? ` / ${needs.reduce((sum, row) => sum + row.needed, 0)}` : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!maker.data.needs.length ? (
        <p className="text-sm text-muted-foreground">
          Showing rostered counts. Staffing requirements have not been set.
        </p>
      ) : null}
      {gaps.map(({ date, need }) => (
        <Gap
          key={`${date}-${need.id}`}
          date={date}
          need={need}
          assignments={shifts}
          overview={overview}
          serviceId={serviceId}
          onPosted={manage.reload}
        />
      ))}
      {manage.data?.seen ? (
        <div className="grid gap-2">
          <p>
            {manage.data.seen.notSeen.length} haven&apos;t seen their changes
            {overview.latestPublication
              ? ` · Published ${formatPerthDay(perthDateOf(overview.latestPublication.publishedAt))}`
              : ""}
          </p>
          <Button
            variant="secondary"
            disabled={busy || reminded || !manage.data.seen.notSeen.length}
            onClick={() => void remind()}
          >
            {reminded ? "Reminded" : "Remind"}
          </Button>
          {message ? <p role="status">{message}</p> : null}
        </div>
      ) : null}
      <Fairness serviceId={serviceId} overview={overview} />
      <section className="grid gap-2">
        <h2>Export to Excel</h2>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Export from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField label="Export to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {exportDays >= 1 && exportDays <= 62 ? (
          <a
            className="inline-flex min-h-12 items-center underline"
            href={`/api/roster/team/${encodeURIComponent(serviceId)}/export?${new URLSearchParams({ from, to })}`}
          >
            Download Excel
          </a>
        ) : (
          <p>Choose up to 62 days to export.</p>
        )}
      </section>
    </section>
  );
}
