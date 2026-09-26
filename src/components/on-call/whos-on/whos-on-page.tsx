"use client";

import { Users } from "lucide-react";
import { useMemo } from "react";

import { OnCallDialRow } from "@/components/on-call/kit/dial-row";
import { OnCallGroupedList } from "@/components/on-call/kit/grouped-list";
import { OnCallHandbookState } from "@/components/on-call/kit/handbook-state";
import { OnCallHospitalLine } from "@/components/on-call/kit/hospital-line";
import { OnCallHubPageFrame } from "@/components/on-call/kit/hub-page-frame";
import { OnCallStateLabel } from "@/components/on-call/kit/state-label";
import { allocateOnCallGroupSlug, onCallGroupAnchorId } from "@/components/on-call/on-call-page-anchors";
import { onCallWhosOnSections } from "@/components/on-call/on-call-page-sections";
import { useHospitalHandbook } from "@/components/on-call/use-hospital-handbook";
import { Select } from "@/components/ui/select";
import type { HandbookItem } from "@/lib/on-call/handbook-items";
import { compareOnCallTeams, ON_CALL_TEAMS, type OnCallTeam } from "@/lib/on-call/handbook-title";
import { saveOnCallMyTeam, useOnCallMyTeam } from "@/lib/on-call/my-team-storage";
import { ON_CALL_AFTER_HOURS_MANAGER, handbookTeams } from "@/lib/on-call/now-rows";

const NO_TEAM = "";

type TeamGroup = { readonly team: OnCallTeam; readonly rows: readonly HandbookItem[] };

/** The hospital's contacts that name a team, grouped by team: the reader's first, then the usual order. */
function teamGroups(items: readonly HandbookItem[], myTeam: OnCallTeam | null): TeamGroup[] {
  const contacts = items.filter((item) => item.section === "contacts");
  return handbookTeams(items)
    .map((team) => ({ team, rows: contacts.filter((item) => item.parsed.team === team) }))
    .filter((group) => group.rows.length > 0)
    .sort((a, b) => Number(b.team === myTeam) - Number(a.team === myTeam) || compareOnCallTeams(a.team, b.team));
}

/**
 * Who's on (hidden from the pages sheet while `ON_CALL_WHOS_ON_ENABLED` is off;
 * reachable by URL). The hospital's roles by team, under the hospital's name,
 * with the reader's own team first. Roles only: the handbook holds no names.
 *
 * Contacts with no team and no prefix go in a last "Other" group, only when
 * there are any. A team with no rows is not drawn; when it is the reader's own,
 * the page says it is not set up for this hospital instead of an empty list.
 */
export function OnCallWhosOnPage() {
  const handbook = useHospitalHandbook();
  const myTeam = useOnCallMyTeam();
  const ready = handbook.status === "ready";
  const items = useMemo(() => (ready ? handbook.items : []), [ready, handbook.items]);
  const hospitalName = handbook.siteName ?? handbook.serviceName;

  const groups = useMemo(() => teamGroups(items, myTeam), [items, myTeam]);
  const other = useMemo(
    () => items.filter((item) => item.section === "contacts" && !item.parsed.team && !item.parsed.prefix),
    [items],
  );
  const sections = useMemo(
    () =>
      onCallWhosOnSections(
        groups.map((group) => ({ team: group.team, count: group.rows.length })),
        myTeam,
      ),
    [groups, myTeam],
  );
  // The anchors in the order `onCallWhosOnSections` allocates them, so the
  // section bar's links land on these groups.
  const anchors = useMemo(() => {
    const taken = new Set<string>();
    const byTeam = new Map(
      groups.map((group) => [group.team, onCallGroupAnchorId(allocateOnCallGroupSlug(group.team, taken))]),
    );
    return { byTeam, other: onCallGroupAnchorId(allocateOnCallGroupSlug("Other", taken)) };
  }, [groups]);

  const teamOptions = useMemo(() => {
    const names = new Set<OnCallTeam>([...ON_CALL_TEAMS, ...handbookTeams(items)]);
    names.delete(ON_CALL_AFTER_HOURS_MANAGER);
    return [...names].sort(compareOnCallTeams);
  }, [items]);
  const myTeamMissing = ready && myTeam !== null && !groups.some((group) => group.team === myTeam);

  return (
    <OnCallHubPageFrame
      page="whos-on"
      sections={sections}
      lead={<OnCallHospitalLine handbook={handbook} testId="on-call-hub-hospital" />}
    >
      <OnCallHandbookState handbook={handbook} page="whos-on" />
      {ready ? (
        <>
          <div className="px-3">
            <Select
              label="My team"
              value={myTeam ?? NO_TEAM}
              onChange={(event) => saveOnCallMyTeam(event.target.value === NO_TEAM ? null : event.target.value)}
              options={[
                ...teamOptions.map((team) => ({ value: team, label: team })),
                { value: NO_TEAM, label: "No team" },
              ]}
              className="min-h-12"
              data-testid="on-call-whos-on-my-team"
            />
          </div>
          {myTeamMissing ? (
            <OnCallGroupedList eyebrow={myTeam ?? undefined} headerIcon={Users} testId="on-call-whos-on-my-team-empty">
              <li className="flex min-h-12 items-center px-3">
                <OnCallStateLabel state={{ kind: "not-set-up" }} />
              </li>
            </OnCallGroupedList>
          ) : null}
          {groups.map((group) => (
            <OnCallGroupedList
              key={group.team}
              eyebrow={group.team}
              headerIcon={Users}
              id={anchors.byTeam.get(group.team)}
              testId={`on-call-whos-on-team-${group.team}`}
            >
              {group.rows.map((item) => (
                <OnCallDialRow
                  key={item.id}
                  id={item.id}
                  source="handbook"
                  title={item.parsed.label}
                  dial={item.dial}
                  mobileDial={item.mobileDial}
                  updatedAt={item.updatedAt}
                  sources={item.sources}
                  hospitalName={hospitalName}
                  testId={`on-call-whos-on-row-${item.id}`}
                />
              ))}
            </OnCallGroupedList>
          ))}
          {other.length > 0 ? (
            <OnCallGroupedList eyebrow="Other" headerIcon={Users} id={anchors.other} testId="on-call-whos-on-other">
              {other.map((item) => (
                <OnCallDialRow
                  key={item.id}
                  id={item.id}
                  source="handbook"
                  title={item.parsed.label}
                  dial={item.dial}
                  mobileDial={item.mobileDial}
                  updatedAt={item.updatedAt}
                  sources={item.sources}
                  hospitalName={hospitalName}
                  testId={`on-call-whos-on-row-${item.id}`}
                />
              ))}
            </OnCallGroupedList>
          ) : null}
        </>
      ) : null}
    </OnCallHubPageFrame>
  );
}
