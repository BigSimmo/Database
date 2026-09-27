import { z } from "zod";
import { withRosterApi } from "@/lib/roster/team/api";
import { rosterInvalidRequest } from "@/lib/roster/team/errors";
import { rosterMakerActionSchema, rosterMakerPublicationReceiptSchema } from "@/lib/roster/maker/workflow-model";
import { commandRosterMaker, readRosterMaker } from "@/lib/roster/maker/workflow-repository";
import { sendMakerPublicationAlerts } from "@/lib/roster/maker/publication-alerts";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";
type Context = { params: Promise<{ serviceId: string }> };
const uuid = z.string().uuid();
async function team(context: Context) {
  const parsed = uuid.safeParse((await context.params).serviceId);
  if (!parsed.success) throw rosterInvalidRequest("Unknown team.");
  return parsed.data;
}
export async function GET(request: Request, context: Context) {
  return withRosterApi(request, async (client, actorId) => {
    const serviceId = await team(context);
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some((key) => key !== "draftId") || params.getAll("draftId").length > 1)
      throw rosterInvalidRequest();
    const draftId = params.get("draftId");
    if (draftId !== null && !uuid.safeParse(draftId).success) throw rosterInvalidRequest();
    return readRosterMaker(client, actorId, serviceId, draftId);
  });
}
export async function POST(request: Request, context: Context) {
  return withRosterApi(request, async (client, actorId) => {
    const serviceId = await team(context);
    const action = await parseJsonBody(request, rosterMakerActionSchema, "Check the reviewed roster change.");
    const result = await commandRosterMaker(client, actorId, serviceId, action);
    if (action.action !== "proposal.publish") return result;
    const receipt = rosterMakerPublicationReceiptSchema.parse(result);
    return { ...receipt, alerts: await sendMakerPublicationAlerts(client, actorId, serviceId, receipt) };
  });
}
