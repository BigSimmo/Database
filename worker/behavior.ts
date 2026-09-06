import { isPartialIndexWriteConflict, isRetryableIngestionError, nextRetryAt } from "../src/lib/ingestion";

export type IngestionFailureDecision = {
  retry: boolean;
  documentStatus: "queued" | "failed" | "indexed";
  stage: string;
  errorMessage: string;
  nextRunAt?: string;
};

export function ingestionFailureDecision(args: {
  error: unknown;
  attemptCount: number;
  maxAttempts: number;
  atomicReindex: boolean;
}): IngestionFailureDecision {
  const errorMessage = args.error instanceof Error ? args.error.message : String(args.error);
  const preservedStatus = args.atomicReindex ? "indexed" : "failed";

  if (isPartialIndexWriteConflict(args.error)) {
    return {
      retry: false,
      documentStatus: preservedStatus,
      stage: "needs recovery after partial index write",
      errorMessage: `${errorMessage}. Run npm run recover:ingestion -- --apply before retrying this document.`,
    };
  }

  if (isRetryableIngestionError(args.error) && args.attemptCount < args.maxAttempts) {
    return {
      retry: true,
      documentStatus: args.atomicReindex ? "indexed" : "queued",
      stage: `retry scheduled after attempt ${args.attemptCount}/${args.maxAttempts}`,
      errorMessage,
      nextRunAt: nextRetryAt(args.attemptCount),
    };
  }

  return {
    retry: false,
    documentStatus: preservedStatus,
    stage: "failed",
    errorMessage,
  };
}

export function enrichmentRepairDecision(args: {
  enrichmentStatus: string;
  enrichmentErrorMessage: string | null;
  optionalIssueCount: number;
}) {
  const optionalRepairRequired = args.optionalIssueCount > 0;
  const optionalRepairMessage = "Optional index artifact writes failed; queued for indexing-v3-agent repair.";
  const enrichmentStatus =
    optionalRepairRequired && args.enrichmentStatus === "completed" ? "pending" : args.enrichmentStatus;
  const enrichmentErrorMessage =
    optionalRepairRequired && args.enrichmentStatus === "completed"
      ? optionalRepairMessage
      : args.enrichmentErrorMessage;
  const repairRequired = enrichmentStatus !== "completed" || optionalRepairRequired;

  return {
    enrichmentStatus,
    enrichmentErrorMessage,
    repairRequired,
    repairReason: optionalRepairRequired
      ? "optional_index_write_issues"
      : enrichmentStatus === "failed"
        ? "inline_enrichment_failed"
        : "enrichment_deferred",
    repairMessage:
      enrichmentErrorMessage ??
      (optionalRepairRequired
        ? optionalRepairMessage
        : "Core index complete; enrichment queued for indexing-v3-agent."),
  };
}

/**
 * Per-image vision-rejection isolation (audit L12).
 *
 * One embedded image the vision provider refuses used to fail the WHOLE
 * document: the provider error escaped the caption batch, the job was recorded
 * failed with an OpenAI error string, and the clinician saw a failed upload
 * with no hint that the fix is "skip that image". The Python extractor now
 * normalises non-web formats to PNG, but a provider can still refuse a
 * particular image, so the worker needs its own per-task guard.
 *
 * The guard is deliberately an ALLOWLIST. Anything not recognised as a
 * non-retryable per-image rejection is rethrown, because silently skipping every
 * image during a rate-limit or provider outage would produce a document that
 * completes with no visual evidence at all — worse than a job that retries.
 */
const NON_RETRYABLE_VISION_REJECTION_CODES = new Set(["openai_invalid_request", "openai_content_filtered"]);

const VISION_IMAGE_REJECTION_MESSAGE =
  /(unsupported image|invalid image|invalid_image|image[_ ]parse[_ ]error|unrecognized (?:file|image) format|corrupt(?:ed)? image)/i;

function errorDetailCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const details = (error as { details?: unknown }).details;
  if (!details || typeof details !== "object") return null;
  const code = (details as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/**
 * A stable, content-free skip reason for an image the provider refused, or null
 * when the error must propagate and fail/retry the job as before.
 *
 * The returned string never quotes the provider message: it is persisted on the
 * image row and read back in the UI, so it stays a fixed phrase plus the
 * provider's own error code.
 */
export function visionImageRejectionSkipReason(error: unknown): string | null {
  if (isRetryableIngestionError(error)) return null;
  const code = errorDetailCode(error);
  if (code && NON_RETRYABLE_VISION_REJECTION_CODES.has(code)) {
    return `vision provider rejected this image (${code})`;
  }
  if (code) return null;
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (VISION_IMAGE_REJECTION_MESSAGE.test(message)) {
    return "vision provider rejected this image (unsupported or unreadable image data)";
  }
  return null;
}
