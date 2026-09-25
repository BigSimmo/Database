import { z } from "zod";
import { withServiceApi } from "@/lib/on-call/service-api";
import { serviceActionSchema, serviceQuerySchema } from "@/lib/on-call/service-model";
import { serviceCommand, serviceMutation } from "@/lib/on-call/service-repository";
import { parseJsonBody } from "@/lib/validation/body";
import { parseRouteParams } from "@/lib/validation/params";
import { parseRequestQuery } from "@/lib/validation/query";

export const runtime = "nodejs";
const paramsSchema = z.object({ serviceId: z.string().uuid() });
type Context = { params: Promise<{ serviceId: string }> };
export async function GET(request: Request, context: Context) {
  return withServiceApi(request, async (client, ownerId) => {
    const { serviceId } = parseRouteParams(await context.params, paramsSchema);
    return serviceCommand(client, ownerId, serviceId, "read", parseRequestQuery(request, serviceQuerySchema));
  });
}
export async function POST(request: Request, context: Context) {
  return withServiceApi(request, async (client, ownerId) => {
    const { serviceId } = parseRouteParams(await context.params, paramsSchema);
    return serviceMutation(client, ownerId, serviceId, await parseJsonBody(request, serviceActionSchema));
  });
}
