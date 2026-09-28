import { env } from "@/lib/env";
import { PublicApiError } from "@/lib/http";
import {
  removeOwnerSubscription,
  removeSubscriptionBodySchema,
  saveOwnerSubscription,
  subscriptionBodySchema,
} from "@/lib/roster/alerts/subscriptions";
import { withRosterApi } from "@/lib/roster/team/api";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";

const configured = () => !!(env.WEB_PUSH_PUBLIC_KEY && env.WEB_PUSH_PRIVATE_KEY && env.WEB_PUSH_SUBJECT);

export async function GET(request: Request) {
  return withRosterApi(
    request,
    async () => ({ configured: configured(), publicKey: configured() ? env.WEB_PUSH_PUBLIC_KEY : null }),
    {
      demo: () => ({ configured: false, publicKey: null }),
    },
  );
}

export async function POST(request: Request) {
  return withRosterApi(request, async (client, ownerId) => {
    const body = await parseJsonBody(request, subscriptionBodySchema, "Check this phone's alert subscription.");
    if (!configured())
      throw new PublicApiError("Phone alerts aren't configured yet.", 503, { code: "roster_unavailable" });
    await saveOwnerSubscription(client, ownerId, body);
    return { configured: true };
  });
}

export async function DELETE(request: Request) {
  return withRosterApi(request, async (client, ownerId) => {
    const body = await parseJsonBody(request, removeSubscriptionBodySchema, "Choose this phone's alert subscription.");
    await removeOwnerSubscription(client, ownerId, body.endpoint);
    return { ok: true };
  });
}
