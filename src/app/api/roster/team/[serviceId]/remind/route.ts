import { z } from "zod";

import { dispatchRosterAlerts } from "@/lib/roster/alerts/dispatch";
import { runAfterResponse, withRosterApi } from "@/lib/roster/team/api";
import { demoRosterRead } from "@/lib/roster/team/demo-team";
import { rosterInvalidRequest } from "@/lib/roster/team/errors";
import { rosterRead } from "@/lib/roster/team/repository";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";
type Context = { params: Promise<{ serviceId: string }> };

export async function POST(request: Request, context: Context) {
  return withRosterApi(
    request,
    async (client, actorId) => {
      await parseJsonBody(request, z.object({}).strict(), "Send an empty reminder request.");
      const serviceId = z.uuid().safeParse((await context.params).serviceId);
      if (!serviceId.success) throw rosterInvalidRequest("Unknown team.");
      // `manage` is manager-only in SQL. A member cannot obtain the unseen ids.
      const manage = await rosterRead(client, actorId, serviceId.data, "manage");
      const recipientIds = [...new Set((manage.seen?.notSeen ?? []).filter((id) => id !== actorId))].slice(0, 500);
      if (recipientIds.length)
        runAfterResponse(() =>
          dispatchRosterAlerts(client, {
            serviceId: serviceId.data,
            actorId,
            action: { action: "remind" },
            result: { recipientIds },
          }),
        );
      return { reminded: recipientIds.length };
    },
    {
      // Release held: the sample team's two people who haven't seen the roster. Nobody is sent anything.
      sample: async () => {
        await parseJsonBody(request, z.object({}).strict(), "Send an empty reminder request.");
        return { reminded: demoRosterRead("manage", {}).seen?.notSeen.length ?? 0 };
      },
    },
  );
}
