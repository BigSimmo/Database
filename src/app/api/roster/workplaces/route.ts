import { NextResponse } from "next/server";
import { z } from "zod";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { removeWorkplaceCalendarLinks, ROSTER_CALENDAR_LINK_WORKPLACE_MAX } from "@/lib/roster/calendar-links";
import { deleteWorkplaceImportedShifts } from "@/lib/roster/shifts/repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";

/**
 * Remove a workplace (Settings): its calendar links first, so no refresh can
 * bring its shifts back, then its imported shifts. Nothing is recorded as an
 * import, and hand-added shifts are never touched. The workplace's remembered
 * codes are cleared through `/api/roster/settings`. Owner from the session only.
 */

const noStore = { "Cache-Control": "no-store" };

const removeWorkplaceSchema = z
  .object({ workplace: z.string().trim().min(1).max(ROSTER_CALENDAR_LINK_WORKPLACE_MAX) })
  .strict();

export async function DELETE(request: Request) {
  try {
    if (isDemoMode()) {
      return publicErrorResponse("Demo mode cannot change a roster. Sign in to add yours.", 400, {
        code: "demo_mode_unavailable",
      });
    }
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: { kind: "owner", ownerId: user.id },
      bucket: "roster",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (rateLimit.limited) return rateLimitJsonResponse("Too many requests. Try again shortly.", rateLimit);
    const body = await parseJsonBody(request, removeWorkplaceSchema, "That workplace could not be removed.");
    await removeWorkplaceCalendarLinks(supabase, user.id, body.workplace);
    await deleteWorkplaceImportedShifts(supabase, user.id, body.workplace);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
