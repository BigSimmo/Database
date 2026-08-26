import { NextResponse } from "next/server";
import { z } from "zod";

import { rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { demoImages } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { jsonError, PublicApiError, publicErrorResponse } from "@/lib/http";
import { committedIndexGeneration, isCommittedGenerationMetadata } from "@/lib/reindex-pipeline";
import { parseRouteParams } from "@/lib/validation/params";
import { enforceDocumentReadRateLimit, withOwnerReadScope } from "@/lib/public-api-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

const coverRouteParamsSchema = z.object({ id: z.string().uuid() });
const coverImageIdSchema = z.string().uuid();
const maxLegacyCoverCandidates = 64;

/**
 * The document's first-page cover thumbnail id, for surfaces that show what a
 * cited document looks like rather than what it says.
 *
 * It exists as its own route because the only alternatives were worse. The
 * cover id rides `RelatedDocument` on the search payload, but the answer
 * surface never calls `/api/search`; adding it to the answer's own source rows
 * would mean editing retrieval hydration, which is a protected RAG surface and
 * a far larger blast radius than a thumbnail earns. `/api/documents/[id]`
 * already carries the id but returns pages, chunks and images with it — a
 * kilobyte-scale payload to render one 90px picture.
 *
 * Authorization is the same shape the rest of the document API uses: the read
 * rate limit first, then an owner-scoped existence check on `documents` BEFORE
 * `document_images` is touched, so an unauthorized caller cannot learn whether
 * a document id is real from the difference between two responses. The id it
 * returns is not itself a capability — `/api/images/[id]/signed-url` re-checks
 * ownership and committed-generation before it signs anything.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;

    if (isDemoMode()) {
      const cover = demoImages.find((image) => image.document_id === rawId && image.source_kind === "cover_page");
      return NextResponse.json({ coverImageId: cover?.id ?? null, demoMode: true });
    }

    const { id } = parseRouteParams({ id: rawId }, coverRouteParamsSchema, "Invalid document id.");
    const supabase = createAdminClient();
    const { access, rateLimit } = await enforceDocumentReadRateLimit(request, supabase);
    if (rateLimit.limited) {
      return rateLimitJsonResponse("Document requests are rate limited. Try again shortly.", rateLimit);
    }
    request.signal.throwIfAborted();

    const { data: document, error: documentError } = await withOwnerReadScope(
      supabase.from("documents").select("id,metadata").eq("id", id),
      access.ownerId,
    )
      .abortSignal(request.signal)
      .maybeSingle();
    if (documentError) throw new Error(documentError.message);
    if (!document) return publicErrorResponse("Document not found.", 404, { code: "document_not_found" });

    /*
     * `documents.metadata.cover_image_id` is the SELECTED cover: the worker
     * writes it in the same committed-core metadata patch as
     * `index_generation_id` (worker/main.ts), so it names the cover belonging to
     * the generation the document currently serves.
     *
     * Prefer it over scanning `document_images` for a `cover_page` row. That
     * scan takes whichever row comes back first, with no ordering and no
     * generation filter, so a document mid-reindex or mid-cover-repair can hand
     * back a staged row — which `/api/images/[id]/signed-url` then refuses as
     * uncommitted, silently losing the thumbnail — or an obsolete duplicate,
     * which shows the wrong front page beside a citation.
     */
    const metadata =
      document.metadata && typeof document.metadata === "object" && !Array.isArray(document.metadata)
        ? (document.metadata as Record<string, unknown>)
        : null;
    if (metadata && Object.hasOwn(metadata, "cover_image_id")) {
      const parsedPointer = coverImageIdSchema.safeParse(metadata.cover_image_id);
      if (!parsedPointer.success) return NextResponse.json({ coverImageId: null });

      const { data: cover, error: coverError } = await supabase
        .from("document_images")
        .select("id,metadata")
        .eq("id", parsedPointer.data)
        .eq("document_id", id)
        .eq("source_kind", "cover_page")
        .abortSignal(request.signal)
        .maybeSingle();
      if (coverError) throw new Error(coverError.message);
      if (
        !cover ||
        !isCommittedGenerationMetadata({
          rowMetadata: cover.metadata,
          committedGeneration: committedIndexGeneration(metadata),
        })
      ) {
        return NextResponse.json({ coverImageId: null });
      }

      return NextResponse.json({ coverImageId: cover.id });
    }

    // Documents indexed before the selected pointer existed carry no such key.
    // Resolve their cover locally so the route never hands a staged/stale row
    // to the signed-url route. The database predicates enforce document + kind;
    // the defensive checks below preserve that invariant even if query data is
    // malformed. A bounded ambiguous legacy result fails closed.
    const committedGeneration = committedIndexGeneration(metadata);
    const { data: candidates, error: candidatesError } = await supabase
      .from("document_images")
      .select("id,document_id,source_kind,metadata")
      .eq("document_id", id)
      .eq("source_kind", "cover_page")
      .abortSignal(request.signal)
      .limit(maxLegacyCoverCandidates + 1);
    if (candidatesError) throw new Error(candidatesError.message);

    const boundedCandidates = candidates ?? [];
    if (boundedCandidates.length > maxLegacyCoverCandidates) {
      return NextResponse.json({ coverImageId: null });
    }
    const committedCandidates = boundedCandidates.filter((candidate) => {
      if (candidate.document_id !== id || candidate.source_kind !== "cover_page") return false;
      if (!coverImageIdSchema.safeParse(candidate.id).success) return false;
      const candidateGeneration = committedIndexGeneration(candidate.metadata);
      return committedGeneration ? candidateGeneration === committedGeneration : candidateGeneration === null;
    });
    return NextResponse.json({ coverImageId: committedCandidates.length === 1 ? committedCandidates[0].id : null });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    if (error instanceof PublicApiError) return jsonError(error);
    return jsonError(error);
  }
}
