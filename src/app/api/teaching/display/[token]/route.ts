import { NextResponse } from "next/server";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode } from "@/lib/env";
import { publicErrorResponse } from "@/lib/http";
import { anonymousApiSubjectKey } from "@/lib/public-api-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { teachingErrorResponse, teachingNoStore } from "@/lib/teaching/api";
import { isTeachingSecret } from "@/lib/teaching/checkin-token";
import { hashTeachingSecret, readDisplayCode } from "@/lib/teaching/repository";

export const runtime = "nodejs";

/**
 * The display-only code screen's poll (spec §9), for a shared hospital PC with nobody signed in.
 * The link is the credential, so only its hash reaches the database, and the answer is never
 * cached, indexed or sent on as a referrer. This code never logs the link. Railway's request log
 * may still record the path; see "Contract concerns" 5.
 */
function displayHeaders(response: Response): Response {
  teachingNoStore(response);
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  let response: Response;
  try {
    const { token } = await context.params;
    if (isDemoMode()) {
      response = publicErrorResponse("Display links are unavailable in synthetic demo mode.", 400, {
        code: "demo_mode_unavailable",
      });
    } else if (!isTeachingSecret(token)) {
      response = publicErrorResponse("This display link isn't available.", 404, { code: "teaching_not_found" });
    } else {
      const client = createAdminClient();
      const rate = await consumeSubjectApiRateLimit({
        supabase: client,
        subject: { kind: "anonymous", subjectKey: anonymousApiSubjectKey(request) },
        bucket: "teaching_code",
        allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
      });
      response = rate.limited
        ? rateLimitJsonResponse("This screen is refreshing too often. It will catch up in a moment.", rate, {
            bucket: "teaching_code",
          })
        : NextResponse.json(await readDisplayCode(client, hashTeachingSecret(token)));
    }
  } catch (error) {
    response = teachingErrorResponse(error);
  }
  return displayHeaders(response);
}
