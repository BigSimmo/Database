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
