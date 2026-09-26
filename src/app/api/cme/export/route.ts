import { z } from "zod";
import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { formatCmeYearCsv } from "@/lib/cme/export";
import { DEMO_CME_ENTRIES, DEMO_CME_YEAR } from "@/lib/cme/demo-year";
import { fetchOwnerCmeEntries, fetchOwnerCmeYear } from "@/lib/cme/repository";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseRequestQuery } from "@/lib/validation/query";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { year } = parseRequestQuery(
      request,
      z.object({ year: z.coerce.number().int().min(2000).max(2100) }),
      "Choose a valid CPD year.",
    );
    let csv: string;
    if (isDemoMode()) {
      if (year !== DEMO_CME_YEAR.year) return publicErrorResponse("This demo year is unavailable.", 404);
      csv = formatCmeYearCsv(DEMO_CME_ENTRIES, DEMO_CME_YEAR);
    } else {
      const supabase = createAdminClient();
      const user = await requireAuthenticatedUser(request, supabase);
      const rateLimit = await consumeSubjectApiRateLimit({
        supabase,
        subject: { kind: "owner", ownerId: user.id },
        bucket: "cme",
        allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
      });
      if (rateLimit.limited)
        return rateLimitJsonResponse("CPD requests are rate limited. Try again shortly.", rateLimit);
      const set = await fetchOwnerCmeYear(supabase, user.id, year);
      if (!set) return publicErrorResponse("This CPD year is unavailable.", 404);
      csv = formatCmeYearCsv(await fetchOwnerCmeEntries(supabase, user.id, set.id), set);
    }
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cme-${year}${isDemoMode() ? "-demo" : ""}.csv"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
