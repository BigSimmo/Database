import { NextResponse } from "next/server";
import { z } from "zod";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { markShiftImportSeen } from "@/lib/on-call/shifts/repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

/** Dismiss the "What changed" card for one of the owner's own roster imports. */

const importIdSchema = z.string().uuid();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (isDemoMode()) return NextResponse.json({ seen: true }, { headers: { "Cache-Control": "no-store" } });
    const { id } = await context.params;
    const parsed = importIdSchema.safeParse(id);
    if (!parsed.success) return publicErrorResponse("Unknown roster import.", 404, { code: "not_found" });
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: { kind: "owner", ownerId: user.id },
      bucket: "on_call",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (rateLimit.limited) return rateLimitJsonResponse("Too many requests. Try again shortly.", rateLimit);
    const seen = await markShiftImportSeen(supabase, user.id, parsed.data);
    if (!seen) return publicErrorResponse("Unknown roster import.", 404, { code: "not_found" });
    return NextResponse.json({ seen: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
