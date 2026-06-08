import { NextResponse } from "next/server";
import { getDemoDocument } from "@/lib/demo-data";
import { env } from "@/lib/env";
import { isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

const signedUrlTtlSeconds = 60 * 10;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    const signed = await supabase.storage
      .from(env.SUPABASE_DOCUMENT_BUCKET)
      .createSignedUrl(document.storage_path, signedUrlTtlSeconds);

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
