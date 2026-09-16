import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * REGRESSION GUARD for the 2026-09-09 search slowdown.
 *
 * Until that day the registry domains of universal search read their catalogue through
 * `owner-catalogue-cache` (5 s TTL, single flight, LRU). Commit b753ed2b1 replaced it with
 * `readCanonicalSiteContentRecords`, which is the right source of truth, but the cache was not
 * carried across and nothing failed. Every registry search paid a full round trip from then on,
 * three per federated search and one per debounced keystroke, and catalogue search went from
 * effectively instant to visibly slow across every mode at once. It was found by reading git
 * history a week later, not by a test.
 *
 * These assertions are deliberately BEHAVIOURAL rather than a source-text check for the opt-in
 * flag. A grep for `cache: true` would pass the day someone refactors the read behind a new
 * helper and drops the caching again, which is exactly the shape of the original regression.
 * Counting round trips survives that refactor.
 *
 * If one of these fails, do not raise the expected count to make it pass. It means a catalogue
 * read reached the database more often than the search path intends, which is the defect.
 */

type RpcCall = { name: string; args: Record<string, unknown> };

/** One published form, in the row shape `read_site_content_public_records` returns. */
function catalogueRow(kind: string) {
  const record = {
    slug: `${kind}-record`,
    title: `${kind} record`,
    subtitle: "Catalogue entry",
    tags: ["transport"],
  };
  return {
    initialized: true,
    record,
    render_payload: record,
    snapshot: { state: "current", changeEpoch: "12", releaseId: "11111111-1111-5111-8111-111111111111" },
  };
}

type SearchSupabase = Parameters<typeof import("../src/lib/universal-search").runUniversalSearch>[0]["supabase"];

/**
 * Only `rpc` is exercised by the catalogue read, so the stub implements that and nothing else.
 * The double assertion is deliberate: a partial stub cannot structurally satisfy SupabaseClient,
 * and widening the production parameter type to accommodate a test would be the wrong trade.
 */
function fakeSupabase(calls: RpcCall[]): SearchSupabase {
  return {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      const kind = typeof args?.p_kind === "string" ? args.p_kind : "form";
      return Promise.resolve({ data: [catalogueRow(kind)], error: null });
    },
  } as unknown as SearchSupabase;
}

function catalogueReads(calls: RpcCall[]) {
  return calls.filter((call) => call.name === "read_site_content_public_records");
}

async function loadUniversalSearch() {
  // A fresh module graph is a fresh cache, so each test starts cold rather than inheriting
  // whatever the previous one warmed.
  vi.resetModules();
  return import("../src/lib/universal-search");
}

afterEach(() => {
  vi.resetModules();
});

describe("registry catalogue reads stay cached on the search path", () => {
  const registryDomains = ["forms", "services", "medications"] as const;

  it("reads each catalogue once per federated search, not once per lookup", async () => {
    const calls: RpcCall[] = [];
    const { runUniversalSearch } = await loadUniversalSearch();

    await runUniversalSearch({
      query: "transport",
      limitPerDomain: 5,
      domains: [...registryDomains],
      demo: false,
      supabase: fakeSupabase(calls),
    });

    const reads = catalogueReads(calls);
    expect(reads).toHaveLength(registryDomains.length);
    expect(new Set(reads.map((read) => read.args.p_kind))).toEqual(new Set(["form", "service", "medication"]));
  });

  // The typeahead symptom: a debounced keystroke sequence is many searches in a few seconds.
  // Without a cache each one pays the full read again, which is what made search feel slow.
  it("does not re-read the catalogue for a repeated search inside the fresh window", async () => {
    const calls: RpcCall[] = [];
    const { runUniversalSearch } = await loadUniversalSearch();
    const supabase = fakeSupabase(calls);

    for (const query of ["tra", "tran", "transport", "transport form"]) {
      await runUniversalSearch({
        query,
        limitPerDomain: 5,
        domains: [...registryDomains],
        demo: false,
        supabase,
      });
    }

    // Four searches, still one read per kind: the catalogue does not depend on the query.
    expect(catalogueReads(calls)).toHaveLength(registryDomains.length);
  });

  it("serves a single-domain search from the catalogue a federated search already warmed", async () => {
    const calls: RpcCall[] = [];
    const { runUniversalSearch } = await loadUniversalSearch();
    const supabase = fakeSupabase(calls);

    await runUniversalSearch({
      query: "transport",
      limitPerDomain: 5,
      domains: [...registryDomains],
      demo: false,
      supabase,
    });
    const afterFederated = catalogueReads(calls).length;

    await runUniversalSearch({
      query: "transport",
      limitPerDomain: 5,
      domains: ["forms"],
      demo: false,
      supabase,
    });

    expect(catalogueReads(calls)).toHaveLength(afterFederated);
  });

  it("never reaches the database on the demo path", async () => {
    const calls: RpcCall[] = [];
    const { runUniversalSearch } = await loadUniversalSearch();

    await runUniversalSearch({
      query: "transport",
      limitPerDomain: 5,
      domains: [...registryDomains],
      demo: true,
      supabase: fakeSupabase(calls),
    });

    expect(catalogueReads(calls)).toHaveLength(0);
  });
});
