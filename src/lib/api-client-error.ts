import { z } from "zod";

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

const apiErrorDetailsSchema = z.looseObject({
  code: z.string().optional(),
  retryAfterSeconds: z.number().optional(),
});

const apiErrorPayloadSchema = z.looseObject({
  message: z.string().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  details: apiErrorDetailsSchema.optional(),
});

type ApiErrorPayload = z.infer<typeof apiErrorPayloadSchema>;

function retryAfterMs(response: Response, now: number) {
  const raw = response.headers.get("retry-after")?.trim();
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

function retryableStatus(status: number) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function parseJsonPayload(raw: string): ApiErrorPayload | null {
  try {
    const parsed = JSON.parse(raw);
    const result = apiErrorPayloadSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
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
  const headerDelay = retryAfterMs(response, now);
  const detailsDelay =
    typeof details?.retryAfterSeconds === "number" ? Math.max(0, details.retryAfterSeconds * 1000) : null;
  return new ApiClientError(
    message,
    response.status,
    code,
    retryableStatus(response.status),
    headerDelay ?? detailsDelay,
  );
}
