import { z } from "zod";

import { PublicApiError } from "@/lib/http";
import { dispatchRosterAlerts } from "@/lib/roster/alerts/dispatch";
import {
  publishOpenShiftSchema,
  publishPayloadSchema,
  validateOpenShifts,
  validatePublishPayload,
  validatePublishPeriod,
} from "@/lib/roster/publish/build";
import { runAfterResponse, withRosterApi, type RosterAdminClient } from "@/lib/roster/team/api";
import { demoPublishPreview, demoPublishReceipt } from "@/lib/roster/team/demo-team";
import { rosterApiError, rosterUnavailable } from "@/lib/roster/team/errors";
import {
  ROSTER_ASSIGNMENT_KINDS,
  rosterAssignmentSchema,
  rosterChangesSchema,
  rosterPersonSchema,
  rosterShiftCodeSchema,
} from "@/lib/roster/team/model";
import { rosterRead } from "@/lib/roster/team/repository";
import { parseSchema } from "@/lib/validation/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ serviceId: string }> };

const uuid = z.string().uuid();
const MAX_PUBLISH_BODY_BYTES = 2 * 1024 * 1024;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const previewSchema = z.object({
  freshnessToken: z.string().min(1).max(256),
  assignments: z.array(rosterAssignmentSchema).max(5000),
  changes: rosterChangesSchema,
  people: z.array(rosterPersonSchema),
  codes: z.array(rosterShiftCodeSchema).max(100),
});
const receiptSchema = z.object({
  publicationId: uuid,
  version: z.number().int().positive(),
  swapsCancelled: z.array(z.object({ id: uuid, requesterId: uuid, counterpartyId: uuid })),
  changedUserIds: z.array(uuid).max(5000),
  openShiftIds: z.array(uuid).max(1000),
  overridesRecorded: z.array(z.object({ kind: z.enum(["swap", "open"]), id: uuid })).max(5000),
});
const overrideSchema = z.object({ kind: z.enum(["swap", "open"]), id: uuid }).strict();
const codeSchema = z
  .object({
    code: z.string().trim().min(1).max(12),
    kind: z.union([z.enum(ROSTER_ASSIGNMENT_KINDS), z.literal("off")]),
    starts: clock.nullable(),
    ends: clock.nullable(),
    label: z.string().trim().min(1).max(40).nullable(),
  })
  .strict()
  .refine((code) => code.kind !== "off" || (code.starts === null && code.ends === null));
const bodySchema = z
  .object({
    expectedToken: z.string().min(1).max(256),
    roles: z.array(z.object({ userId: uuid, rosterName: z.string().trim().min(1).max(80) }).strict()).max(5000),
    codes: z.array(codeSchema).max(100),
    publication: publishPayloadSchema,
    openShifts: z.array(publishOpenShiftSchema).max(1000).default([]),
    overrideChanges: z.array(overrideSchema).max(5000).default([]),
  })
  .strict();

/** 5,000 shifts can exceed the ordinary 256 KiB JSON cap; keep a local 2 MiB bound. */
async function parsePublishBody(request: Request): Promise<z.infer<typeof bodySchema>> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_PUBLISH_BODY_BYTES) {
    throw new PublicApiError("Request body is too large.", 413, { code: "payload_too_large" });
  }
  if (!request.body) return parseSchema(bodySchema, null, "Check the roster before publishing.", "invalid_body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PUBLISH_BODY_BYTES) {
        await reader.cancel("payload_too_large");
        throw new PublicApiError("Request body is too large.", 413, { code: "payload_too_large" });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    value = null;
  }
  return parseSchema(bodySchema, value, "Check the roster before publishing.", "invalid_body");
}

async function serviceIdOf(context: Context) {
  const parsed = uuid.safeParse((await context.params).serviceId);
  if (!parsed.success) throw new PublicApiError("Unknown team.", 400, { code: "roster_invalid_request" });
  return parsed.data;
}

function missingPublishRpc(error: { code?: string | null; message?: string | null }): boolean {
  return error.code === "PGRST202" || error.code === "42883";
}

function updateRequired(): PublicApiError {
  return new PublicApiError("Publishing needs a database safety update first.", 409, {
    code: "roster_publish_requires_update",
  });
}

