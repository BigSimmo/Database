import { withServiceApi } from "@/lib/on-call/service-api";
import { serviceCreateSchema } from "@/lib/on-call/service-model";
import { serviceCommand } from "@/lib/on-call/service-repository";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return withServiceApi(request, (client, ownerId) => serviceCommand(client, ownerId, null, "list"));
}
export async function POST(request: Request) {
  return withServiceApi(request, async (client, ownerId) =>
    serviceCommand(client, ownerId, null, "create", await parseJsonBody(request, serviceCreateSchema)),
  );
}
