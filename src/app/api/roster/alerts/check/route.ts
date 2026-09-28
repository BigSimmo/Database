import { parseJsonBody } from "@/lib/validation/body";
import { ownerHasSubscription, removeSubscriptionBodySchema } from "@/lib/roster/alerts/subscriptions";
import { withRosterApi } from "@/lib/roster/team/api";

export const runtime = "nodejs";

/** A body keeps the browser endpoint out of URLs and access logs. This route never transfers ownership. */
export async function POST(request: Request) {
  return withRosterApi(
    request,
    async (client, ownerId) => {
      const body = await parseJsonBody(request, removeSubscriptionBodySchema, "Check this phone's alert subscription.");
      return { owned: await ownerHasSubscription(client, ownerId, body.endpoint) };
    },
    { demo: () => ({ owned: false }) },
  );
}
