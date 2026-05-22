import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../src/lib/env";
import { buildChunks } from "../src/lib/chunking";
import { extractDocument, fileToBase64 } from "../src/lib/extractors/document";
import { captionImageFromBase64, embedTexts } from "../src/lib/openai";
import { safeErrorLogDetails, safeIngestionJobLog } from "../src/lib/privacy";
import { createAdminClient } from "../src/lib/supabase/admin";
import type { ExtractedDocument } from "../src/lib/types";

type JobRow = {
  id: string;
  document_id: string;
  documents: {
    id: string;
    owner_id: string | null;
    title: string;
    file_name: string;
    file_type: string;
    storage_path: string;
    metadata: Record<string, unknown> | null;
  };
};

const supabase = createAdminClient();

async function updateJob(jobId: string, patch: Record<string, unknown>) {
  await supabase.from("ingestion_jobs").update(patch).eq("id", jobId);
}

async function updateDocument(documentId: string, patch: Record<string, unknown>) {
  await supabase.from("documents").update(patch).eq("id", documentId);
}

async function nextJob() {
  const { data, error } = await supabase
    .from("ingestion_jobs")
    .select("id,document_id,documents(id,owner_id,title,file_name,file_type,storage_path,metadata)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as JobRow | null;
}

async function downloadDocument(storagePath: string) {
  const { data, error } = await supabase.storage.from(env.SUPABASE_DOCUMENT_BUCKET).download(storagePath);

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Storage download returned no data.");
  return Buffer.from(await data.arrayBuffer());
}

async function insertPages(documentId: string, extracted: ExtractedDocument) {
  const pages = extracted.pages.map((page) => ({
    document_id: documentId,
    page_number: page.pageNumber,
    text: page.text,
    ocr_used: Boolean(page.ocrUsed),
    metadata: {},
  }));

  if (pages.length === 0) return;
  const { error } = await supabase.from("document_pages").insert(pages);
  if (error) throw new Error(error.message);
}

async function uploadAndCaptionImages(job: JobRow, extracted: ExtractedDocument, pagesByNumber: Map<number, string>) {
  const insertedImages: Array<{
    id: string;
    caption: string;
    pageNumber: number | null;
  }> = [];

  for (const [index, image] of extracted.images.entries()) {
    await updateJob(job.id, {
      stage: `captioning image ${index + 1}/${extracted.images.length}`,
      progress: Math.min(70, 35 + Math.round((index / Math.max(extracted.images.length, 1)) * 25)),
    });

    const ext = path.extname(image.path) || ".png";
    const imagePrefix = job.documents.owner_id
      ? `${job.documents.owner_id}/images/${job.document_id}`
      : `local/${job.document_id}`;
    const imagePath = `${imagePrefix}/image-${index + 1}${ext}`;
    const bytes = await readFile(image.path);
    const upload = await supabase.storage
      .from(env.SUPABASE_IMAGE_BUCKET)
      .upload(imagePath, bytes, { contentType: image.mimeType, upsert: true });

    if (upload.error) throw new Error(upload.error.message);

    const nearbyText = image.pageNumber ? pagesByNumber.get(image.pageNumber) : undefined;
    const caption = await captionImageFromBase64({
      base64: await fileToBase64(image.path),
      mimeType: image.mimeType,
      nearbyText,
    });

    const { data, error } = await supabase
      .from("document_images")
      .insert({
        document_id: job.document_id,
        page_number: image.pageNumber,
        storage_path: imagePath,
        mime_type: image.mimeType,
        caption,
        bbox: image.bbox ?? null,
        metadata: { extractor: "local-worker" },
      })
      .select("id,caption,page_number")
      .single();

    if (error) throw new Error(error.message);
    insertedImages.push({
      id: data.id,
      caption: data.caption,
      pageNumber: data.page_number,
    });
  }

  return insertedImages;
}

async function insertEmbeddedChunks(job: JobRow, extracted: ExtractedDocument) {
  const pagesByNumber = new Map(extracted.pages.map((page) => [page.pageNumber, page.text] as const));
  const insertedImages = await uploadAndCaptionImages(job, extracted, pagesByNumber);

  await updateJob(job.id, { stage: "chunking", progress: 72 });
  const chunks = buildChunks(
    extracted.pages.map((page) => ({
      documentId: job.document_id,
      pageNumber: page.pageNumber,
      pageText: page.text,
      images: insertedImages.filter((image) => image.pageNumber === null || image.pageNumber === page.pageNumber),
    })),
  );

  for (let start = 0; start < chunks.length; start += env.WORKER_BATCH_SIZE) {
    const batch = chunks.slice(start, start + env.WORKER_BATCH_SIZE);
    await updateJob(job.id, {
      stage: `embedding chunks ${start + 1}-${start + batch.length}/${chunks.length}`,
      progress: Math.min(94, 75 + Math.round((start / Math.max(chunks.length, 1)) * 18)),
    });

    const embeddings = await embedTexts(batch.map((chunk) => chunk.content));
    const rows = batch.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index],
    }));

    const { error } = await supabase.from("document_chunks").insert(rows);
    if (error) throw new Error(error.message);
  }

  return { chunks, imageCount: insertedImages.length };
}

async function processJob(job: JobRow) {
  await updateJob(job.id, {
    status: "processing",
    stage: "downloading",
    progress: 5,
    started_at: new Date().toISOString(),
  });
  await updateDocument(job.document_id, { status: "processing", error_message: null });

  try {
    const buffer = await downloadDocument(job.documents.storage_path);
    await updateJob(job.id, { stage: "extracting text/images", progress: 20 });
    const extracted = await extractDocument({
      buffer,
      fileName: job.documents.file_name,
      mimeType: job.documents.file_type,
    });

    await updateJob(job.id, { stage: "saving pages", progress: 32 });
    await insertPages(job.document_id, extracted);
    const { chunks, imageCount } = await insertEmbeddedChunks(job, extracted);

    await updateDocument(job.document_id, {
      status: "indexed",
      page_count: extracted.pages.length,
      chunk_count: chunks.length,
      image_count: imageCount,
      error_message: null,
      metadata: {
        ...(job.documents.metadata ?? {}),
        indexed_at: new Date().toISOString(),
        extraction_quality: extracted.pages.length > 0 ? "good" : "partial",
      },
    });
    await updateJob(job.id, {
      status: "completed",
      stage: "indexed",
      progress: 100,
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateDocument(job.document_id, { status: "failed", error_message: message });
    await updateJob(job.id, {
      status: "failed",
      stage: "failed",
      progress: 100,
      error_message: message,
      completed_at: new Date().toISOString(),
    });
  }
}

async function main() {
  console.log("Clinical KB worker started.");
  while (true) {
    const job = await nextJob();
    if (job) {
      console.log(safeIngestionJobLog(job.id));
      await processJob(job);
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, env.WORKER_POLL_MS));
  }
}

main().catch((error) => {
  console.error("Clinical KB worker stopped unexpectedly", safeErrorLogDetails(error));
  process.exit(1);
});
