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
  "ALLOW_PROVIDER_TESTS",
]);

const offlineUrlValues = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1",
  SUPABASE_URL: "http://127.0.0.1:1",
  SUPABASE_DB_URL: "postgresql://offline:offline@127.0.0.1:1/offline",
  DATABASE_URL: "postgresql://offline:offline@127.0.0.1:1/offline",
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
  for (const key of providerEnvironmentKeys) environment[key] = offlineUrlValues[key] ?? "";

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

export { offlineUrlValues, providerEnvironmentKeys };
