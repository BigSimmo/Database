export function isRetryableIngestionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (isPartialIndexWriteConflict(error)) return false;
  return /\b(429|rate limit|timeout|temporar|network|fetch failed|ECONNRESET|ETIMEDOUT|5\d\d|502|503|504|bad gateway|gateway timeout|service unavailable)\b/i.test(message) ||
    /document_pages_document_id_page_number_key/i.test(message);
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
