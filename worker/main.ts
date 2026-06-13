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
  lightweightPerceptualHash,
} from "../src/lib/image-filtering";
import { isRetryableIngestionError, nextRetryAt, terminalBatchStatus } from "../src/lib/ingestion";
import { classifyAndCaptionImageFromBase64, embedTexts } from "../src/lib/openai";
import { safeErrorLogDetails, safeIngestionJobLog } from "../src/lib/privacy";
import { createAdminClient } from "../src/lib/supabase/admin";
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

  for (const [index, image] of extracted.images.entries()) {
    await updateJob(job.id, {
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
      skipReasons.set(skipReason, (skipReasons.get(skipReason) ?? 0) + 1);
      continue;
    }
    seenHashes.add(imageHash);

    const nearbyText = image.pageNumber ? pagesByNumber.get(image.pageNumber) : undefined;
    const tableMetadata = imageTableMetadata(image);
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
      skipReasons.set(classifiedSkipReason, (skipReasons.get(classifiedSkipReason) ?? 0) + 1);
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
        caption: classification.caption,
        bbox: image.bbox ?? null,
        image_type: classification.image_type,
        searchable: persistedSearchable,
        clinical_relevance_score: persistedSearchable ? classification.clinical_relevance_score : 0,
        source_kind: image.sourceKind ?? "embedded",
        width: image.width ?? null,
        height: image.height ?? null,
        image_hash: imageHash,
        perceptual_hash: perceptualHash,
        labels: classification.labels,
        metadata: {
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
        },
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
  const fields: Array<{ document_id: string; owner_id: string | null; source_chunk_id: string; field_type: string; content: string; metadata: Record<string, unknown> }> = [];

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
}) {
  const chunkCount = args.chunks.length;
  const headingCount = args.chunks.filter((chunk) => chunk.section_heading).length;
  const tableImages = args.insertedImages.filter((image) => image.sourceKind === "table_crop");
  const tableImagesWithRows = tableImages.filter((image) => image.tableRows?.length);
  const fingerprints = args.chunks.map((chunk) => hashText(chunk.content));
  const duplicateChunkRatio = chunkCount
    ? 1 - new Set(fingerprints).size / Math.max(fingerprints.length, 1)
    : 0;
  const avgChunkLength = chunkCount
    ? args.chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunkCount
    : 0;
  const headingDensity = chunkCount ? headingCount / chunkCount : 0;
  const tableExtractionCoverage = tableImages.length ? tableImagesWithRows.length / tableImages.length : null;
  const ocrCoverage = args.metrics.page_count ? args.metrics.ocr_page_count / args.metrics.page_count : 0;
  const issues: string[] = [];
  if (chunkCount === 0) issues.push("no indexed chunks");
  if (avgChunkLength < 120 && chunkCount > 0) issues.push("short average chunks");
  if (headingDensity < 0.08 && chunkCount >= 8) issues.push("low heading density");
  if (duplicateChunkRatio > 0.18) issues.push("high duplicate chunk ratio");
  if (tableImages.length > 0 && tableExtractionCoverage !== null && tableExtractionCoverage < 0.5)
    issues.push("low table row extraction coverage");
  if (args.metrics.text_character_count < 80) issues.push("low extracted text volume");
  if (args.sectionCount === 0) issues.push("no structured sections");
  if (args.memoryCardCount === 0) issues.push("no memory cards");

  let qualityScore = 1;
  qualityScore -= issues.length * 0.08;
  qualityScore -= Math.min(0.2, duplicateChunkRatio * 0.5);
  if (tableExtractionCoverage !== null) qualityScore -= Math.max(0, 0.7 - tableExtractionCoverage) * 0.12;
  if (headingDensity < 0.08 && chunkCount >= 8) qualityScore -= 0.08;
  qualityScore = Math.max(0, Math.min(1, qualityScore));
  const extractionQuality = qualityScore >= 0.78 ? "good" : qualityScore >= 0.48 ? "partial" : "poor";

  return {
    document_id: args.job.document_id,
    owner_id: args.job.documents.owner_id,
    quality_score: Number(qualityScore.toFixed(3)),
    extraction_quality: extractionQuality,
    issues,
    metrics: {
      ...args.metrics,
      avg_chunk_length: Number(avgChunkLength.toFixed(1)),
      duplicate_chunk_ratio: Number(duplicateChunkRatio.toFixed(3)),
      heading_density: Number(headingDensity.toFixed(3)),
      table_extraction_coverage: tableExtractionCoverage === null ? null : Number(tableExtractionCoverage.toFixed(3)),
      ocr_coverage: Number(ocrCoverage.toFixed(3)),
      search_eval_hit_rate: null,
      section_count: args.sectionCount,
      memory_card_count: args.memoryCardCount,
    },
    updated_at: new Date().toISOString(),
  };
}

