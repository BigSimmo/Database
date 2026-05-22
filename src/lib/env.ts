import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  OPENAI_ANSWER_MODEL: z.string().default("gpt-4.1"),
  OPENAI_VISION_MODEL: z.string().default("gpt-4.1-mini"),
  SUPABASE_DOCUMENT_BUCKET: z.string().default("clinical-documents"),
  SUPABASE_IMAGE_BUCKET: z.string().default("clinical-images"),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(150),
  CHUNK_SIZE: z.coerce.number().int().positive().default(2000),
  CHUNK_OVERLAP: z.coerce.number().int().nonnegative().default(200),
  WORKER_POLL_MS: z.coerce.number().int().positive().default(5000),
  WORKER_BATCH_SIZE: z.coerce.number().int().positive().default(24),
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
}

export function requireOpenAIEnv() {
  if (!env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY. See .env.example.");
  }
}

export function isDemoMode() {
  return env.NEXT_PUBLIC_DEMO_MODE === "true" || !env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY;
}
