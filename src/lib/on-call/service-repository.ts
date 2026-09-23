import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { PublicApiError } from "@/lib/http";
import type { ServiceAction } from "@/lib/on-call/service-model";

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

const serviceErrors: Record<string, { status: number; message: string }> = {
  service_auth_required: { status: 401, message: "Sign in to open service handbooks." },
  service_access_denied: { status: 403, message: "Your account does not have access to this service." },
  service_role_denied: { status: 403, message: "Your service role does not permit this change." },
  service_review_denied: {
    status: 403,
    message: "An assigned reviewer other than the author must review this summary.",
  },
  service_review_required: { status: 400, message: "This summary requires independent clinical or legal review." },
  service_source_required: { status: 400, message: "Add an official source link before requesting review." },
  service_revision_conflict: { status: 409, message: "This entry changed. Reload the current revision before saving." },
  service_last_admin: { status: 409, message: "Assign another administrator before removing the last administrator." },
  service_invitation_invalid: { status: 400, message: "This invitation is invalid, expired, revoked or already used." },
  service_already_member: { status: 409, message: "You already belong to this service." },
  service_invalid_site: { status: 400, message: "Choose a site belonging to this service." },
  service_invalid_orientation: { status: 400, message: "Choose a published orientation item for this site." },
  service_not_found: { status: 404, message: "This service item is unavailable." },
  service_invalid_request: { status: 400, message: "Check the service request fields." },
  service_limit: { status: 409, message: "This service has reached its item limit." },
};

/** Actor is supplied only by requireAuthenticatedUser, never by a request payload. */
export async function serviceCommand(
  client: AdminClient,
  actorId: string,
  serviceId: string | null,
  action: string,
  payload: object = {},
): Promise<unknown> {
  if (!actorId) throw new PublicApiError("Authentication required.", 401);
  const { data, error } = await client.rpc("on_call_service_command", {
    p_actor_id: actorId,
    p_service_id: serviceId,
    p_action: action,
    p_payload: payload,
  });
  if (error) {
    const known = serviceErrors[error.message];
    if (known) throw new PublicApiError(known.message, known.status, { code: error.message });
    if (error.code === "23505")
      throw new PublicApiError("An item with this name already exists.", 409, { code: "service_duplicate" });
    throw new PublicApiError("The service handbook could not be updated or loaded.", 503, {
      code: "service_unavailable",
    });
  }
  return data;
}

export function hashServiceInvitation(code: string): string {
  return createHash("sha256").update(code.toLowerCase()).digest("hex");
}

export async function serviceMutation(
  client: AdminClient,
  actorId: string,
  serviceId: string,
  input: ServiceAction,
): Promise<unknown> {
  if (input.action === "invitation.create") {
    const code = randomBytes(32).toString("hex");
    const response = await serviceCommand(client, actorId, serviceId, input.action, {
      ...input,
      tokenHash: hashServiceInvitation(code),
    });
    const receipt = z.object({ invitationId: z.string().uuid(), expiresAt: z.string() }).parse(response);
    return { ...receipt, code };
  }
  return serviceCommand(client, actorId, serviceId, input.action, input);
}
