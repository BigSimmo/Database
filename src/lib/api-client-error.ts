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

type ApiErrorDetails = {
  code?: string;
  retryAfterSeconds?: number;
};

type ApiErrorPayload = {
  message?: string;
  error?: string;
  code?: string;
  details?: ApiErrorDetails;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonPayload(raw: string): ApiErrorPayload | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(json)) return null;
  const payload: ApiErrorPayload = {};
  if (json.message !== undefined) {
    if (typeof json.message !== "string") return null;
    payload.message = json.message;
  }
  if (json.error !== undefined) {
    if (typeof json.error !== "string") return null;
    payload.error = json.error;
  }
  if (json.code !== undefined) {
    if (typeof json.code !== "string") return null;
    payload.code = json.code;
  }
  if (json.details !== undefined) {
    if (!isRecord(json.details)) return null;
    const details: ApiErrorDetails = {};
    if (json.details.code !== undefined) {
      if (typeof json.details.code !== "string") return null;
      details.code = json.details.code;
    }
    if (json.details.retryAfterSeconds !== undefined) {
      if (typeof json.details.retryAfterSeconds !== "number" || Number.isNaN(json.details.retryAfterSeconds)) {
        return null;
      }
      details.retryAfterSeconds = json.details.retryAfterSeconds;
    }
    payload.details = details;
  }
  return payload;
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

function sseErrorPayload(text: string): ApiErrorPayload | null {
  for (const block of text.split(/\r?\n\r?\n/)) {
    if (!/^event:\s*error\s*$/m.test(block)) continue;
    const data = block.match(/^data:\s*(.+)$/m)?.[1];
    if (!data) continue;
    return parseJsonPayload(data);
  }
  return null;
}

export async function parseApiErrorResponse(response: Response, now = Date.now()) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const text = await response.text().catch(() => "");
  let payload: ApiErrorPayload | null = null;
  if (contentType.includes("json")) {
    payload = parseJsonPayload(text);
  } else if (contentType.includes("text/event-stream")) {
    payload = sseErrorPayload(text);
  }
  const message =
    (typeof payload?.message === "string" && payload.message) ||
    (typeof payload?.error === "string" && payload.error) ||
    (text && !contentType.includes("text/event-stream") ? text.slice(0, 300) : "") ||
    `Request failed (${response.status})`;
  const details = payload?.details ?? null;
  const code =
    (typeof payload?.code === "string" && payload.code) ||
    (typeof details?.code === "string" && details.code) ||
    `http_${response.status}`;
  const headerDelay = parseRetryAfterMs(response, now);
  const detailsDelay =
    typeof details?.retryAfterSeconds === "number" ? Math.max(0, details.retryAfterSeconds * 1000) : null;
  return new ApiClientError(
    message,
    response.status,
    code,
    isRetryableApiStatus(response.status),
    headerDelay ?? detailsDelay,
  );
}
