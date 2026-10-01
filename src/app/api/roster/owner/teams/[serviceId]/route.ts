import { z } from "zod";

import { PublicApiError } from "@/lib/http";
import {
  changeOwnerTeam,
  listOwnerMembers,
  ownerChangeSchema,
  ownerMemberEmail,
  ownerServiceIdSchema,
  withRosterOwnerApi,
} from "@/lib/roster/owner/teams";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";
type Context = { params: Promise<{ serviceId: string }> };

async function serviceIdFrom(context: Context): Promise<string> {
  const parsed = ownerServiceIdSchema.safeParse((await context.params).serviceId);
  if (!parsed.success) throw new PublicApiError("Unknown team.", 400, { code: "roster_invalid_request" });
  return parsed.data;
}

export async function GET(request: Request, context: Context) {
  return withRosterOwnerApi(request, async (client) => {
    const serviceId = await serviceIdFrom(context);
    const search = new URL(request.url).searchParams;
    if ([...search.keys()].some((key) => key !== "member") || search.getAll("member").length > 1) {
      throw new PublicApiError("Check the team request and try again.", 400, { code: "roster_invalid_request" });
    }
    const member = search.get("member");
    if (member === null) return listOwnerMembers(client, serviceId);
    const parsed = z.string().uuid().safeParse(member);
    if (!parsed.success) throw new PublicApiError("Unknown person.", 400, { code: "roster_invalid_request" });
    return ownerMemberEmail(client, serviceId, parsed.data);
  });
}

export async function POST(request: Request, context: Context) {
  return withRosterOwnerApi(request, async (client, actorId) => {
    const serviceId = await serviceIdFrom(context);
    const change = await parseJsonBody(request, ownerChangeSchema, "Check the team request and try again.");
    return changeOwnerTeam(client, actorId, serviceId, change);
  });
}
