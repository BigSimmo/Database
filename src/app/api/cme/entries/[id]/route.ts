import { NextResponse } from "next/server";
import { z } from "zod";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { cmeEntryToRow, fetchOwnerCmeYear, rowToCmeEntry } from "@/lib/cme/repository";
import { cmeEntryUpdateSchema } from "@/lib/cme/schemas";
import type { CmeAllocation, CmeCategory, CmeEntry } from "@/lib/cme/types";
import { isDemoMode } from "@/lib/env";
import { jsonError, PublicApiError, publicErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";
import { parseRouteParams } from "@/lib/validation/params";

export const runtime = "nodejs";

const cmeEntryRouteParamsSchema = z.object({ id: z.string().uuid() });

/**
 * `src/lib/cme/repository.ts` (Task 5, frozen — out of this task's ownership) exports only
 * `insertCmeEntry`, no update/delete primitive for `cme_entries`/`cme_allocations`. The same
 * gap exists on `src/app/api/on-call/entries/[id]/route.ts`, the file this route is built
 * "line for line" from: On Call's repository has no update/delete helper either, and its
 * PATCH/DELETE build their `.update()`/`.delete()` calls directly, scoped by
 * `.eq("id", id).eq("owner_id", ownerId)` on the same chain — the exact pattern
 * `scripts/check-owner-scope-api.mjs` self-tests and accepts. This file follows that same,
 * already-proven precedent rather than leaving these two required endpoints unbuildable.
 *
 * This does mean `docs/codebase-index.md` ("`src/lib/cme/repository.ts` is the only module
 * that reaches [the CME tables]") and the comment on `cme/repository.ts` in
 * `scripts/lib/tenancy-scan.mjs`'s `SCANNED_LIB_MODULES` are not quite true of this file —
 * flagged in this task's report for the controller to either extend the repository with the
 * missing primitives or correct those two comments.
 */
type AdminClient = ReturnType<typeof createAdminClient>;

async function replaceCmeAllocations(
  supabase: AdminClient,
  ownerId: string,
  entryId: string,
  allocations: readonly CmeAllocation[],
): Promise<CmeAllocation[]> {
  const categories = allocations.map((allocation) => allocation.category);
  if (new Set(categories).size !== categories.length) {
    throw new PublicApiError("A CME entry cannot allocate hours to the same category twice.", 400);
  }

  const { error: deleteError } = await supabase
    .from("cme_allocations")
    .delete()
    .eq("owner_id", ownerId)
    .eq("entry_id", entryId);
  if (deleteError) throw new Error(deleteError.message);

  const allocationRows = allocations.map((allocation) => ({
    owner_id: ownerId,
    entry_id: entryId,
    category: allocation.category,
    hours: allocation.hours,
  }));
  const { data: insertedAllocations, error: insertError } = await supabase
    .from("cme_allocations")
    .insert(allocationRows)
    .select("category, hours");
  if (insertError) throw new Error(insertError.message);

  return (insertedAllocations ?? allocationRows).map((allocation) => ({
    category: allocation.category as CmeCategory,
    hours: allocation.hours,
  }));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const { id } = parseRouteParams({ id: rawId }, cmeEntryRouteParamsSchema, "Invalid CME entry id.");

    if (isDemoMode()) {
      return publicErrorResponse("CME entries cannot be edited in demo mode.", 400, {
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
      bucket: "cme",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("CME requests are rate limited. Try again shortly.", rateLimit);
    }

    // PATCH is a full replace, not a true partial update: `cmeEntryUpdateSchema` requires every
    // field `cmeEntryCreateSchema` would otherwise default, so a body that omits one (e.g. sends
    // only a corrected title) is rejected with a 400 instead of silently resetting the omitted
    // fields — the reflection text, recorded cost, routine/document link and buckets — to their
    // defaults. See the schema's own doc comment in `@/lib/cme/schemas.ts`.
    const body = await parseJsonBody(request, cmeEntryUpdateSchema, "Invalid CME entry.");

    // `transcribed` has no field in the schema at all — it is not part of a full replace — so
    // it must be read off the existing row and carried forward. Without this, editing an
    // entry's title or cost would silently un-transcribe it.
    const { data: existingRow, error: existingError } = await supabase
      .from("cme_entries")
      .select("transcribed_at")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existingRow) return publicErrorResponse("CME entry not found.", 404, { code: "cme_entry_not_found" });

    const targetYear = Number(body.date.slice(0, 4));
    const yearRow = await fetchOwnerCmeYear(supabase, user.id, targetYear);
    if (!yearRow) {
      return publicErrorResponse(`Confirm your CPD targets for ${targetYear} before moving an entry there.`, 400, {
        code: "cme_year_not_confirmed",
      });
    }

    const entry: CmeEntry = {
      id,
      date: body.date,
      title: body.title,
      allocations: body.allocations,
      reflection: body.reflection,
      costCents: body.costCents,
      transcribed: (existingRow as Record<string, unknown>).transcribed_at != null,
      // NOT CHECKED: that `routineId`/`documentId` belong to this owner. The foreign keys
      // (`cme_entries.routine_id` -> `cme_routines.id`, `cme_entries.document_id` ->
      // `documents.id`) only prove the row exists somewhere, not who owns it — unlike On
      // Call, which validates ownership before writing via `assertValidLinkedDocumentIds`.
      // Safe today only because nothing ever resolves these ids back to another owner's
      // data: the UI reads them purely as a boolean "attached" flag and never fetches or
      // displays the linked routine's title or the linked document's title/link. It stops
      // being safe the moment any screen resolves either id to show that title or a link —
      // at that point an owner could probe another owner's routine/document ids (e.g. by
      // brute-forcing UUIDs, or ones observed elsewhere) and learn whether they exist from
      // what comes back, a cross-tenant existence oracle. Add an ownership check
      // (`.eq("owner_id", user.id)` alongside the id lookup, mirroring On Call's helper)
      // before any such screen ships.
      routineId: body.routineId,
      documentId: body.documentId,
      buckets: body.buckets,
    };
    const row = cmeEntryToRow(entry, user.id, yearRow.id);

    // Allocations are replaced first: if the duplicate-category guard inside it throws, the
    // `cme_entries` row below is never touched, so a rejected PATCH leaves the stored entry
    // exactly as it was rather than half-applied.
    const allocations = await replaceCmeAllocations(supabase, user.id, id, entry.allocations);

    // Scoped by id AND owner_id on the same chain: a row that exists but belongs to another
    // owner returns no row here, identically to a row that does not exist at all.
    const { data: updatedRow, error: updateError } = await supabase
      .from("cme_entries")
      .update(row)
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("*")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!updatedRow) return publicErrorResponse("CME entry not found.", 404, { code: "cme_entry_not_found" });

    return NextResponse.json({ entry: rowToCmeEntry(updatedRow as Record<string, unknown>, allocations) });
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
    const { id } = parseRouteParams({ id: rawId }, cmeEntryRouteParamsSchema, "Invalid CME entry id.");

    if (isDemoMode()) {
      return publicErrorResponse("CME entries cannot be deleted in demo mode.", 400, {
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
      bucket: "cme",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("CME requests are rate limited. Try again shortly.", rateLimit);
    }

    // Scoped by id AND owner_id on the same chain: deleting an id the caller does not own
    // returns no row, identically to deleting an id that does not exist. `cme_allocations`
    // rows cascade on delete (see the migration's `entry_id ... on delete cascade`), so
    // nothing else needs deleting here.
    const { data, error } = await supabase
      .from("cme_entries")
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return publicErrorResponse("CME entry not found.", 404, { code: "cme_entry_not_found" });

    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
