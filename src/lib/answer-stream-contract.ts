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
const verifiedUnitKinds = new Set(["evidence_preview", "answer_section"]);

/** Validate a candidate verified unit at the stream boundary. `lastSequence` is the
 * previously accepted sequence in this response (null before the first unit); sequences
 * must be strictly increasing within one response and never carry across attempts.
 * Anything token-/revising-shaped, unknown, unsized, or out of order is rejected. */
export function isDeliverableVerifiedUnit(value: unknown, lastSequence: number | null = null): value is VerifiedUnit {
  if (!value || typeof value !== "object") return false;
  const unit = value as Record<string, unknown>;
  if (unit.schemaVersion !== 1) return false;
  if (typeof unit.kind !== "string" || !verifiedUnitKinds.has(unit.kind)) return false;
  if (typeof unit.sequence !== "number" || !Number.isInteger(unit.sequence) || unit.sequence < 0) return false;
  if (lastSequence !== null && unit.sequence <= lastSequence) return false;
  if (unit.kind === "evidence_preview") {
    if (unit.sequence !== 0) return false;
    if (!Array.isArray(unit.sources)) return false;
    if (typeof unit.selectedContextCount !== "number") return false;
  } else if (!unit.section || typeof unit.section !== "object" || !Array.isArray(unit.citations)) {
    return false;
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
