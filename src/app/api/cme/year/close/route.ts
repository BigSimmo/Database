import { NextResponse } from "next/server";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { closeCmeYear, fetchOwnerCmeEntries, fetchOwnerCmeYear, fetchOwnerCmeYearClose } from "@/lib/cme/repository";
import { cmeYearCloseSchema } from "@/lib/cme/schemas";
import { buildCmeCloseEvaluation, canCloseCmeYear, cmeYearClosableFromLabel } from "@/lib/cme/year-close";
import { cmeYearConfigurationState } from "@/lib/cme/year-configuration";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";

/**
 * Close one CPD year (docs/cme/design/cme-design-decisions.md section 9). Closing freezes a
 * snapshot of the year; afterwards a change to one of its activities is a dated amendment.
 * There is no reopen.
 */
export async function POST(request: Request) {
  try {
    if (isDemoMode()) {
      return publicErrorResponse("A CPD year cannot be closed in demo mode.", 400, {
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
      return rateLimitJsonResponse("CPD requests are rate limited. Try again shortly.", rateLimit);
    }

    const body = await parseJsonBody(request, cmeYearCloseSchema, "Invalid CPD year close request.");

    const yearRow = await fetchOwnerCmeYear(supabase, user.id, body.year);
    if (cmeYearConfigurationState(yearRow) === "unavailable") {
      return publicErrorResponse("Your saved CPD targets could not be read. Nothing has been closed.", 503, {
        code: "cme_year_unavailable",
      });
    }
    if (!yearRow || cmeYearConfigurationState(yearRow) !== "ready") {
      return publicErrorResponse(`Confirm your CPD targets for ${body.year} before closing it.`, 400, {
        code: "cme_year_not_confirmed",
      });
    }
    if (yearRow.closedAt) {
      return publicErrorResponse(`${body.year} is already closed.`, 409, { code: "cme_year_closed" });
    }
    if (!canCloseCmeYear(new Date(), body.year)) {
      return publicErrorResponse(`You can close ${body.year} from ${cmeYearClosableFromLabel(body.year)}.`, 400, {
        code: "cme_year_close_too_early",
      });
    }

    const entries = await fetchOwnerCmeEntries(supabase, user.id, yearRow.id);
    const evaluation = buildCmeCloseEvaluation(yearRow, entries);
    const note = body.shortfallNote ? body.shortfallNote : null;
    await closeCmeYear(supabase, user.id, yearRow.id, evaluation, note);

    const close = await fetchOwnerCmeYearClose(supabase, user.id, yearRow.id);
    return NextResponse.json({ year: body.year, close });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
