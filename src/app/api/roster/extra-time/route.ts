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
 *
 * `GET ?from&to` reads the doctor's own finished records back for the Hours
 * fortnight, so extra time survives a reload. Only the times and kind leave
 * the server: no reason and no claim field.
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

const EXTRA_TIME_READ_MAX_DAYS = 62;
const perthDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const extraTimeReadSchema = z
  .object({ from: perthDate, to: perthDate })
  .refine((range) => range.to >= range.from, { message: "The range must end after it starts." })
  .refine(
    (range) =>
      Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`) <=
      EXTRA_TIME_READ_MAX_DAYS * 86_400_000,
    { message: `The range can be at most ${EXTRA_TIME_READ_MAX_DAYS} days.` },
  );

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

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const range = extraTimeReadSchema.safeParse({ from: params.get("from"), to: params.get("to") });
    if (!range.success)
      return publicErrorResponse("That date range could not be read.", 400, { code: "invalid_range" });
    if (isDemoMode()) return NextResponse.json({ records: [] }, { headers: noStore });
    const { supabase, user, rateLimit } = await authorise(request);
    if (rateLimit.limited) return rateLimitJsonResponse("Too many requests. Try again shortly.", rateLimit);
    // Perth dates are read with a day's margin either side; the panel places each record on its Perth day.
    const from = new Date(Date.parse(`${range.data.from}T00:00:00Z`) - 86_400_000).toISOString();
    const to = new Date(Date.parse(`${range.data.to}T00:00:00Z`) + 2 * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from("extra_time_records")
      .select("kind, started_at, ended_at")
      .eq("owner_id", user.id)
      .gte("started_at", from)
      .lt("started_at", to)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: true });
    if (error) throw error;
    const records = (data ?? []).map((row) => ({ kind: row.kind, startedAt: row.started_at, endedAt: row.ended_at }));
    return NextResponse.json({ records }, { headers: noStore });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
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
