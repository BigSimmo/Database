import { clinicalVocabularySearchText, clinicalVocabularyTerms } from "@/lib/clinical-vocabulary";
import { firstSourceSpan, type SourceSpan } from "@/lib/source-spans";
import type { ModelIndexProfile, ModelIndexProfileItem, ModelIndexTableFact } from "@/lib/model-index-extraction";
import type { ClinicalDocument, DocumentSectionMemory } from "@/lib/types";

export const documentIndexUnitVersion = "document-index-units-v1" as const;
export const documentIntelligenceVersion = "document-intelligence-v2" as const;

export type DocumentIndexUnitType =
  | "document_profile"
  | "section_summary"
  | "page_text"
  | "chunk_evidence"
  | "table_fact"
  | "askable_question"
  | "clinical_fact"
  | "threshold"
  | "workflow_step"
  | "medication_monitoring"
  | "alias"
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
  const compacted = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!compacted) return "";
  return compacted.length <= limit ? compacted : `${compacted.slice(0, limit - 3).trim()}...`;
}

const sentenceBoundary = /(?<=[.!?])\s+|\n+/;
const thresholdPattern =
  /\b(?:threshold|cut[\s-]?off|level|range|score|scale|criteria|criterion|maximum|minimum|baseline|anc|fbc|wbc|neutrophil|withhold|cease|stop|urgent|review|<|>|<=|>=|\d+(?:\.\d+)?\s*(?:mg|mcg|mmol|x\s*10\^?9\/l|%))\b/i;
const medicationMonitoringPattern =
  /\b(?:clozapine|lithium|antipsychotic|benzodiazepine|olanzapine|lorazepam|diazepam|haloperidol|depot|lai|neuroleptic|dose|mg|mcg|route|oral|im\b|po\b|titrate|monitor|fbc|anc|level|toxicity)\b/i;
const workflowPattern =
  /\b(?:workflow|pathway|process|procedure|step|refer|review|document|record|complete|form|responsib\w*|follow[- ]?up|appointment|escalat\w*|urgent|required|must|should)\b/i;

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

function splitSourceSentences(content: string) {
  return content
    .replace(/\[\[IMAGE_DATA_START\]\][\s\S]*?\[\[IMAGE_DATA_END\]\]/g, " ")
    .split(sentenceBoundary)
    .map((sentence) => compact(sentence, 520))
    .filter((sentence) => sentence.length >= 20);
}

function deterministicTypedCandidates(chunk: IndexUnitChunk) {
  const candidates: Array<{ unit_type: DocumentIndexUnitType; title: string; content: string; score: number }> = [];
  const sentences = splitSourceSentences(chunk.content);
  const add = (unit_type: DocumentIndexUnitType, title: string, content: string, score: number) => {
    if (!content) return;
    if (candidates.some((candidate) => candidate.unit_type === unit_type && candidate.content === content)) return;
    candidates.push({ unit_type, title, content, score });
  };

  for (const sentence of sentences) {
    if (thresholdPattern.test(sentence)) {
      add("threshold", chunk.section_heading || "Threshold", sentence, 0.7);
    }
    if (medicationMonitoringPattern.test(sentence)) {
      add("medication_monitoring", chunk.section_heading || "Medication monitoring", sentence, 0.68);
    }
    if (workflowPattern.test(sentence)) {
      add("workflow_step", chunk.section_heading || "Workflow step", sentence, 0.64);
    }
    if (candidates.length >= 6) break;
  }

  return candidates.slice(0, 4);
}

function unitTypeForClinicalItem(item: ModelIndexProfileItem): DocumentIndexUnitType {
  const text = `${item.title} ${item.content}`;
  if (thresholdPattern.test(text)) return "threshold";
  if (medicationMonitoringPattern.test(text)) return "medication_monitoring";
  if (workflowPattern.test(text)) return "workflow_step";
  return "clinical_fact";
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
      document_intelligence_version: documentIntelligenceVersion,
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
        quality_score:
          section.extraction_quality === "good" ? 0.78 : section.extraction_quality === "partial" ? 0.58 : 0.42,
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

    for (const candidate of deterministicTypedCandidates(chunk)) {
      add(
        buildUnit({
          document: args.document,
          unit_type: candidate.unit_type,
          sourceChunk: chunk,
          title: candidate.title,
          content: candidate.content,
          quality_score: candidate.score,
          extraction_mode: "deterministic",
          metadata: {
            source: "deterministic_chunk_signal",
            typed_signal: candidate.unit_type,
          },
        }),
      );
    }
  }

  for (const item of args.modelProfile?.sections ?? []) {
    add(
      itemUnit({
        document: args.document,
        chunks: args.chunks,
        item,
        unit_type: "section_summary",
        metadata: { source: "model_sections" },
      }),
    );
  }
  for (const item of args.modelProfile?.askable_questions ?? []) {
    add(
      itemUnit({
        document: args.document,
        chunks: args.chunks,
        item,
        unit_type: "askable_question",
        metadata: { source: "model_askable_questions" },
      }),
    );
  }
  for (const item of args.modelProfile?.clinical_facts ?? []) {
    add(
      itemUnit({
        document: args.document,
        chunks: args.chunks,
        item,
        unit_type: unitTypeForClinicalItem(item),
        metadata: { source: "model_clinical_facts", original_unit_type: "clinical_fact" },
      }),
    );
  }
  for (const item of args.modelProfile?.table_facts ?? []) {
    add(tableUnit({ document: args.document, chunks: args.chunks, item }));
  }
  for (const alias of args.modelProfile?.aliases ?? []) {
    const sourceChunk = firstChunk(args.chunks, alias.source_chunk_ids);
    add(
      buildUnit({
        document: args.document,
        unit_type: "alias",
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

export function countDocumentIndexUnitsByType(units: Array<Pick<DocumentIndexUnitInput, "unit_type">>) {
  return units.reduce<Record<string, number>>((counts, unit) => {
    counts[unit.unit_type] = (counts[unit.unit_type] ?? 0) + 1;
    return counts;
  }, {});
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
