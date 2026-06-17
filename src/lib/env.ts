import { z } from "zod";
import { assertExpectedSupabaseProjectConfig, checkSupabaseProjectConfig } from "@/lib/supabase/project";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_PROJECT_REF: z.string().optional(),
  SUPABASE_PROJECT_NAME: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  NEXT_PUBLIC_LOCAL_NO_AUTH: z.enum(["true", "false"]).optional().default("false"),
  LOCAL_NO_AUTH: z.enum(["true", "false"]).optional().default("false"),
  LOCAL_NO_AUTH_OWNER_EMAIL: z.string().optional(),
  LOCAL_NO_AUTH_OWNER_ID: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  // Must match the vector(N) dimension in supabase/schema.sql. Changing the embedding
  // model without updating this (and the schema) silently corrupts ingestion (IDX-C2).
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  OPENAI_ANSWER_MODEL: z.string().default("gpt-5.4-mini"),
  OPENAI_FAST_ANSWER_MODEL: z.string().default("gpt-5.4-mini"),
  OPENAI_STRONG_ANSWER_MODEL: z.string().default("gpt-5.4"),
  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(1400),
  OPENAI_QUERY_CACHE_SIZE: z.coerce.number().int().nonnegative().default(200),
  OPENAI_VISION_MODEL: z.string().default("gpt-5.4-mini"),
  OPENAI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  OPENAI_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),
  OPENAI_PROMPT_CACHE_RETENTION: z.enum(["off", "in_memory", "24h"]).default("in_memory"),
  OPENAI_STORE_RESPONSES: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  OPENAI_FAST_REASONING_EFFORT: z.enum(["none", "minimal", "low", "medium", "high"]).default("low"),
  OPENAI_STRONG_REASONING_EFFORT: z.enum(["none", "minimal", "low", "medium", "high"]).default("medium"),
  OPENAI_SUMMARY_REASONING_EFFORT: z.enum(["none", "minimal", "low", "medium", "high"]).default("low"),
  OPENAI_VISION_REASONING_EFFORT: z.enum(["none", "minimal", "low", "medium", "high"]).default("low"),
  OPENAI_TEXT_VERBOSITY: z.enum(["low", "medium", "high"]).default("low"),
  RAG_ANSWER_CACHE_TTL_MS: z.coerce.number().int().nonnegative().default(300000),
  RAG_ANSWER_CACHE_SIZE: z.coerce.number().int().nonnegative().default(100),
  RAG_SEARCH_CACHE_TTL_MS: z.coerce.number().int().nonnegative().default(60000),
  RAG_SEARCH_CACHE_SIZE: z.coerce.number().int().nonnegative().default(200),
  RAG_AWAIT_QUERY_LOGS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  // Clinical search queries can contain patient-identifying text (names, MRNs,
  // "patient with X on Y dose"). Default OFF: persist only a hash + normalized
  // tokens needed for miss-promotion. Set true only where retaining raw query
  // text is permitted and a retention policy exists (RET-H4).
  RAG_PERSIST_RAW_QUERY_TEXT: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SUPABASE_DOCUMENT_BUCKET: z.string().default("clinical-documents"),
  SUPABASE_IMAGE_BUCKET: z.string().default("clinical-images"),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(150),
  CHUNK_SIZE: z.coerce.number().int().positive().default(2000),
  CHUNK_OVERLAP: z.coerce.number().int().nonnegative().default(200),
  WORKER_POLL_MS: z.coerce.number().int().positive().default(5000),
  WORKER_BATCH_SIZE: z.coerce.number().int().positive().default(24),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  WORKER_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  WORKER_STALE_AFTER_MINUTES: z.coerce.number().int().positive().default(45),
  PYTHON_BIN: z.string().default("python"),
  NEXT_PUBLIC_DEMO_MODE: z.enum(["true", "false"]).optional().default("false"),
});

export const env = envSchema.parse(process.env);

export function requireServerEnv() {
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
}

export function requireOpenAIEnv() {
  if (!env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY. See .env.example.");
  }
}

export function isDemoMode() {
  const projectCheck = checkSupabaseProjectConfig(env);
  return (
    env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.SUPABASE_SERVICE_ROLE_KEY ||
    projectCheck.status === "mismatch"
  );
}

export function isLocalNoAuthMode() {
  const publicNoAuth = process.env.NEXT_PUBLIC_LOCAL_NO_AUTH === "true";
  const serverNoAuth = typeof window === "undefined" && env.LOCAL_NO_AUTH === "true";

  return process.env.NODE_ENV !== "production" && (publicNoAuth || serverNoAuth);
}