function periodFrom(request: Request): { from: string; to: string } {
  const params = new URL(request.url).searchParams;
  if (
    [...params.keys()].some((key) => key !== "from" && key !== "to") ||
    params.getAll("from").length !== 1 ||
    params.getAll("to").length !== 1
  ) {
    throw new PublicApiError("Choose valid roster dates.", 400, { code: "roster_invalid_request" });
  }
  const from = date.safeParse(params.get("from"));
  const to = date.safeParse(params.get("to"));
  if (!from.success || !to.success)
    throw new PublicApiError("Choose valid roster dates.", 400, { code: "roster_invalid_request" });
  try {
    validatePublishPeriod({ start: from.data, end: to.data });
  } catch {
    throw new PublicApiError("Choose a valid period of at most 186 days.", 400, { code: "roster_invalid_request" });
  }
  return { from: from.data, to: to.data };
}

async function checkedPublishBody(request: Request): Promise<z.infer<typeof bodySchema>> {
  const body = await parsePublishBody(request);
  try {
    validatePublishPayload(body.publication);
    validateOpenShifts({
      period: { start: body.publication.periodStart, end: body.publication.periodEnd },
      openShifts: body.openShifts,
    });
    if (body.publication.assignments.length + body.openShifts.length > 5000) throw new Error("Too many shifts.");
    const overrideKeys = body.overrideChanges.map((change) => `${change.kind}:${change.id}`);
    if (new Set(overrideKeys).size !== overrideKeys.length) throw new Error("Duplicate override.");
  } catch {
    throw new PublicApiError("Check the roster before publishing.", 400, { code: "roster_invalid_request" });
  }
  return body;
}

/** The snapshot is one database read under the same lock used by publication. */
export async function GET(request: Request, context: Context) {
  return withRosterApi(
    request,
    async (client, actorId) => {
      const serviceId = await serviceIdOf(context);
      const { from, to } = periodFrom(request);
      const overview = await rosterRead(client, actorId, serviceId, "overview");
      if (overview.me.role !== "manager")
        throw new PublicApiError("Only the team's roster manager can publish.", 403, { code: "roster_role_denied" });
      const { data, error } = await client.rpc("roster_publish_preview", {
        p_actor_id: actorId,
        p_service_id: serviceId,
        p_from: from,
        p_to: to,
      });
      if (error) throw missingPublishRpc(error) ? updateRequired() : rosterApiError(error);
      const parsed = previewSchema.safeParse(data);
      if (!parsed.success) throw rosterUnavailable();
      return parsed.data;
    },
    {
      // Release held: the sample team's current roster for the chosen period.
      sample: async () => {
        await serviceIdOf(context);
        const { from, to } = periodFrom(request);
        return demoPublishPreview(from, to);
      },
    },
  );
}

/** One atomic command checks freshness, roles, codes and assignments together. */
export async function POST(request: Request, context: Context) {
  return withRosterApi(request, async (client, actorId) => publish(request, context, client, actorId), {
    // Release held: the roster is checked as usual, then nothing is published and nobody is told.
    sample: async () => {
      await serviceIdOf(context);
      await checkedPublishBody(request);
      return demoPublishReceipt();
    },
  });
}

async function publish(request: Request, context: Context, client: RosterAdminClient, actorId: string) {
  const serviceId = await serviceIdOf(context);
  const body = await checkedPublishBody(request);
  const { data, error } = await client.rpc("roster_publish", {
    p_actor_id: actorId,
    p_service_id: serviceId,
    p_expected_token: body.expectedToken,
    p_payload: {
      roles: body.roles,
      codes: body.codes,
      publication: body.publication,
      openShifts: body.openShifts,
      overrideChanges: body.overrideChanges,
    },
  });
  if (error) throw missingPublishRpc(error) ? updateRequired() : rosterApiError(error);
  const parsed = receiptSchema.safeParse(data);
  if (!parsed.success) throw rosterUnavailable();
  runAfterResponse(() =>
    dispatchRosterAlerts(client, {
      serviceId,
      actorId,
      action: { action: "publish" },
      result: parsed.data,
    }),
  );
  return parsed.data;
}
