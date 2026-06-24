import type { SupabaseClient } from "@supabase/supabase-js";
import { buildClinicalTextSearchQuery, classifyRagQuery, normalizedClinicalSearchTokens } from "@/lib/clinical-search";
import {
  buildDocumentIndexUnitInputs,
  countDocumentIndexUnitsByType,
  documentIntelligenceVersion,
  embeddingTextForDocumentIndexUnit,
} from "@/lib/document-index-units";
import { isClinicalImageEvidence } from "@/lib/image-filtering";
import {
  fallbackModelIndexProfile,
  generateModelIndexProfile,
  modelIndexExtractionVersion,
  type ModelIndexProfile,
  type ModelIndexProfileItem,
} from "@/lib/model-index-extraction";
import { embedTexts } from "@/lib/openai";
import { sourceTextForDisplay, sourceTextForModel } from "@/lib/source-text-sanitizer";
import type {
  ClinicalDocument,
  DocumentMemoryCard,
  DocumentMemoryCardType,
  DocumentSectionMemory,
  SearchResult,
} from "@/lib/types";

export const ragDeepMemoryVersion = "rag-deep-memory-v1" as const;

type MemoryChunk = {
  id: string;
  document_id: string;
  page_number: number | null;
  chunk_index: number;
  section_heading: string | null;
  section_path?: string[] | null;
  anchor_id?: string | null;
  content: string;
  image_ids?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

type MemoryImage = {
  id: string;
  page_number: number | null;
  caption: string | null;
  image_type?: string | null;
  labels?: string[] | null;
  source_kind?: string | null;
  clinical_relevance_score?: number | null;
  metadata?: Record<string, unknown> | null;
};

type MemoryDocument = Pick<ClinicalDocument, "id" | "owner_id" | "title" | "file_name" | "source_path"> & {
  metadata?: ClinicalDocument["metadata"];
};

type BuiltMemoryCard = Omit<DocumentMemoryCard, "id" | "embedding" | "created_at" | "updated_at"> & {
  section_index?: number;
};

type SectionInsertRow = Omit<DocumentSectionMemory, "id" | "created_at" | "updated_at">;

const highYieldTerms =
  /\b(?:must|should|required|immediate|urgent|escalat\w*|withhold|cease|stop|discontinue\w*|contraindicat\w*|avoid|monitor\w*|dose|mg|mcg|mmol\/l|anc|fbc|wbc|neutrophil|clozapine|lithium|antipsychotic|benzodiazepine|risk|red flag|baseline|weekly|monthly|hours?|days?|weeks?)\b/i;
const thresholdTerms =
  /\b(?:threshold|level|range|score|rating|criteria|anc|fbc|wbc|neutrophil|cease|withhold|stop|<|>|≤|≥)\b/i;
const medicationTerms =
  /\b(?:clozapine|lithium|antipsychotic|benzodiazepine|olanzapine|lorazepam|diazepam|haloperidol|neuroleptic|dose|mg|mcg|oral|intramuscular|im\b|po\b|route|titrate)\b/i;
const riskTerms =
  /\b(?:risk|urgent|escalat\w*|red flag|toxicity|adverse|side effect|contraindicat\w*|avoid|senior|specialist|crisis|emergency)\b/i;
const workflowTerms =
  /\b(?:workflow|pathway|process|procedure|step|refer|review|document|record|complete|form|responsib\w*|follow up|appointment)\b/i;
const boilerplateTerms =
  /\b(?:uncontrolled when printed|document control|version control|authorisation date|copyright|all rights reserved)\b/i;

function metadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? { ...(metadata as Record<string, unknown>) }
    : {};
}

