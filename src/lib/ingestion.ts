export function isRetryableIngestionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  // Duplicate-key conflicts — including document_pages page-number duplicates —
  // are partial index-write conflicts that the worker routes to manual queue
  // recovery, never auto-retry. (Audit L17: removed an unreachable retry
  // special-case for the page-number constraint that this short-circuit made
  // dead code; recovery is the deliberate path for those conflicts.)
  if (isPartialIndexWriteConflict(error)) return false;
  return /\b(429|rate limit|timeout|temporar|network|fetch failed|ECONNRESET|ETIMEDOUT|5\d\d|502|503|504|bad gateway|gateway timeout|service unavailable)\b/i.test(
    message,
  );
}

export function isPartialIndexWriteConflict(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate key value violates unique constraint/i.test(message);
}

export function retryDelayMs(attemptCount: number) {
  const attempt = Math.max(1, attemptCount);
  return Math.min(30 * 60_000, 60_000 * 2 ** (attempt - 1));
}

export function nextRetryAt(attemptCount: number, now = new Date()) {
  return new Date(now.getTime() + retryDelayMs(attemptCount)).toISOString();
}

export function terminalBatchStatus(args: { queued: number; processing: number; failed: number }) {
  if (args.queued > 0 || args.processing > 0) return "processing";
  return args.failed > 0 ? "completed_with_errors" : "completed";
}
