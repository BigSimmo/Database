import "server-only";

import { z } from "zod";
import { assertExpectedSupabaseProjectConfig, checkSupabaseProjectConfig } from "@/lib/supabase/project";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_PROJECT_REF: z.string().optional(),
  SUPABASE_PROJECT_NAME: z.string().optional(),
  // Optional: declares a second accepted (staging) Supabase project so the
  // identity guard accepts it. Both must be set; the ref must differ from
  // production. See docs/staging-setup.md and src/lib/supabase/project.ts.
  SUPABASE_STAGING_PROJECT_REF: z.string().optional(),
  SUPABASE_STAGING_PROJECT_NAME: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_DB_URL: z.string().url().optional(),
  HEALTH_DEEP_PROBE_SECRET: z.string().min(16).optional(),
  NEXT_PUBLIC_LOCAL_NO_AUTH: z.enum(["true", "false"]).optional().default("false"),
  LOCAL_NO_AUTH: z.enum(["true", "false"]).optional().default("false"),
  LOCAL_NO_AUTH_OWNER_EMAIL: z.string().optional(),
  LOCAL_NO_AUTH_OWNER_ID: z.string().optional(),
  PUBLIC_WORKSPACE_OWNER_ID: z.string().uuid().optional(),
  NEXT_PUBLIC_PUBLIC_UPLOADS_ENABLED: z.enum(["true", "false"]).optional(),
  NEXT_PUBLIC_MOCKUPS_ENABLED: z.enum(["true", "false"]).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  // Must match the vector(N) dimension in supabase/schema.sql. Changing the embedding
  // model without updating this (and the schema) silently corrupts ingestion (IDX-C2).
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  OPENAI_ANSWER_MODEL: z.string().default("gpt-5.5"),
  OPENAI_FAST_ANSWER_MODEL: z.string().default("gpt-5.5"),
  // Strong tier intentionally stays on the standard (non-"pro") model. Fast vs strong
  // is differentiated by reasoning effort (OPENAI_*_REASONING_EFFORT), not model tier.
  OPENAI_STRONG_ANSWER_MODEL: z.string().default("gpt-5.5"),
  // Reasoning models (gpt-5*) draw reasoning tokens from this same budget, so a
  // low cap can starve the JSON answer payload and silently truncate clinical
  // content (doses/thresholds cut mid-sentence). Raised default to 4000 for headroom;
  // if output is still cut off, createTextResult now flags it as truncated (GEN-C1).
  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(4000),
  OPENAI_QUERY_CACHE_SIZE: z.coerce.number().int().nonnegative().default(200),
  // Max inputs per embeddings request. The OpenAI embeddings endpoint caps a single
  // request at 2048 inputs / ~300k tokens; a full-corpus re-embed of ~400k texts in one
  // call would exceed that and fail (IDX-C3). embedTexts splits unique inputs into
  // batches of this size. 256 keeps total tokens well under the ceiling even for the
  // largest (narrative-profile) chunks while staying far below the 2048 input cap.
  OPENAI_EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().max(2048).default(256),
  OPENAI_VISION_MODEL: z.string().default("gpt-5.5"),
  OPENAI_VISION_IMAGE_DETAIL: z.enum(["auto", "low", "high"]).default("auto"),
  OPENAI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  // Answer generation has a source-backed fallback path, but a too-tight budget
  // makes a strong reasoning model time out and silently degrade to stitched
  // extractive prose (the "unnatural answer" failure mode). The product decision is
  // to favour natural, model-written answers within ~20-30s, so this sits well above
  // the old 12s default while staying under the OPENAI_REQUEST_TIMEOUT_MS ceiling.
  // 30s (up from 25s) gives verbose strong-route answers margin so they finish rather
  // than fail-closed; strong reasoning effort is also query-class-capped to keep the
  // tail latency in budget (see strongReasoningEffortForQueryClass).
  OPENAI_ANSWER_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  OPENAI_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),
  OPENAI_GENERATION_MAX_RETRIES: z.coerce.number().int().nonnegative().default(0),
  OPENAI_PROMPT_CACHE_RETENTION: z.enum(["off", "in_memory", "24h"]).default("24h"),
  OPENAI_STORE_RESPONSES: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  OPENAI_FAST_REASONING_EFFORT: z.enum(["none", "low", "medium", "high", "xhigh"]).default("low"),
  OPENAI_STRONG_REASONING_EFFORT: z.enum(["none", "low", "medium", "high", "xhigh"]).default("high"),
  OPENAI_SUMMARY_REASONING_EFFORT: z.enum(["none", "low", "medium", "high", "xhigh"]).default("medium"),
  OPENAI_VISION_REASONING_EFFORT: z.enum(["none", "low", "medium", "high", "xhigh"]).default("low"),
  OPENAI_TEXT_VERBOSITY: z.enum(["low", "medium", "high"]).default("low"),
  // Answer/search provider mode. Controls whether OpenAI (embeddings + synthesis) is used.
  // - "auto" (default): use OpenAI when a usable key is present and the call succeeds;
  //   automatically degrade to a source-only (embedding-free, deterministic) answer when
  //   the key is missing/invalid or the provider fails. The fallback is ON BY DEFAULT.
  // - "openai": legacy behaviour — always attempt OpenAI; do not pre-empt with source-only.
  // - "offline": never call OpenAI at all (no embeddings, no generation); lexical retrieval
  //   + deterministic source-only answers only. Fails closed when evidence is weak.
  RAG_PROVIDER_MODE: z.enum(["auto", "openai", "offline"]).default("auto"),
  // Optional JSON override for app-layer ranking weights (see src/lib/ranking-config.ts).
  // Lets tuning/eval experiments adjust the second-stage rerank weights, document-diversity
  // demotion, and freshness decay WITHOUT a code change. Omitted/malformed => current defaults.
  RAG_RANKING_CONFIG: z.string().optional(),
  // P8b extension: when strict-AND text retrieval returns weak-but-nonzero matches (sparse
  // result set or negligible top text_rank), append OR-relaxed recall behind the strict
  // matches. Default OFF: with it on, the golden retrieval eval measured OR-noise displacing
  // the expected document out of top-5 (opioid-withdrawal-doses docRecall@5 1.0 -> 0.0) —
  // "append-only" at the RPC merge is not append-only after re-ranking. Opt-in experiment
  // flag only; re-enable solely behind a fresh 34/34 golden run.
  RAG_TEXT_WEAK_OR_RELAXATION: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  RAG_REGISTRY_CORPUS_EMBEDDING: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  RAG_ANSWER_CACHE_TTL_MS: z.coerce.number().int().nonnegative().default(300000),
  RAG_ANSWER_CACHE_SIZE: z.coerce.number().int().nonnegative().default(100),
  RAG_SEARCH_CACHE_TTL_MS: z.coerce.number().int().nonnegative().default(60000),
  RAG_SEARCH_CACHE_SIZE: z.coerce.number().int().nonnegative().default(200),
  RAG_AWAIT_QUERY_LOGS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  // Clinical search queries can contain patient-identifying text (names, MRNs,
  // "patient with X on Y dose"). Default OFF: persist only hash-derived
  // placeholders. Set true only where retaining raw query
  // text is permitted and a retention policy exists (RET-H4).
  RAG_PERSIST_RAW_QUERY_TEXT: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  // Audit M15: server-side key for the redacted query hash. When set, stored
  // query hashes are HMAC-SHA256 (not offline-reversible, not correlatable
  // outside this deployment). When unset, the legacy unsalted SHA-256 is kept
  // for continuity with previously stored rows.
  RAG_QUERY_HASH_SECRET: z.string().min(16).optional(),
  SUPABASE_DOCUMENT_BUCKET: z.string().default("clinical-documents"),
  SUPABASE_IMAGE_BUCKET: z.string().default("clinical-images"),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().max(150).default(150),
  MAX_IMPORT_JOBS_PER_RUN: z.coerce.number().int().positive().default(5),
  MAX_IMPORT_BYTES_PER_RUN: z.coerce.number().int().positive().default(157286400),
  CHUNK_SIZE: z.coerce.number().int().positive().default(2000),
  CHUNK_OVERLAP: z.coerce.number().int().nonnegative().default(200),
  // Chunking strategy (CI-1). "page" (default) = the current page-bounded chunker, byte-for-
  // byte unchanged. "document" = structure-aware chunking that lets a chunk span a page break
  // within a section, so dose tables / monitoring protocols split across a page boundary stay
  // together. Enabled only for the eval-gated shadow re-index, never silently for live users.
  CHUNK_STRATEGY: z.enum(["page", "document"]).default("page"),
  WORKER_POLL_MS: z.coerce.number().int().positive().default(30000),
  WORKER_BATCH_SIZE: z.coerce.number().int().positive().default(3),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),
  WORKER_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  WORKER_STALE_AFTER_MINUTES: z.coerce.number().int().positive().default(45),
  WORKER_HEALTH_BACKOFF_MS: z.coerce.number().int().positive().default(120000),
  WORKER_MAX_CLAIM_FAILURES: z.coerce.number().int().positive().default(3),
  WORKER_PROGRESS_UPDATE_MIN_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
  WORKER_MAX_CAPTIONED_IMAGES_PER_DOCUMENT: z.coerce.number().int().nonnegative().default(15),
  WORKER_MAX_CAPTIONED_IMAGES_PER_PAGE: z.coerce.number().int().nonnegative().default(2),
  WORKER_VISION_CONCURRENCY: z.coerce.number().int().positive().default(4),
  WORKER_INLINE_ENRICHMENT: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  PYTHON_BIN: z.string().default("python"),
  NEXT_PUBLIC_DEMO_MODE: z.enum(["true", "false"]).optional().default("false"),
});

