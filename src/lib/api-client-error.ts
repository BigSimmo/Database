import { z } from "zod";
import { apiErrorPayloadSchema, type ApiErrorPayload } from "@/lib/api-error-payload";

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

const legacyApiErrorPayloadSchema = z
  .object({
    message: z.string().optional(),
    error: z.string().optional(),
    code: z.string().optional(),
    details: z
      .object({
        code: z.string().optional(),
        retryAfterSeconds: z.number().finite().optional(),
      })
      .strip()
      .optional(),
  })
  .strip();

const canonicalCandidateSchema = z
  .object({ error: z.unknown(), message: z.unknown(), code: z.unknown() })
  .passthrough();

type LegacyApiErrorDetails = { code?: string; retryAfterSeconds?: number };
type ParsedApiErrorPayload = Partial<Omit<ApiErrorPayload, "details">> & {
  details?: ApiErrorPayload["details"] | LegacyApiErrorDetails;
};

export function parseApiErrorPayload(raw: string): ParsedApiErrorPayload | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const canonical = apiErrorPayloadSchema.safeParse(json);
  if (canonical.success) return canonical.data;
  // A payload claiming the canonical shape must satisfy it strictly. Do not silently
  // downgrade malformed canonical responses into the compatibility parser.
  if (canonicalCandidateSchema.safeParse(json).success) return null;
  const legacy = legacyApiErrorPayloadSchema.safeParse(json);
  return legacy.success ? legacy.data : null;
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
