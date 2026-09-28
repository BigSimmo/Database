import { z } from "zod";

import { withTeachingApi } from "@/lib/teaching/api";
import { teachingDepthActionSchema, teachingDepthQuerySchema } from "@/lib/teaching/depth-model";
import { teachingDepthMutation, teachingDepthRead } from "@/lib/teaching/depth-repository";
import { parseTeachingBody } from "@/lib/teaching/request";
import { parseRouteParams } from "@/lib/validation/params";
import { parseRequestQuery } from "@/lib/validation/query";

export const runtime = "nodejs";

const paramsSchema = z.object({ serviceId: z.uuid() });
type Context = { params: Promise<{ serviceId: string }> };

/** Supervision, readiness, feedback and the term import for one service. No demo option. */
export async function GET(request: Request, context: Context) {
  return withTeachingApi(request, async (client, ownerId) => {
    const { serviceId } = parseRouteParams(await context.params, paramsSchema);
    return teachingDepthRead(client, ownerId, serviceId, parseRequestQuery(request, teachingDepthQuerySchema));
  });
}

export async function POST(request: Request, context: Context) {
  return withTeachingApi(request, async (client, ownerId) => {
    const { serviceId } = parseRouteParams(await context.params, paramsSchema);
    return teachingDepthMutation(
      client,
      ownerId,
      serviceId,
      await parseTeachingBody(request, teachingDepthActionSchema),
    );
  });
}
