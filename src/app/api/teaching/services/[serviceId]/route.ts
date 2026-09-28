import { z } from "zod";

import { PublicApiError } from "@/lib/http";
import { assertTeachingCodeAttempt, withTeachingApi } from "@/lib/teaching/api";
import { DEMO_TEACHING_SERVICE_ID, demoTeachingSessionDetail } from "@/lib/teaching/demo-programme";
import { teachingServiceActionSchema, teachingServiceQuerySchema } from "@/lib/teaching/model";
import { teachingServiceMutation, teachingServiceRead } from "@/lib/teaching/repository";
import { parseTeachingBody } from "@/lib/teaching/request";
import { parseRouteParams } from "@/lib/validation/params";
import { parseRequestQuery } from "@/lib/validation/query";

export const runtime = "nodejs";

const paramsSchema = z.object({ serviceId: z.uuid() });
type Context = { params: Promise<{ serviceId: string }> };

/** Demo mode shows the demo team's sessions and nothing else. */
async function demoRead(request: Request, context: Context): Promise<unknown> {
  const { serviceId } = parseRouteParams(await context.params, paramsSchema);
  const query = parseRequestQuery(request, teachingServiceQuerySchema);
  const session =
    serviceId === DEMO_TEACHING_SERVICE_ID && query.action === "session.read"
      ? demoTeachingSessionDetail(query.occurrenceId)
      : null;
  if (!session) throw new PublicApiError("This isn't available in the demo.", 404, { code: "teaching_not_found" });
  return session;
}

export async function GET(request: Request, context: Context) {
  return withTeachingApi(
    request,
    async (client, ownerId) => {
      const { serviceId } = parseRouteParams(await context.params, paramsSchema);
      return teachingServiceRead(client, ownerId, serviceId, parseRequestQuery(request, teachingServiceQuerySchema));
    },
    { demo: () => demoRead(request, context) },
  );
}

export async function POST(request: Request, context: Context) {
  return withTeachingApi(request, async (client, ownerId) => {
    const { serviceId } = parseRouteParams(await context.params, paramsSchema);
    const input = await parseTeachingBody(request, teachingServiceActionSchema);
    // Six digits can be guessed; a scanned code cannot (review focus 4).
    if (input.action === "checkin.typed") await assertTeachingCodeAttempt(client, ownerId);
    return teachingServiceMutation(client, ownerId, serviceId, input);
  });
}
