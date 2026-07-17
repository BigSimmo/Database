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

  // Playwright validates a real production build, but its runner must remain a
  // provider-free demo. Permit that otherwise-invalid combination only for the
  // runner's isolated output and inert loopback environment. A partial or
  // externally-addressed configuration still falls through to the production
  // guard below and fails closed.
  if (process.env.PLAYWRIGHT_OFFLINE_MODE === "true") {
    const isolatedOutput = /^\.next-playwright\/[a-z0-9-]+\/dist$/i.test(process.env.NEXT_DIST_DIR ?? "");
    const providerFree =
      process.env.NEXT_PUBLIC_DEMO_MODE === "true" &&
      process.env.RAG_PROVIDER_MODE === "offline" &&
      process.env.NEXT_PUBLIC_SUPABASE_URL === "http://127.0.0.1:1" &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !process.env.OPENAI_API_KEY;
    if (isolatedOutput && providerFree) return;
    throw new Error("Refusing to start: invalid isolated Playwright offline environment.");
  }

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

  // Throw actionable errors now if the configured backend is missing or points at
  // the wrong project, instead of failing per-request. Explicit offline deployments
  // intentionally have no OpenAI credential; auto/openai modes still fail closed.
  requireServerEnv();
  if (env.RAG_PROVIDER_MODE !== "offline") requireOpenAIEnv();

  // A keyed HMAC secret must be present so clinical-query hashes written to the log
  // tables are not reversible (PIA-2). Fail closed rather than degrade to weak SHA-256.
  requireQueryHashSecret();
}
