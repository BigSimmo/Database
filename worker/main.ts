import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { env } from "../src/lib/env";
import { buildChunks } from "../src/lib/chunking";
import { ragEnrichmentVersion, upsertDocumentEnrichment } from "../src/lib/document-enrichment";
import { ragDeepMemoryVersion, upsertDocumentDeepMemory } from "../src/lib/deep-memory";
import { extractDocument, fileToBase64 } from "../src/lib/extractors/document";
import {
  assessClinicalImageUse,
  cheapImageSkipReason,
  classifiedImageSkipReason,
  clinicalImagePolicyVersion,
  lowSignalImageTextSkipReason,
  lightweightPerceptualHash,
} from "../src/lib/image-filtering";
import {
  isPartialIndexWriteConflict,
  isRetryableIngestionError,
  nextRetryAt,
  terminalBatchStatus,
} from "../src/lib/ingestion";
import { assessDocumentIndexQuality } from "../src/lib/index-quality";
import { classifyAndCaptionImageFromBase64, embedTexts } from "../src/lib/openai";
import { safeErrorLogDetails, safeIngestionJobLog } from "../src/lib/privacy";
import { createAdminClient } from "../src/lib/supabase/admin";
import { probeSupabaseHealth } from "../src/lib/supabase/health";
import type { ExtractedDocument, ImageEvidenceCategory } from "../src/lib/types";
import { buildAdditionalEmbeddingFieldInputs } from "./embedding-fields";
import { checkPythonPdfPrerequisites } from "./prerequisites";
import { buildTableFactRows } from "./table-facts";

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
const progressUpdateState = new Map<string, { updatedAt: number; progress: number; stage: string }>();
const progressUpdateMinIntervalMs = env.WORKER_PROGRESS_UPDATE_MIN_INTERVAL_MS;
const progressUpdateMinDelta = 4;
const maxSupabaseBackoffMs = env.WORKER_HEALTH_BACKOFF_MS;

