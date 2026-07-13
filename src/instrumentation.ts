// Gated server-side Sentry init. SENTRY_DSN is unset by default, so this is a
// no-op (and never imports the SDK) until Sentry is configured. Runs for both the
// Node.js and Edge runtimes so server + proxy errors are captured. The SDK is
// dynamically imported so a deployment without a DSN never loads it.
async function initSentryServer() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  const [Sentry, { scrubSentryErrorEvent }] = await Promise.all([
    import("@sentry/nextjs"),
    import("@/lib/observability/sentry-scrub"),
  ]);
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0) || 0,
    sendDefaultPii: false,
    beforeSend: scrubSentryErrorEvent,
  });
}

// Next.js calls register() once when a server instance starts, before it serves
// any requests. We use it to fail fast: a clinical production server must be fully
// and correctly configured rather than silently degrading — or, worse, serving
// unauthenticated demo content — on the first request. See production-readiness
// plan items 0.1 and 0.3.
export async function register() {
  // Wire error tracking first so a misconfiguration thrown by the gates below is
  // itself reportable. No-op unless SENTRY_DSN is set.
  await initSentryServer();

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

  const { isDemoMode, requireOpenAIEnv, requireQueryHashSecret, requireServerEnv } = await import("@/lib/env");

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
}

// Next.js calls onRequestError for every uncaught error thrown while rendering or
// handling a request (App Router routes, RSC, and the proxy layer). It is a
// separate export from register() and must NOT be gated behind register()'s
// nodejs/production early-returns. No-op until SENTRY_DSN is set.
export async function onRequestError(...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
