import { NextResponse } from "next/server";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { cpdYearOf } from "@/lib/cme/cpd-year";
import { DEMO_CME_INSTANT, DEMO_CME_YEAR } from "@/lib/cme/demo-year";
import { confirmCmeYear, fetchOwnerCmeYear } from "@/lib/cme/repository";
import { cmeListQuerySchema, cmeYearConfirmSchema } from "@/lib/cme/schemas";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";
import { parseRequestQuery } from "@/lib/validation/query";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { year } = parseRequestQuery(request, cmeListQuerySchema, "Invalid CME query.");

    if (isDemoMode()) {
      const targetYear = year ?? cpdYearOf(DEMO_CME_INSTANT);
      const requirementSet = targetYear === DEMO_CME_YEAR.year ? DEMO_CME_YEAR : null;
      return NextResponse.json({ year: targetYear, requirementSet, demoMode: true });
    }

    const supabase = createAdminClient();
    // The owner comes from the validated session only — never from the request body or a
    // query string. CME targets are always the owner's own confirmed numbers, never a shared
    // reference surface, so there is no anonymous path here.
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

    const targetYear = year ?? cpdYearOf(new Date());
    const requirementSet = await fetchOwnerCmeYear(supabase, user.id, targetYear);
    return NextResponse.json({ year: targetYear, requirementSet });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    if (isDemoMode()) {
      return publicErrorResponse("CME targets cannot be confirmed in demo mode.", 400, {
        code: "demo_mode_unavailable",
      });
    }

    const supabase = createAdminClient();
    // The owner comes from the validated session only — never from the request body or a
    // query string.
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

    const body = await parseJsonBody(request, cmeYearConfirmSchema, "Invalid CME year confirmation.");

    const requirementSet = await confirmCmeYear(supabase, user.id, body);
    return NextResponse.json({ year: body.year, requirementSet });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
