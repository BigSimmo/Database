import { describe, expect, it, vi } from "vitest";

describe("strict embedding dimension guard", () => {
  it("derives EXPECTED_EMBED_DIM from EMBEDDING_DIMENSIONS at module load time", async () => {
    vi.resetModules();
    vi.stubEnv("EMBEDDING_DIMENSIONS", "3");
    const mod = await import("../src/lib/embedding-dimensions");
    const vector = [0.1, 0.2];

    expect(mod.EXPECTED_EMBED_DIM).toBe(3);
    expect(() => mod.assertEmbeddingDim(vector, "test_vector")).toThrow(/2 dimensions; expected 3/);
  });

  it("accepts only finite vectors of the configured dimension", async () => {
    const { EXPECTED_EMBED_DIM, assertEmbeddingDim } = await import("../src/lib/embedding-dimensions");
    const vector = Array.from({ length: EXPECTED_EMBED_DIM }, () => 0.01);

    expect(assertEmbeddingDim(vector, "test_vector")).toBe(vector);
  });

  it("rejects non-arrays, wrong dimensions, and non-finite values", async () => {
    const { EXPECTED_EMBED_DIM, assertEmbeddingDim } = await import("../src/lib/embedding-dimensions");

    expect(() => assertEmbeddingDim("not-a-vector", "test_vector")).toThrow(/must be an array/);
    expect(() => assertEmbeddingDim([0.1, 0.2], "test_vector")).toThrow(
      new RegExp(`2 dimensions; expected ${EXPECTED_EMBED_DIM}`),
    );
    expect(() =>
      assertEmbeddingDim([...Array.from({ length: EXPECTED_EMBED_DIM - 1 }, () => 0), Infinity], "test_vector"),
    ).toThrow(new RegExp(`non-finite value at index ${EXPECTED_EMBED_DIM - 1}`));
  });
});
