import { randomBytes } from "node:crypto";
import { z } from "zod";

import { PublicApiError } from "@/lib/http";
import { hashServiceInvitation, serviceCommand } from "@/lib/on-call/service-repository";
import { withRosterApi } from "@/lib/roster/team/api";
import { rosterRead } from "@/lib/roster/team/repository";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";
type Context = { params: Promise<{ serviceId: string }> };

const inviteSchema = z
  .object({
    invitedEmail: z
      .string()
      .trim()
      .email()
      .max(320)
      .transform((value) => value.toLowerCase()),
    expiresInDays: z.number().int().min(1).max(7).default(7),
  })
  .strict();

/** Roster's invite is the shared On Call invite, stamped as Roster and email-bound. */
export async function POST(request: Request, context: Context) {
  return withRosterApi(request, async (client, actorId) => {
    const serviceId = z
      .string()
      .uuid()
      .safeParse((await context.params).serviceId);
    if (!serviceId.success) throw new PublicApiError("Unknown team.", 400, { code: "roster_invalid_request" });
    const { invitedEmail, expiresInDays } = await parseJsonBody(request, inviteSchema, "Enter a valid email address.");
    const overview = await rosterRead(client, actorId, serviceId.data, "overview");
    if (overview.me.role !== "manager") {
      throw new PublicApiError("Only the team's roster manager can invite someone.", 403, {
        code: "roster_role_denied",
      });
    }
    const code = randomBytes(32).toString("hex");
    const receipt = await serviceCommand(client, actorId, serviceId.data, "invitation.create", {
      role: "member",
      expiresInDays,
      invitedEmail,
      issuedViaMode: "roster",
      tokenHash: hashServiceInvitation(code),
    });
    const parsed = z.object({ expiresAt: z.string() }).safeParse(receipt);
    if (!parsed.success) {
      throw new PublicApiError("The invitation could not be prepared. Try again shortly.", 503, {
        code: "roster_unavailable",
      });
    }
    // The bearer code lives only in the URL fragment. It is never logged,
    // persisted on the device, or sent to a server as part of page navigation.
    return { path: `/roster/join#code=${code}`, expiresAt: parsed.data.expiresAt };
  });
}
