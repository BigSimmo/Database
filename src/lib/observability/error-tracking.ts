import type { ErrorEvent } from "@sentry/nextjs";
import type { Instrumentation } from "next";

const SAFE_ERROR_MESSAGE = "Unhandled server request error";

/** Keep code locations while removing all free-form/request data before export. */
export function privacySafeErrorEvent(event: ErrorEvent): ErrorEvent {
  const exceptions = event.exception?.values?.map((exception) => ({
    type: exception.type || "Error",
    value: SAFE_ERROR_MESSAGE,
    stacktrace: exception.stacktrace
      ? {
          frames: exception.stacktrace.frames?.map((frame) => ({
            filename: frame.filename,
            function: frame.function,
            module: frame.module,
            lineno: frame.lineno,
            colno: frame.colno,
            in_app: frame.in_app,
          })),
        }
      : undefined,
  }));

  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    release: event.release,
    environment: event.environment,
    message: exceptions?.length ? undefined : SAFE_ERROR_MESSAGE,
    exception: exceptions?.length ? { values: exceptions } : undefined,
    fingerprint: event.fingerprint,
    tags: event.tags,
  };
}

export async function initializeErrorTracking(): Promise<boolean> {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_RUNTIME !== "nodejs" || !dsn) return false;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT?.trim() || "production",
    sendDefaultPii: false,
    enableLogs: false,
    tracesSampleRate: 0,
    attachStacktrace: true,
    maxBreadcrumbs: 0,
    beforeSend: privacySafeErrorEvent,
  });
  return true;
}

export const captureRequestError: Instrumentation.onRequestError = async (error, _request, context) => {
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_RUNTIME !== "nodejs" || !process.env.SENTRY_DSN) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.withScope((scope) => {
    scope.setTag("router_kind", context.routerKind);
    scope.setTag("route_type", context.routeType);
    // This is Next's static route pattern, never the requested URL/query string.
    scope.setTag("route_path", context.routePath);
    scope.setFingerprint([context.routePath, error instanceof Error ? error.name : typeof error]);
    Sentry.captureException(error);
  });
  await Sentry.flush(2_000);
};
