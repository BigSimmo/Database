import {
  normalizeAnswerProgressEvent,
  type AnswerProgressUpdate,
} from "@/components/clinical-dashboard/answer-progress";
import type { RagAnswer } from "@/lib/types";

export { keywordQueryFromNaturalLanguage } from "@/lib/keyword-query";

export type AnswerPayload = RagAnswer & { demoMode?: boolean };

const answerConfidenceValues = new Set<AnswerPayload["confidence"]>(["high", "medium", "low", "unsupported"]);

export function isAnswerPayload(value: unknown): value is AnswerPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.answer === "string" &&
    typeof payload.grounded === "boolean" &&
    answerConfidenceValues.has(payload.confidence as AnswerPayload["confidence"]) &&
    Array.isArray(payload.citations) &&
    Array.isArray(payload.sources) &&
    (payload.demoMode === undefined || typeof payload.demoMode === "boolean")
  );
}

export type SearchError = Error & {
  status?: number;
  retryable?: boolean;
  code?: string;
  retryAfterMs?: number | null;
};

export const searchRetryDelaysMs = [500, 1000, 2000] as const;
export const searchRetryCount = 2;

export function makeSearchError(message: string, status?: number, retryable = false): SearchError {
  const error = new Error(message) as SearchError;
  error.status = status;
  error.retryable = retryable;
  return error;
}

function parseSseData(lines: string[]) {
  const data = lines.join("\n").trim();
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    throw makeSearchError("Answer stream returned malformed data.", 500, true);
  }
}

function findSseSeparator(buffer: string) {
  const match = /\r?\n\r?\n/.exec(buffer);
  return match ? { index: match.index, length: match[0].length } : null;
}

/** Consume the answer SSE contract shared by every browser answer surface. */
export async function readAnswerStream(
  response: Response,
  onProgress: (progress: AnswerProgressUpdate) => void,
  onToken?: (delta: string) => void,
  onRevising?: () => void,
  onActivity?: () => void,
): Promise<AnswerPayload> {
  if (!response.body) throw makeSearchError("Answer stream could not be opened.", undefined, true);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let pendingCompletion: AnswerProgressUpdate | null = null;

  function processEvent(block: string) {
    const lines = block.split(/\r?\n/);
    let event = "message";
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice("event:".length).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).trimStart());
    }

    if (dataLines.length === 0) return null;
    const data = parseSseData(dataLines);
    if (data === null) return null;
    if (event === "progress") {
      const progress = normalizeAnswerProgressEvent(data);
      if (progress) {
        if (progress.stage === "complete") {
          pendingCompletion = progress;
        } else {
          onProgress(progress);
          if (progress.stage === "fallback") onRevising?.();
        }
      }
      return null;
    }
    if (event === "token") {
      const delta = data && typeof data === "object" ? (data as { delta?: unknown }).delta : null;
      if (typeof delta === "string" && delta) onToken?.(delta);
      return null;
    }
    if (event === "revising") {
      onRevising?.();
      return null;
    }
    if (event === "error") {
      pendingCompletion = null;
      const message = data && typeof data === "object" ? (data as { error?: unknown }).error : null;
      const details =
        data && typeof data === "object" ? (data as { details?: { message?: unknown } | unknown }).details : null;
      const detailMessage =
        details && typeof details === "object" && "message" in details && typeof details.message === "string"
          ? details.message
          : null;
      const status = data && typeof data === "object" ? (data as { status?: unknown }).status : null;
      const statusCode = typeof status === "number" ? status : undefined;
      const errorMessage =
        typeof message === "string" && message.trim()
          ? message
          : typeof detailMessage === "string" && detailMessage.trim()
            ? detailMessage
            : "Answer generation failed due to a streaming error.";
      throw makeSearchError(
        errorMessage,
        statusCode,
        isRetryableStatus(statusCode ?? 0) || isRetryableMessage(errorMessage),
      );
    }
    if (event === "final") {
      if (!isAnswerPayload(data)) {
        pendingCompletion = null;
        throw makeSearchError("Answer stream returned an invalid final payload.", 502, true);
      }
      if (pendingCompletion) {
        onProgress(pendingCompletion);
        pendingCompletion = null;
      }
      return data;
    }

    return null;
  }

  while (true) {
    const { value, done } = await reader.read();
    if (value && value.length > 0) onActivity?.();
    buffer += decoder.decode(value, { stream: !done });

    let separator = findSseSeparator(buffer);
    while (separator) {
      const block = buffer.slice(0, separator.index).trim();
      buffer = buffer.slice(separator.index + separator.length);
      const finalPayload = block ? processEvent(block) : null;
      if (finalPayload) {
        await reader.cancel().catch(() => undefined);
        return finalPayload;
      }
      separator = findSseSeparator(buffer);
    }

    if (done) break;
  }

  const finalPayload = buffer.trim() ? processEvent(buffer.trim()) : null;
  if (finalPayload) return finalPayload;
  pendingCompletion = null;
  throw makeSearchError("Answer stream ended before a final answer was received.", undefined, true);
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

