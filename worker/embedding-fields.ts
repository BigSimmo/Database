import type { TableFactChunkRow, TableFactImageRow, TableFactInsert } from "./table-facts";

type EmbeddingFieldJob = {
  document_id: string;
  documents: {
    owner_id: string | null;
    title: string;
    file_name: string;
  };
};

export type EmbeddingFieldInput = {
  document_id: string;
  owner_id: string | null;
  source_chunk_id: string;
  field_type: "chunk_high_yield" | "table_row" | "image_caption" | "clinical_action" | "threshold_fact";
  content: string;
  metadata: Record<string, unknown>;
};

const highYieldPattern =
  /\b(?:dose|dosing|dosage|mg|mcg|mmol|threshold|withhold|cease|stop|monitor|fbc|anc|risk|urgent|escalat|review|repeat|baseline|titrate|contraindicat|toxicity|required|criteria|management|action|intervention)\b/i;
const actionPattern =
  /\b(?:withhold|cease|stop|escalat|urgent|review|repeat|monitor|commence|increase|decrease|reduce|avoid|refer|document|required|must|should)\b/i;
const thresholdPattern =
  /\b(?:threshold|cut[\s-]?off|level|range|score|scale|criteria|criterion|maximum|minimum|baseline|anc|fbc|neutrophil|\d+(?:\.\d+)?\s*(?:mg|mcg|mmol|x\s*10\^?9\/l|%))\b/i;
const clinicalImageTypes = new Set([
  "clinical_table",
  "flowchart_algorithm",
  "form_checklist",
  "risk_matrix",
  "medication_chart",
  "graph",
]);

function compactSearchText(value: unknown, limit = 900) {
  const compact = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact) return "";
  return compact.length > limit ? compact.slice(0, limit).trim() : compact;
}

function sectionPathForChunk(chunk: TableFactChunkRow) {
  return chunk.section_path?.length
    ? chunk.section_path.join(" > ")
    : Array.isArray(chunk.metadata?.subsection_path)
      ? (chunk.metadata.subsection_path as unknown[]).map(String).join(" > ")
      : "";
}

function chunkContext(job: EmbeddingFieldJob, chunk: TableFactChunkRow, contentLimit = 950) {
  return compactSearchText(
    [
      job.documents.title,
      job.documents.file_name,
      sectionPathForChunk(chunk),
      chunk.section_heading,
      compactSearchText(chunk.content, contentLimit),
    ]
      .filter(Boolean)
      .join(" | "),
    1300,
  );
}

