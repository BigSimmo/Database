import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

function createAliasQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.is = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return query;
}

describe("warmEnabledRagAliasCache", () => {
  it("loads public aliases into the in-memory cache", async () => {
    const from = vi.fn(() =>
      createAliasQuery({
        data: [{ alias: "SSRI", canonical: "selective serotonin reuptake inhibitor", weight: 1 }],
        error: null,
      }),
    );
    const supabase = { from } as never;
    const { warmEnabledRagAliasCache, fetchEnabledRagAliases } = await import("../src/lib/rag/rag-retrieval-variants");

    await warmEnabledRagAliasCache(supabase);
    const aliases = await fetchEnabledRagAliases(supabase, undefined, { includePublic: true });

    expect(aliases).toEqual([
      expect.objectContaining({ alias: "SSRI", canonical: "selective serotonin reuptake inhibitor" }),
    ]);
    // Warm + cached read should only hit the table once (public scope).
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("does not throw when the warmup query fails", async () => {
    const from = vi.fn(() => createAliasQuery({ data: null, error: { message: "boom" } }));
    const { warmEnabledRagAliasCache } = await import("../src/lib/rag/rag-retrieval-variants");
    await expect(warmEnabledRagAliasCache({ from } as never)).resolves.toBeUndefined();
  });
});