function compactText(value: string | null | undefined, limit = 420) {
  const clean = sourceTextForModel(String(value ?? ""));
  if (!clean) return "";
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 3).trim()}...`;
}

function normalizeLookup(value: string) {
  return value
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^a-z0-9%/.<>≤≥]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedTerms(value: string) {
  const terms = normalizedClinicalSearchTokens(value);
  const numericTerms = normalizeLookup(value)
    .split(/\s+/)
    .filter((token) => /^\d+(?:\.\d+)?$|^<|^>|^≤|^≥/.test(token));
  return Array.from(new Set([...terms, ...numericTerms])).slice(0, 28);
}

function headingFromContent(content: string) {
  const firstLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length >= 4 && line.length <= 100 && !line.includes("[[IMAGE_DATA_START]]"));
  if (!firstLine) return null;
  if (/^\d+\.?\s+[A-Z]/.test(firstLine) || /^[A-Z][A-Za-z0-9\s,;:()[\]/-]+$/.test(firstLine)) {
    return firstLine.replace(/[:.\s]+$/, "");
  }
  return null;
}

function extractionQualityForChunks(chunks: MemoryChunk[]): DocumentSectionMemory["extraction_quality"] {
  const qualities = chunks.map((chunk) => metadataRecord(chunk.metadata).extraction_quality);
  if (qualities.includes("poor")) return "poor";
  if (qualities.includes("partial")) return "partial";
  return "good";
}

function sectionHeadingForChunk(chunk: MemoryChunk) {
  return chunk.section_heading || headingFromContent(chunk.content) || `Page ${chunk.page_number ?? "unknown"}`;
}

export function buildDocumentSections(args: { document: MemoryDocument; chunks: MemoryChunk[] }): SectionInsertRow[] {
  const sorted = [...args.chunks].sort((a, b) => a.chunk_index - b.chunk_index);
  const groups: MemoryChunk[][] = [];

  for (const chunk of sorted) {
    const previous = groups.at(-1);
    const heading = normalizeLookup(sectionHeadingForChunk(chunk));
    const previousHeading = previous?.length ? normalizeLookup(sectionHeadingForChunk(previous[0])) : "";
    const pageGap =
      previous?.length && chunk.page_number && previous.at(-1)?.page_number
        ? chunk.page_number - (previous.at(-1)?.page_number ?? chunk.page_number)
        : 0;
    if (!previous || (heading && previousHeading && heading !== previousHeading) || pageGap > 1) {
      groups.push([chunk]);
    } else {
      previous.push(chunk);
    }
  }

  return groups.map((group, sectionIndex) => {
    const heading = sectionHeadingForChunk(group[0]);
    const pages = group.map((chunk) => chunk.page_number).filter((page): page is number => Boolean(page));
    const combined = compactText(group.map((chunk) => chunk.content).join(" "), 520);
    const tags = normalizedTerms(`${args.document.title} ${heading} ${combined}`).slice(0, 14);
    return {
      document_id: args.document.id,
      owner_id: args.document.owner_id ?? null,
      section_index: sectionIndex,
      heading,
      heading_path: [heading],
      page_start: pages.length ? Math.min(...pages) : null,
      page_end: pages.length ? Math.max(...pages) : null,
      chunk_ids: group.map((chunk) => chunk.id),
      summary: combined || `${heading}: indexed source section.`,
      tags,
      extraction_quality: extractionQualityForChunks(group),
      metadata: {
        rag_indexing_version: ragDeepMemoryVersion,
        source_path: args.document.source_path ?? null,
      },
    };
  });
}

function imageMetadataString(image: MemoryImage, key: string) {
  const value = metadataRecord(image.metadata)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function imageTextForCards(images: MemoryImage[]) {
  return images
    .filter((image) => isClinicalImageEvidence(image))
    .map((image) =>
      [
        image.caption,
        image.image_type,
        image.source_kind,
        imageMetadataString(image, "table_label"),
        imageMetadataString(image, "table_title"),
        imageMetadataString(image, "table_text"),
        ...(image.labels ?? []),
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join("\n");
}

function splitCandidateStatements(text: string) {
  const withoutImageBlocks = sourceTextForDisplay(text);
  return withoutImageBlocks
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((line) => compactText(line, 360))
    .filter((line) => line.length >= 24 && line.length <= 360 && !boilerplateTerms.test(line));
}

function tableRowsFromMarkdown(text: string) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("|") && !/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(line));

  if (rows.length < 2) return [];
  const header = rows[0]
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean)
    .join(" ");

  return rows.slice(1).map((row) => {
    const cells = row
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean);
    return compactText(`${header} ${cells.join(" ")}`, 360);
  });
}

function tableRowsFromImageTags(text: string) {
  const rows: string[] = [];
  for (const match of text.matchAll(/\[\[IMAGE_DATA_START\]\]\s*([\s\S]*?)\s*\[\[IMAGE_DATA_END\]\]/g)) {
    const block = match[1] ?? "";
    const tableText = block.match(/Table text:\s*([\s\S]*?)(?:;\s*Description:|$)/i)?.[1];
    if (tableText) rows.push(...tableRowsFromMarkdown(tableText));
  }
  return rows;
}

function classifyStatement(statement: string): { type: DocumentMemoryCardType; score: number } | null {
  let score = 0;
  let type: DocumentMemoryCardType = "citation_anchor";

  if (thresholdTerms.test(statement)) {
    type = "threshold";
    score += 0.3;
  }
  if (medicationTerms.test(statement)) {
    type = type === "citation_anchor" ? "medication" : type;
    score += 0.24;
  }
  if (riskTerms.test(statement)) {
    type = type === "citation_anchor" ? "risk" : type;
    score += 0.2;
  }
  if (workflowTerms.test(statement)) {
    type = type === "citation_anchor" ? "workflow" : type;
    score += 0.16;
  }
  if (highYieldTerms.test(statement)) score += 0.22;
  if (/\d/.test(statement)) score += 0.08;
  if (boilerplateTerms.test(statement)) score -= 0.25;

  return score >= 0.24 ? { type, score: Math.min(0.96, score) } : null;
}

function titleForCard(type: DocumentMemoryCardType, document: MemoryDocument, context: string) {
  const terms = normalizedTerms(context).slice(0, 5).join(" ");
  const prefix =
    type === "table_row"
      ? "Table evidence"
      : type === "threshold"
        ? "Threshold"
        : type === "medication"
          ? "Medication point"
          : type === "risk"
            ? "Risk/escalation point"
            : type === "workflow"
              ? "Workflow step"
              : type === "section_summary"
                ? "Section summary"
                : "Source fact";
  return compactText(`${prefix}: ${terms || document.title}`, 120);
}

function createCard(args: {
  document: MemoryDocument;
  chunk?: MemoryChunk;
  sectionIndex?: number;
  type: DocumentMemoryCardType;
  content: string;
  confidence: number;
  sourceImageIds?: string[];
  metadata?: Record<string, unknown>;
}): BuiltMemoryCard {
  const title = titleForCard(args.type, args.document, `${args.chunk?.section_heading ?? ""} ${args.content}`);
  return {
    document_id: args.document.id,
    owner_id: args.document.owner_id ?? null,
    section_id: null,
    section_index: args.sectionIndex,
    card_type: args.type,
    title,
    content: compactText(args.content, 640),
    normalized_terms: normalizedTerms(`${title} ${args.content}`),
    page_number: args.chunk?.page_number ?? null,
    source_chunk_ids: args.chunk ? [args.chunk.id] : [],
    source_image_ids: args.sourceImageIds ?? [],
    confidence: Math.max(0.35, Math.min(0.99, args.confidence)),
    metadata: {
      rag_indexing_version: ragDeepMemoryVersion,
      generated_by: "local-worker",
      chunk_index: args.chunk?.chunk_index ?? null,
      section_heading: args.chunk?.section_heading ?? null,
      ...args.metadata,
    },
  };
}

function modelItemToCard(args: {
  document: MemoryDocument;
  item: ModelIndexProfileItem;
  type: DocumentMemoryCardType;
  chunkById: Map<string, MemoryChunk>;
  source?: string;
}): BuiltMemoryCard | null {
  const chunk = args.item.source_chunk_ids.map((id) => args.chunkById.get(id)).find(Boolean) ?? undefined;
  if (!chunk && args.item.source_image_ids.length === 0) return null;
  return createCard({
    document: args.document,
    chunk,
    type: args.type,
    content: `${args.item.title}: ${args.item.content}`,
    confidence: args.item.confidence,
    sourceImageIds: args.item.source_image_ids,
    metadata: {
      extraction_source: args.source ?? "model_index_profile",
      model_index_version: modelIndexExtractionVersion,
      source_chunk_ids: args.item.source_chunk_ids,
      source_image_ids: args.item.source_image_ids,
    },
  });
}

function sectionIndexForChunk(sections: SectionInsertRow[], chunkId: string) {
  return sections.find((section) => section.chunk_ids.includes(chunkId))?.section_index;
}

function dedupeCards(cards: BuiltMemoryCard[]) {
  const seen = new Set<string>();
  const deduped: BuiltMemoryCard[] = [];
  for (const card of cards) {
    const key = `${card.card_type}:${normalizeLookup(card.content).slice(0, 260)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(card);
  }
  return deduped;
}

