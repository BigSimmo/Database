import { NextResponse } from "next/server";
import { z } from "zod";
import { getDemoImage } from "@/lib/demo-data";
import { env } from "@/lib/env";
import { isDemoMode } from "@/lib/env";
import { jsonError, PublicApiError } from "@/lib/http";
import { committedIndexGeneration, isCommittedGenerationMetadata } from "@/lib/reindex-pipeline";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import { publicAccessContext, withOwnerReadScope } from "@/lib/public-api-access";

export const runtime = "nodejs";

const signedUrlTtlSeconds = 60 * 10;
const routeIdSchema = z.string().uuid();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (isDemoMode()) {
      const image = getDemoImage(id);
      if (!image) return NextResponse.json({ error: "Demo image not found." }, { status: 404 });
      return NextResponse.json({
        url: image.signed_url ?? image.storage_path,
        mimeType: image.mime_type,
        caption: image.caption,
        expiresAt: new Date(Date.now() + signedUrlTtlSeconds * 1000).toISOString(),
        demoMode: true,
      });
    }

    if (!routeIdSchema.safeParse(id).success) throw new PublicApiError("Invalid image id.");

    const supabase = createAdminClient();
    const access = await publicAccessContext(_request, supabase);
    const { data: image, error } = await supabase
      .from("document_images")
      .select("document_id,storage_path,mime_type,caption,metadata")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!image) return NextResponse.json({ error: "Image not found." }, { status: 404 });

    const { data: document, error: documentError } = await withOwnerReadScope(
      supabase.from("documents").select("id,metadata").eq("id", image.document_id),
      access.ownerId,
    ).maybeSingle();

    if (documentError) throw new Error(documentError.message);
    if (!document) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    if (
      !isCommittedGenerationMetadata({
        rowMetadata: imageRef.metadata,
        committedGeneration: committedIndexGeneration(document.metadata),
      })
    ) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }

    const { data: image, error: imageError } = await supabase
      .from("document_images")
      .select("storage_path,mime_type,caption")
      .eq("id", id)
      .maybeSingle();

    if (imageError) throw new Error(imageError.message);
    if (!image) return NextResponse.json({ error: "Image not found." }, { status: 404 });

    const signed = await supabase.storage
      .from(env.SUPABASE_IMAGE_BUCKET)
      .createSignedUrl(image.storage_path, signedUrlTtlSeconds);

    if (signed.error) throw new Error(signed.error.message);
    return NextResponse.json({
      url: signed.data.signedUrl,
      mimeType: image.mime_type,
      caption: image.caption,
      expiresAt: new Date(Date.now() + signedUrlTtlSeconds * 1000).toISOString(),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
