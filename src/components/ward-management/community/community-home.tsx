// src/components/ward-management/community/community-home.tsx
"use client";

import { useMemo, useState } from "react";

import { COMMUNITY_TEAM_PAGES, communityTeamById } from "@/components/ward-management/community/community-derivations";
import { CommunityFigures, type CommunityFigureSpec } from "@/components/ward-management/community/community-figures";
import {
  CommunityTeamsTable,
  suburbCountForTeam,
  suburbCountsByTeam,
  type CommunityTeamRow,
} from "@/components/ward-management/community/community-teams-table";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { ReferralAddressing } from "@/components/ward-management/ward-model";
import { WardPanel } from "@/components/ward-management/ward-panel";
import {
  coordinatorScopedReferrals,
  type CoordinatorScopedReferral,
} from "@/components/ward-management/ward-referral-visibility";

import styles from "./community-home.module.css";

type Scope = { kind: "all" } | { kind: "team"; teamId: string };

type CommunityBoundReferral = { referral: CoordinatorScopedReferral; community: ReferralAddressing };

function communityAddressingOf(referral: CoordinatorScopedReferral): ReferralAddressing | undefined {
  return referral.destinations.find((addressing) => addressing.destination.kind === "community_team");
}

function teamNameOf(community: ReferralAddressing): string | null {
  return community.destination.kind === "community_team" ? community.destination.teamName : null;
}

/** The earliest-raised (so longest-waiting) entry of a set, or `null` for an empty set. Extracted
 *  so the all-teams and single-team figures compute "longest wait" identically rather than two
 *  copies of the same reduction drifting apart. */
function longestWaiting(entries: readonly CommunityBoundReferral[]): CommunityBoundReferral | null {
  return entries.reduce<CommunityBoundReferral | null>((worst, entry) => {
    if (!worst || entry.referral.raisedAt < worst.referral.raisedAt) return entry;
    return worst;
  }, null);
}

/**
 * THE COORDINATOR'S OWN VIEW: the all-teams overview, and drilling into one team.
 *
 * Coordinator-only, both scopes. `CommunityScopedReferral` -- the restricted projection a
 * community team's own hub must read instead -- is deliberately never imported here. FD-23 (owner
 * ruling 2026-08-30, extended to community 2026-09-04) says the coordinator may see everything, and
 * that covers BOTH scopes on this screen: the all-teams aggregate and a drill-down into one team are
 * still the coordinator looking, never the team itself. `community-team-hub.tsx` is the separate
 * component for the team's own, restricted view -- see its own doc comment and the build plan's
 * Task 3b for why the two must never share a component or a data type even though a drill-down and
 * that team's own hub can render the same team at the same moment.
 *
 * Every number below is derived from live ward-flow state via `coordinatorScopedReferrals` -- none
 * is a literal. The suburb counts come from `ward-catchment.ts` through `community-teams-table.tsx`,
 * which is real repository data; see that file's doc comment on why the real team count (65 today)
 * is used rather than the design prototype's invented "16".
 */
