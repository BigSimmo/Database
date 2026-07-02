import { NextResponse } from "next/server";
import { z } from "zod";
import { getDemoDocument } from "@/lib/demo-data";
import { env } from "@/lib/env";
import { isDemoMode } from "@/lib/env";
import { jsonError, PublicApiError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

const signedUrlTtlSeconds = 60 * 10;
const routeIdSchema = z.string().uuid();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const requestUrl = new URL(_request.url);
    const shouldDownload = ["1", "true"].includes((requestUrl.searchParams.get("download") ?? "").toLowerCase());
    if (isDemoMode()) {
      const document = getDemoDocument(id);
      if (!document) return NextResponse.json({ error: "Demo document not found." }, { status: 404 });
      return NextResponse.json({
        url: document.storage_path,
        fileType: document.file_type,
        expiresAt: new Date(Date.now() + signedUrlTtlSeconds * 1000).toISOString(),
        demoMode: true,
      });
    }

    if (!routeIdSchema.safeParse(id).success) throw new PublicApiError("Invalid document id.");

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(_request, supabase);
    const { data: document, error } = await supabase
      .from("documents")
      .select("storage_path,file_type")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    const storage = supabase.storage.from(env.SUPABASE_DOCUMENT_BUCKET);
    const signed = shouldDownload
      ? await storage.createSignedUrl(document.storage_path, signedUrlTtlSeconds, { download: true })
      : await storage.createSignedUrl(document.storage_path, signedUrlTtlSeconds);

    if (signed.error) throw new Error(signed.error.message);
    return NextResponse.json({
      url: signed.data.signedUrl,
      fileType: document.file_type,
      expiresAt: new Date(Date.now() + signedUrlTtlSeconds * 1000).toISOString(),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
