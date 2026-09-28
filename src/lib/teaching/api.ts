import "server-only";

import { NextResponse } from "next/server";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode } from "@/lib/env";
import { jsonError, PublicApiError, publicErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

type AdminClient = ReturnType<typeof createAdminClient>;

export type TeachingApiOptions = {
  /** What demo mode serves instead of refusing. Reads only; writes are always refused in demo mode. */
  demo?: () => unknown;
};

/** Teaching data never enters shared HTTP caches, including denied responses. */
export function teachingNoStore(response: Response): Response {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie, Authorization");
  return response;
}

/** 4xx answers are the doctor's to act on, not server faults; only 5xx are logged as errors. */
export function teachingErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthenticationError) return unauthorizedResponse();
  return jsonError(error, 500, { log: !(error instanceof PublicApiError) || error.status >= 500 });
}

export async function withTeachingApi(
  request: Request,
  operation: (client: AdminClient, ownerId: string) => Promise<unknown>,
  options: TeachingApiOptions = {},
): Promise<Response> {
  let response: Response;
  try {
    if (isDemoMode()) {
      response = options.demo
        ? NextResponse.json(await options.demo())
        : publicErrorResponse("Teaching changes are unavailable in synthetic demo mode.", 400, {
            code: "demo_mode_unavailable",
          });
    } else {
      const client = createAdminClient();
      const user = await requireAuthenticatedUser(request, client);
      const rate = await consumeSubjectApiRateLimit({
        supabase: client,
        subject: { kind: "owner", ownerId: user.id },
        bucket: "teaching",
        allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
      });
      if (rate.limited) {
        response = rateLimitJsonResponse("Teaching requests are rate limited. Try again shortly.", rate);
      } else {
        const result = await operation(client, user.id);
        response = result instanceof Response ? result : NextResponse.json(result);
      }
    }
  } catch (error) {
    response = teachingErrorResponse(error);
  }
  return teachingNoStore(response);
}

/** Typed six-digit codes can be guessed, so each attempt also spends from a small per-doctor allowance. */
export async function assertTeachingCodeAttempt(client: AdminClient, ownerId: string): Promise<void> {
  const rate = await consumeSubjectApiRateLimit({
    supabase: client,
    subject: { kind: "owner", ownerId },
    bucket: "teaching_code",
    allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
  });
  if (rate.limited)
    throw new PublicApiError("Too many code attempts. Wait a minute, then try again.", 429, { code: "rate_limited" });
}
