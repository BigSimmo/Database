import * as Sentry from "@sentry/nextjs";

/**
 * Privacy-safe Sentry Logs helpers for PsychSift.
 *
 * Best practices adapted for this repo (see docs/error-tracking.md):
 * - Prefer static messages + structured attributes (wide events), never interpolate
 *   clinical query/answer/document text into the message.
 * - Fail closed in `beforeSendLog`: drop debug/trace, unknown attributes, and
 *   free-form messages that are not on the allowlist.
 * - Do not enable `consoleLoggingIntegration` — console output is too leaky.
 * - No browser/client Sentry logging path.
 */

export type SentryLogLevel = "info" | "warn" | "error" | "fatal";

type ScrubbedLog = {
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  message: string;
  attributes?: Record<string, string | number | boolean>;
  severityNumber?: number;
};

/** Static operational messages deliberately emitted to Sentry Logs. */
export const SENTRY_LOG_MESSAGES = {
  API_REQUEST_FAILED: "API request failed",
  API_RATE_LIMITED: "API rate limited",
  API_RATE_LIMIT_FALLBACK: "API rate limit durable check unavailable",
  API_RATE_LIMIT_INVALID_PAYLOAD: "API rate limit durable check returned invalid payload",
  SEARCH_STREAM_FAILED: "Search stream failed",
  UPLOAD_DUPLICATE_CLEANUP_FAILED: "Duplicate upload storage cleanup failed",
  UPLOAD_CLEANUP_DOCUMENT_ORPHAN_RISK: "Upload cleanup failed; document row may be orphaned",
  UPLOAD_CLEANUP_STORAGE_ORPHAN_RISK: "Upload cleanup failed; storage object may be orphaned",
  CHAT_WEBHOOK_DELIVERY_FAILED: "Chat webhook delivery failed",
  CHAT_WEBHOOK_DELIVERY_ERRORED: "Chat webhook delivery errored",
  AUDIT_LOG_WRITE_FAILED: "Audit log write failed",
  AUDIT_LOG_WRITE_THREW: "Audit log write threw",
  HYBRID_RPC_FAILED: "hybrid_rpc_failed",
  RAILWAY_WEBHOOK_SHAPE_MISMATCH: "Railway webhook payload did not match expected shape",
  REINDEX_FLAG_CLEAR_FAILED: "Failed to clear reindex_requested flag",
  BULK_DOCUMENT_EDIT_FAILED: "Bulk document edit failed for a document",
  APPLICATION_WARN: "Application warn",
  APPLICATION_ERROR: "Application error",
  /** Matches the Sentry Logs wizard verify sample (static; no clinical content). */
  SENTRY_TEST: "User triggered test log",
} as const;

const ALLOWED_MESSAGES = new Set<string>(Object.values(SENTRY_LOG_MESSAGES));

/** Attributes safe to export on Sentry Logs (operational only). */
const SAFE_LOG_ATTRIBUTE_KEYS = new Set([
  "code",
  "status",
  "http.status_code",
  "route_path",
  "route_type",
  "router_kind",
  "duration_ms",
  "request_id",
  "interaction_id",
  "bucket",
  "retry_after_seconds",
  "limit",
  "remaining",
  "backend",
  "outcome",
  "generation_mode",
  "provider_mode",
  "error_name",
  "sql_state",
  "file_type",
  "size_bytes",
  "component",
  "event",
  "cache",
  "fallback",
  "sample_rate",
  "level",
  "action",
  "rpc",
  "owner_scoped",
  "log_source",
]);

const MAX_MESSAGE_LENGTH = 120;
const MAX_STRING_ATTRIBUTE_LENGTH = 64;

/** Opt-in when DSN is set; set `SENTRY_ENABLE_LOGS=false` to keep logs off. */
export function isSentryLoggingEnabled(
  rawValue: string | undefined = process.env.SENTRY_ENABLE_LOGS,
  dsn: string | undefined = process.env.SENTRY_DSN,
): boolean {
  if (!dsn?.trim()) return false;
  if (rawValue === undefined || rawValue.trim() === "") return true;
  return rawValue.trim().toLowerCase() !== "false" && rawValue.trim() !== "0";
}

function normalizeAttributeKey(key: string): string {
  // Map common camelCase logger fields onto the Sentry attribute allowlist.
  switch (key) {
    case "requestId":
      return "request_id";
    case "sqlState":
      return "sql_state";
    case "retryAfterSeconds":
      return "retry_after_seconds";
    case "fileType":
      return "file_type";
    case "sizeBytes":
      return "size_bytes";
    case "ownerScoped":
      return "owner_scoped";
    case "errorName":
    case "name":
      return "error_name";
    default:
      return key;
  }
}

function sanitizeAttributeValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_STRING_ATTRIBUTE_LENGTH) return undefined;
    // Reject values that look like emails, URLs, or query strings.
    if (/@|[?]|=|https?:\/\//i.test(trimmed)) return undefined;
    // Short operational tokens (bucket names, codes, rpc ids) are always safe.
    if (/^[a-zA-Z][a-zA-Z0-9._-]{0,63}$/.test(trimmed)) return trimmed;
    // Free-text values: reject clinical/PII-shaped content.
    if (/\b(mrn|patient|suicid|prompt|answer|query)\b/i.test(trimmed)) return undefined;
    return trimmed;
  }
  return undefined;
}

