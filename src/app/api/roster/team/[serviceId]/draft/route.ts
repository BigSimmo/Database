import { z } from "zod";
import { withRosterApi } from "@/lib/roster/team/api";
import { rosterInvalidRequest } from "@/lib/roster/team/errors";
import { rosterDraftActionSchema } from "@/lib/roster/maker/model";
import { changeRosterDraft, readRosterDraft } from "@/lib/roster/maker/repository";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";
type Context = { params: Promise<{ serviceId: string }> };
const uuid = z.string().uuid();
async function serviceIdFrom(context: Context) {
  const parsed = uuid.safeParse((await context.params).serviceId);
  if (!parsed.success) throw rosterInvalidRequest("Unknown team.");
  return parsed.data;
}
export async function GET(request: Request, context: Context) {
  return withRosterApi(request, async (client, actorId) => {
    const serviceId = await serviceIdFrom(context);
    const params = new URL(request.url).searchParams;
    const draftId = uuid.safeParse(params.get("draftId"));
    if (
      [...params.keys()].some((key) => key !== "draftId") ||
      params.getAll("draftId").length !== 1 ||
      !draftId.success
    )
      throw rosterInvalidRequest();
    return readRosterDraft(client, actorId, serviceId, draftId.data);
  });
}
export async function POST(request: Request, context: Context) {
  return withRosterApi(request, async (client, actorId) => {
    const serviceId = await serviceIdFrom(context);
    const action = await parseJsonBody(request, rosterDraftActionSchema, "Check the draft change and try again.");
    return changeRosterDraft(client, actorId, serviceId, action);
  });
}
