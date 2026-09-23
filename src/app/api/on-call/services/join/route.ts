import { withServiceApi } from "@/lib/on-call/service-api";
import { serviceJoinSchema } from "@/lib/on-call/service-model";
import { hashServiceInvitation, serviceCommand } from "@/lib/on-call/service-repository";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return withServiceApi(request, async (client, ownerId) => {
    const { code } = await parseJsonBody(request, serviceJoinSchema);
    return serviceCommand(client, ownerId, null, "join", { tokenHash: hashServiceInvitation(code) });
  });
}
