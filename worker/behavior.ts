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
