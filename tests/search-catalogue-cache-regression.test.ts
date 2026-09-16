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

    const response = await runUniversalSearch({
      query: "transport",
      limitPerDomain: 5,
      domains: [...registryDomains],
      demo: false,
      supabase: fakeSupabase(calls),
    });

    const reads = catalogueReads(calls);
    expect(reads).toHaveLength(registryDomains.length);
    expect(new Set(reads.map((read) => read.args.p_kind))).toEqual(new Set(["form", "service", "medication"]));
    // A healthy catalogue is never marked degraded, so the flag stays a real signal.
    expect(response.groups.every((group) => group.degraded === undefined)).toBe(true);
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

  // THE PRODUCTION SYMPTOM, 2026-09-16. The canonical read was outrunning the 2500ms domain budget
  // every time, so forms/services/medications came back as errored empty groups and catalogue
  // search returned nothing at all on the live site. A failing catalogue must degrade to the
  // in-bundle list, never to an empty result.
  it.each([
    ["rejects", () => Promise.reject(new Error("Canonical site-content read failed: boom"))],
    ["never settles", () => new Promise<never>(() => {})],
  ])(
    "still returns results when the catalogue read %s",
    async (_label, rpcBehaviour) => {
      const { runUniversalSearch } = await loadUniversalSearch();
      const { clearCatalogueSeedFallbackCooldown } = await import("@/lib/site-content/catalogue-seed-fallback");
      clearCatalogueSeedFallbackCooldown();

      const supabase = {
        rpc: (name: string) =>
          name === "read_site_content_public_records" ? rpcBehaviour() : Promise.resolve({ data: [], error: null }),
      } as unknown as SearchSupabase;

      const response = await runUniversalSearch({
        query: "transport",
        limitPerDomain: 5,
        domains: ["forms"],
        demo: false,
        supabase,
      });

      const forms = response.groups.find((group) => group.kind === "forms");
      expect(forms?.error).not.toBe(true);
      expect(forms?.items.length ?? 0).toBeGreaterThan(0);
      // Answering from seeds is not the same as answering canonically, and the response says so.
      // Without this an external monitor cannot tell a healthy catalogue from a broken one.
      expect(forms?.degraded).toBe(true);
      clearCatalogueSeedFallbackCooldown();
    },
    20_000,
  );

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

/**
 * The other half of the 2026-09-16 outage. Falling back keeps the reader working; this keeps the
 * operator informed. A fan-out where every requested domain failed answered HTTP 200 with an
 * empty body and logged nothing, so there was no signal to alert on for seven days.
 */
describe("a total search blackout is reported", () => {
  it("logs an error when every requested domain fails", async () => {
    const { runUniversalSearch } = await loadUniversalSearch();
    const { logger } = await import("@/lib/logger");
    const reported = vi.spyOn(logger, "error").mockImplementation(() => {});

    const supabase = {
      rpc: () => Promise.reject(new Error("database unreachable")),
    } as unknown as SearchSupabase;

    const response = await runUniversalSearch({
      query: "transport",
      limitPerDomain: 5,
      domains: ["documents"],
      demo: false,
      supabase,
    });

    expect(response.groups.every((group) => group.error)).toBe(true);
    expect(reported).toHaveBeenCalledTimes(1);
    const [message, context] = reported.mock.calls[0]!;
    expect(message).toContain("every requested domain failed");
    expect(context).toMatchObject({ domains: ["documents"], domain_count: 1 });
    // The query is never logged, whatever else is.
    expect(JSON.stringify(context)).not.toContain("transport");
    vi.restoreAllMocks();
  });

  it("stays quiet when a working domain answers alongside a failing one", async () => {
    const { runUniversalSearch } = await loadUniversalSearch();
    const { logger } = await import("@/lib/logger");
    const reported = vi.spyOn(logger, "error").mockImplementation(() => {});

    const supabase = {
      rpc: () => Promise.reject(new Error("database unreachable")),
    } as unknown as SearchSupabase;

    const response = await runUniversalSearch({
      // `dictionary` reads the in-bundle catalogue, so it answers while `documents` fails.
      query: "akathisia",
      limitPerDomain: 5,
      domains: ["documents", "dictionary"],
      demo: false,
      supabase,
    });

    expect(response.groups.some((group) => group.error)).toBe(true);
    expect(response.groups.some((group) => group.items.length > 0)).toBe(true);
    expect(reported).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
