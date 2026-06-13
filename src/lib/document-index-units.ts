import { clinicalVocabularySearchText, clinicalVocabularyTerms } from "@/lib/clinical-vocabulary";
import { firstSourceSpan, type SourceSpan } from "@/lib/source-spans";
import type { ModelIndexProfile, ModelIndexProfileItem, ModelIndexTableFact } from "@/lib/model-index-extraction";
import type { ClinicalDocument, DocumentSectionMemory } from "@/lib/types";

export const documentIndexUnitVersion = "document-index-units-v1" as const;

export type DocumentIndexUnitType =
  | "document_profile"
  | "section_summary"
  | "page_text"
  | "chunk_evidence"
  | "table_fact"
  | "askable_question"
  | "clinical_fact"
  | "vocabulary_term";

export type DocumentIndexUnitInput = {
  owner_id: string | null;
  document_id: string;
  unit_type: DocumentIndexUnitType;
  source_chunk_id: string | null;
  source_image_id: string | null;
  page_start: number | null;
  page_end: number | null;
  heading_path: string[];
  title: string;
  content: string;
  normalized_terms: string[];
  source_span: SourceSpan | null;
  quality_score: number;
  extraction_mode: "deterministic" | "model_heavy" | "hybrid";
  metadata: Record<string, unknown>;
};

export type IndexUnitChunk = {
  id: string;
  document_id: string;
  page_number: number | null;
  chunk_index: number;
  section_heading: string | null;
  section_path?: string[] | null;
  content: string;
  metadata?: Record<string, unknown> | null;
};

function compact(value: unknown, limit = 900) {
  const compacted = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!compacted) return "";
  return compacted.length <= limit ? compacted : `${compacted.slice(0, limit - 3).trim()}...`;
}

function termsFor(...values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? ""))
        .flatMap((value) => [
          ...value
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter((term) => term.length >= 2 && !["the", "and", "for", "with", "from", "that"].includes(term)),
          ...clinicalVocabularyTerms(value, 24),
        ]),
    ),
  ).slice(0, 48);
}

function firstChunk(chunks: IndexUnitChunk[], chunkIds: string[] = []) {
  if (chunkIds.length) {
    const direct = chunks.find((chunk) => chunkIds.includes(chunk.id));
    if (direct) return direct;
  }
  return chunks[0] ?? null;
}

function pageRange(chunks: IndexUnitChunk[]) {
  const pages = chunks.map((chunk) => chunk.page_number).filter((page): page is number => Boolean(page));
  return {
    page_start: pages.length ? Math.min(...pages) : null,
    page_end: pages.length ? Math.max(...pages) : null,
  };
}

function buildUnit(args: {
  document: Pick<ClinicalDocument, "id" | "owner_id" | "title" | "file_name">;
  unit_type: DocumentIndexUnitType;
  sourceChunk: IndexUnitChunk | null;
  source_image_id?: string | null;
  page_start?: number | null;
  page_end?: number | null;
  heading_path?: string[];
  title: string;
  content: string;
  source_span?: SourceSpan | null;
  quality_score?: number;
  extraction_mode: DocumentIndexUnitInput["extraction_mode"];
  metadata?: Record<string, unknown>;
}): DocumentIndexUnitInput | null {
  const title = compact(args.title, 160);
  const content = compact(clinicalVocabularySearchText(args.content), 1400);
  if (!title || !content) return null;
  return {
    owner_id: args.document.owner_id ?? null,
    document_id: args.document.id,
    unit_type: args.unit_type,
    source_chunk_id: args.sourceChunk?.id ?? null,
    source_image_id: args.source_image_id ?? null,
    page_start: args.page_start ?? args.sourceChunk?.page_number ?? null,
    page_end: args.page_end ?? args.sourceChunk?.page_number ?? null,
    heading_path: args.heading_path ?? args.sourceChunk?.section_path ?? [],
    title,
    content,
    normalized_terms: termsFor(args.document.title, args.document.file_name, title, content),
    source_span: args.source_span ?? firstSourceSpan(args.sourceChunk?.metadata),
    quality_score: Math.max(0, Math.min(1, args.quality_score ?? 0.7)),
    extraction_mode: args.extraction_mode,
    metadata: {
      document_index_unit_version: documentIndexUnitVersion,
      chunk_index: args.sourceChunk?.chunk_index ?? null,
      section_heading: args.sourceChunk?.section_heading ?? null,
      ...args.metadata,
    },
  };
}

function itemUnit(args: {
  document: Pick<ClinicalDocument, "id" | "owner_id" | "title" | "file_name">;
  chunks: IndexUnitChunk[];
  item: ModelIndexProfileItem;
  unit_type: DocumentIndexUnitType;
  metadata?: Record<string, unknown>;
}) {
  const sourceChunk = firstChunk(args.chunks, args.item.source_chunk_ids);
  return buildUnit({
    document: args.document,
    unit_type: args.unit_type,
    sourceChunk,
    source_image_id: args.item.source_image_ids[0] ?? null,
    title: args.item.title,
    content: args.item.content,
    quality_score: args.item.confidence,
    extraction_mode: "model_heavy",
    metadata: {
      source_chunk_ids: args.item.source_chunk_ids,
      source_image_ids: args.item.source_image_ids,
      ...args.metadata,
    },
  });
}

