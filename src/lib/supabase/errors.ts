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
  return "supabase_api_key_configuration_unavailable";
}
