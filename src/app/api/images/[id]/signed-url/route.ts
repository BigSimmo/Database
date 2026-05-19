import { NextResponse } from "next/server";
import { getDemoImage } from "@/lib/demo-data";
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
      const image = getDemoImage(id);
      if (!image) return NextResponse.json({ error: "Demo image not found." }, { status: 404 });
      return NextResponse.json({
        url: image.signed_url ?? image.storage_path,
        mimeType: image.mime_type,
        caption: image.caption,
        demoMode: true,
      });
    }

    const supabase = createAdminClient();
    const { data: image, error } = await supabase
      .from("document_images")
      .select("storage_path,mime_type,caption")
      .eq("id", id)
      .single();

    if (error) throw new Error(error.message);

    const signed = await supabase.storage
      .from(env.SUPABASE_IMAGE_BUCKET)
      .createSignedUrl(image.storage_path, 60 * 10);

    if (signed.error) throw new Error(signed.error.message);
    return NextResponse.json({
      url: signed.data.signedUrl,
      mimeType: image.mime_type,
      caption: image.caption,
    });
  } catch (error) {
    return jsonError(error);
  }
}
