// Lightweight structured logger with redaction (plan item 1.2). API routes log
// operational context (status, error name, request id) but must never emit secrets
// or patient-identifying text (clinical query/answer content, emails). Values under
// sensitive keys are redacted and long strings truncated before serialization.

type LogLevel = "debug" | "info" | "warn" | "error";

const REDACTED = "[redacted]";
const MAX_STRING_LENGTH = 512;
const MAX_DEPTH = 5;

// Keys whose values may carry secrets or PII. Matched case-insensitively as substrings.
const SENSITIVE_KEY =
  /authorization|cookie|token|secret|api[-_]?key|password|service[-_]?role|email|\bquery\b|prompt|\bcontent\b|\banswer\b|patient|\bmrn\b/i;

const SENSITIVE_VALUE_PATTERN = /\b(?:mrn|ur|unit\s*no\.?)\s*[:#]?\s*\d{6,10}\b|\b\d{3}\s\d{3}\s\d{4}\b/i;

function redactValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (SENSITIVE_VALUE_PATTERN.test(value)) return REDACTED;
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…[truncated]` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= MAX_DEPTH) return "[depth-limited]";
  if (value instanceof Error) return { name: value.name, message: redactValue(value.message, depth + 1) };
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactValue(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactValue(val, depth + 1);
    }
    return out;
  }
  return String(value);
}

export function redactLogContext(context: Record<string, unknown>): Record<string, unknown> {
  return redactValue(context, 0) as Record<string, unknown>;
}

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// This module is server-oriented, but bundlers that reach it from a shared module
// (or a standalone bundle such as the design-system export) inline it into browser
// code, where a bare `process.env` read throws ReferenceError and unmounts the
// React tree. Read the environment defensively instead of assuming Node.
function env(): Record<string, string | undefined> {
  return typeof process !== "undefined" && process.env ? process.env : {};
}

function activeLevel(): LogLevel {
  const configured = env().LOG_LEVEL?.toLowerCase();
  if (configured && configured in LEVEL_RANK) return configured as LogLevel;
  return env().NODE_ENV === "production" ? "info" : "debug";
}

type SentryLogForwarder = (level: "warn" | "error", message: string, context?: Record<string, unknown>) => void;

let sentryLogForwarder: SentryLogForwarder | null = null;

/**
 * Register a Sentry Logs bridge from server instrumentation after `Sentry.init`.
 * Kept as a callback so this module never imports `@sentry/nextjs` (bundler-safe).
 */
export function registerSentryLogForwarder(forwarder: SentryLogForwarder | null) {
  sentryLogForwarder = forwarder;
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>) {
  // Keep tests quiet; they assert on responses, not log output.
  if (env().NODE_ENV === "test") return;
  if (LEVEL_RANK[level] < LEVEL_RANK[activeLevel()]) return;
  const redacted = context ? redactLogContext(context) : undefined;
  const line = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(redacted ?? {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  // Forward warn/error to privacy-scrubbed Sentry Logs when instrumentation registered a bridge.
  if ((level === "warn" || level === "error") && sentryLogForwarder) {
    try {
      sentryLogForwarder(level, message, redacted);
    } catch {
      // Optional observability must never interfere with request handling.
    }
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};

// Correlation id so a client error report can be matched to server logs without
// exposing the underlying log content to the client.
export function newRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}