/** Keep only allowlisted primitive attributes; drop everything else. */
export function privacySafeLogAttributes(
  attributes: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> {
  if (!attributes) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [rawKey, rawValue] of Object.entries(attributes)) {
    const key = normalizeAttributeKey(rawKey);
    if (!SAFE_LOG_ATTRIBUTE_KEYS.has(key)) continue;
    const value = sanitizeAttributeValue(rawValue);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/**
 * Fail-closed log scrubber for `Sentry.init({ beforeSendLog })`.
 * Drops debug/trace, unknown messages, and non-allowlisted attributes.
 */
export function privacySafeLog(log: ScrubbedLog): ScrubbedLog | null {
  if (log.level === "trace" || log.level === "debug") return null;

  const rawMessage = typeof log.message === "string" ? log.message.trim() : "";
  if (!rawMessage || rawMessage.length > MAX_MESSAGE_LENGTH) return null;

  const message = ALLOWED_MESSAGES.has(rawMessage) ? rawMessage : null;
  if (!message) return null;

  const attributes = privacySafeLogAttributes(log.attributes);
  return {
    level: log.level,
    message,
    ...(Object.keys(attributes).length ? { attributes } : {}),
    ...(typeof log.severityNumber === "number" ? { severityNumber: log.severityNumber } : {}),
  };
}

/** Resolve what would be emitted after allowlist/scrubbing (testable without a live Sentry client). */
export function resolveSentryLogEmission(
  message: string,
  attributes?: Record<string, unknown>,
): { message: string; attributes?: Record<string, string | number | boolean> } | null {
  if (!ALLOWED_MESSAGES.has(message)) return null;
  const safeAttributes = privacySafeLogAttributes(attributes);
  return Object.keys(safeAttributes).length ? { message, attributes: safeAttributes } : { message };
}

function emit(level: SentryLogLevel, message: string, attributes?: Record<string, unknown>): void {
  if (!isSentryLoggingEnabled()) return;
  try {
    // Skip when Sentry was never initialized (tests, worker, missing DSN path).
    if (!Sentry.getClient()) return;
    const resolved = resolveSentryLogEmission(message, attributes);
    if (!resolved) return;
    const payload = resolved.attributes;
    switch (level) {
      case "info":
        Sentry.logger.info(resolved.message, payload);
        break;
      case "warn":
        Sentry.logger.warn(resolved.message, payload);
        break;
      case "error":
        Sentry.logger.error(resolved.message, payload);
        break;
      case "fatal":
        Sentry.logger.fatal(resolved.message, payload);
        break;
    }
  } catch {
    // Optional observability must never take down clinical request handling.
  }
}

/**
 * Structured Sentry Logs API for call sites.
 * Always pass a `SENTRY_LOG_MESSAGES.*` constant — never interpolate clinical text.
 *
 * @example Wide-event style (preferred)
 * ```ts
 * sentryLog.warn(SENTRY_LOG_MESSAGES.API_RATE_LIMITED, {
 *   bucket: "answer",
 *   code: "rate_limited",
 *   retry_after_seconds: 30,
 *   limit: 60,
 *   remaining: 0,
 * });
 * ```
 */
export const sentryLog = {
  info: (message: string, attributes?: Record<string, unknown>) => emit("info", message, attributes),
  warn: (message: string, attributes?: Record<string, unknown>) => emit("warn", message, attributes),
  error: (message: string, attributes?: Record<string, unknown>) => emit("error", message, attributes),
  fatal: (message: string, attributes?: Record<string, unknown>) => emit("fatal", message, attributes),
};

/**
 * Bridge from the redacting app `logger` into Sentry Logs for warn/error only.
 * Unknown messages collapse to a generic allowlisted label so free-form text never exports.
 */
export function mapAppLogMessage(level: "warn" | "error", message: string): string {
  return ALLOWED_MESSAGES.has(message)
    ? message
    : level === "error"
      ? SENTRY_LOG_MESSAGES.APPLICATION_ERROR
      : SENTRY_LOG_MESSAGES.APPLICATION_WARN;
}

export function forwardAppLogToSentry(
  level: "warn" | "error",
  message: string,
  context?: Record<string, unknown>,
): void {
  emit(level, mapAppLogMessage(level, message), context);
}

/** True when an operator opted into one startup verify log (`SENTRY_SEND_TEST_LOG=true`). */
export function isSentryTestLogEnabled(rawValue: string | undefined = process.env.SENTRY_SEND_TEST_LOG): boolean {
  const normalized = rawValue?.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

/**
 * Emit the Sentry Logs wizard verify sample once (startup / operator check).
 * Gated by `SENTRY_SEND_TEST_LOG=true` so production restarts do not spam Explore → Logs.
 */
export function sendSentryTestLog(): void {
  if (!isSentryTestLogEnabled()) return;
  sentryLog.info(SENTRY_LOG_MESSAGES.SENTRY_TEST, { log_source: "sentry_test" });
}