function tableUnit(args: {
  document: Pick<ClinicalDocument, "id" | "owner_id" | "title" | "file_name">;
  chunks: IndexUnitChunk[];
  item: ModelIndexTableFact;
}) {
  const sourceChunk = firstChunk(args.chunks, args.item.source_chunk_ids);
  return buildUnit({
    document: args.document,
    unit_type: "table_fact",
    sourceChunk,
    source_image_id: args.item.source_image_ids[0] ?? null,
    title: args.item.table_title || args.item.title,
    content: [
      args.item.table_title,
      args.item.clinical_parameter,
      args.item.threshold_value,
      args.item.action,
      args.item.content,
    ]
      .filter(Boolean)
      .join(" | "),
    quality_score: args.item.confidence,
    extraction_mode: "model_heavy",
    metadata: {
      source: "model_index_profile",
      source_chunk_ids: args.item.source_chunk_ids,
      source_image_ids: args.item.source_image_ids,
      table_title: args.item.table_title,
      clinical_parameter: args.item.clinical_parameter,
      threshold_value: args.item.threshold_value,
      action: args.item.action,
    },
  });
}

export function buildDocumentIndexUnitInputs(args: {
  document: Pick<ClinicalDocument, "id" | "owner_id" | "title" | "file_name">;
  chunks: IndexUnitChunk[];
  sections?: Array<Omit<DocumentSectionMemory, "id" | "created_at" | "updated_at">>;
  modelProfile?: ModelIndexProfile | null;
  summary?: string | null;
}) {
  const units: DocumentIndexUnitInput[] = [];
  const add = (unit: DocumentIndexUnitInput | null) => {
    if (unit) units.push(unit);
  };

  const first = firstChunk(args.chunks);
  add(
    buildUnit({
      document: args.document,
      unit_type: "document_profile",
      sourceChunk: first,
      page_start: pageRange(args.chunks).page_start,
      page_end: pageRange(args.chunks).page_end,
      title: args.document.title,
      content: [args.document.title, args.document.file_name, args.summary].filter(Boolean).join(" | "),
      quality_score: 0.72,
      extraction_mode: args.modelProfile ? "hybrid" : "deterministic",
      metadata: { source: "document_profile", model_profile_version: args.modelProfile?.version ?? null },
    }),
  );

  for (const section of args.sections ?? []) {
    const sourceChunk = firstChunk(args.chunks, section.chunk_ids);
    add(
      buildUnit({
        document: args.document,
        unit_type: "section_summary",
        sourceChunk,
        page_start: section.page_start,
        page_end: section.page_end,
        heading_path: section.heading_path,
        title: section.heading,
        content: section.summary,
        quality_score: section.extraction_quality === "good" ? 0.78 : section.extraction_quality === "partial" ? 0.58 : 0.42,
        extraction_mode: "hybrid",
        metadata: { source: "document_sections", chunk_ids: section.chunk_ids, tags: section.tags },
      }),
    );
  }

  for (const chunk of args.chunks) {
    add(
      buildUnit({
        document: args.document,
        unit_type: "chunk_evidence",
        sourceChunk: chunk,
        title: chunk.section_heading || `Page ${chunk.page_number ?? "unknown"} chunk ${chunk.chunk_index}`,
        content: chunk.content,
        quality_score: 0.62,
        extraction_mode: "deterministic",
        metadata: { source: "document_chunks" },
      }),
    );
  }

  for (const item of args.modelProfile?.sections ?? []) {
    add(itemUnit({ document: args.document, chunks: args.chunks, item, unit_type: "section_summary", metadata: { source: "model_sections" } }));
  }
  for (const item of args.modelProfile?.askable_questions ?? []) {
    add(itemUnit({ document: args.document, chunks: args.chunks, item, unit_type: "askable_question", metadata: { source: "model_askable_questions" } }));
  }
  for (const item of args.modelProfile?.clinical_facts ?? []) {
    add(itemUnit({ document: args.document, chunks: args.chunks, item, unit_type: "clinical_fact", metadata: { source: "model_clinical_facts" } }));
  }
  for (const item of args.modelProfile?.table_facts ?? []) {
    add(tableUnit({ document: args.document, chunks: args.chunks, item }));
  }
  for (const alias of args.modelProfile?.aliases ?? []) {
    const sourceChunk = firstChunk(args.chunks, alias.source_chunk_ids);
    add(
      buildUnit({
        document: args.document,
        unit_type: "vocabulary_term",
        sourceChunk,
        title: alias.canonical,
        content: `${alias.alias} means ${alias.canonical}`,
        quality_score: alias.confidence,
        extraction_mode: "model_heavy",
        metadata: {
          source: "model_aliases",
          alias: alias.alias,
          canonical: alias.canonical,
          alias_type: alias.alias_type,
          source_chunk_ids: alias.source_chunk_ids,
        },
      }),
    );
  }

  const seen = new Set<string>();
  return units.filter((unit) => {
    const key = `${unit.unit_type}:${unit.source_chunk_id ?? ""}:${unit.title.toLowerCase()}:${unit.content.toLowerCase().slice(0, 180)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function embeddingTextForDocumentIndexUnit(unit: DocumentIndexUnitInput) {
  return [
    `Type: ${unit.unit_type}`,
    `Title: ${unit.title}`,
    unit.heading_path.length ? `Path: ${unit.heading_path.join(" > ")}` : "",
    `Content: ${unit.content}`,
    unit.normalized_terms.length ? `Terms: ${unit.normalized_terms.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
