import { NextResponse } from "next/server";
import { z } from "zod";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";

/**
 * "Stayed late": the doctor's own report of extra time, folded into the one
 * `extra_time_records` table Admin also writes to. Roster writes only
 * `kind`, `started_at` and `ended_at`, and `ignoreDuplicates` means a record
 * Admin already holds (perhaps already claimed) is never overwritten by a
 * doctor logging the same shift a second time.
 */

const noStore = { "Cache-Control": "no-store" };
const EXTRA_TIME_MAX_HOURS = 24;

const isoInstant = z.string().datetime({ offset: true });

const extraTimeRequestSchema = z
  .object({
    kind: z.literal("stayed_late"),
    startedAt: isoInstant,
    endedAt: isoInstant,
  })
  .strict()
  .refine((body) => Date.parse(body.endedAt) > Date.parse(body.startedAt), {
    message: "Extra time must end after it starts.",
  })
  .refine((body) => Date.parse(body.endedAt) - Date.parse(body.startedAt) <= EXTRA_TIME_MAX_HOURS * 3_600_000, {
    message: `Extra time can be at most ${EXTRA_TIME_MAX_HOURS} hours.`,
  });

async function authorise(request: Request) {
  const supabase = createAdminClient();
  const user = await requireAuthenticatedUser(request, supabase);
  const rateLimit = await consumeSubjectApiRateLimit({
    supabase,
    subject: { kind: "owner", ownerId: user.id },
    bucket: "roster",
    allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
  });
  return { supabase, user, rateLimit };
}

function demoRefusal() {
  return publicErrorResponse("Demo mode cannot log extra time. Sign in to log yours.", 400, {
    code: "demo_mode_unavailable",
  });
}

export async function POST(request: Request) {
  try {
    if (isDemoMode()) return demoRefusal();
    const { supabase, user, rateLimit } = await authorise(request);
    if (rateLimit.limited) return rateLimitJsonResponse("Too many requests. Try again shortly.", rateLimit);
    const body = await parseJsonBody(request, extraTimeRequestSchema, "That extra time could not be saved.");
    const { error } = await supabase
      .from("extra_time_records")
      .upsert(
        { owner_id: user.id, kind: body.kind, started_at: body.startedAt, ended_at: body.endedAt },
        { onConflict: "owner_id,kind,started_at", ignoreDuplicates: true },
      );
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
