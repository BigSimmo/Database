import { env } from "@/lib/env";
import { PublicApiError } from "@/lib/http";

export type RagProviderMode = "auto" | "openai" | "offline";

/**
 * How the answer/search stack should treat the OpenAI provider.
 *
 * - "auto" (default): use OpenAI when a usable key is present and calls succeed; degrade to a
 *   source-only (embedding-free, deterministic) path when the key is missing or a call fails.
 * - "openai": always attempt OpenAI; do not pre-empt or silently degrade (legacy behaviour).
 * - "offline": never call OpenAI at all (no embeddings, no generation); lexical retrieval +
 *   deterministic source-only answers only, failing closed when evidence is weak.
 */
export function ragProviderMode(): RagProviderMode {
  return env.RAG_PROVIDER_MODE;
}

export function hasUsableOpenAIKey(): boolean {
  return Boolean(env.OPENAI_API_KEY);
}

/**
 * True when retrieval and answering must run without any OpenAI call. This is the case in
 * "offline" mode always, and in "auto" mode when no usable key is configured.
 */
export function isSourceOnlyMode(): boolean {
  const mode = ragProviderMode();
  if (mode === "offline") return true;
  if (mode === "openai") return false;
  return !hasUsableOpenAIKey();
}

/**
 * True when a runtime OpenAI failure should be degraded to a source-only answer rather than
 * surfaced as an error. Only "auto" mode degrades; "openai" surfaces, "offline" never calls.
 */
export function allowsAutoDegrade(): boolean {
  return ragProviderMode() === "auto";
}

export type ProviderFailureKind =
  | "missing_key"
  | "auth_failed"
  | "quota_exhausted"
  | "rate_limited"
  | "timeout"
  | "provider_failed";

/**
 * Classify why an OpenAI call failed, for telemetry and user-facing fallback messaging.
 * Works on both raw provider errors and the PublicApiError produced by mapOpenAIError.
 * Never returns provider internals — only a stable, coarse kind.
 */
export function classifyProviderFailure(error: unknown): ProviderFailureKind {
  const status =
    error instanceof PublicApiError
      ? error.status
      : typeof (error as { status?: unknown })?.status === "number"
        ? (error as { status: number }).status
        : undefined;
  const code =
    error instanceof PublicApiError
      ? error.details?.code
      : typeof (error as { code?: unknown })?.code === "string"
        ? (error as { code: string }).code
        : undefined;
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();

  if (code === "insufficient_quota" || /quota|billing/.test(message)) return "quota_exhausted";
  if (status === 401 || status === 403 || /authentication|unauthori[sz]ed|api key/.test(message)) {
    return "auth_failed";
  }
  if (code === "rate_limit_exceeded" || (status === 429 && /rate limit/.test(message))) return "rate_limited";
  if (status === 408 || status === 504 || /timed out|timeout|aborted/.test(message)) return "timeout";
  return "provider_failed";
}

/**
 * Reason string recorded on a degraded answer/search so the UI and telemetry can explain that
 * the response is source-only and may be lower quality. Maps a failure (or the static no-key
 * case) to a stable token.
 */
export function sourceOnlyReason(error?: unknown): string {
  if (error === undefined) {
    return ragProviderMode() === "offline" ? "source_only_offline_mode" : "source_only_no_api";
  }
  return `source_only_${classifyProviderFailure(error)}`;
}

/** Telemetry skip reason set on retrieval when embeddings are bypassed for provider reasons. */
export const SOURCE_ONLY_EMBEDDING_SKIP_REASON = "provider_source_only";