function supabaseStageError(stage: string, error: { message?: string; code?: string; details?: string; hint?: string }) {
  const wrapped = new Error(`${stage}: ${error.message ?? "Supabase request failed"}`);
  Object.assign(wrapped, {
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
  return wrapped;
}

async function updateJob(jobId: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from("ingestion_jobs").update(patch).eq("id", jobId);
  if (error) throw supabaseStageError("update ingestion job", error);
  if (typeof patch.progress === "number" || typeof patch.stage === "string") {
    progressUpdateState.set(jobId, {
      updatedAt: Date.now(),
      progress: typeof patch.progress === "number" ? patch.progress : (progressUpdateState.get(jobId)?.progress ?? 0),
      stage: typeof patch.stage === "string" ? patch.stage : (progressUpdateState.get(jobId)?.stage ?? ""),
    });
  }
}

async function updateJobProgress(jobId: string, patch: { stage: string; progress: number }) {
  const previous = progressUpdateState.get(jobId);
  const now = Date.now();
  const enoughTimeElapsed = !previous || now - previous.updatedAt >= progressUpdateMinIntervalMs;
  const enoughProgressChanged = !previous || Math.abs(patch.progress - previous.progress) >= progressUpdateMinDelta;
  const stagePrefixChanged = !previous || patch.stage.split(" ")[0] !== previous.stage.split(" ")[0];

  if (!enoughTimeElapsed && !enoughProgressChanged && !stagePrefixChanged) return;

  const { error } = await supabase.from("ingestion_jobs").update(patch).eq("id", jobId);
  if (error) {
    console.warn("Ingestion progress update failed", safeErrorLogDetails(supabaseStageError("update ingestion progress", error)));
    return;
  }
  progressUpdateState.set(jobId, { updatedAt: now, progress: patch.progress, stage: patch.stage });
}

async function updateDocument(documentId: string, patch: Record<string, unknown>) {
  const sanitized = patch.metadata ? { ...patch, metadata: sanitizeJsonb(patch.metadata) } : patch;
  const { error } = await supabase.from("documents").update(sanitized).eq("id", documentId);
  if (error) throw supabaseStageError("update document", error);
}

async function markSupersededSiblingJobs(job: JobRow) {
  const { error } = await supabase
    .from("ingestion_jobs")
    .update({
      status: "completed",
      stage: "superseded by successful index",
      progress: 100,
      error_message: null,
      locked_at: null,
      locked_by: null,
      completed_at: new Date().toISOString(),
    })
    .eq("document_id", job.document_id)
    .neq("id", job.id)
    .in("status", ["pending", "processing", "failed"]);
  if (error) throw supabaseStageError("mark superseded ingestion jobs", error);
}

async function updateBatch(batchId: string | null) {
  if (!batchId) return;

  const { error: refreshError } = await supabase.rpc("refresh_import_batch_status", { p_batch_id: batchId });
  if (!refreshError) return;

  if (!isMissingSchemaError(refreshError)) {
    console.warn(
      "Import batch status refresh failed",
      safeErrorLogDetails(supabaseStageError("refresh import batch status", refreshError)),
    );
    return;
  }

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

async function completeJob(job: JobRow, stage: string) {
  const { error } = await supabase.rpc("complete_ingestion_job", {
    p_job_id: job.id,
    p_document_id: job.document_id,
    p_batch_id: job.batch_id,
    p_stage: stage,
  });
  if (!error) return;
  if (!isMissingSchemaError(error)) throw supabaseStageError("complete ingestion job", error);

  await updateJob(job.id, {
    status: "completed",
    stage,
    progress: 100,
    locked_at: null,
    locked_by: null,
    completed_at: new Date().toISOString(),
  });
  await markSupersededSiblingJobs(job);
  await updateBatch(job.batch_id);
}

async function failOrRetryJob(args: {
  job: JobRow;
  retry: boolean;
  documentStatus: "queued" | "failed";
  stage: string;
  errorMessage: string;
  nextRunAt?: string;
}) {
  const { error } = await supabase.rpc("fail_or_retry_ingestion_job", {
    p_job_id: args.job.id,
    p_document_id: args.job.document_id,
    p_batch_id: args.job.batch_id,
    p_retry: args.retry,
    p_document_status: args.documentStatus,
    p_stage: args.stage,
    p_error_message: args.errorMessage,
    p_next_run_at: args.nextRunAt ?? null,
  });
  if (!error) return;
  if (!isMissingSchemaError(error)) throw supabaseStageError("fail or retry ingestion job", error);

  await updateDocument(args.job.document_id, { status: args.documentStatus, error_message: args.errorMessage });
  await updateJob(args.job.id, {
    status: args.retry ? "pending" : "failed",
    stage: args.stage,
    progress: args.retry ? 0 : 100,
    error_message: args.errorMessage,
    locked_at: null,
    locked_by: null,
    ...(args.nextRunAt ? { next_run_at: args.nextRunAt } : {}),
    completed_at: args.retry ? null : new Date().toISOString(),
  });
  await updateBatch(args.job.batch_id);
}

function isMissingSchemaError(error: { message?: string; code?: string }) {
  return /could not find the function|schema cache|PGRST20\d/i.test(error.message ?? "") || error.code === "PGRST202";
}

function workerBackoffMs(failures: number) {
  return Math.min(maxSupabaseBackoffMs, env.WORKER_POLL_MS * 2 ** Math.max(0, failures - 1));
}

function optionalIndexWriteWarning(stage: string, error: unknown) {
  console.warn(`Optional ${stage} write failed`, safeErrorLogDetails(error));
}

function noteSkippedImage(skipReasons: Map<string, number>, reason: string) {
  skipReasons.set(reason, (skipReasons.get(reason) ?? 0) + 1);
}

async function claimJobs() {
  const { data, error } = await supabase.rpc("claim_ingestion_jobs", {
    p_worker_id: workerId,
    p_claim_limit: env.WORKER_CONCURRENCY,
    p_stale_after_minutes: env.WORKER_STALE_AFTER_MINUTES,
  });

  if (error) throw supabaseStageError("claim ingestion jobs", error);
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

function cleanString(val: string): string {
  if (typeof val !== "string") return val;
  return val.replace(/\u0000/g, "").replace(/\\u0000/g, "").toWellFormed();
}

function sanitizeJsonb(val: any): any {
  if (typeof val === "string") {
    return cleanString(val);
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeJsonb);
  }
  if (val !== null && typeof val === "object") {
    const res: Record<string, any> = {};
    for (const [key, value] of Object.entries(val)) {
      res[key] = sanitizeJsonb(value);
    }
    return res;
  }
  return val;
}

async function resetDocumentIndex(documentId: string) {
  const { error } = await supabase.rpc("reset_document_index", { p_document_id: documentId });
  if (error) throw supabaseStageError("reset_document_index", error);
}

async function insertPages(documentId: string, extracted: ExtractedDocument) {
  const pages = extracted.pages.map((page) => ({
    document_id: documentId,
    page_number: page.pageNumber,
    text: cleanString(page.text),
    ocr_used: Boolean(page.ocrUsed),
    metadata: {},
  }));

  if (pages.length === 0) return;
  const { error } = await supabase.from("document_pages").upsert(pages, {
    onConflict: "document_id,page_number",
  });
  if (error) throw supabaseStageError("upsert document_pages", error);
}

function hashBytes(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function hashText(text: string) {
  return createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex");
}

function compactSearchText(value: unknown, limit = 900) {
  const compact = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact) return "";
  return compact.length > limit ? compact.slice(0, limit).trim() : compact;
}

type ImageClassification = Awaited<ReturnType<typeof classifyAndCaptionImageFromBase64>>;

const imageEvidenceCategories = new Set<ImageEvidenceCategory>([
  "clinical_table",
  "flowchart_algorithm",
  "form_checklist",
  "risk_matrix",
  "medication_chart",
  "graph",
  "screenshot_ui",
  "photo",
  "logo_decorative",
  "unclear",
]);

function cachedImageMetadata(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function cachedImageLabels(labels: unknown) {
  if (!Array.isArray(labels)) return [];
  return labels
    .map((label) => String(label).trim())
    .filter(Boolean)
    .slice(0, 6);
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function compactMetadataText(value: string | null, limit = 1200) {
  if (!value) return null;
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return null;
  return compact.length > limit ? `${compact.slice(0, limit - 3).trim()}...` : compact;
}

function imageTableMetadata(image: ExtractedDocument["images"][number]) {
  const metadata = image.metadata ?? {};
  const tableText = metadataString(metadata, "table_text");
  const confidence = Number(metadata.table_confidence);
  return {
    candidateType: metadataString(metadata, "candidate_type"),
    tableLabel: metadataString(metadata, "table_label"),
    tableTitle: metadataString(metadata, "table_title"),
    tableRole: metadataString(metadata, "table_role"),
    tableConfidence: Number.isFinite(confidence) ? confidence : null,
    tableText,
    tableTextSnippet: compactMetadataText(tableText),
    accessibleTableMarkdown: metadataString(metadata, "accessible_table_markdown") ?? tableText,
    tableRows: Array.isArray(metadata.table_rows) ? metadata.table_rows : null,
    tableColumns: Array.isArray(metadata.table_columns) ? metadata.table_columns : null,
  };
}

function nonClinicalTableClassification(args: {
  tableMetadata: ReturnType<typeof imageTableMetadata>;
  sourceKind?: string | null;
  imageType?: ImageEvidenceCategory;
}) {
  const assessment = assessClinicalImageUse({
    imageType: args.imageType ?? "clinical_table",
    searchable: true,
    clinicalRelevanceScore: 0.4,
    sourceKind: args.sourceKind,
    tableRole: args.tableMetadata.tableRole,
    tableText: args.tableMetadata.tableText,
    tableTitle: args.tableMetadata.tableTitle,
    tableLabel: args.tableMetadata.tableLabel,
  });
  if (assessment.clinical_use_class === "clinical_evidence" || assessment.clinical_use_class === "ambiguous") {
    return null;
  }
  return {
    image_type: args.imageType ?? ("clinical_table" as const),
    searchable: false,
    clinical_relevance_score: 0,
    labels: [],
    caption:
      assessment.clinical_use_class === "administrative"
        ? "Administrative document-control table retained for audit, not clinical evidence."
        : "Reference table retained for audit, not clinical evidence.",
    skip_reason: assessment.clinical_use_reason,
    clinical_use_class: assessment.clinical_use_class,
    clinical_use_reason: assessment.clinical_use_reason,
    clinical_signal_score: assessment.clinical_signal_score,
    admin_signal_score: assessment.admin_signal_score,
  } satisfies ImageClassification;
}

async function getCachedImageClassification(ownerId: string | null, imageHash: string) {
  if (!ownerId) return null;

  const { data, error } = await supabase
    .from("image_caption_cache")
    .select("caption,metadata")
    .eq("owner_id", ownerId)
    .eq("image_hash", imageHash)
    .eq("model", env.OPENAI_VISION_MODEL)
    .maybeSingle();

  if (error) {
    console.warn("Image caption cache lookup failed", safeErrorLogDetails(error));
    return null;
  }
  if (!data) return null;

  const metadata = cachedImageMetadata(data.metadata);
  const imageType = imageEvidenceCategories.has(metadata.image_type as ImageEvidenceCategory)
    ? (metadata.image_type as ImageEvidenceCategory)
    : "unclear";
  const score = Number(metadata.clinical_relevance_score);
  const labels = cachedImageLabels(metadata.labels);
  const assessment = assessClinicalImageUse({
    imageType,
    searchable: Boolean(metadata.searchable),
    clinicalRelevanceScore: score,
    caption: String(data.caption || ""),
    labels,
    skipReason: typeof metadata.skip_reason === "string" ? metadata.skip_reason : null,
  });

  return {
    image_type: imageType,
    searchable: assessment.searchable && imageType !== "logo_decorative",
    clinical_relevance_score: assessment.clinical_relevance_score,
    labels,
    caption: String(data.caption || "").trim() || "Extracted source image.",
    skip_reason:
      typeof metadata.skip_reason === "string" && metadata.skip_reason.trim() ? metadata.skip_reason.trim() : null,
    clinical_use_class: assessment.clinical_use_class,
    clinical_use_reason: assessment.clinical_use_reason,
    clinical_signal_score: assessment.clinical_signal_score,
    admin_signal_score: assessment.admin_signal_score,
  } satisfies ImageClassification;
}

async function setCachedImageClassification(args: {
  ownerId: string | null;
  imageHash: string;
  mimeType: string;
  classification: ImageClassification;
}) {
  if (!args.ownerId || !args.classification.caption.trim()) return;

  const { error } = await supabase.from("image_caption_cache").upsert(
    {
      owner_id: args.ownerId,
      image_hash: args.imageHash,
      model: env.OPENAI_VISION_MODEL,
      caption: args.classification.caption,
      mime_type: args.mimeType,
      metadata: {
        extractor: "local-worker",
        image_type: args.classification.image_type,
        searchable: args.classification.searchable,
        clinical_relevance_score: args.classification.clinical_relevance_score,
        labels: args.classification.labels,
        skip_reason: args.classification.skip_reason,
        clinical_use_class: args.classification.clinical_use_class,
        clinical_use_reason: args.classification.clinical_use_reason,
        clinical_signal_score: args.classification.clinical_signal_score,
        admin_signal_score: args.classification.admin_signal_score,
        image_policy_version: clinicalImagePolicyVersion,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,image_hash,model" },
  );

  if (error) {
    console.warn("Image caption cache write failed", safeErrorLogDetails(error));
  }
}

async function uploadAndCaptionImages(job: JobRow, extracted: ExtractedDocument, pagesByNumber: Map<number, string>) {
  const insertedImages: Array<{
    id: string;
    caption: string;
    pageNumber: number | null;
    imageType: ImageEvidenceCategory;
    sourceKind: string | null;
    labels: string[];
    tableLabel: string | null;
    tableTitle: string | null;
    tableTextSnippet: string | null;
    tableRole: string | null;
    accessibleTableMarkdown: string | null;
    tableRows: string[][] | null;
    tableColumns: string[] | null;
  }> = [];
  const seenHashes = new Set<string>();
  let skippedImages = 0;
  const skipReasons = new Map<string, number>();
  const imageTypeCounts = new Map<string, number>();
  const captionedImagesByPage = new Map<number | "unknown", number>();
  let captionedImages = 0;

  for (const [index, image] of extracted.images.entries()) {
    await updateJobProgress(job.id, {
      stage: `captioning image ${index + 1}/${extracted.images.length}`,
      progress: Math.min(70, 35 + Math.round((index / Math.max(extracted.images.length, 1)) * 25)),
    });

    const bytes = await readFile(image.path);
    const imageHash = hashBytes(bytes);
    const perceptualHash = lightweightPerceptualHash(imageHash, image.width, image.height);
    const skipReason = cheapImageSkipReason({
      bytesLength: bytes.length,
      imageHash,
      seenHashes,
      image,
    });
    if (skipReason) {
      skippedImages += 1;
      noteSkippedImage(skipReasons, skipReason);
      continue;
    }
    seenHashes.add(imageHash);

    const nearbyText = image.pageNumber ? pagesByNumber.get(image.pageNumber) : undefined;
    const tableMetadata = imageTableMetadata(image);
    const lowSignalSkipReason = lowSignalImageTextSkipReason({
      sourceKind: image.sourceKind ?? null,
      tableRole: tableMetadata.tableRole,
      tableText: tableMetadata.tableText,
      tableTitle: tableMetadata.tableTitle,
      tableLabel: tableMetadata.tableLabel,
      width: image.width ?? null,
      height: image.height ?? null,
    });
    if (lowSignalSkipReason && !["administrative table without clinical facts"].includes(lowSignalSkipReason)) {
      skippedImages += 1;
      noteSkippedImage(skipReasons, lowSignalSkipReason);
      continue;
    }
    const pageKey = image.pageNumber ?? "unknown";
    const pageCaptionedImages = captionedImagesByPage.get(pageKey) ?? 0;
    if (captionedImages >= env.WORKER_MAX_CAPTIONED_IMAGES_PER_DOCUMENT) {
      skippedImages += 1;
      noteSkippedImage(skipReasons, "document image caption cap reached");
      continue;
    }
    if (pageCaptionedImages >= env.WORKER_MAX_CAPTIONED_IMAGES_PER_PAGE) {
      skippedImages += 1;
      noteSkippedImage(skipReasons, "page image caption cap reached");
      continue;
    }
    captionedImages += 1;
    captionedImagesByPage.set(pageKey, pageCaptionedImages + 1);
    let classification: ImageClassification | null =
      image.sourceKind === "table_crop"
        ? nonClinicalTableClassification({ tableMetadata, sourceKind: image.sourceKind })
        : null;
    let classificationCacheHit = false;
    if (!classification) {
      classification = await getCachedImageClassification(job.documents.owner_id, imageHash);
      classificationCacheHit = Boolean(classification);
    }
    if (!classification) {
      classification = await classifyAndCaptionImageFromBase64({
        base64: await fileToBase64(image.path),
        mimeType: image.mimeType,
        nearbyText,
        sourceKind: image.sourceKind ?? null,
        candidateType: tableMetadata.candidateType,
        tableLabel: tableMetadata.tableLabel,
        tableTitle: tableMetadata.tableTitle,
        tableRole: tableMetadata.tableRole,
        tableText: tableMetadata.tableText,
      });
      await setCachedImageClassification({
        ownerId: job.documents.owner_id,
        imageHash,
        mimeType: image.mimeType,
        classification,
      });
    }
    const policyAssessment = assessClinicalImageUse({
      imageType: classification.image_type,
      searchable: classification.searchable,
      clinicalRelevanceScore: classification.clinical_relevance_score,
      sourceKind: image.sourceKind ?? null,
      tableRole: tableMetadata.tableRole,
      tableText: tableMetadata.tableText,
      tableTitle: tableMetadata.tableTitle,
      tableLabel: tableMetadata.tableLabel,
      caption: classification.caption,
      labels: classification.labels,
      skipReason: classification.skip_reason,
    });
    classification = {
      ...classification,
      searchable: policyAssessment.searchable,
      clinical_relevance_score: policyAssessment.clinical_relevance_score,
      skip_reason: policyAssessment.searchable ? classification.skip_reason : policyAssessment.clinical_use_reason,
      clinical_use_class: policyAssessment.clinical_use_class,
      clinical_use_reason: policyAssessment.clinical_use_reason,
      clinical_signal_score: policyAssessment.clinical_signal_score,
      admin_signal_score: policyAssessment.admin_signal_score,
    };

    const classifiedSkipReason = classifiedImageSkipReason(classification);
    const retainAsAuditTable =
      image.sourceKind === "table_crop" &&
      ["administrative", "reference"].includes(policyAssessment.clinical_use_class) &&
      classification.image_type !== "logo_decorative";
    if (classifiedSkipReason && !retainAsAuditTable) {
      skippedImages += 1;
      noteSkippedImage(skipReasons, classifiedSkipReason);
      continue;
    }
    const persistedSearchable = policyAssessment.searchable;
    if (persistedSearchable) {
      imageTypeCounts.set(classification.image_type, (imageTypeCounts.get(classification.image_type) ?? 0) + 1);
    }

    const ext = path.extname(image.path) || ".png";
    const imagePrefix = job.documents.owner_id
      ? `${job.documents.owner_id}/images/${job.document_id}`
      : `local/${job.document_id}`;
    const imagePath = `${imagePrefix}/image-${index + 1}${ext}`;
    const upload = await supabase.storage
      .from(env.SUPABASE_IMAGE_BUCKET)
      .upload(imagePath, bytes, { contentType: image.mimeType, upsert: true });

    if (upload.error) throw new Error(upload.error.message);

    const { data, error } = await supabase
      .from("document_images")
      .insert({
        document_id: job.document_id,
        page_number: image.pageNumber,
        storage_path: imagePath,
        mime_type: image.mimeType,
        caption: cleanString(classification.caption),
        bbox: image.bbox ?? null,
        image_type: classification.image_type,
        searchable: persistedSearchable,
        clinical_relevance_score: persistedSearchable ? classification.clinical_relevance_score : 0,
        source_kind: image.sourceKind ?? "embedded",
        width: image.width ?? null,
        height: image.height ?? null,
        image_hash: imageHash,
        perceptual_hash: perceptualHash,
        labels: classification.labels.map(cleanString),
        metadata: sanitizeJsonb({
          ...(image.metadata ?? {}),
          extractor: "local-worker",
          image_hash: imageHash,
          perceptual_hash: perceptualHash,
          classification_cache_hit: classificationCacheHit,
          candidate_type: tableMetadata.candidateType ?? image.metadata?.candidate_type ?? null,
          table_label: tableMetadata.tableLabel,
          table_title: tableMetadata.tableTitle,
          table_text: tableMetadata.tableText,
          table_text_snippet: tableMetadata.tableTextSnippet,
          table_role: tableMetadata.tableRole,
          table_confidence: tableMetadata.tableConfidence,
          table_rows: tableMetadata.tableRows,
          table_columns: tableMetadata.tableColumns,
          accessible_table_markdown: tableMetadata.accessibleTableMarkdown,
          clinical_use_class: policyAssessment.clinical_use_class,
          clinical_use_reason: policyAssessment.clinical_use_reason,
          clinical_signal_score: policyAssessment.clinical_signal_score,
          admin_signal_score: policyAssessment.admin_signal_score,
          image_policy_version: clinicalImagePolicyVersion,
          retained_for_audit: retainAsAuditTable || undefined,
          retained_for_document_view: retainAsAuditTable || undefined,
          skip_reason: retainAsAuditTable ? classifiedSkipReason : classification.skip_reason,
        }),
      })
      .select("id,caption,page_number,image_type,labels,searchable")
      .single();

    if (error) throw new Error(error.message);
    if (data.searchable !== false) {
      insertedImages.push({
        id: data.id,
        caption: data.caption,
        pageNumber: data.page_number,
        imageType: data.image_type,
        sourceKind: image.sourceKind ?? "embedded",
        labels: data.labels ?? [],
        tableLabel: tableMetadata.tableLabel,
        tableTitle: tableMetadata.tableTitle,
        tableTextSnippet: tableMetadata.tableTextSnippet,
        tableRole: tableMetadata.tableRole,
        accessibleTableMarkdown: tableMetadata.accessibleTableMarkdown,
        tableRows: tableMetadata.tableRows,
        tableColumns: tableMetadata.tableColumns,
      });
    }
  }

  return {
    insertedImages,
    skippedImages,
    skipReasons: Object.fromEntries(skipReasons.entries()),
    imageTypeCounts: Object.fromEntries(imageTypeCounts.entries()),
  };
}

type IndexedChunkRow = ReturnType<typeof buildChunks>[number] & {
  id: string;
  content_hash: string;
  index_generation_id: string;
  embedding: number[];
};

function buildEmbeddingFieldInputs(job: JobRow, chunkRows: IndexedChunkRow[]) {
  const seen = new Set<string>();
  const fields: Array<{
    document_id: string;
    owner_id: string | null;
    source_chunk_id: string;
    field_type: string;
    content: string;
    metadata: Record<string, unknown>;
  }> = [];

  for (const chunk of chunkRows) {
    const sectionPath = chunk.section_path?.length
      ? chunk.section_path.join(" > ")
      : Array.isArray(chunk.metadata?.subsection_path)
        ? (chunk.metadata.subsection_path as unknown[]).map(String).join(" > ")
        : "";
    const content = compactSearchText(
      [job.documents.title, job.documents.file_name, sectionPath, chunk.section_heading].filter(Boolean).join(" | "),
      700,
    );
    if (!content) continue;
    const key = `${chunk.id}:section_context:${content.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    fields.push({
      owner_id: job.documents.owner_id,
      document_id: job.document_id,
      source_chunk_id: chunk.id,
      field_type: "section_context",
      content,
      metadata: {
        chunk_index: chunk.chunk_index,
        page_number: chunk.page_number,
        anchor_id: chunk.anchor_id ?? null,
      },
    });
  }

  return fields;
}

function buildIndexQualityPayload(args: {
  job: JobRow;
  metrics: ReturnType<typeof extractionMetrics>;
  chunks: ReturnType<typeof buildChunks>;
  insertedImages: Awaited<ReturnType<typeof uploadAndCaptionImages>>["insertedImages"];
  sectionCount: number;
  memoryCardCount: number;
  documentEmbeddingFieldTypes?: string[];
}) {
  const assessment = assessDocumentIndexQuality({
    metrics: args.metrics,
    chunks: args.chunks,
    insertedImages: args.insertedImages,
    sectionCount: args.sectionCount,
    memoryCardCount: args.memoryCardCount,
    documentEmbeddingFieldTypes: args.documentEmbeddingFieldTypes,
  });

  return {
    document_id: args.job.document_id,
    owner_id: args.job.documents.owner_id,
    quality_score: assessment.qualityScore,
    extraction_quality: assessment.extractionQuality,
    issues: assessment.issues,
    metrics: {
      ...args.metrics,
      ...assessment.metrics,
      search_eval_hit_rate: null,
    },
    updated_at: new Date().toISOString(),
  };
}

function buildChunkQualityHint(chunks: ReturnType<typeof buildChunks>) {
  const chunkCount = chunks.length;
  const fingerprints = chunks.map((chunk) => hashText(chunk.content));
  const duplicateChunkRatio = chunkCount ? 1 - new Set(fingerprints).size / Math.max(fingerprints.length, 1) : 0;
  const headingDensity = chunkCount ? chunks.filter((chunk) => chunk.section_heading).length / chunkCount : 0;
  return {
    duplicateChunkRatio: Number(duplicateChunkRatio.toFixed(3)),
    headingDensity: Number(headingDensity.toFixed(3)),
  };
}

async function insertDocumentLevelEmbeddingFields(args: {
  job: JobRow;
  chunkRows: IndexedChunkRow[];
  summary: string | null;
}) {
  const sourceChunkId = args.chunkRows[0]?.id;
  if (!sourceChunkId) return [];
  const inputs = [
    {
      field_type: "document_title",
      content: compactSearchText(`${args.job.documents.title} ${args.job.documents.file_name}`, 600),
    },
    {
      field_type: "document_summary",
      content: compactSearchText(`${args.job.documents.title} ${args.summary ?? ""}`, 1200),
    },
  ].filter((field) => field.content);
  if (inputs.length === 0) return [];
  const embeddings = await embedTexts(inputs.map((field) => field.content));
  const rows = inputs.map((field, index) => ({
    owner_id: args.job.documents.owner_id,
    document_id: args.job.document_id,
    source_chunk_id: sourceChunkId,
    field_type: field.field_type,
    content: field.content,
    embedding: embeddings[index],
    metadata: {
      source: "document_level",
    },
  }));
  const { error } = await supabase.from("document_embedding_fields").insert(rows);
  if (error) throw supabaseStageError("insert document-level embedding fields", error);
  return rows.map((row) => row.field_type);
}

async function insertEmbeddedChunks(job: JobRow, extracted: ExtractedDocument) {
  const pagesByNumber = new Map(extracted.pages.map((page) => [page.pageNumber, page.text] as const));
  const imageResult = await uploadAndCaptionImages(job, extracted, pagesByNumber);
  const { insertedImages } = imageResult;
  const indexGenerationId = randomUUID();

  await updateJob(job.id, { stage: "chunking", progress: 72 });
  const chunkMetadata = {
    source_path: job.documents.source_path ?? null,
    content_hash: job.documents.content_hash ?? null,
    index_generation_id: indexGenerationId,
    embedding_model: env.OPENAI_EMBEDDING_MODEL,
    extractor: "local-worker",
    rag_indexing_version: ragDeepMemoryVersion,
    rag_memory_version: ragDeepMemoryVersion,
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
  const indexedChunkRows: IndexedChunkRow[] = [];

  for (let start = 0; start < chunks.length; start += env.WORKER_BATCH_SIZE) {
    const batch = chunks.slice(start, start + env.WORKER_BATCH_SIZE);
    await updateJobProgress(job.id, {
      stage: `embedding chunks ${start + 1}-${start + batch.length}/${chunks.length}`,
      progress: Math.min(94, 75 + Math.round((start / Math.max(chunks.length, 1)) * 18)),
    });

    const embeddings = await embedTexts(batch.map((chunk) => chunk.content));
    const rows = batch.map((chunk, index) => ({
      id: randomUUID(),
      document_id: chunk.document_id,
      page_number: chunk.page_number,
      chunk_index: chunk.chunk_index,
      section_heading: chunk.section_heading ? cleanString(chunk.section_heading) : null,
      section_path: Array.isArray(chunk.section_path) ? chunk.section_path.map(cleanString) : [],
      heading_level: chunk.heading_level,
      parent_heading: chunk.parent_heading ? cleanString(chunk.parent_heading) : null,
      anchor_id: chunk.anchor_id ? cleanString(chunk.anchor_id) : null,
      content: cleanString(chunk.content),
      retrieval_synopsis: chunk.retrieval_synopsis ? cleanString(chunk.retrieval_synopsis) : null,
      token_estimate: chunk.token_estimate,
      image_ids: chunk.image_ids,
      content_hash: hashText(`${chunk.section_heading ?? ""}\n${chunk.content}`),
      index_generation_id: indexGenerationId,
      embedding: embeddings[index],
      metadata: sanitizeJsonb(chunk.metadata),
    })) satisfies IndexedChunkRow[];
    indexedChunkRows.push(...rows);

    const { error } = await supabase.from("document_chunks").insert(rows);
    if (error) throw new Error(error.message);

    const fieldInputs = buildEmbeddingFieldInputs(job, rows);
    if (fieldInputs.length > 0) {
      try {
        const fieldEmbeddings = await embedTexts(fieldInputs.map((field) => field.content));
        const fieldRows = fieldInputs.map((field, index) => ({
          ...field,
          content: cleanString(field.content),
          embedding: fieldEmbeddings[index],
          metadata: sanitizeJsonb(field.metadata),
        }));
        for (let start = 0; start < fieldRows.length; start += 10) {
          const batch = fieldRows.slice(start, start + 10);
          const { error: fieldsError } = await supabase.from("document_embedding_fields").insert(batch);
          if (fieldsError) throw supabaseStageError("insert section-context embedding fields", fieldsError);
        }
      } catch (error) {
        optionalIndexWriteWarning("section-context embedding field", error);
      }
    }
  }

  const tableFacts = buildTableFactRows({ job, chunkRows: indexedChunkRows, insertedImages }).map((row) => ({
    ...row,
    table_title: row.table_title ? cleanString(row.table_title) : null,
    row_label: row.row_label ? cleanString(row.row_label) : null,
    clinical_parameter: row.clinical_parameter ? cleanString(row.clinical_parameter) : null,
    threshold_value: row.threshold_value ? cleanString(row.threshold_value) : null,
    action: row.action ? cleanString(row.action) : null,
    metadata: sanitizeJsonb(row.metadata),
  }));
  if (tableFacts.length > 0) {
    const { error: factsError } = await supabase.from("document_table_facts").insert(tableFacts);
    if (factsError) optionalIndexWriteWarning("table fact", supabaseStageError("insert table facts", factsError));
  }

  const additionalFieldInputs = buildAdditionalEmbeddingFieldInputs({
    job,
    chunkRows: indexedChunkRows,
    insertedImages,
    tableFacts,
    qualityHint: buildChunkQualityHint(chunks),
  });
  if (additionalFieldInputs.length > 0) {
    try {
      const additionalEmbeddings = await embedTexts(additionalFieldInputs.map((field) => field.content));
      const additionalRows = additionalFieldInputs.map((field, index) => ({
        ...field,
        content: cleanString(field.content),
        embedding: additionalEmbeddings[index],
        metadata: sanitizeJsonb(field.metadata),
      }));
      for (let start = 0; start < additionalRows.length; start += 10) {
        const batch = additionalRows.slice(start, start + 10);
        const { error: additionalFieldsError } = await supabase.from("document_embedding_fields").insert(batch);
        if (additionalFieldsError) throw supabaseStageError("insert supplemental embedding fields", additionalFieldsError);
      }
    } catch (error) {
      optionalIndexWriteWarning("supplemental embedding field", error);
    }
  }

  return {
    chunks,
    indexedChunkRows,
    indexGenerationId,
    imageCount: insertedImages.length,
    insertedImages,
    skippedImages: imageResult.skippedImages,
    imageSkipReasons: imageResult.skipReasons,
    imageTypeCounts: imageResult.imageTypeCounts,
  };
}

function extractionMetrics(
  extracted: ExtractedDocument,
  skippedImages: number,
  imageSkipReasons: Record<string, number>,
  imageTypeCounts: Record<string, number>,
) {
  const textCharacterCount = extracted.pages.reduce((sum, page) => sum + page.text.length, 0);
  const ocrPageCount = extracted.pages.filter((page) => page.ocrUsed).length;
  const warnings = [...(extracted.warnings ?? [])];
  if (textCharacterCount < 80) warnings.push("Low extracted text volume; inspect OCR quality.");

  return {
    page_count: extracted.pages.length,
    ocr_page_count: ocrPageCount,
    text_character_count: textCharacterCount,
    extracted_image_count: extracted.images.length,
    searchable_image_count: Object.values(imageTypeCounts).reduce((sum, count) => sum + count, 0),
    skipped_image_count: skippedImages,
    skipped_image_reasons: imageSkipReasons,
    image_type_counts: imageTypeCounts,
    extraction_warnings: warnings,
  };
}

async function loadEnrichmentRows(documentId: string) {
  const chunks = [];
  const images = [];

  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase
      .from("document_chunks")
      .select(
        "id,document_id,page_number,chunk_index,section_heading,section_path,heading_level,parent_heading,anchor_id,content,image_ids,metadata",
      )
      .eq("document_id", documentId)
      .order("chunk_index", { ascending: true })
      .range(start, start + 999);
    if (error) throw new Error(error.message);
    chunks.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase
      .from("document_images")
      .select("id,page_number,caption,image_type,labels,source_kind,clinical_relevance_score,metadata")
      .eq("document_id", documentId)
      .eq("searchable", true)
      .order("clinical_relevance_score", { ascending: false })
      .range(start, start + 999);
    if (error) throw new Error(error.message);
    images.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  return { chunks, images };
}

async function processJob(job: JobRow) {
  await updateJobProgress(job.id, {
    stage: "downloading",
    progress: 5,
  });
  await updateDocument(job.document_id, { status: "processing", error_message: null });
  await updateBatch(job.batch_id);

  try {
    await resetDocumentIndex(job.document_id);
    const buffer = await downloadDocument(job.documents.storage_path);
    await updateJobProgress(job.id, { stage: "extracting text/images", progress: 20 });
    const extracted = await extractDocument({
      buffer,
      fileName: job.documents.file_name,
      mimeType: job.documents.file_type,
    });

    await updateJobProgress(job.id, { stage: "saving pages", progress: 32 });
    await insertPages(job.document_id, extracted);
    const {
      chunks,
      indexedChunkRows,
      indexGenerationId,
      imageCount,
      insertedImages,
      skippedImages,
      imageSkipReasons,
      imageTypeCounts,
    } = await insertEmbeddedChunks(job, extracted);
    const metrics = extractionMetrics(extracted, skippedImages, imageSkipReasons, imageTypeCounts);

    const initialQuality = buildIndexQualityPayload({
      job,
      metrics,
      chunks,
      insertedImages,
      sectionCount: 0,
      memoryCardCount: 0,
    });
    const { error: initialQualityError } = await supabase.from("document_index_quality").upsert(sanitizeJsonb(initialQuality), {
      onConflict: "document_id",
    });
    if (initialQualityError) throw new Error(initialQualityError.message);

    const indexedAt = new Date().toISOString();
    await updateDocument(job.document_id, {
      status: "indexed",
      page_count: extracted.pages.length,
      chunk_count: chunks.length,
      image_count: imageCount,
      error_message: null,
      metadata: {
        ...(job.documents.metadata ?? {}),
        indexed_at: indexedAt,
        index_generation_id: indexGenerationId,
        rag_enrichment_version: ragEnrichmentVersion,
        rag_indexing_version: ragDeepMemoryVersion,
        rag_memory_version: ragDeepMemoryVersion,
        rag_memory_updated_at: null,
        rag_enrichment_updated_at: null,
        enrichment_status: "pending",
        section_count: 0,
        memory_card_count: 0,
        extraction_quality: initialQuality.extraction_quality,
        index_quality_score: initialQuality.quality_score,
        index_quality_issues: initialQuality.issues,
        index_quality_metrics: initialQuality.metrics,
        embedding_model: env.OPENAI_EMBEDDING_MODEL,
        ...metrics,
      },
    });

    let enrichmentStatus = env.WORKER_INLINE_ENRICHMENT ? "completed" : "pending";
    let enrichmentErrorMessage: string | null = null;
    let finalQuality = initialQuality;
    let sectionCount = 0;
    let memoryCardCount = 0;
    let enrichmentUpdatedAt: string | null = null;
    let documentEmbeddingFieldTypes: string[] = [];

    if (env.WORKER_INLINE_ENRICHMENT) {
      await updateJobProgress(job.id, { stage: "enriching indexed document", progress: 96 });
      try {
        const enrichmentRows = await loadEnrichmentRows(job.document_id);
        const enrichment = await upsertDocumentEnrichment({
          supabase,
          document: job.documents,
          chunks: enrichmentRows.chunks,
          images: enrichmentRows.images,
        });
        documentEmbeddingFieldTypes = await insertDocumentLevelEmbeddingFields({
          job,
          chunkRows: indexedChunkRows,
          summary: enrichment.summary.summary,
        });
        await updateJobProgress(job.id, { stage: "building structured memory", progress: 98 });
        const deepMemory = await upsertDocumentDeepMemory({
          supabase,
          document: job.documents,
          chunks: enrichmentRows.chunks,
          images: enrichmentRows.images,
          summary: enrichment.summary.summary,
        });
        sectionCount = deepMemory.sections.length;
        memoryCardCount = deepMemory.memoryCards.length;
        finalQuality = buildIndexQualityPayload({
          job,
          metrics,
          chunks,
          insertedImages,
          sectionCount,
          memoryCardCount,
          documentEmbeddingFieldTypes,
        });
        const { error: qualityError } = await supabase.from("document_index_quality").upsert(sanitizeJsonb(finalQuality), {
          onConflict: "document_id",
        });
        if (qualityError) throw new Error(qualityError.message);
        enrichmentUpdatedAt = new Date().toISOString();
      } catch (enrichmentError) {
        enrichmentStatus = "failed";
        enrichmentErrorMessage = enrichmentError instanceof Error ? enrichmentError.message : String(enrichmentError);
        console.warn("Optional document enrichment failed", safeErrorLogDetails(enrichmentError));
      }
    } else {
      await updateJob(job.id, { stage: "core index complete; enrichment deferred", progress: 98 });
    }

    await updateDocument(job.document_id, {
      metadata: {
        ...(job.documents.metadata ?? {}),
        indexed_at: indexedAt,
        index_generation_id: indexGenerationId,
        rag_enrichment_version: ragEnrichmentVersion,
        rag_indexing_version: ragDeepMemoryVersion,
        rag_memory_version: ragDeepMemoryVersion,
        rag_memory_updated_at: enrichmentUpdatedAt,
        rag_enrichment_updated_at: enrichmentUpdatedAt,
        enrichment_status: enrichmentStatus,
        enrichment_error: enrichmentErrorMessage,
        section_count: sectionCount,
        memory_card_count: memoryCardCount,
        extraction_quality: finalQuality.extraction_quality,
        index_quality_score: finalQuality.quality_score,
        index_quality_issues: finalQuality.issues,
        index_quality_metrics: finalQuality.metrics,
        embedding_model: env.OPENAI_EMBEDDING_MODEL,
        ...metrics,
      },
    });

    await completeJob(job, enrichmentStatus === "completed" ? "indexed" : "indexed; enrichment deferred");
  } catch (error) {
    console.error(`Ingestion job ${job.id} failed:`, error);
    const message = error instanceof Error ? error.message : String(error);
    const partialConflict = isPartialIndexWriteConflict(error);
    const shouldRetry = isRetryableIngestionError(error) && job.attempt_count < job.max_attempts;

    if (partialConflict) {
      await failOrRetryJob({
        job,
        retry: false,
        documentStatus: "failed",
        stage: "needs recovery after partial index write",
        errorMessage: `${message}. Run npm run recover:ingestion -- --apply before retrying this document.`,
      });
    } else if (shouldRetry) {
      await failOrRetryJob({
        job,
        retry: true,
        documentStatus: "queued",
        stage: `retry scheduled after attempt ${job.attempt_count}/${job.max_attempts}`,
        errorMessage: message,
        nextRunAt: nextRetryAt(job.attempt_count),
      });
    } else {
      await failOrRetryJob({
        job,
        retry: false,
        documentStatus: "failed",
        stage: "failed",
        errorMessage: message,
      });
    }
  }
}

async function main() {
  const once = process.argv.includes("--once");
  const prereqs = await checkPythonPdfPrerequisites();
  let consecutiveClaimFailures = 0;
  console.log(`Clinical KB worker started. worker=${workerId}`);
  if (!prereqs.ok) {
    console.warn(`PDF/OCR prerequisite warning: ${prereqs.detail}`);
  }

  while (true) {
    let jobs: JobRow[] = [];
    try {
      const health = await probeSupabaseHealth(supabase);
      if (!health.ok) {
        console.warn("Supabase health check failed; worker is backing off", { message: health.message });
        if (once) {
          process.exitCode = 1;
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, env.WORKER_HEALTH_BACKOFF_MS));
        continue;
      }
      jobs = await claimJobs();
      consecutiveClaimFailures = 0;
    } catch (error) {
      consecutiveClaimFailures += 1;
      console.warn("Ingestion job claim failed", safeErrorLogDetails(error));
      if (once) throw error;
      if (consecutiveClaimFailures >= env.WORKER_MAX_CLAIM_FAILURES) {
        await new Promise((resolve) => setTimeout(resolve, env.WORKER_HEALTH_BACKOFF_MS));
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, workerBackoffMs(consecutiveClaimFailures)));
      continue;
    }

    if (jobs.length > 0) {
      await Promise.all(
        jobs.map(async (job) => {
          console.log(safeIngestionJobLog(job.id));
          try {
            await processJob(job);
          } catch (error) {
            console.error("Ingestion job processing failed", safeErrorLogDetails(error));
          }
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
  process.exitCode = 1;
});
