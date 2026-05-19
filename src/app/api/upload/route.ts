import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { assertAllowedFile, jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field." }, { status: 400 });
    }

    assertAllowedFile(file, env.MAX_UPLOAD_MB);

    const supabase = createAdminClient();
    const documentId = randomUUID();
    const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
    const ownerFolder = "local";
    const storagePath = `${ownerFolder}/${documentId}/${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const upload = await supabase.storage
      .from(env.SUPABASE_DOCUMENT_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (upload.error) throw new Error(upload.error.message);

    const title = String(formData.get("title") || file.name.replace(/\.[^.]+$/, ""));
    const description = formData.get("description")
      ? String(formData.get("description"))
      : null;

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .insert({
        id: documentId,
        title,
        description,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        status: "queued",
        metadata: {
          max_upload_mb: env.MAX_UPLOAD_MB,
          confidentiality_scope: "guidelines-only",
        },
      })
      .select()
      .single();

    if (documentError) throw new Error(documentError.message);

    const { data: job, error: jobError } = await supabase
      .from("ingestion_jobs")
      .insert({
        document_id: documentId,
        status: "pending",
        stage: "queued",
        progress: 0,
      })
      .select()
      .single();

    if (jobError) throw new Error(jobError.message);

    return NextResponse.json({ document, job }, { status: 201 });
  } catch (error) {
    return jsonError(error, 400);
  }
}
