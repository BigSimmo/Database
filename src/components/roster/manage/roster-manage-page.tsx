"use client";

import { useState } from "react";
import { InformationPageShell } from "@/components/information-page-shell";
import { Button } from "@/components/ui/button";
import { useRosterRead, useRosterTeams } from "@/components/roster/use-roster-team";
import { RosterManageNavHeader } from "./roster-manage-nav-header";
import { RosterApproveTab } from "./roster-approve-tab";
import { RosterCoverTab } from "./roster-cover-tab";
import { RosterPeopleList } from "./roster-people-list";
import { RosterTeamSettings } from "./roster-team-settings";
import { RosterPublishTab } from "./publish/roster-publish-tab";

function ManagerTeam({ serviceId }: { serviceId: string }) {
  const overview = useRosterRead(serviceId, "overview");
  const [section, setSection] = useState("approve");
  if (overview.status === "error")
    return (
      <div>
        <p>{overview.message}</p>
        <Button onClick={overview.reload}>Try again</Button>
      </div>
    );
  if (!overview.data) return <p>Loading your team…</p>;
  if (overview.data.me.role !== "manager") return <p>Only your team&apos;s roster manager can see this page.</p>;
  return (
    <div className="grid gap-6">
      <RosterManageNavHeader activeId={section} onSelect={setSection} />
      {section === "approve" ? (
        <RosterApproveTab serviceId={serviceId} />
      ) : section === "cover" ? (
        <RosterCoverTab serviceId={serviceId} overview={overview.data} />
      ) : (
        <>
          <RosterPublishTab serviceId={serviceId} overview={overview.data} />
          <RosterPeopleList
            team={{
              serviceId,
              name: overview.data.service.name,
              enabled: true,
              role: "manager",
              grade: overview.data.me.grade,
            }}
          />
          <RosterTeamSettings serviceId={serviceId} overview={overview.data} />
        </>
      )}
    </div>
  );
}

export function RosterManagePage() {
  const teams = useRosterTeams();
  const [selected, setSelected] = useState("");
  const available = teams.data?.teams.filter((team) => team.enabled && team.role === "manager") ?? [];
  const serviceId = available.find((team) => team.serviceId === selected)?.serviceId ?? available[0]?.serviceId;
  return (
    <InformationPageShell width="narrow">
      <div className="grid gap-4" data-mode-identity="roster">
        {teams.status === "loading" ? (
          <p>Loading your teams…</p>
        ) : teams.status !== "ready" ? (
          <div>
            <p>{teams.message}</p>
            <Button onClick={teams.reload}>Try again</Button>
          </div>
        ) : !serviceId ? (
          <p>Only your team&apos;s roster manager can see this page.</p>
        ) : (
          <>
            {available.length > 1 ? (
              <label className="grid gap-1">
                Team
                <select
                  className="min-h-12 rounded border bg-background p-2"
                  value={serviceId}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  {available.map((team) => (
                    <option value={team.serviceId} key={team.serviceId}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <ManagerTeam key={serviceId} serviceId={serviceId} />
          </>
        )}
      </div>
    </InformationPageShell>
  );
}
