import { NextResponse } from "next/server";
import { getDemoDocument } from "@/lib/demo-data";
import { env } from "@/lib/env";
import { isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (isDemoMode()) {
      const document = getDemoDocument(id);
      if (!document) return NextResponse.json({ error: "Demo document not found." }, { status: 404 });
      return NextResponse.json({
        url: document.storage_path,
        fileType: document.file_type,
        demoMode: true,
      });
    }

    const supabase = createAdminClient();
    const { data: document, error } = await supabase
      .from("documents")
      .select("storage_path,file_type")
      .eq("id", id)
      .single();

    if (error) throw new Error(error.message);

    const signed = await supabase.storage
      .from(env.SUPABASE_DOCUMENT_BUCKET)
      .createSignedUrl(document.storage_path, 60 * 10);

    if (signed.error) throw new Error(signed.error.message);
    return NextResponse.json({ url: signed.data.signedUrl, fileType: document.file_type });
  } catch (error) {
    return jsonError(error);
  }
}
