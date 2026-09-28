import { NextResponse } from "next/server";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode } from "@/lib/env";
import { PublicApiError, publicErrorResponse } from "@/lib/http";
import { anonymousApiSubjectKey } from "@/lib/public-api-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOptionalAuthentication } from "@/lib/supabase/auth";
import { teachingErrorResponse, teachingNoStore } from "@/lib/teaching/api";
import { setTeachingClaimCookie } from "@/lib/teaching/checkin-claim";
import { parseCheckinToken } from "@/lib/teaching/checkin-token";
import { checkinOpenBodySchema } from "@/lib/teaching/model";
import { hashTeachingSecret, newTeachingSecret, openCheckinClaim } from "@/lib/teaching/repository";
import { parseTeachingBody } from "@/lib/teaching/request";

export const runtime = "nodejs";

/**
 * A scanned QR code (spec §9). Signed in or not, this checks the code and records a single-use,
 * 10-minute claim whose secret stays in this browser's cookie. `/api/teaching/checkin/complete`
 * redeems it for the signed-in doctor: at once if they are signed in, after sign-in if not. Only
 * the claim's hash reaches the database, and the answer names the session and nothing else.
 */
export async function POST(request: Request) {
  let response: Response;
  try {
    if (isDemoMode()) {
      response = publicErrorResponse("Check-in is unavailable in synthetic demo mode.", 400, {
        code: "demo_mode_unavailable",
      });
    } else {
      const { token } = await parseTeachingBody(request, checkinOpenBodySchema);
      if (!parseCheckinToken(token))
        throw new PublicApiError("This code can't be read. Scan the screen again.", 400, {
          code: "teaching_code_invalid",
        });
      const client = createAdminClient();
      const authentication = await resolveOptionalAuthentication(request, client);
      // A lecture theatre on hospital Wi-Fi shares one network address (review focus 4). A
      // signed-in doctor spends their own allowance; only signed-out scans share the network's.
      const signedIn = authentication.status === "valid";
      const rate = await consumeSubjectApiRateLimit({
        supabase: client,
        subject: signedIn
          ? { kind: "owner", ownerId: authentication.user.id }
          : { kind: "anonymous", subjectKey: anonymousApiSubjectKey(request) },
        bucket: signedIn ? "teaching" : "teaching_code",
        allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
      });
      if (rate.limited) {
        response = rateLimitJsonResponse("Too many check-ins at once. Wait a moment, then scan again.", rate, {
          bucket: signedIn ? "teaching" : "teaching_code",
        });
      } else {
        const secret = newTeachingSecret();
        const session = await openCheckinClaim(client, token, hashTeachingSecret(secret));
        response = setTeachingClaimCookie(NextResponse.json(session), request, secret);
      }
    }
  } catch (error) {
    response = teachingErrorResponse(error);
  }
  return teachingNoStore(response);
}
