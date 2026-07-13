import "server-only";

import { env } from "@/lib/env";

// Server-only Sentry capture, fully inert unless SENTRY_DSN is configured: without a
// DSN, @sentry/node is never imported, so tests and DSN-less deployments never touch
// the SDK and no event egress can occur.
//
// Privacy boundary (clinical app): context values must be short operational strings —
// route names, status codes, sanitized failure reasons. Never pass query text, document
// content, headers, or request bodies. Event-level scrubbing is enforced again at init
// (see src/instrumentation.ts beforeSend), but callers are the first line of defense.

type CaptureContext = Record<string, string | number | boolean | null | undefined>;

type SentryLike = {
  captureException: (error: unknown, context?: { extra?: CaptureContext }) => unknown;
  captureMessage: (message: string, context?: { level?: "warning"; extra?: CaptureContext }) => unknown;
};

let sentryModule: Promise<SentryLike | null> | null = null;

function sentryEnabled() {
  return Boolean(env.SENTRY_DSN) && process.env.NEXT_RUNTIME !== "edge";
}

async function loadSentry(): Promise<SentryLike | null> {
  if (!sentryEnabled()) return null;
  sentryModule ??= import("@sentry/node").then(
    (mod) => mod as SentryLike,
    // A missing/broken SDK must degrade to the console-only logger, never break a request.
    () => null,
  );
  return sentryModule;
}

/** Report a server-side exception. Swallows its own failures — capture must never break a request. */
export async function captureServerException(error: unknown, context?: CaptureContext) {
  const sentry = await loadSentry();
  if (!sentry) return;
  try {
    // Clinical errors can embed query or document text in their message and
    // stack. Preserve only the safe error class as operational context.
    const errorType = error instanceof Error ? error.name : "UnknownError";
    sentry.captureException(new Error("Server request failed"), {
      extra: { ...(context ?? {}), errorType },
    });
  } catch {
    // Capture is best-effort observability; the request outcome must not change.
  }
}

/** Report a non-exception degradation signal (e.g. generation fell back to source-only). */
export async function captureServerEvent(message: string, context?: CaptureContext) {
  const sentry = await loadSentry();
  if (!sentry) return;
  try {
    sentry.captureMessage(message, { level: "warning", ...(context ? { extra: context } : {}) });
  } catch {
    // Same best-effort contract as captureServerException.
  }
}
