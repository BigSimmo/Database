import { describe, expect, it } from "vitest";
import { EXPECTED_EMBED_DIM, assertEmbeddingDim } from "../src/lib/embedding-dimensions";

describe("strict embedding dimension guard", () => {
  it("accepts only finite 1536-dimensional vectors", () => {
    const vector = Array.from({ length: EXPECTED_EMBED_DIM }, () => 0.01);

    expect(assertEmbeddingDim(vector, "test_vector")).toBe(vector);
  });

  it("rejects non-arrays, wrong dimensions, and non-finite values", () => {
    expect(() => assertEmbeddingDim("not-a-vector", "test_vector")).toThrow(/must be an array/);
    expect(() => assertEmbeddingDim([0.1, 0.2], "test_vector")).toThrow(/2 dimensions; expected 1536/);
    expect(() =>
      assertEmbeddingDim([...Array.from({ length: EXPECTED_EMBED_DIM - 1 }, () => 0), Infinity], "test_vector"),
    ).toThrow(/non-finite value at index 1535/);
  });
});
