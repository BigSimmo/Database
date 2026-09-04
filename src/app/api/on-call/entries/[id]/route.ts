import { NextResponse } from "next/server";
import { z } from "zod";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { onCallDetailsSchemaFor, onCallEntrySchema } from "@/lib/on-call/entry-model";
import { onCallEntryToRow, rowToOnCallEntry } from "@/lib/on-call/repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";
import { parseRouteParams } from "@/lib/validation/params";

export const runtime = "nodejs";

const onCallEntryRouteParamsSchema = z.object({ id: z.string().uuid() });

// A PATCH replaces the entry (its id comes from the route, never the body) — the same
// contract POST validates against, minus `id`, plus a section-specific `details` check below.
//
// `.required()` additionally strips every `.default(...)` onCallEntrySchema declares
// (subtitle, body, linkedDocumentIds, tags, isPersonal, includeOnCard, sortOrder,
// lastVerifiedAt) and makes each of those fields mandatory. Defaults are correct on create — a
// brand-new entry that omits `subtitle` really has no subtitle — but dangerous on update:
// without `.required()`, a PATCH body that simply forgot to round-trip `lastVerifiedAt` would
// validate successfully and silently reset it to null on save, discarding the "this entry is
// still correct" record the mode's whole twelve-month staleness design rests on. Confirmed
// against the installed Zod 4 (4.4.3) that `.required()` strips ZodDefault wrappers, not only
// ZodOptional ones, so this rejects a partial body with a 400 instead of trusting the caller.
// Exported for tests/on-call-api-contract.test.ts, which asserts against this schema directly
// rather than re-deriving it — a route handler's own runtime methods (GET/POST/…) are the only
// exports Next.js's Route Handler contract cares about; an additional plain const export is
// inert to it.
export const updateOnCallEntrySchema = onCallEntrySchema.omit({ id: true }).required();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const { id } = parseRouteParams({ id: rawId }, onCallEntryRouteParamsSchema, "Invalid On Call entry id.");

    if (isDemoMode()) {
      return publicErrorResponse("On Call entries cannot be edited in demo mode.", 400, {
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
      bucket: "on_call",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("On Call requests are rate limited. Try again shortly.", rateLimit);
    }

    const rawBody = await parseJsonBody(request, z.unknown(), "Invalid request body.");
    const parsedEntry = updateOnCallEntrySchema.safeParse(rawBody);
    if (!parsedEntry.success) {
      return NextResponse.json({ error: "Invalid On Call entry.", issues: parsedEntry.error.issues }, { status: 400 });
    }
    const parsedDetails = onCallDetailsSchemaFor(parsedEntry.data.section).safeParse(parsedEntry.data.details);
    if (!parsedDetails.success) {
      return NextResponse.json(
        { error: "Invalid On Call entry details.", issues: parsedDetails.error.issues },
        { status: 400 },
      );
    }

    const entry = onCallEntrySchema.parse({ ...parsedEntry.data, id, details: parsedDetails.data });
    const row = onCallEntryToRow(entry, user.id);

    // Scoped by id AND owner_id on the same chain: a row that exists but belongs to another
    // owner returns no row here, identically to a row that does not exist at all — this
    // handler never learns which case it was.
    const { data, error } = await supabase
      .from("on_call_entries")
      .update(row)
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return publicErrorResponse("On Call entry not found.", 404, { code: "on_call_entry_not_found" });

    return NextResponse.json({ entry: rowToOnCallEntry(data as Record<string, unknown>) });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const { id } = parseRouteParams({ id: rawId }, onCallEntryRouteParamsSchema, "Invalid On Call entry id.");

    if (isDemoMode()) {
      return publicErrorResponse("On Call entries cannot be deleted in demo mode.", 400, {
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
      bucket: "on_call",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("On Call requests are rate limited. Try again shortly.", rateLimit);
    }

    // Scoped by id AND owner_id on the same chain: deleting an id the caller does not own
    // returns no row, identically to deleting an id that does not exist.
    const { data, error } = await supabase
      .from("on_call_entries")
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return publicErrorResponse("On Call entry not found.", 404, { code: "on_call_entry_not_found" });

    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