function extractClinicalSentences(text: unknown, pattern: RegExp, limit = 2) {
  const sentences = String(text ?? "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => compactSearchText(sentence, 360))
    .filter((sentence) => sentence && pattern.test(sentence));
  return sentences.slice(0, limit).join(" ");
}

function sourceChunkForImage(image: TableFactImageRow, chunks: TableFactChunkRow[]) {
  const linked = chunks.find((chunk) => (chunk.image_ids ?? []).includes(image.id));
  if (linked) return linked;
  return chunks.find((chunk) => image.pageNumber !== null && chunk.page_number === image.pageNumber) ?? null;
}

function usefulImageCaption(image: TableFactImageRow) {
  if (image.tableRole === "admin") return "";
  const clinical =
    clinicalImageTypes.has(String(image.imageType ?? "")) ||
    image.sourceKind === "table_crop" ||
    Boolean(image.tableTitle || image.tableLabel || image.tableTextSnippet);
  if (!clinical) return "";
  return compactSearchText(
    [
      image.tableTitle,
      image.tableLabel,
      image.caption,
      image.tableTextSnippet ? `Table text: ${image.tableTextSnippet}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    900,
  );
}

function tableFactText(fact: TableFactInsert) {
  return compactSearchText(
    [fact.table_title, fact.row_label, fact.clinical_parameter, fact.threshold_value, fact.action]
      .filter(Boolean)
      .join(" | "),
    900,
  );
}

export function buildAdditionalEmbeddingFieldInputs(args: {
  job: EmbeddingFieldJob;
  chunkRows: TableFactChunkRow[];
  insertedImages: TableFactImageRow[];
  tableFacts: TableFactInsert[];
}) {
  const fields: EmbeddingFieldInput[] = [];
  const seenContent = new Set<string>();
  const extraCountByChunk = new Map<string, number>();
  const tableRowCountByChunk = new Map<string, number>();
  const maxExtraFieldsPerChunk = 8;
  const maxTableRowsPerChunk = 3;

  const addField = (
    chunk: TableFactChunkRow | null,
    field_type: EmbeddingFieldInput["field_type"],
    content: string,
    metadata: Record<string, unknown>,
  ) => {
    if (!chunk?.id) return;
    const compact = compactSearchText(content, 1300);
    if (!compact) return;
    const key = compact.toLowerCase();
    if (seenContent.has(key)) return;
    const chunkCount = extraCountByChunk.get(chunk.id) ?? 0;
    if (chunkCount >= maxExtraFieldsPerChunk) return;
    seenContent.add(key);
    extraCountByChunk.set(chunk.id, chunkCount + 1);
    fields.push({
      owner_id: args.job.documents.owner_id,
      document_id: args.job.document_id,
      source_chunk_id: chunk.id,
      field_type,
      content: compact,
      metadata,
    });
  };

  for (const chunk of args.chunkRows) {
    const text = `${chunk.section_heading ?? ""} ${chunk.content ?? ""}`;
    if (!highYieldPattern.test(text)) continue;

    addField(chunk, "chunk_high_yield", `High-yield clinical context: ${chunkContext(args.job, chunk)}`, {
      source: "chunk_high_yield",
      chunk_index: chunk.chunk_index ?? null,
      page_number: chunk.page_number,
    });

    const actionText = extractClinicalSentences(chunk.content, actionPattern);
    if (actionText) {
      addField(chunk, "clinical_action", `Clinical action: ${chunkContext(args.job, { ...chunk, content: actionText }, 650)}`, {
        source: "chunk_action_sentence",
        page_number: chunk.page_number,
      });
    }

    const thresholdText = extractClinicalSentences(chunk.content, thresholdPattern);
    if (thresholdText) {
      addField(chunk, "threshold_fact", `Threshold fact: ${chunkContext(args.job, { ...chunk, content: thresholdText }, 650)}`, {
        source: "chunk_threshold_sentence",
        page_number: chunk.page_number,
      });
    }
  }

  const chunkById = new Map(args.chunkRows.map((chunk) => [chunk.id, chunk]));
  for (const fact of args.tableFacts) {
    if (!fact.source_chunk_id) continue;
    const chunk = chunkById.get(fact.source_chunk_id) ?? null;
    const currentTableRows = tableRowCountByChunk.get(fact.source_chunk_id) ?? 0;
    if (currentTableRows >= maxTableRowsPerChunk) continue;
    const content = tableFactText(fact);
    addField(chunk, "table_row", `Table row: ${content}`, {
      source: "document_table_facts",
      source_image_id: fact.source_image_id,
      table_title: fact.table_title,
      page_number: fact.page_number,
    });
    tableRowCountByChunk.set(fact.source_chunk_id, currentTableRows + 1);

    if (fact.threshold_value) {
      addField(chunk, "threshold_fact", `Threshold fact: ${content}`, {
        source: "document_table_facts",
        source_image_id: fact.source_image_id,
        table_title: fact.table_title,
      });
    }
    if (fact.action) {
      addField(chunk, "clinical_action", `Clinical action: ${content}`, {
        source: "document_table_facts",
        source_image_id: fact.source_image_id,
        table_title: fact.table_title,
      });
    }
  }

  for (const image of args.insertedImages) {
    const content = usefulImageCaption(image);
    if (!content) continue;
    addField(sourceChunkForImage(image, args.chunkRows), "image_caption", `Image/table caption: ${content}`, {
      source: "document_image",
      source_image_id: image.id,
      page_number: image.pageNumber,
      image_type: image.imageType ?? null,
      source_kind: image.sourceKind ?? null,
    });
  }

  return fields;
}
