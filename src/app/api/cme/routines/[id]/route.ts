import { NextResponse } from "next/server";
import { z } from "zod";
import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { saveCmeRoutine } from "@/lib/cme/repository";
import { cmeRoutineUpdateSchema } from "@/lib/cme/schemas";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";
import { parseRouteParams } from "@/lib/validation/params";
export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (isDemoMode())
      return publicErrorResponse("Routines cannot be changed in demo mode.", 400, { code: "demo_mode_unavailable" });
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const limit = await consumeSubjectApiRateLimit({
      supabase,
      subject: { kind: "owner", ownerId: user.id },
      bucket: "cme",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (limit.limited) return rateLimitJsonResponse("CME requests are rate limited. Try again shortly.", limit);
    const { id } = parseRouteParams(await params, z.object({ id: z.string().uuid() }), "Invalid routine ID.");
    const body = await parseJsonBody(request, cmeRoutineUpdateSchema, "Invalid CME routine.");
    return NextResponse.json({ routine: await saveCmeRoutine(supabase, user.id, body, id) });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
