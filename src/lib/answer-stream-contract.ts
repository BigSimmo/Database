import type { PublicAnswerProgressEvent } from "@/lib/answer-progress-public";
import type { AnswerSection, Citation, SearchResult } from "@/lib/types";

// #100 incremental verified delivery (docs/verified-answer-incremental-delivery-design.md).
// A verified unit is an append-only preview of content that is byte-identical to a subset
// of the authoritative `final` payload. No new SSE event name is introduced: units ride the
// existing `progress` event as an optional field that old clients ignore.
export type VerifiedEvidencePreviewUnit = {
  schemaVersion: 1;
  kind: "evidence_preview";
  sequence: 0;
  /** Client-trimmed sources — the exact trimSourceForClient output used by `final`. */
  sources: SearchResult[];
  selectedContextCount: number;
};

export type VerifiedAnswerSectionUnit = {
  schemaVersion: 1;
  kind: "answer_section";
  sequence: number;
  section: AnswerSection;
  citations: Citation[];
  supportLevel: string;
};

export type VerifiedUnit = VerifiedEvidencePreviewUnit | VerifiedAnswerSectionUnit;

// A unit is a bounded preview, never a transport for full documents. Sized to the
// client-source snippet policy (≤900 chars/source, ≤12 sources) with headroom.
const verifiedUnitMaxJsonChars = 64_000;
const evidencePreviewMaxSources = 12;
const clientSourceSnippetMaxChars = 900;
const verifiedUnitKinds = new Set(["evidence_preview", "answer_section"]);
const answerSectionKinds = new Set([
  "bottom_line",
  "required_actions",
  "monitoring_timing",
  "medication_dose",
  "thresholds",
  "escalation_risk",
  "contraindications_cautions",
  "comparison",
  "documentation",
  "source_gap",
  "visual_evidence",
  "quotes",
  "verification",
]);
const answerSectionSupportLevels = new Set(["direct", "partial", "nearby", "unsupported"]);
// Mirrors the `similarity_origin` union in `types.ts`. Kept as an allow-set rather than a
// chain of `!==` comparisons so adding a provenance value there cannot silently leave the
// streamed preview rejecting a payload the `final` response accepts.
const similarityOriginValues = new Set(["cosine", "synthetic_text", "document_context"]);
const citationProvenanceValues = new Set([
  "model_selected",
  "section_selected",
  "exact_quote",
  "deterministic_support",
  "review_only",
  "retrieval_only",
]);
const clientSourceKeys = new Set([
  "id",
  "document_id",
  "title",
  "file_name",
  "page_number",
  "chunk_index",
  "section_heading",
  "section_path",
  "heading_level",
  "parent_heading",
  "anchor_id",
  "content",
  "retrieval_synopsis",
  "image_ids",
  "similarity",
  "similarity_origin",
  "text_rank",
  "hybrid_score",
  "lexical_score",
  "rrf_score",
  "score_explanation",
  "source_strength",
  "source_metadata",
  "document_labels",
  "memory_score",
  "relevance",
  "match_explanation",
  "indexing_quality",
  "images",
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(record: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(record).every((key) => allowedKeys.has(key));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isJsonValue(value: unknown, depth = 0): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (isFiniteNumber(value)) return true;
  if (depth >= 8) return false;
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1));
  if (!isPlainRecord(value)) return false;
  return Object.values(value).every((item) => item === undefined || isJsonValue(item, depth + 1));
}

function isOptionalFiniteNumber(record: Record<string, unknown>, key: string): boolean {
  return !(key in record) || record[key] === undefined || isFiniteNumber(record[key]);
}

function isOptionalNullableString(record: Record<string, unknown>, key: string): boolean {
  return !(key in record) || record[key] === undefined || isNullableString(record[key]);
}

function isClientSource(value: unknown): value is SearchResult {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, clientSourceKeys)) return false;
  if (
    typeof value.id !== "string" ||
    typeof value.document_id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.file_name !== "string" ||
    !(value.page_number === null || isInteger(value.page_number)) ||
    !isInteger(value.chunk_index) ||
    !isNullableString(value.section_heading) ||
    typeof value.content !== "string" ||
    value.content.length > clientSourceSnippetMaxChars ||
    !isStringArray(value.image_ids) ||
    !isFiniteNumber(value.similarity) ||
    !Array.isArray(value.images) ||
    value.images.length !== 0
  ) {
    return false;
  }
  if ("section_path" in value && value.section_path !== undefined && !isStringArray(value.section_path)) return false;
  if (
    "heading_level" in value &&
    value.heading_level !== undefined &&
    !(value.heading_level === null || isInteger(value.heading_level))
  ) {
    return false;
  }
  if (!isOptionalNullableString(value, "parent_heading") || !isOptionalNullableString(value, "anchor_id")) return false;
  if ("retrieval_synopsis" in value && value.retrieval_synopsis !== undefined) {
    if (!isNullableString(value.retrieval_synopsis)) return false;
    if (value.retrieval_synopsis !== null && value.retrieval_synopsis !== value.content) return false;
  }
  if (
    "similarity_origin" in value &&
    value.similarity_origin !== undefined &&
    !similarityOriginValues.has(value.similarity_origin as string)
  ) {
    return false;
  }
  for (const key of ["text_rank", "hybrid_score", "rrf_score", "memory_score"] as const) {
    if (!isOptionalFiniteNumber(value, key)) return false;
  }
  if (
    "lexical_score" in value &&
    value.lexical_score !== undefined &&
    !(value.lexical_score === null || isFiniteNumber(value.lexical_score))
  ) {
    return false;
  }
  if (
    "source_strength" in value &&
    value.source_strength !== undefined &&
    !["strong", "moderate", "limited"].includes(String(value.source_strength))
  ) {
    return false;
  }
  for (const key of [
    "score_explanation",
    "source_metadata",
    "document_labels",
    "relevance",
    "match_explanation",
    "indexing_quality",
  ] as const) {
    if (key in value && value[key] !== undefined && !isJsonValue(value[key])) return false;
  }
  return true;
}

