// src/app/api/caring-contacts/access-trail/route.ts
//
// The access trail itself, which only the auditor may read.
//
// POST, not GET, and the filters travel in the body: a trail query is the one read whose filters
// could grow to carry free text, and a query string is logged by every proxy between here and the
// browser. Reading the trail is itself an access, so this read is recorded like any other -- an
// auditor's own views sit in the trail beside everybody else's.
import type { NextRequest } from "next/server";
import { z } from "zod";

import { invalidRequestResponse, readHandler } from "@/lib/caring-contacts-server/handler";
import { actorId } from "@/lib/caring-contacts/ids";
import { parseJsonBodyOrDefault } from "@/lib/validation/body";

export const runtime = "nodejs";

const COLLECTION = "all";

const querySchema = z
  .object({
    fromIso: z.string().min(1).optional(),
    toIso: z.string().min(1).optional(),
    actorId: z.string().min(1).optional(),
    objectType: z.enum(["plan", "contact", "episode", "auditTrail", "report", "patientDirectory"]).optional(),
    limit: z.number().int().positive().max(500).default(100),
    offset: z.number().int().nonnegative().default(0),
  })
  .strict();

export async function POST(request: NextRequest): Promise<Response> {
  // The filter body is read here, before the audited read, so a query that does not parse is
  // refused by name rather than silently answered with a different window than the one asked for.
  const raw = await parseJsonBodyOrDefault(request, z.unknown(), undefined);
  const parsed = querySchema.safeParse(raw ?? {});
  if (!parsed.success) return invalidRequestResponse();
  const query = parsed.data;

  return readHandler({
    access: { kind: "search", objectType: "auditTrail", objectId: () => COLLECTION },
    // The body is already consumed above; the handler never reads it again.
    read: async (store, actor) =>
      store.listAccessTrail(
        {
          fromIso: query.fromIso,
          toIso: query.toIso,
          actorId: query.actorId === undefined ? undefined : actorId(query.actorId),
          objectType: query.objectType,
          limit: query.limit,
          offset: query.offset,
        },
        { actor },
      ),
  })(request);
}
