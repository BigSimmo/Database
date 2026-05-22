import { NextResponse } from "next/server";
import { getDemoDocumentPayload } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (isDemoMode()) {
      const chunkId = new URL(request.url).searchParams.get("chunk");
      const payload = getDemoDocumentPayload(id, chunkId);
      if (!payload) {
        return NextResponse.json({ error: "Demo document not found." }, { status: 404 });
      }
      return NextResponse.json({ ...payload, demoMode: true });
    }

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const { data: document, error } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    const { data: pages, error: pagesError } = await supabase
      .from("document_pages")
      .select("id,page_number,text,ocr_used,metadata")
      .eq("document_id", id)
      .order("page_number", { ascending: true })
      .limit(80);

    if (pagesError) throw new Error(pagesError.message);

    const { data: images, error: imagesError } = await supabase
      .from("document_images")
      .select("id,page_number,storage_path,caption,bbox,mime_type")
      .eq("document_id", id)
      .order("page_number", { ascending: true });

    if (imagesError) throw new Error(imagesError.message);

    const chunkId = new URL(request.url).searchParams.get("chunk");
    const chunkQuery = supabase
      .from("document_chunks")
      .select("id,page_number,chunk_index,section_heading,content,image_ids")
      .eq("document_id", id)
      .order("chunk_index", { ascending: true });

    const { data: chunks, error: chunksError } = chunkId
      ? await chunkQuery.eq("id", chunkId).limit(1)
      : await chunkQuery.limit(30);

    if (chunksError) throw new Error(chunksError.message);

    return NextResponse.json({
      document,
      pages: pages ?? [],
      images: images ?? [],
      chunks: chunks ?? [],
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
