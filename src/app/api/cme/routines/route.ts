import { DEMO_CME_ROUTINES } from "@/lib/cme/demo-year";
import { NextResponse } from "next/server";
import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { fetchOwnerCmeRoutines, saveCmeRoutine } from "@/lib/cme/repository";
import { cmeRoutineCreateSchema } from "@/lib/cme/schemas";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    if (isDemoMode()) return NextResponse.json({ routines: DEMO_CME_ROUTINES, demoMode: true });
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const limit = await consumeSubjectApiRateLimit({
      supabase,
      subject: { kind: "owner", ownerId: user.id },
      bucket: "cme",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (limit.limited) return rateLimitJsonResponse("CME requests are rate limited. Try again shortly.", limit);
    return NextResponse.json(
      { routines: await fetchOwnerCmeRoutines(supabase, user.id) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
export async function POST(request: Request) {
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
    const body = await parseJsonBody(request, cmeRoutineCreateSchema, "Invalid CME routine.");
    return NextResponse.json({ routine: await saveCmeRoutine(supabase, user.id, body) }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
