import { z } from "zod";

import { withTeachingApi } from "@/lib/teaching/api";
import { teachingResourceTeamActionSchema } from "@/lib/teaching/model";
import { teachingResourceTeamMutation } from "@/lib/teaching/repository";
import { parseTeachingBody } from "@/lib/teaching/request";
import { parseRouteParams } from "@/lib/validation/params";

export const runtime = "nodejs";

const paramsSchema = z.object({ serviceId: z.uuid() });
type Context = { params: Promise<{ serviceId: string }> };

/**
 * Organiser and presenter writes for one service's resources, collections and open series. Writes
 * only, so demo mode refuses them like every other Teaching write; the demo's resources are served
 * by `GET /api/teaching/resources`.
 */
export async function POST(request: Request, context: Context) {
  return withTeachingApi(request, async (client, ownerId) => {
    const { serviceId } = parseRouteParams(await context.params, paramsSchema);
    const input = await parseTeachingBody(request, teachingResourceTeamActionSchema);
    return teachingResourceTeamMutation(client, ownerId, serviceId, input);
  });
}