export function buildDocumentMemoryCards(args: {
  document: MemoryDocument;
  chunks: MemoryChunk[];
  images?: MemoryImage[];
  sections?: SectionInsertRow[];
  modelProfile?: ModelIndexProfile | null;
}) {
  const cards: BuiltMemoryCard[] = [];
  const sections = args.sections ?? buildDocumentSections({ document: args.document, chunks: args.chunks });
  const chunkById = new Map(args.chunks.map((chunk) => [chunk.id, chunk]));
  const imagesByPage = new Map<number | null, MemoryImage[]>();
  for (const image of args.images ?? []) {
    imagesByPage.set(image.page_number ?? null, [...(imagesByPage.get(image.page_number ?? null) ?? []), image]);
  }

  for (const section of sections) {
    cards.push(
      createCard({
        document: args.document,
        sectionIndex: section.section_index,
        type: "section_summary",
        content: `${section.heading}: ${section.summary}`,
        confidence: 0.68,
        metadata: { chunk_ids: section.chunk_ids, page_start: section.page_start, page_end: section.page_end },
      }),
    );
  }

  for (const chunk of args.chunks) {
    const sectionIndex = sectionIndexForChunk(sections, chunk.id);
    const pageImages = imagesByPage.get(chunk.page_number) ?? [];
    const sourceImageIds = Array.from(new Set([...(chunk.image_ids ?? []), ...pageImages.map((image) => image.id)]));
    const imageContext = imageTextForCards(pageImages);

    for (const row of [...tableRowsFromMarkdown(chunk.content), ...tableRowsFromImageTags(chunk.content)]) {
      cards.push(
        createCard({
          document: args.document,
          chunk,
          sectionIndex,
          type: "table_row",
          content: row,
          confidence: 0.9,
          sourceImageIds,
          metadata: { extraction_source: "table_row" },
        }),
      );
    }

    for (const statement of splitCandidateStatements(`${chunk.content}\n${imageContext}`)) {
      const classification = classifyStatement(statement);
      if (!classification) continue;
      cards.push(
        createCard({
          document: args.document,
          chunk,
          sectionIndex,
          type: classification.type,
          content: statement,
          confidence: 0.55 + classification.score * 0.42,
          sourceImageIds,
          metadata: { extraction_source: "chunk_statement" },
        }),
      );
    }
  }

  for (const item of args.modelProfile?.askable_questions ?? []) {
    const card = modelItemToCard({
      document: args.document,
      item,
      type: "askable_question",
      chunkById,
      source: "model_askable_question",
    });
    if (card) cards.push(card);
  }
  for (const item of args.modelProfile?.clinical_facts ?? []) {
    const card = modelItemToCard({
      document: args.document,
      item,
      type: classifyStatement(item.content)?.type ?? "citation_anchor",
      chunkById,
      source: "model_clinical_fact",
    });
    if (card) cards.push(card);
  }
  for (const item of args.modelProfile?.table_facts ?? []) {
    const card = modelItemToCard({
      document: args.document,
      item,
      type: "table_row",
      chunkById,
      source: "model_table_fact",
    });
    if (card) cards.push(card);
  }

  if (!cards.some((card) => card.source_chunk_ids.length > 0) && args.chunks.length > 0) {
    const chunk = args.chunks[0];
    cards.push(
      createCard({
        document: args.document,
        chunk,
        sectionIndex: sectionIndexForChunk(sections, chunk.id),
        type: "citation_anchor",
        content: chunk.content,
        confidence: 0.45,
        sourceImageIds: chunk.image_ids ?? [],
        metadata: { extraction_source: "fallback_anchor" },
      }),
    );
  }

  return dedupeCards(cards).sort((a, b) => b.confidence - a.confidence);
}

