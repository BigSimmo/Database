export interface RAGPreflightChecks {
  maxTokens?: number;
  maxCost?: number;
  requiredQualityThreshold?: number;
}

export function validatePreflightConstraints(
  estimatedTokens: number,
  estimatedCost: number,
  constraints: RAGPreflightChecks
): string[] {
  const errors: string[] = [];

  if (constraints.maxTokens && estimatedTokens > constraints.maxTokens) {
    errors.push(`Estimated tokens (${estimatedTokens}) exceeds maximum allowed (${constraints.maxTokens}).`);
  }

  if (constraints.maxCost && estimatedCost > constraints.maxCost) {
    errors.push(`Estimated cost ($${estimatedCost}) exceeds maximum allowed ($${constraints.maxCost}).`);
  }

  return errors;
}

export function getOfflineEnvironment() {
  return {
    RAG_PROVIDER_MODE: "offline",
    OPENAI_API_KEY: "",
    OPENAI_ORG_ID: "",
    OPENAI_PROJECT_ID: "",
    NEXT_PUBLIC_SUPABASE_URL: "https://offline.invalid",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "offline-placeholder",
    SUPABASE_SERVICE_ROLE_KEY: "offline-placeholder",
    SUPABASE_DB_URL: "postgresql://offline:offline@offline.invalid:5432/offline",
  };
}
