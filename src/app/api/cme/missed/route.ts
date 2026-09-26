import { NextResponse } from "next/server";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { cmeMissedSessionCreateSchema } from "@/lib/cme/missed-sessions";
import { createOwnerCmeMissedSession, fetchOwnerCmeMissedSessions } from "@/lib/cme/missed-sessions-repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";

/** List and create missed teaching/supervision sessions. These never carry CPD credit. */

export async function GET(request: Request) {
  try {
    // Demo mode has no missed sessions of its own; the read-only demo record shows none.
    if (isDemoMode()) return NextResponse.json({ missedSessions: [], demoMode: true });
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: { kind: "owner", ownerId: user.id },
      bucket: "cme",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("CME requests are rate limited. Try again shortly.", rateLimit);
    }
    return NextResponse.json(
      { missedSessions: await fetchOwnerCmeMissedSessions(supabase, user.id) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (isDemoMode()) {
      return publicErrorResponse("Missed sessions cannot be recorded in demo mode.", 400, {
        code: "demo_mode_unavailable",
      });
    }
    const supabase = createAdminClient();
    // The owner comes from the validated session only — never from the request body.
    const user = await requireAuthenticatedUser(request, supabase);
    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: { kind: "owner", ownerId: user.id },
      bucket: "cme",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("CME requests are rate limited. Try again shortly.", rateLimit);
    }
    const body = await parseJsonBody(request, cmeMissedSessionCreateSchema, "Invalid missed session.");
    const missedSession = await createOwnerCmeMissedSession(supabase, user.id, body);
    return NextResponse.json({ missedSession }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