function embeddingText(card: BuiltMemoryCard) {
  return `${card.title}\n${card.card_type}\n${card.content}\nTerms: ${card.normalized_terms.join(", ")}`;
}

function slugForAnchor(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "section"
  );
}

function derivedChunkAnchor(chunk: MemoryChunk) {
  const page = Number.isFinite(chunk.page_number) ? `p${chunk.page_number}` : "pna";
  const heading = slugForAnchor(chunk.section_heading || chunk.section_path?.join(" ") || "chunk");
  return `${page}-c${chunk.chunk_index}-${heading}`.slice(0, 80);
}

async function repairMissingChunkAnchors(supabase: SupabaseClient, chunks: MemoryChunk[]) {
  const missing = chunks.filter((chunk) => chunk.anchor_id === null);
  let repaired = 0;

  for (let start = 0; start < missing.length; start += 10) {
    const batch = missing.slice(start, start + 10);
    await Promise.all(
      batch.map(async (chunk) => {
        const anchor = derivedChunkAnchor(chunk);
        const { error } = await supabase
          .from("document_chunks")
          .update({
            anchor_id: anchor,
            metadata: {
              ...metadataRecord(chunk.metadata),
              anchor_id: anchor,
              anchor_repaired_by: documentIntelligenceVersion,
            },
          })
          .eq("id", chunk.id)
          .is("anchor_id", null);
        if (error) throw new Error(error.message);
        chunk.anchor_id = anchor;
        chunk.metadata = {
          ...metadataRecord(chunk.metadata),
          anchor_id: anchor,
          anchor_repaired_by: documentIntelligenceVersion,
        };
        repaired += 1;
      }),
    );
  }

  return repaired;
}

