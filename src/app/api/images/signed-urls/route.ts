import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { getDemoImage } from "@/lib/demo-data";
import { env, isDemoMode } from "@/lib/env";
import { jsonError, PublicApiError } from "@/lib/http";
import { committedIndexGeneration, isCommittedGenerationMetadata } from "@/lib/reindex-pipeline";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import { enforceDocumentReadRateLimit, withOwnerReadScope } from "@/lib/public-api-access";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";

// Batch variant of /api/images/[id]/signed-url: a document view with N inline
// images previously issued N API calls of 3 DB round trips each. This route
// resolves up to 50 images with one rate-limit consume, one document_images
// read, one owner-scoped documents read, and one batch storage signing call.
//
// Authorization is fail-closed PER ITEM: every requested id starts as null and
// only becomes a URL when its image row exists, its parent document passes
// withOwnerReadScope for this caller, and its generation metadata matches the
// document's committed index generation — identical checks to the single route.
// Unknown, unauthorized, and uncommitted ids are indistinguishable (all null).

const signedUrlTtlSeconds = 60 * 10;

const batchSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});

type SignedUrlItem = {
  url: string;
  mimeType: string | null;
  caption: string | null;
  expiresAt: string;
};

export async function POST(request: Request) {
  try {
    const { ids } = await parseJsonBody(request, batchSchema, "Invalid image batch request.");
    const uniqueIds = [...new Set(ids)];
    const expiresAt = new Date(Date.now() + signedUrlTtlSeconds * 1000).toISOString();
    const items: Record<string, SignedUrlItem | null> = {};
    for (const id of uniqueIds) items[id] = null;

    if (isDemoMode()) {
      for (const id of uniqueIds) {
        const image = getDemoImage(id);
        if (image) {
          items[id] = {
            url: image.signed_url ?? image.storage_path,
            mimeType: image.mime_type ?? null,
            caption: image.caption ?? null,
            expiresAt,
          };
        }
      }
      return NextResponse.json({ items, demoMode: true });
    }

    const supabase = createAdminClient();
    const { access, rateLimit } = await enforceDocumentReadRateLimit(request, supabase);
    if (rateLimit.limited) {
      return rateLimitJsonResponse("Document requests are rate limited. Try again shortly.", rateLimit);
    }

    const { data: images, error } = await supabase
      .from("document_images")
      .select("id,document_id,storage_path,mime_type,caption,metadata")
      .in("id", uniqueIds);
    if (error) throw new Error(error.message);
    if (!images?.length) return NextResponse.json({ items });

    const documentIds = [...new Set(images.map((image) => image.document_id))];
    const { data: documents, error: documentError } = await withOwnerReadScope(
      supabase.from("documents").select("id,metadata").in("id", documentIds),
      access.ownerId,
    );
    if (documentError) throw new Error(documentError.message);
    const documentById = new Map((documents ?? []).map((document) => [document.id, document]));

    const authorized = images.filter((image) => {
      const document = documentById.get(image.document_id);
      if (!document) return false;
      return isCommittedGenerationMetadata({
        rowMetadata: image.metadata,
        committedGeneration: committedIndexGeneration(document.metadata),
      });
    });
    if (!authorized.length) return NextResponse.json({ items });

    const paths = [...new Set(authorized.map((image) => image.storage_path))];
    const signed = await supabase.storage.from(env.SUPABASE_IMAGE_BUCKET).createSignedUrls(paths, signedUrlTtlSeconds);
    if (signed.error) throw new Error(signed.error.message);
    const urlByPath = new Map(
      (signed.data ?? []).filter((row) => row.signedUrl && !row.error).map((row) => [row.path ?? "", row.signedUrl]),
    );

    for (const image of authorized) {
      const url = urlByPath.get(image.storage_path);
      if (url) {
        items[image.id] = {
          url,
          mimeType: image.mime_type ?? null,
          caption: image.caption ?? null,
          expiresAt,
        };
      }
    }
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    if (error instanceof z.ZodError) {
      return jsonError(error, 400);
    }
    if (error instanceof PublicApiError) {
      return jsonError(error, error.status);
    }
    return jsonError(error);
  }
}
