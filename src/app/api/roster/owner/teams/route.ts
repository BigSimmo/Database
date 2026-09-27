import { listOwnerTeams, withRosterOwnerApi } from "@/lib/roster/owner/teams";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRosterOwnerApi(request, (client) => listOwnerTeams(client));
}
