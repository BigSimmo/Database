import type { ApiErrorPayload } from "@/lib/api-error-payload";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly retryable: boolean,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type LegacyApiErrorDetails = { code?: string; retryAfterSeconds?: number };
type ParsedApiErrorPayload = Partial<Omit<ApiErrorPayload, "details">> & {
  details?: ApiErrorPayload["details"] | LegacyApiErrorDetails;
};

type JsonRecord = Record<string, unknown>;

function object(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function exactKeys(value: JsonRecord, keys: readonly string[]) {
  const present = Object.keys(value);
  return present.length === keys.length && keys.every((key) => key in value);
}

function hasOnlyKnownKeys(value: JsonRecord, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function apiErrorCode(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(value);
}

function timestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function canonicalDetails(value: unknown): ApiErrorPayload["details"] | null {
  const details = object(value);
  if (!details || typeof details.kind !== "string") return null;
  if (details.kind === "rate_limit") {
    return exactKeys(details, ["kind", "retryAfterSeconds", "resetAt"]) &&
      typeof details.retryAfterSeconds === "number" &&
      Number.isFinite(details.retryAfterSeconds) &&
      details.retryAfterSeconds >= 0 &&
      timestamp(details.resetAt)
      ? (details as ApiErrorPayload["details"])
      : null;
  }
  if (details.kind !== "ingestion_mutation_safety") return null;
  if (
    !exactKeys(details, [
      "kind",
      "safeToRun",
      "checkedAt",
      "reason",
      "message",
      "activeJobCount",
      "staleProcessingJobCount",
      "activeJobs",
    ]) ||
    typeof details.safeToRun !== "boolean" ||
    !timestamp(details.checkedAt) ||
    typeof details.reason !== "string" ||
    details.reason.length === 0 ||
    typeof details.message !== "string" ||
    details.message.length === 0 ||
    typeof details.activeJobCount !== "number" ||
    !Number.isInteger(details.activeJobCount) ||
    details.activeJobCount < 0 ||
    typeof details.staleProcessingJobCount !== "number" ||
    !Number.isInteger(details.staleProcessingJobCount) ||
    details.staleProcessingJobCount < 0 ||
    !Array.isArray(details.activeJobs) ||
    !details.activeJobs.every((job) => {
      const candidate = object(job);
      return Boolean(
        candidate &&
        exactKeys(candidate, [
          "id",
          "documentId",
          "status",
          "stage",
          "lockedAt",
          "updatedAt",
          "errorMessage",
          "attemptCount",
          "maxAttempts",
        ]) &&
        typeof candidate.id === "string" &&
        ["documentId", "status", "stage", "lockedAt", "updatedAt", "errorMessage"].every(
          (key) => candidate[key] === null || typeof candidate[key] === "string",
        ) &&
        ["attemptCount", "maxAttempts"].every((key) => candidate[key] === null || typeof candidate[key] === "number"),
      );
    })
  ) {
    return null;
  }
  return details as ApiErrorPayload["details"];
}

function canonicalPayload(value: JsonRecord): ApiErrorPayload | null {
  if (
    !hasOnlyKnownKeys(value, ["error", "message", "code", "requestId", "details"]) ||
    typeof value.error !== "string" ||
    typeof value.message !== "string" ||
    !apiErrorCode(value.code) ||
    (value.requestId !== undefined && (typeof value.requestId !== "string" || value.requestId.length === 0))
  ) {
    return null;
  }
  if (value.details === undefined) return value as ApiErrorPayload;
  const details = canonicalDetails(value.details);
  return details ? ({ ...value, details } as ApiErrorPayload) : null;
}

function legacyPayload(value: JsonRecord): ParsedApiErrorPayload | null {
  if (
    (value.message !== undefined && typeof value.message !== "string") ||
    (value.error !== undefined && typeof value.error !== "string") ||
    (value.code !== undefined && typeof value.code !== "string")
  ) {
    return null;
  }
  if (value.details === undefined) return value as ParsedApiErrorPayload;
  const details = object(value.details);
  if (
    !details ||
    (details.code !== undefined && typeof details.code !== "string") ||
    (details.retryAfterSeconds !== undefined &&
      (typeof details.retryAfterSeconds !== "number" || !Number.isFinite(details.retryAfterSeconds)))
  ) {
    return null;
  }
  const parsedDetails: LegacyApiErrorDetails = {};
  if (typeof details.code === "string") parsedDetails.code = details.code;
  if (typeof details.retryAfterSeconds === "number") parsedDetails.retryAfterSeconds = details.retryAfterSeconds;
  return { ...value, details: parsedDetails } as ParsedApiErrorPayload;
}

export function parseApiErrorPayload(raw: string): ParsedApiErrorPayload | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const candidate = object(json);
  if (!candidate) return null;
  const canonical = canonicalPayload(candidate);
  if (canonical) return canonical;
  // A payload claiming the canonical shape must satisfy it strictly. Do not silently
  // downgrade malformed canonical responses into the compatibility parser.
  if ("error" in candidate && "message" in candidate && "code" in candidate) return null;
  return legacyPayload(candidate);
}

export function parseRetryAfterMs(response: { headers?: { get(name: string): string | null } }, now = Date.now()) {
  const raw = response.headers?.get("retry-after")?.trim();
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

export function isRetryableApiStatus(status: number) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function sseErrorPayload(text: string): ParsedApiErrorPayload | null {
  for (const block of text.split(/\r?\n\r?\n/)) {
    if (!/^event:\s*error\s*$/m.test(block)) continue;
    const data = block.match(/^data:\s*(.+)$/m)?.[1];
    if (!data) continue;
    return parseApiErrorPayload(data);
  }
  return null;
}

export async function parseApiErrorResponse(response: Response, now = Date.now()) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const text = await response.text().catch(() => "");
  let payload: ParsedApiErrorPayload | null = null;
  if (contentType.includes("json")) {
    payload = parseApiErrorPayload(text);
  } else if (contentType.includes("text/event-stream")) {
    payload = sseErrorPayload(text);
  }
  const message =
    (typeof payload?.message === "string" && payload.message) ||
    (typeof payload?.error === "string" && payload.error) ||
    (text && contentType.includes("text/plain") ? text.slice(0, 300) : "") ||
    `Request failed (${response.status})`;
  const details = payload?.details ?? null;
  const code =
    (typeof payload?.code === "string" && payload.code) ||
    (details && "code" in details && typeof details.code === "string" && details.code) ||
    `http_${response.status}`;
  const headerDelay = parseRetryAfterMs(response, now);
  const detailsDelay =
    details && "retryAfterSeconds" in details && typeof details.retryAfterSeconds === "number"
      ? Math.max(0, details.retryAfterSeconds * 1000)
      : null;
  return new ApiClientError(
    message,
    response.status,
    code,
    isRetryableApiStatus(response.status),
    headerDelay ?? detailsDelay,
  );
}
