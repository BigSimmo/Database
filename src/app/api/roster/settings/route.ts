import { NextResponse } from "next/server";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import {
  DEFAULT_ROSTER_SETTINGS,
  fetchRosterSettings,
  rosterSettingsPatchSchema,
  writeRosterSettings,
} from "@/lib/roster/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";

/**
 * Roster's own settings: which row on an import is the doctor, what shift
 * codes mean at each workplace, and the calendar-link switch. Stored at
 * `user_preferences.preferences.roster`; see `@/lib/roster/settings` for why
 * this is the only route that may read or write that key.
 */

const noStore = { "Cache-Control": "no-store" };

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
  return publicErrorResponse("Demo mode cannot save Roster settings. Sign in to save yours.", 400, {
    code: "demo_mode_unavailable",
  });
}

export async function GET(request: Request) {
  try {
    if (isDemoMode()) return NextResponse.json({ ...DEFAULT_ROSTER_SETTINGS, demoMode: true }, { headers: noStore });
    const { supabase, user, rateLimit } = await authorise(request);
    if (rateLimit.limited) return rateLimitJsonResponse("Too many requests. Try again shortly.", rateLimit);
    const settings = await fetchRosterSettings(supabase, user.id);
    return NextResponse.json(settings, { headers: noStore });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    if (isDemoMode()) return demoRefusal();
    const { supabase, user, rateLimit } = await authorise(request);
    if (rateLimit.limited) return rateLimitJsonResponse("Too many requests. Try again shortly.", rateLimit);
    const patch = await parseJsonBody(request, rosterSettingsPatchSchema, "Roster settings are invalid.");
    const settings = await writeRosterSettings(supabase, user.id, patch);
    return NextResponse.json(settings, { headers: noStore });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
