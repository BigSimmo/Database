import "server-only";
import type { RosterAdminClient } from "./api";
import { rosterRead, rosterReadTeams } from "./repository";
import { rosterTeamReleaseEnabled } from "./release";
import { mergeMyShifts } from "./team-view";
import { addDaysToDate, perthDateOf } from "../shifts/perth-time";
import type { OnCallShift } from "../shifts/model";

/** Recheck membership on every feed request; only the token owner's rows leave the server. */
export async function calendarRosterShifts(
  client: RosterAdminClient,
  ownerId: string,
  own: readonly OnCallShift[],
  now: Date,
) {
  if (!rosterTeamReleaseEnabled()) {
    return mergeMyShifts(own, [], ownerId).filter((shift) => Date.parse(shift.endsAt) > now.getTime());
  }
  const teams = await rosterReadTeams(client, ownerId);
  const from = addDaysToDate(perthDateOf(now), -1);
  const to = addDaysToDate(perthDateOf(now), 60);
  const rows = await Promise.all(
    teams
      .filter((team) => team.enabled)
      .map(async (team) => {
        const { assignments } = await rosterRead(client, ownerId, team.serviceId, "assignments", { from, to });
        return { team, assignments };
      }),
  );
  return mergeMyShifts(own, rows, ownerId).filter((shift) => Date.parse(shift.endsAt) > now.getTime());
}
