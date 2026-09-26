import { NextResponse } from "next/server";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { demoOnCallShifts } from "@/lib/on-call/shifts/demo-shifts";
import { shiftIsInWindow } from "@/lib/on-call/shifts/diff";
import { onCallShiftImportRequestSchema } from "@/lib/on-call/shifts/model";
import {
  deleteOwnerShifts,
  fetchLatestShiftImport,
  fetchOwnerShifts,
  replaceOwnerShifts,
} from "@/lib/on-call/shifts/repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";

/**
 * My shifts: the signed-in doctor's own roster. List what is coming up and the
 * latest import (GET), save an imported roster (POST), or delete every shift
 * (DELETE). The owner comes from the validated session only, never the request,
 * and every query is filtered by it.
 */

const noStore = { "Cache-Control": "no-store" };

async function authorise(request: Request) {
  const supabase = createAdminClient();
  const user = await requireAuthenticatedUser(request, supabase);
  const rateLimit = await consumeSubjectApiRateLimit({
    supabase,
    subject: { kind: "owner", ownerId: user.id },
    bucket: "on_call",
    allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
  });
  return { supabase, user, rateLimit };
}

function demoRefusal() {
  return publicErrorResponse("Demo mode cannot save a roster. Sign in to add yours.", 400, {
    code: "demo_mode_unavailable",
  });
}

export async function GET(request: Request) {
  try {
    if (isDemoMode()) {
      return NextResponse.json(
        { shifts: demoOnCallShifts(new Date()), latestImport: null, demoMode: true },
        { headers: noStore },
      );
    }
    const { supabase, user, rateLimit } = await authorise(request);
    if (rateLimit.limited) return rateLimitJsonResponse("Too many requests. Try again shortly.", rateLimit);
    const [shifts, latestImport] = await Promise.all([
      fetchOwnerShifts(supabase, user.id, new Date()),
      fetchLatestShiftImport(supabase, user.id),
    ]);
    return NextResponse.json({ shifts, latestImport }, { headers: noStore });
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
    const body = await parseJsonBody(request, onCallShiftImportRequestSchema, "That roster could not be saved.");
    const window = { start: body.windowStart, end: body.windowEnd };
    const outOfWindow = body.shifts.some((shift) => !shiftIsInWindow(shift, window));
    if (outOfWindow) {
      return publicErrorResponse("A shift falls outside the roster's dates.", 400, { code: "invalid_body" });
    }
    await replaceOwnerShifts(supabase, user.id, body);
    const [shifts, latestImport] = await Promise.all([
      fetchOwnerShifts(supabase, user.id, new Date()),
      fetchLatestShiftImport(supabase, user.id),
    ]);
    return NextResponse.json({ shifts, latestImport }, { headers: noStore });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    if (isDemoMode()) return demoRefusal();
    const { supabase, user, rateLimit } = await authorise(request);
    if (rateLimit.limited) return rateLimitJsonResponse("Too many requests. Try again shortly.", rateLimit);
    await deleteOwnerShifts(supabase, user.id);
    return NextResponse.json({ shifts: [], latestImport: null }, { headers: noStore });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