function isAnswerSection(value: unknown): value is AnswerSection {
  if (
    !isPlainRecord(value) ||
    !hasOnlyKeys(value, new Set(["heading", "body", "citation_chunk_ids", "kind", "supportLevel"]))
  ) {
    return false;
  }
  if (typeof value.heading !== "string" || typeof value.body !== "string" || !isStringArray(value.citation_chunk_ids)) {
    return false;
  }
  if (
    "kind" in value &&
    value.kind !== undefined &&
    (typeof value.kind !== "string" || !answerSectionKinds.has(value.kind))
  ) {
    return false;
  }
  if (
    "supportLevel" in value &&
    value.supportLevel !== undefined &&
    (typeof value.supportLevel !== "string" || !answerSectionSupportLevels.has(value.supportLevel))
  ) {
    return false;
  }
  return true;
}

function isCitation(value: unknown): value is Citation {
  if (
    !isPlainRecord(value) ||
    !hasOnlyKeys(
      value,
      new Set([
        "chunk_id",
        "document_id",
        "title",
        "file_name",
        "page_number",
        "chunk_index",
        "similarity",
        "source_metadata",
        "provenance",
      ]),
    )
  ) {
    return false;
  }
  if (
    typeof value.chunk_id !== "string" ||
    typeof value.document_id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.file_name !== "string" ||
    !(value.page_number === null || isInteger(value.page_number)) ||
    !isInteger(value.chunk_index)
  ) {
    return false;
  }
  if (!isOptionalFiniteNumber(value, "similarity")) return false;
  if (
    "source_metadata" in value &&
    value.source_metadata !== undefined &&
    !(value.source_metadata === null || isJsonValue(value.source_metadata))
  ) {
    return false;
  }
  if (
    "provenance" in value &&
    value.provenance !== undefined &&
    (typeof value.provenance !== "string" || !citationProvenanceValues.has(value.provenance))
  ) {
    return false;
  }
  return true;
}

/** Validate a candidate verified unit at the stream boundary. `lastSequence` is the
 * previously accepted sequence in this response (null before the first unit); sequences
 * must be strictly increasing within one response and never carry across attempts.
 * Anything token-/revising-shaped, unknown, unsized, or out of order is rejected. */
export function isDeliverableVerifiedUnit(value: unknown, lastSequence: number | null = null): value is VerifiedUnit {
  if (!isPlainRecord(value)) return false;
  if (value.schemaVersion !== 1) return false;
  if (typeof value.kind !== "string" || !verifiedUnitKinds.has(value.kind)) return false;
  if (!isInteger(value.sequence) || value.sequence < 0) return false;
  if (lastSequence !== null && value.sequence <= lastSequence) return false;
  if (value.kind === "evidence_preview") {
    if (!hasOnlyKeys(value, new Set(["schemaVersion", "kind", "sequence", "sources", "selectedContextCount"]))) {
      return false;
    }
    if (value.sequence !== 0) return false;
    if (
      !Array.isArray(value.sources) ||
      value.sources.length === 0 ||
      value.sources.length > evidencePreviewMaxSources
    ) {
      return false;
    }
    if (!value.sources.every(isClientSource)) return false;
    if (!isInteger(value.selectedContextCount) || value.selectedContextCount < value.sources.length) {
      return false;
    }
  } else {
    if (!hasOnlyKeys(value, new Set(["schemaVersion", "kind", "sequence", "section", "citations", "supportLevel"]))) {
      return false;
    }
    if (!isAnswerSection(value.section) || !Array.isArray(value.citations) || !value.citations.every(isCitation)) {
      return false;
    }
    if (typeof value.supportLevel !== "string" || !answerSectionSupportLevels.has(value.supportLevel)) return false;
    if (value.section.supportLevel !== undefined && value.section.supportLevel !== value.supportLevel) return false;
  }
  try {
    return JSON.stringify(value).length <= verifiedUnitMaxJsonChars;
  } catch {
    return false;
  }
}

export type AnswerStreamEventMap = {
  progress: PublicAnswerProgressEvent;
  final: unknown;
  error: {
    error: string;
    status?: number;
    details?: { code?: string; message?: string };
  };
};

export type AnswerStreamEventName = keyof AnswerStreamEventMap;
export type AnswerStreamEvent = {
  [Name in AnswerStreamEventName]: { event: Name; data: AnswerStreamEventMap[Name] };
}[AnswerStreamEventName];

// Deliberately excludes the legacy `token` and `revising` event names. A new
// client can be routed to an older server during a rolling deployment, so
// accepting those events would re-expose unvalidated clinical prose.
const answerStreamEventNames = new Set<AnswerStreamEventName>(["progress", "final", "error"]);

export function isAnswerStreamEventName(value: string): value is AnswerStreamEventName {
  return answerStreamEventNames.has(value as AnswerStreamEventName);
}
