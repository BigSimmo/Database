import { z } from "zod";
import { withRosterApi } from "@/lib/roster/team/api";
import { rosterInvalidRequest } from "@/lib/roster/team/errors";
import { rosterAgreementActionSchema } from "@/lib/roster/maker/workflow-model";
import { agreeRosterProposal, readRosterMaker } from "@/lib/roster/maker/workflow-repository";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";
type Context = { params: Promise<{ serviceId: string }> };
async function team(context: Context) {
  const parsed = z
    .string()
    .uuid()
    .safeParse((await context.params).serviceId);
  if (!parsed.success) throw rosterInvalidRequest("Unknown team.");
  return parsed.data;
}
export async function GET(request: Request, context: Context) {
  return withRosterApi(request, async (client, actorId) => {
    if (new URL(request.url).searchParams.size) throw rosterInvalidRequest();
    return readRosterMaker(client, actorId, await team(context), null, true);
  });
}
export async function POST(request: Request, context: Context) {
  return withRosterApi(request, async (client, actorId) => {
    const body = await parseJsonBody(request, rosterAgreementActionSchema, "Choose a proposed duty change.");
    return agreeRosterProposal(client, actorId, await team(context), body.proposalId);
  });
}
