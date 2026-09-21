import { NextResponse } from "next/server";
import { z } from "zod";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { cpdYearOf } from "@/lib/cme/cpd-year";
import { DEMO_CME_INSTANT, DEMO_CME_YEAR } from "@/lib/cme/demo-year";
import { fetchOwnerCmeYear } from "@/lib/cme/repository";
import { cmeListQuerySchema } from "@/lib/cme/schemas";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";
import { parseRequestQuery } from "@/lib/validation/query";

export const runtime = "nodejs";

/**
 * The confirmation body. Not exported from `@/lib/cme/schemas.ts` — that file (Task 2's
 * `schemas.ts`) was pulled forward with an exact, frozen contents list that has no year
 * schema in it, and this task does not own it. Kept local to this route, the same way On
 * Call keeps its route-specific `onCallListQuerySchema` local rather than shared.
 *
 * This confirms only the `cme_years` scalar target (total hours + provenance) — it never
 * writes `cme_requirements`. `src/lib/cme/repository.ts` (Task 5, frozen, out of this task's
 * ownership) exports no primitive for creating or editing individual requirements, and no
 * task in this plan's Phase 1 defines what authoring one over the wire would even look like
 * (the Setup/Programme screens in Task 11 are presentational, with no fetch call in either).
 * Re-confirming the total is the one write the Programme page's own "re-confirm" control
 * needs (see `tests/cme-programme.dom.test.tsx`), so it is the one this route implements.
 * Flagged in this task's report as a real, narrower-than-listed scope for the controller to
 * confirm or extend.
 */
const cmeYearConfirmSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  totalHours: z.number().positive().max(500),
  confirmedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date."),
  confirmedSource: z.string().trim().min(1).max(200),
});

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

    // `owner_id` on the write payload itself is the scoping token here — the same
    // "a write is scoped by what it writes" idiom `insertCmeEntry` uses — and the
    // `(owner_id, year)` unique constraint from the migration is what `onConflict` names.
    const { error: upsertError } = await supabase.from("cme_years").upsert(
      {
        owner_id: user.id,
        year: body.year,
        total_hours: body.totalHours,
        confirmed_on: body.confirmedOn,
        confirmed_source: body.confirmedSource,
      },
      { onConflict: "owner_id,year" },
    );
    if (upsertError) throw new Error(upsertError.message);

    const requirementSet = await fetchOwnerCmeYear(supabase, user.id, body.year);
    return NextResponse.json({ year: body.year, requirementSet });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
