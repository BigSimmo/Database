import type { RagAnswer } from "@/lib/types";

export { keywordQueryFromNaturalLanguage } from "@/lib/keyword-query";

export type AnswerPayload = RagAnswer & { demoMode?: boolean };

export type SearchError = Error & {
  status?: number;
  retryable?: boolean;
};

export const searchRetryDelaysMs = [500, 1000, 2000] as const;
export const searchRetryCount = 2;

export function makeSearchError(message: string, status?: number, retryable = false): SearchError {
  const error = new Error(message) as SearchError;
  error.status = status;
  error.retryable = retryable;
  return error;
}

export function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

export function isRetryableMessage(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("rate limit") ||
    normalized.includes("rate-limited") ||
    normalized.includes("temporar") ||
    normalized.includes("overload") ||
    normalized.includes("retry") ||
    normalized.includes("unavailable") ||
    normalized.includes("upstream") ||
    normalized.includes("service is currently")
  );
}

export function isRetryableError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const searchError = error as SearchError;
  if (searchError.name === "TypeError") return true;
  if (searchError.retryable !== undefined) return searchError.retryable;
  if (searchError.status !== undefined) return isRetryableStatus(searchError.status);
  return isRetryableMessage(searchError.message);
}

export function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function answerPayloadIsUsable(payload: AnswerPayload) {
  const answerText = payload.answer.trim();
  if (!answerText) return false;
  if (payload.confidence === "unsupported") {
    const hasGapContext = Boolean(
      payload.relevance || payload.smartPanel?.relevance || payload.sources?.length || payload.relatedDocuments?.length,
    );
    return hasGapContext;
  }

  return true;
}

export function progressForRetry(attempt: number) {
  if (attempt <= 1) return "Retrying...";
  return `Retrying... (${Math.min(attempt, searchRetryCount)}/${searchRetryCount})`;
}