async function insertDocumentLevelEmbeddingFields(args: {
  job: JobRow;
  chunkRows: IndexedChunkRow[];
  summary: string | null;
}) {
  const sourceChunkId = args.chunkRows[0]?.id;
  if (!sourceChunkId) return;
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
  if (inputs.length === 0) return;
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
  if (error) throw new Error(error.message);
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
    await updateJob(job.id, {
      stage: `embedding chunks ${start + 1}-${start + batch.length}/${chunks.length}`,
      progress: Math.min(94, 75 + Math.round((start / Math.max(chunks.length, 1)) * 18)),
    });

    const embeddings = await embedTexts(batch.map((chunk) => chunk.content));
    const rows = batch.map((chunk, index) => ({
      id: randomUUID(),
      ...chunk,
      content_hash: hashText(`${chunk.section_heading ?? ""}\n${chunk.content}`),
      index_generation_id: indexGenerationId,
      embedding: embeddings[index],
    })) satisfies IndexedChunkRow[];
    indexedChunkRows.push(...rows);

    const { error } = await supabase.from("document_chunks").insert(rows);
    if (error) throw new Error(error.message);

    const fieldInputs = buildEmbeddingFieldInputs(job, rows);
    if (fieldInputs.length > 0) {
      const fieldEmbeddings = await embedTexts(fieldInputs.map((field) => field.content));
      const fieldRows = fieldInputs.map((field, index) => ({
        ...field,
        embedding: fieldEmbeddings[index],
      }));
      const { error: fieldsError } = await supabase.from("document_embedding_fields").insert(fieldRows);
      if (fieldsError) throw new Error(fieldsError.message);
    }
  }

  const tableFacts = buildTableFactRows({ job, chunkRows: indexedChunkRows, insertedImages });
  if (tableFacts.length > 0) {
    const { error: factsError } = await supabase.from("document_table_facts").insert(tableFacts);
    if (factsError) throw new Error(factsError.message);
  }

  const additionalFieldInputs = buildAdditionalEmbeddingFieldInputs({
    job,
    chunkRows: indexedChunkRows,
    insertedImages,
    tableFacts,
  });
  if (additionalFieldInputs.length > 0) {
    const additionalEmbeddings = await embedTexts(additionalFieldInputs.map((field) => field.content));
    const additionalRows = additionalFieldInputs.map((field, index) => ({
      ...field,
      embedding: additionalEmbeddings[index],
    }));
    const { error: additionalFieldsError } = await supabase.from("document_embedding_fields").insert(additionalRows);
    if (additionalFieldsError) throw new Error(additionalFieldsError.message);
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

    await updateJob(job.id, { stage: "summarising and labelling", progress: 95 });
    const enrichmentRows = await loadEnrichmentRows(job.document_id);
    const enrichment = await upsertDocumentEnrichment({
      supabase,
      document: job.documents,
      chunks: enrichmentRows.chunks,
      images: enrichmentRows.images,
    });
    await insertDocumentLevelEmbeddingFields({
      job,
      chunkRows: indexedChunkRows,
      summary: enrichment.summary.summary,
    });
    await updateJob(job.id, { stage: "building structured memory", progress: 98 });
    const deepMemory = await upsertDocumentDeepMemory({
      supabase,
      document: job.documents,
      chunks: enrichmentRows.chunks,
      images: enrichmentRows.images,
      summary: enrichment.summary.summary,
    });
    const quality = buildIndexQualityPayload({
      job,
      metrics,
      chunks,
      insertedImages,
      sectionCount: deepMemory.sections.length,
      memoryCardCount: deepMemory.memoryCards.length,
    });
    const { error: qualityError } = await supabase.from("document_index_quality").upsert(quality, {
      onConflict: "document_id",
    });
    if (qualityError) throw new Error(qualityError.message);

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
        rag_memory_updated_at: indexedAt,
        rag_enrichment_updated_at: indexedAt,
        section_count: deepMemory.sections.length,
        memory_card_count: deepMemory.memoryCards.length,
        extraction_quality: quality.extraction_quality,
        index_quality_score: quality.quality_score,
        index_quality_issues: quality.issues,
        index_quality_metrics: quality.metrics,
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
