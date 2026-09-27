import { NextResponse } from "next/server";

import { PublicApiError } from "@/lib/http";
import { teachingErrorResponse, withTeachingApi } from "@/lib/teaching/api";
import { clearTeachingClaimCookie, readTeachingClaimSecret } from "@/lib/teaching/checkin-claim";
import { completeCheckin, hashTeachingSecret } from "@/lib/teaching/repository";

export const runtime = "nodejs";

/** A claim that can never succeed: used, expired, another team's, or refused. 401 and 429 are not final. */
function claimIsSpent(error: unknown): error is PublicApiError {
  return (
    error instanceof PublicApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 401 &&
    error.status !== 429
  );
}

/**
 * Redeems this browser's claim for the signed-in doctor. Signed out, the wrapper answers 401
 * before this runs and the cookie stays for after sign-in. A spent claim clears the cookie; a
 * server fault keeps it, so the page can try again within its 10 minutes.
 */
export async function POST(request: Request) {
  return withTeachingApi(request, async (client, ownerId) => {
    const secret = readTeachingClaimSecret(request);
    if (!secret)
      throw new PublicApiError("Scan the screen again to check in.", 410, { code: "teaching_claim_missing" });
    try {
      const mark = await completeCheckin(client, ownerId, hashTeachingSecret(secret));
      return clearTeachingClaimCookie(NextResponse.json(mark), request);
    } catch (error) {
      if (claimIsSpent(error)) return clearTeachingClaimCookie(teachingErrorResponse(error), request);
      throw error;
    }
  });
}
