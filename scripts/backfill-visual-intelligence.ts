import { embedTexts } from "@/lib/openai";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildVisualDocumentIndexUnitInputs,
  embeddingTextForDocumentIndexUnit,
  type IndexUnitChunk,
  type IndexUnitVisualImage,
} from "@/lib/document-index-units";
import {
  deterministicStructuredVisualProfile,
  visualIntelligenceVersion,
  type StructuredVisualProfile,
} from "@/lib/visual-intelligence";

const supabase = createAdminClient();

type BackfillImageRow = {
  id: string;
  document_id: string;
  page_number: number | null;
  caption: string | null;
  image_type: string | null;
  source_kind: string | null;
  labels: string[] | null;
  metadata: Record<string, unknown> | null;
};

type BackfillDocumentRow = {
  id: string;
  owner_id: string | null;
  title: string;
  file_name: string;
};

function argValue(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function numberArg(name: string, fallback: number) {
  const value = Number(argValue(name, String(fallback)));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const limit = numberArg("--limit", 10);
const dryRun = process.argv.includes("--dry-run");

function metadataText(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metadataStringArray(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return Array.isArray(value) ? value.map(String) : null;
}

function metadataRows(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return Array.isArray(value) ? (value as string[][]) : null;
}

function imageToVisualInput(image: BackfillImageRow): IndexUnitVisualImage {
  const metadata = image.metadata ?? {};
  const existingProfile =
    typeof metadata.structured_visual_profile === "object" && metadata.structured_visual_profile !== null
      ? (metadata.structured_visual_profile as StructuredVisualProfile)
      : null;
  const profile =
    existingProfile ??
    deterministicStructuredVisualProfile({
      imageType: image.image_type,
      caption: image.caption,
      tableTitle: metadataText(metadata, "table_title"),
      tableLabel: metadataText(metadata, "table_label"),
      tableTextSnippet: metadataText(metadata, "table_text_snippet") ?? metadataText(metadata, "table_text"),
      tableRows: metadataRows(metadata, "table_rows"),
      tableColumns: metadataStringArray(metadata, "table_columns"),
      metadata,
    });

  return {
    id: image.id,
    caption: image.caption,
    pageNumber: image.page_number,
    imageType: image.image_type,
    sourceKind: image.source_kind,
    labels: image.labels ?? [],
    tableLabel: metadataText(metadata, "table_label"),
    tableTitle: metadataText(metadata, "table_title"),
    tableTextSnippet: metadataText(metadata, "table_text_snippet") ?? metadataText(metadata, "table_text"),
    tableRole: metadataText(metadata, "table_role"),
    accessibleTableMarkdown: metadataText(metadata, "accessible_table_markdown"),
    tableRows: metadataRows(metadata, "table_rows"),
    tableColumns: metadataStringArray(metadata, "table_columns"),
    structuredVisualProfile: profile,
    candidatePriorityScore: Number(metadata.candidate_priority_score ?? 0.62),
    imageQualityScore: Number(metadata.image_quality_score ?? 0.62),
    cropCompleteness: Number(metadata.crop_completeness ?? 0.62),
    ocrTextDensity: Number(metadata.ocr_text_density ?? 0),
    metadata,
  };
}

async function loadCandidateImages() {
  const { data, error } = await supabase
    .from("document_images")
    .select("id,document_id,page_number,caption,image_type,source_kind,labels,metadata")
    .eq("searchable", true)
    .or(
      [
        "metadata->>visual_intelligence_version.is.null",
        `metadata->>visual_intelligence_version.neq.${visualIntelligenceVersion}`,
        "metadata->>visual_backfill_status.eq.retry",
      ].join(","),
    )
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as BackfillImageRow[];
}

async function loadDocument(documentId: string) {
  const { data, error } = await supabase
    .from("documents")
    .select("id,owner_id,title,file_name")
    .eq("id", documentId)
    .single();
  if (error) throw new Error(error.message);
  return data as BackfillDocumentRow;
}

async function loadChunks(documentId: string) {
  const { data, error } = await supabase
    .from("document_chunks")
    .select("id,document_id,page_number,chunk_index,section_heading,section_path,content,metadata,image_ids")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as IndexUnitChunk[];
}

async function markImage(image: BackfillImageRow, patch: Record<string, unknown>) {
  const metadata = { ...(image.metadata ?? {}), ...patch };
  const { error } = await supabase.from("document_images").update({ metadata }).eq("id", image.id);
  if (error) throw new Error(error.message);
}

async function backfillDocument(documentId: string, images: BackfillImageRow[]) {
  const document = await loadDocument(documentId);
  const chunks = await loadChunks(documentId);
  const visualImages = images.map(imageToVisualInput);
  const units = buildVisualDocumentIndexUnitInputs({ document, chunks, images: visualImages });
  console.log(
    `${dryRun ? "[dry-run] " : ""}${document.file_name}: ${images.length} image(s), ${units.length} visual unit(s)`,
  );
  if (dryRun) return;

  const imageIds = images.map((image) => image.id);
  await supabase
    .from("document_index_units")
    .delete()
    .eq("document_id", documentId)
    .in("source_image_id", imageIds)
    .in("unit_type", [
      "visual_summary",
      "flowchart_step",
      "diagram_decision",
      "risk_matrix_cell",
      "medication_chart_row",
      "chart_finding",
      "visual_askable_question",
      "table_threshold",
    ]);

  if (units.length > 0) {
    const embeddings = await embedTexts(units.map(embeddingTextForDocumentIndexUnit));
    for (let start = 0; start < units.length; start += 50) {
      const batch = units.slice(start, start + 50).map((unit, index) => ({
        ...unit,
        embedding: embeddings[start + index],
      }));
      const { error } = await supabase.from("document_index_units").insert(batch);
      if (error) throw new Error(error.message);
    }
  }

  for (const image of images) {
    const profile = imageToVisualInput(image).structuredVisualProfile;
    await markImage(image, {
      visual_intelligence_version: visualIntelligenceVersion,
      structured_visual_profile: profile,
      structured_extraction_confidence: profile?.confidence ?? null,
      visual_backfill_status: "completed",
      visual_backfill_completed_at: new Date().toISOString(),
    });
  }
}

async function main() {
  const images = await loadCandidateImages();
  if (images.length === 0) {
    console.log("No visual intelligence backfill candidates found.");
    return;
  }
  const imagesByDocument = new Map<string, BackfillImageRow[]>();
  for (const image of images) {
    imagesByDocument.set(image.document_id, [...(imagesByDocument.get(image.document_id) ?? []), image]);
  }

  for (const [documentId, documentImages] of imagesByDocument) {
    try {
      await backfillDocument(documentId, documentImages);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Visual backfill failed for document ${documentId}: ${message}`);
      if (!dryRun) {
        for (const image of documentImages) {
          await markImage(image, {
            visual_backfill_status: "retry",
            visual_backfill_error: message.slice(0, 500),
          });
        }
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
