import type { PublicAnswerProgressEvent } from "@/lib/answer-progress-public";
import {
  isClientCitation,
  isClientSearchResult,
  type ClientCitation,
  type ClientSearchResult,
} from "@/lib/answer-client-payload";
import { clientAnswerSectionSchema } from "@/lib/answer-client-fields";
import { adaptiveAnswerLimits, answerWithinLimits } from "@/lib/rag/rag-answer-contract-limits";
import type { AnswerSection } from "@/lib/types";
import type { ApiStreamErrorPayload } from "@/lib/api-error-payload";

// #100 incremental verified delivery (docs/verified-answer-incremental-delivery-design.md).
// A verified unit is an append-only preview of content that is byte-identical to a subset
// of the authoritative `final` payload. No new SSE event name is introduced: units ride the
// existing `progress` event as an optional field that old clients ignore.
export type VerifiedEvidencePreviewUnit = {
  schemaVersion: 1;
  kind: "evidence_preview";
  sequence: 0;
  /** Client-trimmed sources — the exact trimSourceForClient output used by `final`. */
  sources: ClientSearchResult[];
  selectedContextCount: number;
};

export type VerifiedAnswerSectionUnit = {
  schemaVersion: 1;
  kind: "answer_section";
  sequence: number;
  section: AnswerSection;
  citations: ClientCitation[];
  supportLevel: string;
};

export type VerifiedUnit = VerifiedEvidencePreviewUnit | VerifiedAnswerSectionUnit;

// A unit is a bounded preview, never a transport for full documents. This cap is a ceiling
// the builder must fit under, not a size it can assume: a real trimmed source is ~7,000 JSON
// characters (the ≤900-char snippet is carried twice, plus scoring, labels, indexing quality
// and relevance), so twelve of them overrun it. `answer-preview.ts` shrinks the unit to fit
// this exact check before emitting; the check here is the boundary's own last line.
const verifiedUnitMaxJsonChars = 64_000;
const evidencePreviewMaxSources = 12;
const verifiedUnitKinds = new Set(["evidence_preview", "answer_section"]);
const answerSectionSupportLevels = new Set(["direct", "partial", "nearby", "unsupported"]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(record: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(record).every((key) => allowedKeys.has(key));
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isAnswerSection(value: unknown): value is AnswerSection {
  if (!isPlainRecord(value)) return false;
  if (!hasOnlyKeys(value, new Set(["heading", "body", "citation_chunk_ids", "kind", "supportLevel"]))) return false;
  const parsed = clientAnswerSectionSchema.safeParse(value);
  return parsed.success && answerWithinLimits({ answer: "", answerSections: [parsed.data] }, adaptiveAnswerLimits, 1);
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
    if (!value.sources.every(isClientSearchResult)) return false;
    if (!isInteger(value.selectedContextCount) || value.selectedContextCount < value.sources.length) {
      return false;
    }
  } else {
    if (!hasOnlyKeys(value, new Set(["schemaVersion", "kind", "sequence", "section", "citations", "supportLevel"]))) {
      return false;
    }
    if (
      !isAnswerSection(value.section) ||
      !Array.isArray(value.citations) ||
      !value.citations.every(isClientCitation)
    ) {
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
  error: ApiStreamErrorPayload;
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
