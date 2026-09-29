import { z } from "zod";
import { withRosterApi } from "@/lib/roster/team/api";
import { rosterApiError, rosterInvalidRequest } from "@/lib/roster/team/errors";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";
const bodySchema = z
  .object({
    cutoffOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value)
      .nullable(),
  })
  .strict();
export async function POST(request: Request, context: { params: Promise<{ serviceId: string }> }) {
  return withRosterApi(request, async (client, actorId) => {
    const parsed = z
      .string()
      .uuid()
      .safeParse((await context.params).serviceId);
    if (!parsed.success) throw rosterInvalidRequest();
    const body = await parseJsonBody(request, bodySchema, "Choose a valid cut-off date.");
    const { error } = await client.rpc("roster_set_cutoff", {
      p_actor_id: actorId,
      p_service_id: parsed.data,
      p_cutoff: body.cutoffOn,
    });
    if (error) throw rosterApiError(error);
    return { ok: true };
  });
}
