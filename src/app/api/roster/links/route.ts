import { NextResponse } from "next/server";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { CalendarLinkError } from "@/lib/roster/calendar-link-fetch";
import {
  addCalendarLink,
  addRosterCalendarLinkSchema,
  fetchOwnerCalendarLinks,
  removeCalendarLink,
  removeRosterCalendarLinkSchema,
} from "@/lib/roster/calendar-links";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";

/**
 * A doctor's own calendar links (list, add, remove). The full address is
 * never returned here: `fetchOwnerCalendarLinks` gives back only a host
 * preview, and it is read in full only by the refresh route, server-side.
 */

export const runtime = "nodejs";

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
  return publicErrorResponse("Demo mode cannot save a calendar link. Sign in to add yours.", 400, {
    code: "demo_mode_unavailable",
  });
}

export async function GET(request: Request) {
  try {
    if (isDemoMode()) return NextResponse.json({ links: [], demoMode: true }, { headers: noStore });
    const { supabase, user, rateLimit } = await authorise(request);
    if (rateLimit.limited) return rateLimitJsonResponse("Too many requests. Try again shortly.", rateLimit);
    const links = await fetchOwnerCalendarLinks(supabase, user.id);
    return NextResponse.json({ links }, { headers: noStore });
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
    const body = await parseJsonBody(request, addRosterCalendarLinkSchema, "That calendar link could not be saved.");
    const link = await addCalendarLink(supabase, user.id, body.url, body.workplace);
    return NextResponse.json({ link }, { headers: noStore });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    if (error instanceof CalendarLinkError) {
      return publicErrorResponse("That calendar link could not be added.", 400, { code: error.reason });
    }
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    if (isDemoMode()) return demoRefusal();
    const { supabase, user, rateLimit } = await authorise(request);
    if (rateLimit.limited) return rateLimitJsonResponse("Too many requests. Try again shortly.", rateLimit);
    const body = await parseJsonBody(request, removeRosterCalendarLinkSchema, "That calendar link could not be found.");
    const removed = await removeCalendarLink(supabase, user.id, body.id);
    if (!removed) return publicErrorResponse("That calendar link could not be found.", 404, { code: "not_found" });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
