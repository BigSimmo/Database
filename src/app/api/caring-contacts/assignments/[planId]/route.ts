// src/app/api/caring-contacts/assignments/[planId]/route.ts
//
// Who is carrying one plan. GET reads the assignment; POST claims, reassigns, or covers it.
// An assignment is a fact about a plan, so its read is recorded against that plan.
//
// Next 16: `params` is a Promise and must be awaited.
import type { NextRequest } from "next/server";
import { z } from "zod";

import { readHandler, writeContextFor, writeHandler } from "@/lib/caring-contacts-server/handler";
import { actorId, planId } from "@/lib/caring-contacts/ids";
import type { CaringContactAction } from "@/lib/caring-contacts/permissions";

export const runtime = "nodejs";

type AssignmentRouteContext = { params: Promise<{ planId: string }> };

const assignmentSchema = z
  .object({
    action: z.discriminatedUnion("type", [
      z.object({ type: z.literal("claim"), actorId: z.string().min(1) }).strict(),
      z.object({ type: z.literal("reassign"), toActorId: z.string().min(1), reason: z.string().min(1) }).strict(),
      z
        .object({
          type: z.literal("startCoverage"),
          actorId: z.string().min(1),
          from: z.string().min(1),
          until: z.string().min(1),
        })
        .strict(),
      z.object({ type: z.literal("endCoverage") }).strict(),
    ]),
    idempotencyKey: z.string().min(1),
  })
  .strict();

/** Exactly what the store checks: claim, reassign, and either coverage move under coverCoordinator. */
function capabilityFor(body: z.infer<typeof assignmentSchema>): CaringContactAction {
  if (body.action.type === "claim") return "claimPlan";
  if (body.action.type === "reassign") return "reassignPlan";
  return "coverCoordinator";
}

export async function GET(request: NextRequest, context: AssignmentRouteContext): Promise<Response> {
  const { planId: id } = await context.params;
  return readHandler({
    access: { kind: "view", objectType: "plan", objectId: () => id },
    read: async (store, actor) => store.getAssignment(planId(id), { actor }),
  })(request);
}

export async function POST(request: NextRequest, context: AssignmentRouteContext): Promise<Response> {
  const { planId: id } = await context.params;
  return writeHandler({
    schema: assignmentSchema,
    action: capabilityFor,
    access: { objectType: "plan", objectId: () => id },
    write: async (store, actor, body) => {
      const action =
        body.action.type === "claim"
          ? { type: "claim" as const, actorId: actorId(body.action.actorId) }
          : body.action.type === "reassign"
            ? { type: "reassign" as const, toActorId: actorId(body.action.toActorId), reason: body.action.reason }
            : body.action.type === "startCoverage"
              ? {
                  type: "startCoverage" as const,
                  actorId: actorId(body.action.actorId),
                  from: body.action.from,
                  until: body.action.until,
                }
              : { type: "endCoverage" as const };
      return store.applyAssignment({ planId: planId(id), action }, writeContextFor(actor, body.idempotencyKey));
    },
  })(request);
}
