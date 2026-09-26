import { NextResponse } from "next/server";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { cmeDraftCreateSchema, cmeDraftPayloadSchema } from "@/lib/cme/drafts";
import { createOwnerCmeDraft, fetchOwnerCmeDrafts } from "@/lib/cme/drafts-repository";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";

/** Demo mode has no drafts of its own: it is read-only, and nothing is ever saved to it. */
export async function GET(request: Request) {
  try {
    if (isDemoMode()) return NextResponse.json({ drafts: [], demoMode: true });

    const supabase = createAdminClient();
    // The owner comes from the validated session only — never from the request body or a
    // query string. Drafts are a private per-owner record, like every other CME table.
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

    return NextResponse.json(
      { drafts: await fetchOwnerCmeDrafts(supabase, user.id) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (isDemoMode()) {
      return publicErrorResponse("Drafts cannot be saved in demo mode.", 400, { code: "demo_mode_unavailable" });
    }

    const supabase = createAdminClient();
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

    const body = await parseJsonBody(request, cmeDraftCreateSchema, "Invalid draft.");
    const payload = body.payload ?? cmeDraftPayloadSchema.parse({});
    const draft = await createOwnerCmeDraft(supabase, user.id, payload, {
      waitingOn: body.waitingOn,
      waitingNote: body.waitingNote,
      followUpOn: body.followUpOn,
    });
    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
