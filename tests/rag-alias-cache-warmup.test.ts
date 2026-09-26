import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  // The rag_aliases cache lives on globalThis (shared with the startup warm), so resetting
  // modules no longer empties it; clear it so each scenario counts its own alias read.
  (globalThis as { [key: symbol]: Map<string, unknown> | undefined })[Symbol.for("psychsift.ragAliasCache")]?.clear();
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

describe("rag_aliases cache sharing", () => {
  it("serves a startup warm to a separately loaded copy of the module", async () => {
    // A production build loads this module once for instrumentation.ts and again for the route
    // handlers; the startup warm only helps if both copies read the same entries.
    const from = vi.fn(() =>
      createAliasQuery({ data: [{ alias: "SSRI", canonical: "selective serotonin reuptake inhibitor" }], error: null }),
    );
    const supabase = { from } as never;
    const bootCopy = await import("../src/lib/rag/rag-retrieval-variants");
    await bootCopy.warmEnabledRagAliasCache(supabase);

    vi.resetModules();
    const routeCopy = await import("../src/lib/rag/rag-retrieval-variants");
    expect(routeCopy).not.toBe(bootCopy);
    const aliases = await routeCopy.fetchEnabledRagAliases(supabase, undefined, { includePublic: true });

    expect(aliases).toEqual([expect.objectContaining({ alias: "SSRI" })]);
    expect(from).toHaveBeenCalledTimes(1);
  });
});
