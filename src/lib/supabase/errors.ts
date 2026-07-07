function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error ?? "");
}

export function isSupabaseApiKeyConfigurationError(error: unknown) {
  const message = errorMessage(error);
  return (
    /\b(?:unregistered|invalid)\s+api\s+key\b/i.test(message) ||
    // Post-rotation messages confirmed live (2026-07-06): PostgREST returns
    // "Legacy API keys are disabled" once the anon/service_role JWTs are turned
    // off, and "Secret API key required" when a publishable key is sent to a
    // secret-only endpoint. Both mean the configured key is wrong, not the query.
    /\blegacy\s+api\s+keys?\s+(?:are\s+)?disabled\b/i.test(message) ||
    /\bsecret\s+api\s+key\s+required\b/i.test(message)
  );
}

export function nonProductionSupabaseDemoFallbackReason(error: unknown) {
  if (process.env.NODE_ENV === "production") return null;
  if (!isSupabaseApiKeyConfigurationError(error)) return null;
  return "supabase_api_key_configuration_unavailable";
}
