import { NextResponse } from "next/server";
import { z } from "zod";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { cmeDraftUpdateSchema } from "@/lib/cme/drafts";
import { deleteOwnerCmeDraft, fetchOwnerCmeDraft, updateOwnerCmeDraft } from "@/lib/cme/drafts-repository";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";
import { parseRouteParams } from "@/lib/validation/params";

export const runtime = "nodejs";

const cmeDraftRouteParamsSchema = z.object({ id: z.string().uuid() });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (isDemoMode()) {
      return publicErrorResponse("Drafts are unavailable in demo mode.", 400, { code: "demo_mode_unavailable" });
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

    const { id } = parseRouteParams(await params, cmeDraftRouteParamsSchema, "Invalid draft id.");
    const draft = await fetchOwnerCmeDraft(supabase, user.id, id);
    if (!draft) return publicErrorResponse("Draft not found.", 404, { code: "cme_draft_not_found" });
    return NextResponse.json({ draft }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (isDemoMode()) {
      return publicErrorResponse("Drafts cannot be changed in demo mode.", 400, { code: "demo_mode_unavailable" });
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

    const { id } = parseRouteParams(await params, cmeDraftRouteParamsSchema, "Invalid draft id.");
    const body = await parseJsonBody(request, cmeDraftUpdateSchema, "Invalid draft update.");
    const draft = await updateOwnerCmeDraft(supabase, user.id, id, body);
    if (!draft) return publicErrorResponse("Draft not found.", 404, { code: "cme_draft_not_found" });
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (isDemoMode()) {
      return publicErrorResponse("Drafts cannot be deleted in demo mode.", 400, { code: "demo_mode_unavailable" });
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

    const { id } = parseRouteParams(await params, cmeDraftRouteParamsSchema, "Invalid draft id.");
    // A missing or already-deleted draft is a no-op, not an error — deleting a
    // draft the entry route already cleaned up after a save must not fail.
    await deleteOwnerCmeDraft(supabase, user.id, id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