export function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
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

// Inactivity window for an in-flight search/answer request. The answer stream
// keeps delivering progress events, token deltas, and periodic server
// heartbeats while generation is running, so a healthy request — even one that
// escalates fast -> strong and runs well past a minute — keeps resetting this
// window. Only a stream with no bytes for this long is treated as a stall.
export const answerStallTimeoutMs = 60_000;

// Hard ceiling on a single request regardless of stream activity, sized above
// the server's worst-case pipeline (retrieval + fast generation + strong
// escalation + strong quality repair, each generation capped at
// OPENAI_ANSWER_TIMEOUT_MS) so it only fires on a genuinely runaway stream.
export const answerRequestMaxDurationMs = 180_000;

export type AnswerRequestWatchdog = {
  /** Reset the inactivity window — the stream showed signs of life. */
  touch: () => void;
  /** True once the watchdog fired (stall or max-duration). */
  readonly timedOut: boolean;
  /** Disarm both timers; safe to call more than once. */
  cancel: () => void;
};

/**
 * Watchdog for a streaming answer request. Fires `onTimeout` once when either
 * the stream goes silent for `stallMs` or the request exceeds `maxDurationMs`
 * in total. `touch()` on every received chunk keeps a live-but-slow generation
 * (fast -> strong escalation) from being aborted mid-stream, which previously
 * surfaced as "Answer generation timed out" while tokens were still arriving.
 */
export function createAnswerRequestWatchdog(
  onTimeout: () => void,
  { stallMs = answerStallTimeoutMs, maxDurationMs = answerRequestMaxDurationMs } = {},
): AnswerRequestWatchdog {
  let cancelled = false;
  let fired = false;
  const fire = () => {
    if (cancelled || fired) return;
    fired = true;
    onTimeout();
  };
  let stallTimer = setTimeout(fire, stallMs);
  const maxDurationTimer = setTimeout(fire, maxDurationMs);
  return {
    touch() {
      if (cancelled || fired) return;
      clearTimeout(stallTimer);
      stallTimer = setTimeout(fire, stallMs);
    },
    get timedOut() {
      return fired;
    },
    cancel() {
      cancelled = true;
      clearTimeout(stallTimer);
      clearTimeout(maxDurationTimer);
    },
  };
}

export type AnswerErrorKind = "no-results" | "failure";

/**
 * Classify an answer/search failure so the UI can offer the right recovery.
 *
 * A `404` `SearchError` is the sentinel for "the query ran fine but nothing
 * usable came back" (see `makeSearchError("No usable results were found.", 404,
 * false)` in the search executor) — that deserves a calm, helpful panel rather
 * than an alarming error. Everything else (network, 5xx, generic) is a genuine
 * failure the user should be able to retry.
 */
export function classifyAnswerError(error: unknown): AnswerErrorKind {
  if (error instanceof Error && (error as SearchError).status === 404) {
    return "no-results";
  }
  return "failure";
}
