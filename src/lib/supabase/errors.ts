function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error ?? "");
}

export function isSupabaseApiKeyConfigurationError(error: unknown) {
  return /\b(?:unregistered|invalid)\s+api\s+key\b/i.test(errorMessage(error));
}

export function nonProductionSupabaseDemoFallbackReason(error: unknown) {
  if (process.env.NODE_ENV === "production") return null;
  if (!isSupabaseApiKeyConfigurationError(error)) return null;
  // Item 19 (rag-hybrid-findings): this fallback silently swaps demo data in for live search
  // and answer responses outside production, which can make a broken live path look healthy
  // during local/dev testing. Keep the behaviour, but make it loud in the server log — the
  // only other signal is the easy-to-miss X-Clinical-KB-Fallback response header.
  console.warn(
    "[clinical-kb] Supabase unavailable — serving DEMO data as a non-production fallback. " +
      "Live search/answer paths are NOT being exercised. Check NEXT_PUBLIC_SUPABASE_URL / " +
      "SUPABASE_SERVICE_ROLE_KEY if this is unexpected.",
  );
  return "supabase_api_key_configuration_unavailable";
}