const parsedEnv = envSchema.parse(process.env);
const nonProAnswerModelFallback = "gpt-5.5";

function isProAnswerModel(model: string) {
  return /(?:^|[-_])pro(?:$|[-_])/i.test(model);
}

function runtimeAnswerModel(model: string) {
  return isProAnswerModel(model) ? nonProAnswerModelFallback : model;
}

export const requestedOpenAIAnswerModels = {
  answer: parsedEnv.OPENAI_ANSWER_MODEL,
  fastAnswer: parsedEnv.OPENAI_FAST_ANSWER_MODEL,
  strongAnswer: parsedEnv.OPENAI_STRONG_ANSWER_MODEL,
} as const;

export const env = {
  ...parsedEnv,
  OPENAI_ANSWER_MODEL: runtimeAnswerModel(parsedEnv.OPENAI_ANSWER_MODEL),
  OPENAI_FAST_ANSWER_MODEL: runtimeAnswerModel(parsedEnv.OPENAI_FAST_ANSWER_MODEL),
  OPENAI_STRONG_ANSWER_MODEL: runtimeAnswerModel(parsedEnv.OPENAI_STRONG_ANSWER_MODEL),
} satisfies typeof parsedEnv;

export function requireServerEnv(): {
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
} {
  const missing = [
    ["NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL],
    ["SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Missing server environment variables: ${missing.map(([key]) => key).join(", ")}. See .env.example.`,
    );
  }

  assertExpectedSupabaseProjectConfig(env);
  return env as { NEXT_PUBLIC_SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string };
}

export function requireOpenAIEnv() {
  if (!env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY. See .env.example.");
  }
}

// Clinical query text is redacted to a keyed HMAC pseudonym before it is logged
// (see query-privacy.ts). Without RAG_QUERY_HASH_SECRET the hash silently degrades
// to an unsalted, dictionary-reversible SHA-256, which defeats the redaction: a
// reader of the log tables can hash candidate patient/drug strings offline and match
// rows. Production must fail closed rather than log real clinical queries under the
// weak digest. See docs/privacy-impact-assessment.md (PIA-2).
export function requireQueryHashSecret() {
  if (!env.RAG_QUERY_HASH_SECRET) {
    throw new Error(
      "Missing RAG_QUERY_HASH_SECRET. It is required in production so logged clinical-query hashes are keyed HMAC-SHA256 pseudonyms, not offline-reversible SHA-256. Set a random secret (min 16 chars). See docs/privacy-impact-assessment.md (PIA-2).",
    );
  }
}

export function isDemoMode() {
  // Explicit opt-in is honored in every environment (e.g. a deliberate demo deploy).
  if (env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return true;
  }
  // Production must never silently fall back to demo mode: missing or mismatched
  // Supabase config has to fail loudly (see requireServerEnv / instrumentation.ts),
  // not serve unauthenticated demo content from the 22 routes that gate on this
  // (DEMO fail-open guard). Mirrors the prod guard in isLocalNoAuthMode below.
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  const projectCheck = checkSupabaseProjectConfig(env);
  return !env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || projectCheck.status === "mismatch";
}

export function isLocalNoAuthMode() {
  const publicNoAuth = process.env.NEXT_PUBLIC_LOCAL_NO_AUTH === "true";
  const serverNoAuth = typeof window === "undefined" && env.LOCAL_NO_AUTH === "true";

  return process.env.NODE_ENV !== "production" && (publicNoAuth || serverNoAuth);
}

export function publicWorkspaceOwnerId() {
  return env.PUBLIC_WORKSPACE_OWNER_ID?.trim() || null;
}

export function publicUploadsEnabled() {
  return env.NEXT_PUBLIC_PUBLIC_UPLOADS_ENABLED === "true";
}

export function mockupsEnabled() {
  // Design-exploration mockup routes (/mockups/*) are a development surface.
  // They stay reachable in dev/test builds, but a production deploy 404s them
  // unless explicitly opted in (mirrors the prod guard in isLocalNoAuthMode).
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  return env.NEXT_PUBLIC_MOCKUPS_ENABLED === "true";
}
