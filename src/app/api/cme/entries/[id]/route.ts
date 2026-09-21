import { NextResponse } from "next/server";
import { z } from "zod";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import {
  assertValidCmeLinkedIds,
  cmeEntryToRow,
  fetchOwnerCmeYear,
  markCmeEntryTranscribed,
  replaceCmeAllocations,
  restoreCmeAllocations,
  rowToCmeEntry,
} from "@/lib/cme/repository";
import { cmeEntryUpdateSchema } from "@/lib/cme/schemas";
import type { CmeEntry } from "@/lib/cme/types";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
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

    // Two accepted bodies:
    // 1. `{ "transcribed": true }` — stamp transcribed_at after a successful clipboard copy.
    // 2. A full-replace `cmeEntryUpdateSchema` body (every create field required), so a partial
    //    edit cannot silently blank reflection/cost/links via create-schema defaults.
    const rawBody: unknown = await request.json();
    const markTranscribed =
      rawBody !== null &&
      typeof rawBody === "object" &&
      !Array.isArray(rawBody) &&
      Object.keys(rawBody as object).length === 1 &&
      (rawBody as { transcribed?: unknown }).transcribed === true;

    if (markTranscribed) {
      const entry = await markCmeEntryTranscribed(supabase, user.id, id);
      return NextResponse.json({ entry });
    }

    const body = cmeEntryUpdateSchema.parse(rawBody);

    // `transcribed` is not part of a full replace — read it off the existing row and carry
    // it forward so editing title/cost cannot silently un-transcribe the entry.
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

    await assertValidCmeLinkedIds(supabase, user.id, {
      routineId: body.routineId,
      documentId: body.documentId,
    });

    const entry: CmeEntry = {
      id,
      date: body.date,
      title: body.title,
      allocations: body.allocations,
      reflection: body.reflection,
      costCents: body.costCents,
      transcribed: (existingRow as Record<string, unknown>).transcribed_at != null,
      routineId: body.routineId,
      documentId: body.documentId,
      buckets: body.buckets,
    };
    const row = cmeEntryToRow(entry, user.id, yearRow.id);

    // Allocations first (with restore-on-insert-failure). If the later entry update fails,
    // restore the prior allocation snapshot so a rejected edit cannot corrupt the CPD record.
    const { written: allocations, prior } = await replaceCmeAllocations(supabase, user.id, id, entry.allocations);

    const { data: updatedRow, error: updateError } = await supabase
      .from("cme_entries")
      .update(row)
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("*")
      .maybeSingle();
    if (updateError) {
      await restoreCmeAllocations(supabase, user.id, id, prior);
      throw new Error(updateError.message);
    }
    if (!updatedRow) {
      await restoreCmeAllocations(supabase, user.id, id, prior);
      return publicErrorResponse("CME entry not found.", 404, { code: "cme_entry_not_found" });
    }

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