async function stampDeepMemoryVersion(args: {
  supabase: SupabaseClient;
  documentId: string;
  sectionCount: number;
  memoryCardCount: number;
  indexUnitCountsByType: Record<string, number>;
  repairedAnchorCount: number;
}) {
  const stampedAt = new Date().toISOString();

  const { data: doc, error: fetchError } = await args.supabase
    .from("documents")
    .select("metadata")
    .eq("id", args.documentId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const docMetadata = metadataRecord(doc?.metadata);
  const { error: docError } = await args.supabase
    .from("documents")
    .update({
      metadata: {
        ...docMetadata,
        rag_indexing_version: ragDeepMemoryVersion,
        rag_memory_version: ragDeepMemoryVersion,
        rag_memory_updated_at: stampedAt,
        document_intelligence_version: documentIntelligenceVersion,
        document_intelligence_updated_at: stampedAt,
        section_count: args.sectionCount,
        memory_card_count: args.memoryCardCount,
        index_unit_count: Object.values(args.indexUnitCountsByType).reduce((sum, count) => sum + count, 0),
        index_unit_counts_by_type: args.indexUnitCountsByType,
        repaired_anchor_count: args.repairedAnchorCount,
      },
    })
    .eq("id", args.documentId);
  if (docError) throw new Error(docError.message);

  const { data: chunks, error: chunksError } = await args.supabase
    .from("document_chunks")
    .select("id,metadata")
    .eq("document_id", args.documentId);
  if (chunksError) throw new Error(chunksError.message);

  const chunksToUpdate = (chunks ?? []).filter((chunk) => {
    const record = metadataRecord(chunk.metadata);
    return record.rag_memory_version !== ragDeepMemoryVersion && record.rag_indexing_version !== ragDeepMemoryVersion;
  });

  if (chunksToUpdate.length > 0) {
    const limit = 5;
    for (let start = 0; start < chunksToUpdate.length; start += limit) {
      const batch = chunksToUpdate.slice(start, start + limit);
      await Promise.all(
        batch.map(async (chunk) => {
          const { error } = await args.supabase
            .from("document_chunks")
            .update({
              metadata: {
                ...metadataRecord(chunk.metadata),
                rag_indexing_version: ragDeepMemoryVersion,
                rag_memory_version: ragDeepMemoryVersion,
                rag_memory_updated_at: stampedAt,
                document_intelligence_version: documentIntelligenceVersion,
              },
            })
            .eq("id", chunk.id);
          if (error) throw new Error(error.message);
        }),
      );
    }
  }
}

export async function upsertDocumentDeepMemory(args: {
  supabase: SupabaseClient;
  document: MemoryDocument;
  chunks: MemoryChunk[];
  images?: MemoryImage[];
  summary?: string | null;
}) {
  if (args.chunks.length === 0) throw new Error("Cannot build deep memory for a document with no chunks.");

  const sections = buildDocumentSections(args);
  let modelProfile: ModelIndexProfile | null = null;
  try {
    modelProfile = await generateModelIndexProfile({
      document: args.document,
      chunks: args.chunks,
      images: args.images ?? [],
    });
  } catch {
    modelProfile = fallbackModelIndexProfile();
  }
  const cards = buildDocumentMemoryCards({ ...args, sections, modelProfile });
  if (cards.length === 0) throw new Error("Deep memory generated no source-backed memory cards.");

  await args.supabase.from("document_memory_cards").delete().eq("document_id", args.document.id);
  await args.supabase.from("document_sections").delete().eq("document_id", args.document.id);
  await args.supabase
    .from("document_index_units")
    .delete()
    .eq("document_id", args.document.id)
    .then(undefined, () => undefined);

  const { data: insertedSections, error: sectionError } = await args.supabase
    .from("document_sections")
    .insert(sections)
    .select("id,section_index");
  if (sectionError) throw new Error(sectionError.message);

  const sectionIds = new Map<string | number, string>();
  for (const section of insertedSections ?? []) {
    sectionIds.set(section.section_index, section.id);
  }

  const embeddings = await embedTexts(cards.map(embeddingText));
  if (embeddings.length !== cards.length) throw new Error("OpenAI returned an unexpected memory-card embedding count.");

  for (let start = 0; start < cards.length; start += 50) {
    const batch = cards.slice(start, start + 50).map((card, index) => {
      const { section_index: sectionIndex, ...row } = card;
      return {
        ...row,
        section_id: sectionIndex === undefined ? null : (sectionIds.get(sectionIndex) ?? null),
        embedding: embeddings[start + index],
      };
    });
    const { error } = await args.supabase.from("document_memory_cards").insert(batch);
    if (error) throw new Error(error.message);
  }

  const indexUnits = buildDocumentIndexUnitInputs({
    document: args.document,
    chunks: args.chunks,
    sections,
    modelProfile,
    summary: args.summary ?? null,
    images: (args.images ?? []).map((image) => {
      const metadata = image.metadata ?? {};
      return {
        id: image.id,
        caption: image.caption,
        pageNumber: image.page_number,
        imageType: image.image_type,
        sourceKind: image.source_kind,
        labels: image.labels,
        tableLabel: typeof metadata.table_label === "string" ? metadata.table_label : null,
        tableTitle: typeof metadata.table_title === "string" ? metadata.table_title : null,
        tableTextSnippet:
          typeof metadata.table_text_snippet === "string"
            ? metadata.table_text_snippet
            : typeof metadata.table_text === "string"
              ? metadata.table_text
              : null,
        tableRole: typeof metadata.table_role === "string" ? metadata.table_role : null,
        accessibleTableMarkdown:
          typeof metadata.accessible_table_markdown === "string" ? metadata.accessible_table_markdown : null,
        tableRows: Array.isArray(metadata.table_rows) ? (metadata.table_rows as string[][]) : null,
        tableColumns: Array.isArray(metadata.table_columns) ? (metadata.table_columns as string[]) : null,
        structuredVisualProfile:
          typeof metadata.structured_visual_profile === "object" && metadata.structured_visual_profile !== null
            ? (metadata.structured_visual_profile as never)
            : null,
        metadata,
      };
    }),
  });
  if (indexUnits.length > 0) {
    const indexUnitEmbeddings = await embedTexts(indexUnits.map(embeddingTextForDocumentIndexUnit));
    for (let start = 0; start < indexUnits.length; start += 50) {
      const batch = indexUnits.slice(start, start + 50).map((unit, index) => ({
        ...unit,
        embedding: indexUnitEmbeddings[start + index],
      }));
      const { error } = await args.supabase.from("document_index_units").insert(batch);
      if (error) throw new Error(error.message);
    }
  }

  if (modelProfile?.aliases.length) {
    const aliases = modelProfile.aliases
      .filter((alias) => alias.confidence >= 0.65)
      .map((alias) => ({
        owner_id: args.document.owner_id ?? null,
        alias: alias.alias,
        canonical: alias.canonical,
        alias_type: alias.alias_type,
        weight: Math.max(0.5, Math.min(1.5, alias.confidence + 0.25)),
        enabled: true,
        metadata: {
          source: "model_index_profile",
          document_id: args.document.id,
          source_chunk_ids: alias.source_chunk_ids,
          model_index_version: modelIndexExtractionVersion,
        },
      }));
    if (aliases.length) {
      await args.supabase
        .from("rag_aliases")
        .insert(aliases)
        .then(undefined, () => undefined);
    }
  }

  const repairedAnchorCount = await repairMissingChunkAnchors(args.supabase, args.chunks);
  await stampDeepMemoryVersion({
    supabase: args.supabase,
    documentId: args.document.id,
    sectionCount: sections.length,
    memoryCardCount: cards.length,
    indexUnitCountsByType: countDocumentIndexUnitsByType(indexUnits),
    repairedAnchorCount,
  });
  return { sections, memoryCards: cards, indexUnits, modelProfile };
}

function scoreMemoryCardForQuery(
  query: string,
  card: Pick<DocumentMemoryCard, "title" | "content" | "normalized_terms" | "card_type" | "confidence">,
) {
  const queryTokens = normalizedTerms(query);
  if (queryTokens.length === 0) return 0;
  const termSet = new Set(card.normalized_terms ?? []);
  const content = normalizeLookup(`${card.title} ${card.content}`);
  const hits = queryTokens.filter((token) => termSet.has(token) || content.includes(token)).length;
  const coverage = hits / queryTokens.length;
  const queryClass = classifyRagQuery(query).queryClass;
  const classBoost =
    queryClass === "table_threshold" && ["table_row", "threshold"].includes(card.card_type)
      ? 0.18
      : queryClass === "medication_dose_risk" && ["medication", "threshold", "risk"].includes(card.card_type)
        ? 0.14
        : queryClass === "document_lookup" && card.card_type === "section_summary"
          ? 0.08
          : queryClass === "broad_summary" && card.card_type === "section_summary"
            ? 0.08
            : 0;
  return Math.min(1, coverage * 0.62 + (card.confidence ?? 0.5) * 0.2 + classBoost);
}

function memoryCardRetrievalScore(card: DocumentMemoryCard) {
  const hybridScore = Number(card.metadata?.memory_hybrid_score);
  if (Number.isFinite(hybridScore) && hybridScore > 0) return Math.min(1, hybridScore);
  return Math.min(1, card.confidence ?? 0.5);
}

export async function fetchMemoryCardsForQuery(args: {
  supabase: SupabaseClient;
  query: string;
  queryEmbedding?: number[];
  ownerId?: string;
  documentIds?: string[];
  matchCount?: number;
}) {
  try {
    if (args.queryEmbedding?.length) {
      const { data, error } = await args.supabase.rpc("match_document_memory_cards_hybrid", {
        query_embedding: args.queryEmbedding,
        query_text: buildClinicalTextSearchQuery(args.query),
        match_count: args.matchCount ?? 32,
        min_similarity: 0.1,
        document_filters: args.documentIds?.length ? args.documentIds : null,
        owner_filter: args.ownerId ?? null,
      });

      if (!error && data?.length) {
        return (
          (data ?? []) as Array<
            DocumentMemoryCard & {
              similarity?: number;
              text_rank?: number;
              hybrid_score?: number;
              rrf_score?: number;
            }
          >
        )
          .map((card) => ({
            ...card,
            confidence: Number(card.confidence ?? 0.5),
            metadata: {
              ...(card.metadata ?? {}),
              memory_similarity: card.similarity,
              memory_text_rank: card.text_rank,
              memory_hybrid_score: card.hybrid_score,
              memory_rrf_score: card.rrf_score,
            },
          }))
          .slice(0, args.matchCount ?? 32);
      }
    }

    let queryBuilder = args.supabase
      .from("document_memory_cards")
      .select(
        "id,document_id,owner_id,section_id,card_type,title,content,normalized_terms,page_number,source_chunk_ids,source_image_ids,confidence,metadata",
      )
      .textSearch("search_tsv", buildClinicalTextSearchQuery(args.query), { type: "websearch", config: "english" })
      .order("confidence", { ascending: false })
      .limit(args.matchCount ?? 32);

    if (args.ownerId) queryBuilder = queryBuilder.eq("owner_id", args.ownerId);
    if (args.documentIds?.length) queryBuilder = queryBuilder.in("document_id", args.documentIds);

    const { data, error } = await queryBuilder;
    if (error) return [];

    return ((data ?? []) as DocumentMemoryCard[])
      .map((card) => ({ ...card, confidence: Number(card.confidence ?? 0.5) }))
      .sort((a, b) => scoreMemoryCardForQuery(args.query, b) - scoreMemoryCardForQuery(args.query, a))
      .slice(0, args.matchCount ?? 32);
  } catch {
    return [];
  }
}

export function applyMemoryCardBoosts(query: string, results: SearchResult[], cards: DocumentMemoryCard[]) {
  if (results.length === 0 || cards.length === 0) return results;
  const cardsByChunk = new Map<string, DocumentMemoryCard[]>();
  for (const card of cards) {
    for (const chunkId of card.source_chunk_ids ?? []) {
      cardsByChunk.set(chunkId, [...(cardsByChunk.get(chunkId) ?? []), card]);
    }
  }

  return results.map((result) => {
    const relatedCards = cardsByChunk.get(result.id) ?? [];
    if (relatedCards.length === 0) return result;
    const memoryScore = Math.max(
      ...relatedCards.map((card) => Math.max(scoreMemoryCardForQuery(query, card), memoryCardRetrievalScore(card))),
    );
    const base = result.hybrid_score ?? result.similarity;
    return {
      ...result,
      hybrid_score: Math.min(0.99, base + Math.min(0.24, memoryScore * 0.24)),
      memory_score: Number(memoryScore.toFixed(4)),
      memory_cards: relatedCards
        .sort(
          (a, b) =>
            Math.max(scoreMemoryCardForQuery(query, b), memoryCardRetrievalScore(b)) -
            Math.max(scoreMemoryCardForQuery(query, a), memoryCardRetrievalScore(a)),
        )
        .slice(0, 4),
    };
  });
}
