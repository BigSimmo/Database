import { withServiceApi } from "@/lib/on-call/service-api";
import { serviceJoinSchema } from "@/lib/on-call/service-model";
import { hashServiceInvitation, serviceCommand } from "@/lib/on-call/service-repository";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return withServiceApi(request, async (client, ownerId) => {
    const { code } = await parseJsonBody(request, serviceJoinSchema);
    // Invitations are bound to an email. Only a confirmed address is sent, read from Auth by the
    // session's user id, so the database never compares against an email the caller typed.
    const { data } = await client.auth.admin.getUserById(ownerId);
    const actorEmail = data.user?.email_confirmed_at ? (data.user.email ?? "") : "";
    return serviceCommand(client, ownerId, null, "join", { tokenHash: hashServiceInvitation(code), actorEmail });
  });
}
