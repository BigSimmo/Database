import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { env } from "../src/lib/env";
import { buildChunks } from "../src/lib/chunking";
import { extractDocument, fileToBase64 } from "../src/lib/extractors/document";
import { isRetryableIngestionError, nextRetryAt, terminalBatchStatus } from "../src/lib/ingestion";
import { captionImageFromBase64, embedTexts } from "../src/lib/openai";
import { safeErrorLogDetails, safeIngestionJobLog } from "../src/lib/privacy";
import { createAdminClient } from "../src/lib/supabase/admin";
import type { ExtractedDocument } from "../src/lib/types";
import { checkPythonPdfPrerequisites } from "./prerequisites";

type JobDocument = {
  id: string;
  owner_id: string | null;
  title: string;
  file_name: string;
  file_type: string;
  storage_path: string;
  content_hash?: string | null;
  source_path?: string | null;
  import_batch_id?: string | null;
  metadata: Record<string, unknown> | null;
};

type JobRow = {
  id: string;
  document_id: string;
  batch_id: string | null;
  attempt_count: number;
  max_attempts: number;
  documents: JobDocument;
};

const supabase = createAdminClient();
const workerId = `${os.hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;

async function updateJob(jobId: string, patch: Record<string, unknown>) {
  await supabase.from("ingestion_jobs").update(patch).eq("id", jobId);
}

async function updateDocument(documentId: string, patch: Record<string, unknown>) {
  await supabase.from("documents").update(patch).eq("id", documentId);
}

async function updateBatch(batchId: string | null) {
  if (!batchId) return;

  const { data, error } = await supabase.from("ingestion_jobs").select("status").eq("batch_id", batchId);
  if (error || !data) return;

  const queued = data.filter((job) => job.status === "pending").length;
  const processing = data.filter((job) => job.status === "processing").length;
  const failed = data.filter((job) => job.status === "failed").length;
  const status = terminalBatchStatus({ queued, processing, failed });

  await supabase
    .from("import_batches")
    .update({
      status,
      failed_files: failed,
      completed_at: status === "processing" ? null : new Date().toISOString(),
    })
    .eq("id", batchId);
}

async function claimJobs() {
  const { data, error } = await supabase.rpc("claim_ingestion_jobs", {
    p_worker_id: workerId,
    p_claim_limit: env.WORKER_CONCURRENCY,
    p_stale_after_minutes: env.WORKER_STALE_AFTER_MINUTES,
  });

  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Omit<JobRow, "documents"> & { documents: JobDocument }>).map((job) => ({
    ...job,
    documents: job.documents,
  })) as JobRow[];
}

async function downloadDocument(storagePath: string) {
  const { data, error } = await supabase.storage.from(env.SUPABASE_DOCUMENT_BUCKET).download(storagePath);

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Storage download returned no data.");
  return Buffer.from(await data.arrayBuffer());
}

async function resetDocumentIndex(documentId: string) {
  const { error } = await supabase.rpc("reset_document_index", { p_document_id: documentId });
  if (error) throw new Error(error.message);
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

function hashBytes(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function shouldSkipImage(bytes: Buffer, imageHash: string, seenHashes: Set<string>) {
  if (bytes.length < 4096) return "small decorative image";
  if (seenHashes.has(imageHash)) return "duplicate image";
  return null;
}

async function uploadAndCaptionImages(job: JobRow, extracted: ExtractedDocument, pagesByNumber: Map<number, string>) {
  const insertedImages: Array<{
    id: string;
    caption: string;
    pageNumber: number | null;
  }> = [];
  const seenHashes = new Set<string>();
  let skippedImages = 0;

  for (const [index, image] of extracted.images.entries()) {
    await updateJob(job.id, {
      stage: `captioning image ${index + 1}/${extracted.images.length}`,
      progress: Math.min(70, 35 + Math.round((index / Math.max(extracted.images.length, 1)) * 25)),
    });

    const bytes = await readFile(image.path);
    const imageHash = hashBytes(bytes);
    const skipReason = shouldSkipImage(bytes, imageHash, seenHashes);
    if (skipReason) {
      skippedImages += 1;
      continue;
    }
    seenHashes.add(imageHash);

    const ext = path.extname(image.path) || ".png";
    const imagePrefix = job.documents.owner_id
      ? `${job.documents.owner_id}/images/${job.document_id}`
      : `local/${job.document_id}`;
    const imagePath = `${imagePrefix}/image-${index + 1}${ext}`;
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
        metadata: { extractor: "local-worker", image_hash: imageHash },
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

  return { insertedImages, skippedImages };
}

async function insertEmbeddedChunks(job: JobRow, extracted: ExtractedDocument) {
  const pagesByNumber = new Map(extracted.pages.map((page) => [page.pageNumber, page.text] as const));
  const { insertedImages, skippedImages } = await uploadAndCaptionImages(job, extracted, pagesByNumber);

  await updateJob(job.id, { stage: "chunking", progress: 72 });
  const chunkMetadata = {
    source_path: job.documents.source_path ?? null,
    content_hash: job.documents.content_hash ?? null,
    embedding_model: env.OPENAI_EMBEDDING_MODEL,
    extractor: "local-worker",
  };
  const chunks = buildChunks(
    extracted.pages.map((page) => ({
      documentId: job.document_id,
      pageNumber: page.pageNumber,
      pageText: page.text,
      images: insertedImages.filter((image) => image.pageNumber === null || image.pageNumber === page.pageNumber),
      metadata: {
        ...chunkMetadata,
        ocr_used: Boolean(page.ocrUsed),
      },
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

  return { chunks, imageCount: insertedImages.length, skippedImages };
}

function extractionMetrics(extracted: ExtractedDocument, skippedImages: number) {
  const textCharacterCount = extracted.pages.reduce((sum, page) => sum + page.text.length, 0);
  const ocrPageCount = extracted.pages.filter((page) => page.ocrUsed).length;
  const warnings = [...(extracted.warnings ?? [])];
  if (textCharacterCount < 80) warnings.push("Low extracted text volume; inspect OCR quality.");

  return {
    page_count: extracted.pages.length,
    ocr_page_count: ocrPageCount,
    text_character_count: textCharacterCount,
    extracted_image_count: extracted.images.length,
    skipped_image_count: skippedImages,
    extraction_warnings: warnings,
  };
}

async function processJob(job: JobRow) {
  await updateJob(job.id, {
    status: "processing",
    stage: "downloading",
    progress: 5,
    locked_at: new Date().toISOString(),
    locked_by: workerId,
    started_at: new Date().toISOString(),
  });
  await updateDocument(job.document_id, { status: "processing", error_message: null });
  await updateBatch(job.batch_id);

  try {
    await resetDocumentIndex(job.document_id);
    const buffer = await downloadDocument(job.documents.storage_path);
    await updateJob(job.id, { stage: "extracting text/images", progress: 20 });
    const extracted = await extractDocument({
      buffer,
      fileName: job.documents.file_name,
      mimeType: job.documents.file_type,
    });

    await updateJob(job.id, { stage: "saving pages", progress: 32 });
    await insertPages(job.document_id, extracted);
    const { chunks, imageCount, skippedImages } = await insertEmbeddedChunks(job, extracted);
    const metrics = extractionMetrics(extracted, skippedImages);

    await updateDocument(job.document_id, {
      status: "indexed",
      page_count: extracted.pages.length,
      chunk_count: chunks.length,
      image_count: imageCount,
      error_message: null,
      metadata: {
        ...(job.documents.metadata ?? {}),
        indexed_at: new Date().toISOString(),
        extraction_quality: extracted.pages.length > 0 && metrics.text_character_count >= 80 ? "good" : "partial",
        embedding_model: env.OPENAI_EMBEDDING_MODEL,
        ...metrics,
      },
    });
    await updateJob(job.id, {
      status: "completed",
      stage: "indexed",
      progress: 100,
      locked_at: null,
      locked_by: null,
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const shouldRetry = isRetryableIngestionError(error) && job.attempt_count < job.max_attempts;

    if (shouldRetry) {
      await updateDocument(job.document_id, { status: "queued", error_message: message });
      await updateJob(job.id, {
        status: "pending",
        stage: `retry scheduled after attempt ${job.attempt_count}/${job.max_attempts}`,
        progress: 0,
        error_message: message,
        locked_at: null,
        locked_by: null,
        next_run_at: nextRetryAt(job.attempt_count),
      });
    } else {
      await updateDocument(job.document_id, { status: "failed", error_message: message });
      await updateJob(job.id, {
        status: "failed",
        stage: "failed",
        progress: 100,
        error_message: message,
        locked_at: null,
        locked_by: null,
        completed_at: new Date().toISOString(),
      });
    }
  } finally {
    await updateBatch(job.batch_id);
  }
}

async function main() {
  const once = process.argv.includes("--once");
  const prereqs = await checkPythonPdfPrerequisites();
  console.log(`Clinical KB worker started. worker=${workerId}`);
  if (!prereqs.ok) {
    console.warn(`PDF/OCR prerequisite warning: ${prereqs.detail}`);
  }

  while (true) {
    const jobs = await claimJobs();
    if (jobs.length > 0) {
      await Promise.all(
        jobs.map(async (job) => {
          console.log(safeIngestionJobLog(job.id));
          await processJob(job);
        }),
      );
      if (once) break;
      continue;
    }

    if (once) break;
    await new Promise((resolve) => setTimeout(resolve, env.WORKER_POLL_MS));
  }
}

main().catch((error) => {
  console.error("Clinical KB worker stopped unexpectedly", safeErrorLogDetails(error));
  process.exit(1);
});
