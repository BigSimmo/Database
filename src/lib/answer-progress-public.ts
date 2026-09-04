import { isDeliverableVerifiedUnit, type VerifiedUnit } from "@/lib/answer-stream-contract";
import {
  evidencePreviewReasons,
  recordEvidencePreviewContractRejection,
  type EvidencePreviewReason,
} from "@/lib/answer-preview";

export type PublicAnswerProgressStage =
  | "scoping"
  | "retrieving"
  | "retrieved"
  | "ranking"
  | "generating"
  | "retrying"
  | "fallback"
  | "verifying"
  | "cached"
  | "complete";

export type PublicAnswerProgressEvent = {
  stage: PublicAnswerProgressStage;
  message: string;
  resultCount?: number;
  selectedContextCount?: number;
  australianSourceCount?: number;
  waSourceCount?: number;
  elapsedMs?: number;
  /** #100: optional verified unit (already governed + client-trimmed server-side).
   * Old clients ignore it; it only crosses the boundary when it validates. */
  verifiedUnit?: VerifiedUnit;
  /** Why the wait did or did not show sources. An enum, never a message: it names a
   *  decision and carries no query, document, owner or clinical text. */
  previewReason?: EvidencePreviewReason;
};

function isEvidencePreviewReason(value: unknown): value is EvidencePreviewReason {
  return typeof value === "string" && (evidencePreviewReasons as readonly string[]).includes(value);
}

function safeProgressNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined;
}

/** Convert internal RAG progress into the minimal, stable DTO allowed at the browser boundary. */
export function toPublicAnswerProgressEvent(
  event: unknown,
  lastVerifiedUnitSequence: number | null = null,
): PublicAnswerProgressEvent | null {
  if (!event || typeof event !== "object") return null;
  const value = event as Record<string, unknown>;
  const resultCount = safeProgressNumber(value.resultCount);
  const selectedContextCount = safeProgressNumber(value.selectedContextCount);
  const australianSourceCount = safeProgressNumber(value.australianSourceCount);
  const waSourceCount = safeProgressNumber(value.waSourceCount);
  const elapsedMs = safeProgressNumber(value.elapsedMs);

  let stage: PublicAnswerProgressStage;
  let message: string;
  switch (value.stage) {
    case "scoping":
      stage = "scoping";
      message = "Preparing the clinical search scope.";
      break;
    case "retrieving":
      stage = "retrieving";
      message = "Searching indexed clinical documents.";
      break;
    case "retrieved":
      stage = "retrieved";
      message =
        resultCount === undefined
          ? "Source passages found."
          : `Found ${resultCount} candidate source passage${resultCount === 1 ? "" : "s"}.`;
      break;
    case "ranking":
    case "routing":
      stage = "ranking";
      message = "Selecting the most relevant source passages.";
      break;
    case "generating":
      stage = "generating";
      message = "Drafting a cited answer from the selected passages.";
      break;
    case "retrying":
      stage = "retrying";
      message = "The draft needs another pass; revising it against the evidence.";
      break;
    case "fallback":
      stage = "fallback";
      message = "Building a source-backed answer from the selected passages.";
      break;
    case "verifying":
    case "finalizing":
      stage = "verifying";
      message = "Checking citations, clinical numbers, and source metadata.";
      break;
    case "cached":
      stage = "cached";
      message = "Loading a recent cited answer.";
      break;
    case "complete":
      stage = "complete";
      message = "Answer ready.";
      break;
    default:
      return null;
  }

  // The verified unit crosses the boundary only when it passes the stream contract's
  // structural validation; a malformed or oversized unit is dropped, never repaired.
  const verifiedUnit = isDeliverableVerifiedUnit(value.verifiedUnit, lastVerifiedUnitSequence)
    ? value.verifiedUnit
    : undefined;
  // A unit the server built and this boundary then threw away is the one preview failure with
  // no upstream explanation: `previewReason` still reads "ok" because the builder succeeded.
  // Overwrite it, so a source that fails `isClientSource` can no longer take the whole rail
  // down without leaving a trace. `value.verifiedUnit !== undefined` rather than a truthiness
  // check, so a deliberate absence is not misreported as a rejection.
  const rejectedUnit = value.verifiedUnit !== undefined && verifiedUnit === undefined;
  if (rejectedUnit) recordEvidencePreviewContractRejection();
  const previewReason = rejectedUnit
    ? "contract_rejected"
    : isEvidencePreviewReason(value.previewReason)
      ? value.previewReason
      : undefined;

  return {
    stage,
    message,
    ...(verifiedUnit === undefined ? {} : { verifiedUnit }),
    ...(previewReason === undefined ? {} : { previewReason }),
    ...(resultCount === undefined ? {} : { resultCount }),
    ...(selectedContextCount === undefined ? {} : { selectedContextCount }),
    ...(australianSourceCount === undefined ? {} : { australianSourceCount }),
    ...(waSourceCount === undefined ? {} : { waSourceCount }),
    ...(elapsedMs === undefined ? {} : { elapsedMs }),
  };
}
