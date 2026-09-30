"use client";

import { Suspense, useState } from "react";
import { InformationPageShell } from "@/components/information-page-shell";
import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { Button } from "@/components/ui/button";
import { RosterAskBox } from "@/components/roster/ask/roster-ask-box";
import { RosterSampleNotice } from "@/components/roster/team/roster-sample-notice";
import { TeamCalendar } from "@/components/roster/team/calendar/team-calendar";
import { useRosterNow } from "@/components/roster/roster-format";
import { useRosterTeams } from "@/components/roster/use-roster-team";

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
          <Suspense fallback={<p role="status">Loading the team roster…</p>}>
            <TeamCalendar key={selected.serviceId} team={selected} actorId={teams.data?.actorId ?? null} now={now} />
          </Suspense>
        </>
      )}
    </InformationPageShell>
  );
}
