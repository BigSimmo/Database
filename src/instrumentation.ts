import type { Instrumentation } from "next";

// Next.js calls register() once when a server instance starts, before it serves
// any requests. We use it to fail fast: a clinical production server must be fully
// and correctly configured rather than silently degrading — or, worse, serving
// unauthenticated demo content — on the first request. See production-readiness
// plan items 0.1 and 0.3.
export async function register() {
  // Only the Node.js server runtime in production needs this gate. Development
  // keeps its local/demo fallbacks, and the Edge runtime doesn't use the Node-only
  // server configuration these checks validate.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  // Defense in depth: no-auth must never be active in a production build (even
  // though isLocalNoAuthMode() already hard-guards on NODE_ENV).
  if (process.env.LOCAL_NO_AUTH === "true" || process.env.NEXT_PUBLIC_LOCAL_NO_AUTH === "true") {
    throw new Error("Refusing to start: local no-auth mode is enabled in a production build.");
  }

  const { env, isDemoMode, requireOpenAIEnv, requireQueryHashSecret, requireServerEnv } = await import("@/lib/env");

  // A clinical production server must run against real, configured backends — never
  // in demo mode, which bypasses auth and serves canned content.
  if (isDemoMode()) {
    throw new Error(
      "Refusing to start: demo mode is enabled in a production build. Unset NEXT_PUBLIC_DEMO_MODE and configure Supabase.",
    );
  }

  // Throw actionable errors now if Supabase project / service-role / OpenAI config
  // is missing or points at the wrong project, instead of failing per-request.
  requireServerEnv();
  requireOpenAIEnv();

  // A keyed HMAC secret must be present so clinical-query hashes written to the log
  // tables are not reversible (PIA-2). Fail closed rather than degrade to weak SHA-256.
  requireQueryHashSecret();

  // Optional server-side error capture. Initialized last, deliberately: a
  // misconfigured server must fail the guards above, not report a half-configured
  // boot to Sentry. Fully inert without a DSN (see error-capture.ts).
  if (env.SENTRY_DSN) {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn: env.SENTRY_DSN,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      // Privacy boundary (clinical app): clinical queries and document content must
      // never leave the box. Strip request payloads/headers and breadcrumbs (which
      // could echo console lines); events carry only the error and the small
      // operational context supplied by error-capture.ts callers.
      beforeSend(event) {
        delete event.request;
        delete event.breadcrumbs;
        return event;
      },
      beforeBreadcrumb() {
        return null;
      },
    });
  }
}

// Uncaught request errors (route handlers, RSC renders, server actions). Errors the
// answer routes catch and convert to degraded responses never reach this hook — those
// are captured explicitly at the catch sites via error-capture.ts.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.SENTRY_DSN) return;
  const { captureServerException } = await import("@/lib/observability/error-capture");
  await captureServerException(error, {
    source: "onRequestError",
    // Path only — query strings could carry user input.
    path: request.path.split("?")[0],
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
