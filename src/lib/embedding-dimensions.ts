import { env } from "./env";

export const EXPECTED_EMBED_DIM = env.EMBEDDING_DIMENSIONS;

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
