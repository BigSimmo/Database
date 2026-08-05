const providerEnvironmentKeys = Object.freeze([
  "OPENAI_API_KEY",
  "OPENAI_ORG_ID",
  "OPENAI_PROJECT_ID",
  "OPENAI_BASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_URL",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_PROJECT_NAME",
  "SUPABASE_STAGING_PROJECT_REF",
  "SUPABASE_STAGING_PROJECT_NAME",
  "DATABASE_URL",
  "POSTGRES_PASSWORD",
  "E2E_AUTH_ENABLED",
  "E2E_USER_EMAIL",
  "E2E_USER_PASSWORD",
  "SENTRY_AUTH_TOKEN",
  // Public client DSN is still a live monitoring destination — scrub it too so
  // Playwright/Lighthouse production builds cannot bake a real browser DSN.
  "NEXT_PUBLIC_SENTRY_DSN",
  "SENTRY_DSN",
  "ALLOW_PROVIDER_TESTS",
]);

// Inert loopback DSN shared by server + client so requireSentryEnv never sees a
// mismatch, the Zod `.url()` schema still parses, and Next/Vite cannot reload a
// real DSN from `.env.local` (keys must be present — deletion would let them
// return). Traffic, if any SDK path still fires, targets 127.0.0.1 only.
const OFFLINE_SENTRY_DSN = "https://offline@127.0.0.1/0";

const offlineUrlValues = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1",
  SUPABASE_URL: "http://127.0.0.1:1",
  SUPABASE_DB_URL: "postgresql://offline:offline@127.0.0.1:1/offline",
  DATABASE_URL: "postgresql://offline:offline@127.0.0.1:1/offline",
  NEXT_PUBLIC_SENTRY_DSN: OFFLINE_SENTRY_DSN,
  SENTRY_DSN: OFFLINE_SENTRY_DSN,
});

// Feature flags / sampling, not credentials: force them off in offline wrappers
// without joining the credential inventory (which would also demand setup/raw-env
// scrubbing for names that never carry a secret). Applied to every consumer of
// offlineTestEnvironment (Vitest, Playwright, Lighthouse, CLS) by design — the
// offline contract is provider-free, so default-on Sentry log/trace behaviour
// must be opted into via an explicit test argument, not the ambient environment.
const offlineSentryControlFlags = Object.freeze({
  SENTRY_ENABLE_LOGS: "false",
  SENTRY_SEND_TEST_LOG: "false",
  // Belt-and-suspenders with the inert DSN: keep DB/perf tracing off even if a
  // future change stops treating the loopback DSN as non-production.
  SENTRY_TRACES_SAMPLE_RATE: "0",
});

/**
 * @param {Record<string, string | undefined>} source
 * @param {Record<string, string | undefined>} overrides
 */
export function offlineTestEnvironment(source = process.env, overrides = {}) {
  const environment = { ...source };
  // Explicit values both scrub inherited secrets and prevent Next/Vite from
  // repopulating the same names from a repository-local env file. URL-shaped
  // settings use inert loopback values so the runtime env schema still parses.
  //
  // Sentry DSNs cannot be blanked (`z.string().url().optional()` rejects "") and
  // cannot be deleted (Next would reload `.env.local`). The inert loopback URL
  // plus forced-off control flags keeps offline runs provider-free.
  for (const key of providerEnvironmentKeys) {
    environment[key] = offlineUrlValues[key] ?? "";
  }
  Object.assign(environment, offlineSentryControlFlags);

  return {
    ...environment,
    RAG_PROVIDER_MODE: "offline",
    NEXT_PUBLIC_DEMO_MODE: "true",
    ...overrides,
  };
}

/** @param {Record<string, string | undefined>} environment */
export function requireProviderTestPermission(environment = process.env) {
  if (environment.ALLOW_PROVIDER_TESTS !== "true") {
    throw new Error(
      "Live provider tests are disabled. Set ALLOW_PROVIDER_TESTS=true only after explicit provider-test approval.",
    );
  }
}

/** @param {Record<string, string | undefined>} environment */
export function providerFreeCloudLiveTestGap(environment = process.env) {
  const providerFree =
    environment.ALLOW_PROVIDER_TESTS === "true" &&
    environment.CODEX_CLOUD === "1" &&
    (environment.CODEX_CLOUD_ACCESS_PROFILE ?? "offline") === "offline";
  if (!providerFree) return null;
  return (
    "Live provider test capability gap: ALLOW_PROVIDER_TESTS is authorized, but agent-phase provider " +
    "credentials are intentionally unavailable in CODEX_CLOUD_ACCESS_PROFILE=offline. Run this check " +
    "locally/operator-side or in an explicitly provisioned connected Cloud profile."
  );
}

export { offlineUrlValues, offlineSentryControlFlags, OFFLINE_SENTRY_DSN, providerEnvironmentKeys };
