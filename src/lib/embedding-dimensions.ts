import * as envModule from "./env";

function expectedEmbeddingDimensions() {
  const configured =
    Object.prototype.hasOwnProperty.call(envModule, "env") &&
    typeof (envModule as { env?: unknown }).env === "object" &&
    (envModule as { env?: { EMBEDDING_DIMENSIONS?: unknown } }).env !== null
      ? (envModule as { env?: { EMBEDDING_DIMENSIONS?: unknown } }).env?.EMBEDDING_DIMENSIONS
      : undefined;
  if (typeof configured === "number" && Number.isInteger(configured) && configured > 0) {
    return configured;
  }

  const fallback = Number(process.env.EMBEDDING_DIMENSIONS ?? 1536);
  return Number.isInteger(fallback) && fallback > 0 ? fallback : 1536;
}

export const EXPECTED_EMBED_DIM = expectedEmbeddingDimensions();

// IDX-C2 (fail-fast): the embedding dimension is declared in three places that MUST agree
// — the configured EMBEDDING_DIMENSIONS, the OpenAI model's output, and the schema's
// vector(N) columns. A mismatch corrupts ingestion silently (every write throws, or worse,
// a future model change slips through). These helpers let a startup check compare the
// configured dimension against supabase/schema.sql offline, before any DB work.
export function parseSchemaVectorDimensions(schemaSql: string): number[] {
  const dims = new Set<number>();
  for (const match of schemaSql.matchAll(/\bvector\((\d+)\)/gi)) {
    const value = Number(match[1]);
    if (Number.isInteger(value) && value > 0) dims.add(value);
  }
  return [...dims].sort((a, b) => a - b);
}

// Returns a human-readable problem description, or null when the configured dimension is
// consistent with every vector(N) column in the schema. Absence of any vector column is
// treated as a problem (the schema we were handed is not the RAG schema).
export function describeSchemaDimensionMismatch(configuredDim: number, schemaSql: string): string | null {
  const schemaDims = parseSchemaVectorDimensions(schemaSql);
  if (schemaDims.length === 0) {
    return "No vector(N) columns found in schema.sql — cannot verify embedding dimensions.";
  }
  if (schemaDims.length > 1) {
    return `schema.sql declares inconsistent vector dimensions ${schemaDims.join(", ")}; all embedding columns must share one dimension.`;
  }
  if (schemaDims[0] !== configuredDim) {
    return `EMBEDDING_DIMENSIONS=${configuredDim} does not match schema vector(${schemaDims[0]}). Re-embedding with a mismatched dimension corrupts retrieval; align OPENAI_EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, and the schema before indexing.`;
  }
  return null;
}

export function assertEmbeddingDim(vec: unknown, context: string): number[] {
  if (!Array.isArray(vec)) {
    throw new Error(`${context} embedding must be an array.`);
  }
  if (vec.length !== EXPECTED_EMBED_DIM) {
    throw new Error(`${context} embedding has ${vec.length} dimensions; expected ${EXPECTED_EMBED_DIM}.`);
  }
  for (const [index, value] of vec.entries()) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${context} embedding contains a non-finite value at index ${index}.`);
    }
  }
  return vec;
}
