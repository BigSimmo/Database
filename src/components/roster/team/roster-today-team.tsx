"use client";
import { useEffect, useRef } from "react";
import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { ModeNotice } from "@/components/mode-kit/notice";
import { useRosterTeams, useRosterRead, postRosterAction } from "@/components/roster/use-roster-team";
import { addDaysToDate, formatPerthDay, perthDateOf } from "@/lib/roster/shifts/perth-time";
import { personalRosterChanges, timelineSpan } from "@/lib/roster/team/team-view";
import type { RosterTeam } from "@/lib/roster/team/model";
import type { RosterDisplayShift } from "@/lib/roster/team/team-view";
import { WA_PUBLIC_HOLIDAYS } from "@/lib/on-call/wa-public-holidays";
import { formatShiftRange } from "@/components/roster/roster-format";
import { RosterSampleNotice } from "./roster-sample-notice";

function TeamSummary({
  team,
  actorId,
  now,
  enabledTeams,
  myShifts,
}: {
  team: RosterTeam;
  actorId: string;
  now: Date;
  enabledTeams: readonly RosterTeam[];
  myShifts: readonly RosterDisplayShift[];
}) {
  const today = perthDateOf(now);
  const overview = useRosterRead(team.serviceId, "overview");
  const shifts = useRosterRead(team.serviceId, "assignments", {
    from: addDaysToDate(today, -1),
    to: addDaysToDate(today, 7),
  });
  const requests = useRosterRead(team.serviceId, "requests");
  const manage = useRosterRead(team.role === "manager" ? team.serviceId : null, "manage");
  const myChanges = useRosterRead(
    overview.data?.latestPublication && !overview.data.seenLatest ? team.serviceId : null,
    "my_changes",
  );
  const marked = useRef<string | null>(null);
  const publication = overview.data?.latestPublication;
  useEffect(() => {
    if (!publication || overview.data?.seenLatest || marked.current === publication.id) return;
    marked.current = publication.id;
    void postRosterAction(team.serviceId, { action: "seen.mark", publicationId: publication.id });
  }, [team.serviceId, publication, overview.data?.seenLatest]);
  if (overview.status !== "ready" || !overview.data)
    return overview.status === "error" ? <ModeNotice tone="warning">{overview.message}</ModeNotice> : null;
  const assignments = Array.isArray(shifts.data?.assignments) ? shifts.data.assignments : [];
  const own = assignments.filter((row) => row.userId === actorId && timelineSpan(row, today));
  const colleagues = assignments.filter(
    (row) =>
      row.userId !== actorId &&
      own.some(
        (mine) =>
          Date.parse(row.startsAt) < Date.parse(mine.endsAt) && Date.parse(row.endsAt) > Date.parse(mine.startsAt),
      ),
  );
  const needsYou = (requests.data?.swaps ?? []).filter(
    (swap) => swap.counterpartyId === actorId && swap.status === "requested",
  );
  const waiting =
    (manage.data?.swaps ?? []).filter((swap) => swap.status === "accepted").length +
    (manage.data?.openShifts ?? []).filter((shift) => shift.status === "claimed" || shift.status === "reported").length;
  const cutoff = overview.data.nextCutoffOn;
  const holiday = Array.from({ length: 8 }, (_, offset) => addDaysToDate(today, offset)).find(
    (date) =>
      WA_PUBLIC_HOLIDAYS.has(date) && assignments.some((row) => row.userId === actorId && timelineSpan(row, date)),
  );
  const rotationEndsOn = overview.data.me.rotationEndsOn;
  const nextTeamShift = rotationEndsOn
    ? myShifts
        .filter(
          (shift) =>
            shift.source === "team" &&
            shift.serviceId !== team.serviceId &&
            perthDateOf(shift.startsAt) > rotationEndsOn,
        )
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]
    : null;
  const nextTeamName = enabledTeams.find((candidate) => candidate.serviceId === nextTeamShift?.serviceId)?.name;
  const changed =
    myChanges.status === "ready" && myChanges.data
      ? personalRosterChanges(myChanges.data.before, myChanges.data.after)
      : [];
  const duties = (rows: typeof assignments) =>
    rows.length
      ? rows
          .map((row) => `${row.shiftCode} ${formatShiftRange(row)}${row.siteName ? ` · ${row.siteName}` : ""}`)
          .join(", ")
      : "Off";
  return (
    <>
      {needsYou.length > 0 || waiting > 0 ? (
        <ModeGroupedList eyebrow="Needs you" mode="roster">
          {needsYou.map((swap) => (
            <ModeRow
              key={swap.id}
              title={`${swap.requesterName ?? "A colleague"} asks to swap`}
              href="/roster/requests"
            />
          ))}
          {waiting > 0 ? <ModeRow title={`${waiting} waiting in Manage`} href="/roster/manage" /> : null}
        </ModeGroupedList>
      ) : null}
      {colleagues.length ? (
        <ModeGroupedList eyebrow="On with you" mode="roster">
          {colleagues.map((row) => (
            <ModeRow
              key={row.id}
              title={row.name ?? "Name not available"}
              subtitle={row.siteName ?? undefined}
              trailing={formatShiftRange(row)}
            />
          ))}
        </ModeGroupedList>
      ) : null}
      <ModeGroupedList>
        {rotationEndsOn ? (
          <ModeRow
            title={`${team.name} until ${formatPerthDay(rotationEndsOn)}${nextTeamName ? `, then ${nextTeamName}` : ""}`}
          />
        ) : null}
        {holiday ? <ModeRow title={`${formatPerthDay(holiday)} is a public holiday`} /> : null}
        {team.role === "member" && !overview.data.me.grade ? (
          <ModeRow title="Ask your manager to set your grade so you can swap." />
        ) : null}
        {cutoff && cutoff >= today && cutoff <= addDaysToDate(today, 14) ? (
          <ModeRow
            title={`Next roster closes ${formatPerthDay(cutoff)}. Add dates you can't work.`}
            href="/roster/requests?start=dates"
          />
        ) : null}
        {!overview.data.seenLatest && publication ? (
          changed.length ? (
            changed.map((change) => {
              return (
                <ModeRow
                  key={change.date}
                  title={`Your roster changed · ${formatPerthDay(change.date)}`}
                  subtitle={
                    <>
                      <s>{duties(change.before)}</s> → {duties(change.after)}
                    </>
                  }
                  href="/roster/shifts"
                />
              );
            })
          ) : (
            <ModeRow title="Your roster changed" subtitle={`Version ${publication.version}`} href="/roster/shifts" />
          )
        ) : null}
        {team.role === "manager" ? (
          <ModeRow title="Manage" subtitle={team.name} href="/roster/manage" />
        ) : (
          <ModeRow title="Team" subtitle={team.name} href="/roster/team" />
        )}
      </ModeGroupedList>
    </>
  );
}
export function RosterTodayTeam({ now, myShifts = [] }: { now: Date; myShifts?: readonly RosterDisplayShift[] }) {
  const teams = useRosterTeams();
  if (teams.status !== "ready") return null;
  const enabled = (Array.isArray(teams.data?.teams) ? teams.data.teams : []).filter((team) => team.enabled);
  if (!enabled.length)
    return (
      <ModeGroupedList>
        <ModeRow title="Have an invite link? Open it here" href="/roster/join" />
      </ModeGroupedList>
    );
  if (!teams.data?.actorId)
    return (
      <ModeNotice tone="warning">Your team identity could not be loaded. Refresh before using team shifts.</ModeNotice>
    );
  return (
    <>
      <RosterSampleNotice sample={teams.data.sample} />
      {enabled.map((team) => (
        <TeamSummary
          key={team.serviceId}
          team={team}
          actorId={teams.data!.actorId!}
          now={now}
          enabledTeams={enabled}
          myShifts={myShifts}
        />
      ))}
    </>
  );
}