export function CommunityHome() {
  const { referrals, now } = useWardFlow();
  const [scope, setScope] = useState<Scope>({ kind: "all" });

  const communityReferrals = useMemo<CommunityBoundReferral[]>(() => {
    return coordinatorScopedReferrals(referrals)
      .map((referral) => ({ referral, community: communityAddressingOf(referral) }))
      .filter((entry): entry is CommunityBoundReferral => entry.community !== undefined);
  }, [referrals]);

  const suburbCounts = useMemo(() => suburbCountsByTeam(), []);

  function openTeam(teamId: string) {
    setScope({ kind: "team", teamId });
  }

  const allTeamsRows: CommunityTeamRow[] = COMMUNITY_TEAM_PAGES.map((team) => {
    const waitingCount = communityReferrals.filter(
      (entry) => teamNameOf(entry.community) === team.name && entry.community.state === "queued",
    ).length;
    return {
      teamId: team.id,
      teamName: team.name,
      suburbCount: suburbCountForTeam(team.name, suburbCounts),
      waitingCount,
    };
  });

  const totalQueued = communityReferrals.filter((entry) => entry.community.state === "queued");
  const worstOverall = longestWaiting(totalQueued);
  const teamsWithNothingWaiting = allTeamsRows.filter((row) => row.waitingCount === 0).length;

  const allFigures: CommunityFigureSpec[] = [
    { label: "Referred to a community team, not yet actioned", value: String(totalQueued.length) },
    {
      label: "Longest wait for first contact",
      value: worstOverall ? splitDuration(Math.max(now - worstOverall.referral.raisedAt, 0)) : "—",
      sub: worstOverall ? worstOverall.referral.id : undefined,
      flagged: totalQueued.length > 0,
    },
    {
      label: "Teams with nothing waiting",
      value: String(teamsWithNothingWaiting),
      unit: `of ${allTeamsRows.length}`,
      flagged: teamsWithNothingWaiting > 0,
    },
  ];

  const activeTeam = scope.kind === "team" ? communityTeamById(scope.teamId) : null;
  const teamReferrals = activeTeam
    ? communityReferrals.filter((entry) => teamNameOf(entry.community) === activeTeam.name)
    : [];
  const teamQueued = teamReferrals.filter((entry) => entry.community.state === "queued");
  const worstForTeam = longestWaiting(teamQueued);

  const teamFigures: CommunityFigureSpec[] = [
    { label: "Referred to this team, not yet actioned", value: String(teamQueued.length) },
    {
      label: "Longest wait for first contact",
      value: worstForTeam ? splitDuration(Math.max(now - worstForTeam.referral.raisedAt, 0)) : "—",
      sub: worstForTeam ? worstForTeam.referral.id : undefined,
      flagged: teamQueued.length > 0,
    },
  ];

  return (
    <main className={styles.home}>
      <p className={styles.eyebrow}>Coordinator</p>
      <h1>{scope.kind === "all" ? "All community teams" : (activeTeam?.name ?? "Unknown team")}</h1>

      <div className={styles.picker}>
        <button type="button" aria-pressed={scope.kind === "all"} onClick={() => setScope({ kind: "all" })}>
          All teams
        </button>
        <label htmlFor="community-home-team-select">or open a team</label>
        <select
          id="community-home-team-select"
          value={scope.kind === "team" ? scope.teamId : ""}
          onChange={(event) => {
            if (event.target.value) openTeam(event.target.value);
            else setScope({ kind: "all" });
          }}
        >
          <option value="">Choose a team...</option>
          {COMMUNITY_TEAM_PAGES.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>

      <p className={styles.covers}>
        This hub does not show referrals a community team has itself raised asking for a bed. The model records who
        raised a referral only as a category (&quot;community&quot;, &quot;crisis service&quot;, and the rest) — never
        which specific team — so there is no reliable count of outbound referrals per team to show, and a number here
        would assert something the data does not support.
      </p>

      {scope.kind === "all" ? (
        <>
          <CommunityFigures figures={allFigures} />
          <CommunityTeamsTable rows={allTeamsRows} onOpenTeam={openTeam} />
        </>
      ) : (
        <>
          <CommunityFigures figures={teamFigures} />
          <WardPanel title="Referred to this team" count={`${teamReferrals.length}`}>
            {teamReferrals.length === 0 ? (
              <p>Nothing is currently referred to this team.</p>
            ) : (
              <ul className={styles.rows}>
                {teamReferrals.map(({ referral, community }) => {
                  const others = referral.destinations.filter(
                    (addressing) => addressing.destination.kind !== "community_team",
                  );
                  return (
                    <li key={referral.id}>
                      <span className={styles.id}>{referral.id}</span>
                      <span>{community.state}</span>
                      {others.length > 0 ? (
                        <p className={styles.otherDestinations}>
                          Also asked:{" "}
                          {others
                            .map((addressing) => `${addressing.destination.kind} (${addressing.state})`)
                            .join(", ")}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </WardPanel>
        </>
      )}
    </main>
  );
}
