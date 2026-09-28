import "server-only";

import { after, NextResponse } from "next/server";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode } from "@/lib/env";
import { rosterTeamReleaseEnabled } from "@/lib/roster/team/release";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export type RosterAdminClient = ReturnType<typeof createAdminClient>;

/**
 * The one wrapper every Roster team route uses, in the shape of On Call's
 * `withServiceApi`: the actor comes from the session only, the `roster`
 * rate-limit bucket applies, and nothing enters a shared HTTP cache, denied
 * responses included.
 *
 * In synthetic demo mode a route may pass `demo` to answer a read from the
 * invented team; anything without it (every write) is refused with 400.
 */
export async function withRosterApi(
  request: Request,
  operation: (client: RosterAdminClient, actorId: string) => Promise<unknown>,
  options: { demo?: () => unknown } = {},
): Promise<Response> {
  let response: Response;
  try {
    if (isDemoMode()) {
      response = options.demo
        ? NextResponse.json(options.demo())
        : publicErrorResponse("Demo mode can't change a team roster. Sign in to use your team.", 400, {
            code: "demo_mode_unavailable",
          });
    } else if (!rosterTeamReleaseEnabled()) {
      response = publicErrorResponse("Team roster is not available for real staff yet.", 503, {
        code: "roster_release_held",
      });
    } else {
      const client = createAdminClient();
      const user = await requireAuthenticatedUser(request, client);
      const rate = await consumeSubjectApiRateLimit({
        supabase: client,
        subject: { kind: "owner", ownerId: user.id },
        bucket: "roster",
        allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
      });
      if (rate.limited) response = rateLimitJsonResponse("Too many requests. Try again shortly.", rate);
      else {
        const result = await operation(client, user.id);
        response = result instanceof Response ? result : NextResponse.json(result);
      }
    }
  } catch (error) {
    response = error instanceof AuthenticationError ? unauthorizedResponse() : jsonError(error);
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie, Authorization");
  return response;
}

/**
 * Run work after the response is sent (phone alerts). `after` only exists
 * inside a request scope; outside one (unit tests, scripts) the work runs
 * detached instead. Failures are swallowed: an alert that fails must never
 * turn a saved change into an error.
 */
export function runAfterResponse(work: () => Promise<void>): void {
  const safe = async () => {
    try {
      await work();
    } catch {
      // Counts only are ever logged, and by the alerts module itself.
    }
  };
  try {
    after(safe);
  } catch {
    void safe();
  }
}
