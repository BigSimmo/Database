// Privacy scrubber for Sentry events (client + server). This app handles clinical
// queries/answers and user emails; NONE of that may leave the app in an error
// report. The scrubber runs as Sentry's `beforeSend`/`beforeSendTransaction` hook
// and enforces the same PII contract the structured logger uses (SENSITIVE_KEY,
// imported from src/lib/logger.ts as the single source of truth):
//   - strips request cookies, headers, query string and body outright;
//   - drops user identifiers;
//   - redacts any extra/context/tag value whose KEY looks sensitive;
//   - truncates long strings so a stray query embedded in an error message is bounded.
// It is intentionally conservative: over-redaction only loses debugging detail,
// under-redaction leaks patient data.
import type { ErrorEvent, Event } from "@sentry/nextjs";
import { SENSITIVE_KEY } from "@/lib/logger";

const REDACTED = "[redacted]";
const MAX_STRING_LENGTH = 512;
const MAX_DEPTH = 6;

function redactByKey(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…[truncated]` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= MAX_DEPTH) return "[depth-limited]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactByKey(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactByKey(val, depth + 1);
    }
    return out;
  }
  return String(value);
}

function truncate(value: string | undefined): string | undefined {
  if (typeof value !== "string") return value;
  return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…[truncated]` : value;
}

export function scrubSentryEvent<T extends Event>(event: T): T {
  // Request context is the highest-risk surface: cookies/auth headers are secrets,
  // and query strings / bodies can carry the clinical query. Remove them wholesale.
  if (event.request) {
    delete event.request.cookies;
    delete event.request.query_string;
    delete event.request.data;
    if (event.request.headers) {
      event.request.headers = redactByKey(event.request.headers) as Record<string, string>;
    }
  }

  // No user identity (email/id/ip) — the request-hash correlation id is enough.
  delete event.user;

  if (event.extra) event.extra = redactByKey(event.extra) as Record<string, unknown>;
  if (event.contexts) event.contexts = redactByKey(event.contexts) as typeof event.contexts;
  if (event.tags) event.tags = redactByKey(event.tags) as typeof event.tags;

  // Defensively bound exception/message text so a query echoed into an Error
  // message cannot arrive verbatim.
  if (event.message) event.message = truncate(event.message) as string;
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = truncate(exception.value);
  }

  return event;
}

// Convenience alias with the ErrorEvent type Sentry's beforeSend hook expects.
export const scrubSentryErrorEvent = (event: ErrorEvent): ErrorEvent => scrubSentryEvent(event);
