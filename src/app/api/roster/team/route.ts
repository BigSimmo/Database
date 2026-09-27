import { withRosterApi } from "@/lib/roster/team/api";
import { demoRosterTeams, DEMO_ME_ID } from "@/lib/roster/team/demo-team";
import { rosterReadTeams } from "@/lib/roster/team/repository";

export const runtime = "nodejs";

/** The teams the signed-in doctor belongs to, confirmed or not. The actor is the session user only. */
export async function GET(request: Request) {
  return withRosterApi(
    request,
    async (client, actorId) => ({ teams: await rosterReadTeams(client, actorId), actorId }),
    {
      demo: () => ({ teams: demoRosterTeams(), actorId: DEMO_ME_ID }),
    },
  );
}
