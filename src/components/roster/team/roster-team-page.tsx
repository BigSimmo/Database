"use client";

import { useEffect, useRef, useState } from "react";
import { InformationPageShell } from "@/components/information-page-shell";
import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { RosterAskBox } from "@/components/roster/ask/roster-ask-box";
import { RosterSampleNotice } from "@/components/roster/team/roster-sample-notice";
import { postRosterAction, useRosterRead, useRosterTeams } from "@/components/roster/use-roster-team";
import { addDaysToDate, formatPerthDay, perthDateOf, perthTimeOf } from "@/lib/roster/shifts/perth-time";
import { groupByGrade, timelineSpan, withMe } from "@/lib/roster/team/team-view";
import type { RosterTeam } from "@/lib/roster/team/model";
import { useRosterNow } from "@/components/roster/roster-format";

function TeamDay({ team, actorId, now }: { team: RosterTeam; actorId: string | null; now: Date }) {
  const today = perthDateOf(now);
  const [day, setDay] = useState(today);
  const [onlyWithMe, setOnlyWithMe] = useState(false);
  const [windowStart, setWindowStart] = useState(addDaysToDate(today, -7));
  const overview = useRosterRead(team.serviceId, "overview");
  const read = useRosterRead(team.serviceId, "assignments", { from: windowStart, to: addDaysToDate(windowStart, 14) });
  const marked = useRef<string | null>(null);
  const publication = overview.data?.latestPublication;
  useEffect(() => {
    if (!publication || overview.data?.seenLatest || marked.current === publication.id) return;
    marked.current = publication.id;
    void postRosterAction(team.serviceId, { action: "seen.mark", publicationId: publication.id });
  }, [publication, overview.data?.seenLatest, team.serviceId]);
  function changeDay(next: string) {
    setDay(next);
    if (next < windowStart || next > addDaysToDate(windowStart, 14)) setWindowStart(addDaysToDate(next, -7));
  }
  const all = read.data?.assignments ?? [];
  const visible = (onlyWithMe && actorId ? withMe(all, actorId, now) : all).filter((row) => timelineSpan(row, day));
  return (
    <>
      <SegmentedControl
        label="Show team"
        layout="equal"
        value={onlyWithMe ? "with" : "all"}
        onChange={(value) => setOnlyWithMe(value === "with")}
        options={[
          { value: "all", label: "Everyone" },
          { value: "with", label: "With me", disabled: !actorId },
        ]}
      />
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          className="min-h-12"
          aria-label="Previous day"
          disabled={day <= addDaysToDate(today, -7)}
          onClick={() => changeDay(addDaysToDate(day, -1))}
        >
          ‹
        </Button>
        <h1 className="text-base font-normal">{formatPerthDay(day)}</h1>
        <Button
          variant="ghost"
          className="min-h-12"
          aria-label="Next day"
          disabled={day >= addDaysToDate(today, 31)}
          onClick={() => changeDay(addDaysToDate(day, 1))}
        >
          ›
        </Button>
      </div>
      {read.status === "loading" ? (
        <p role="status">Loading the team roster…</p>
      ) : read.status !== "ready" ? (
        <div role="alert">
          <p>{read.message}</p>
          <Button onClick={read.reload}>Try again</Button>
        </div>
      ) : (
        <>
          <div className="mx-px flex items-center justify-between gap-3 pl-3 pr-1 text-sm text-muted-foreground">
            <span>{day === today ? `Now ${perthTimeOf(now)}` : "Perth time"}</span>
            <span
              data-testid="roster-timeline-axis"
              className="flex w-36 shrink-0 justify-between nums text-xs"
              aria-hidden="true"
            >
              {["00", "06", "12", "18", "24"].map((hour) => (
                <span key={hour}>{hour}</span>
              ))}
            </span>
          </div>
          {groupByGrade(visible).map((group) => (
            <ModeGroupedList key={group.label} eyebrow={group.label} mode="roster">
              {group.assignments.map((row) => {
                const span = timelineSpan(row, day)!;
                const displayName = row.userId === actorId ? "You" : (row.name ?? "Name not available");
                const initial = row.name?.trim().charAt(0).toUpperCase() ?? "?";
                const nowMinute = Number(perthTimeOf(now).slice(0, 2)) * 60 + Number(perthTimeOf(now).slice(3, 5));
                return (
                  <ModeRow
                    key={row.id}
                    title={
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="grid size-8 shrink-0 place-items-center rounded-full border border-[color:var(--border)] text-sm"
                        >
                          {initial}
                        </span>
                        <span>{displayName}</span>
                      </span>
                    }
                    trailing={
                      <span data-mode-identity="roster" className="grid w-36 gap-1 nums text-right text-sm font-normal">
                        <span>{span.label}</span>
                        <svg
                          data-testid="roster-timeline-bar"
                          viewBox="0 0 1440 32"
                          preserveAspectRatio="none"
                          className="h-3 w-full"
                          aria-hidden="true"
                        >
                          <rect width="1440" height="32" rx="12" fill="var(--surface-wash)" />
                          <rect
                            x={span.startMinute}
                            width={span.endMinute - span.startMinute}
                            height="32"
                            rx="12"
                            fill={row.userId === actorId ? "var(--mode-identity)" : "var(--text-muted)"}
                          />
                          {day === today ? (
                            <line
                              x1={nowMinute}
                              x2={nowMinute}
                              y1="0"
                              y2="32"
                              stroke="var(--info)"
                              strokeWidth="2"
                              vectorEffect="non-scaling-stroke"
                            />
                          ) : null}
                        </svg>
                      </span>
                    }
                  />
                );
              })}
            </ModeGroupedList>
          ))}
          {!visible.length ? <p>Appears once your manager adds you.</p> : null}
        </>
      )}
      <ModeGroupedList>
        <ModeRow
          title="Phone numbers are in On call"
          href={`/on-call/service?service=${encodeURIComponent(team.serviceId)}`}
        />
      </ModeGroupedList>
    </>
  );
}

export function RosterTeamPage({ now: suppliedNow }: { readonly now?: Date } = {}) {
  const now = useRosterNow(suppliedNow);
  const teams = useRosterTeams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listed = Array.isArray(teams.data?.teams) ? teams.data.teams : [];
  const available = listed.filter((team) => team.enabled);
  const selected = available.find((team) => team.serviceId === selectedId) ?? available[0];
  return (
    <InformationPageShell testId="roster-team-page" width="narrow">
      <RosterAskBox />
      {teams.status === "loading" ? (
        <p role="status">Loading your teams…</p>
      ) : teams.status !== "ready" ? (
        <div role="alert">
          <p>{teams.message}</p>
          <Button onClick={teams.reload}>Try again</Button>
        </div>
      ) : !selected ? (
        <ModeGroupedList>
          <ModeRow
            title={listed.length ? "This team hasn't been confirmed yet." : "Appears once your manager adds you."}
          />
          <ModeRow title="Have an invite link? Open it here" href="/roster/join" />
        </ModeGroupedList>
      ) : (
        <>
          <RosterSampleNotice sample={teams.data?.sample} />
          {available.length > 1 ? (
            <label className="grid gap-1 text-sm">
              Team
              <select
                className="min-h-12 w-full min-w-0 rounded border bg-background p-2"
                value={selected.serviceId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {available.map((team) => (
                  <option key={team.serviceId} value={team.serviceId}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm">{selected.name}</p>
          )}
          <TeamDay key={selected.serviceId} team={selected} actorId={teams.data?.actorId ?? null} now={now} />
        </>
      )}
    </InformationPageShell>
  );
}
