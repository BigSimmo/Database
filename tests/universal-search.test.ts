import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadUniversalSearch() {
  return import("../src/lib/universal-search");
}

describe("runUniversalSearch (demo/fixtures path)", () => {
  it("returns groups in the fixed domain order without touching Supabase", async () => {
    const { runUniversalSearch, universalSearchDomains } = await loadUniversalSearch();
    const response = await runUniversalSearch({ query: "clinical", limitPerDomain: 5, demo: true });

    expect(response.groups.map((group) => group.kind)).toEqual(universalSearchDomains);
    for (const group of response.groups) {
      expect(group.error).toBeUndefined();
      expect(group.items.length).toBeLessThanOrEqual(5);
    }
  });

  it("finds fixture records per domain with working hrefs", async () => {
    const { runUniversalSearch } = await loadUniversalSearch();
    const response = await runUniversalSearch({ query: "acamprosate", limitPerDomain: 5, demo: true });
    const medications = response.groups.find((group) => group.kind === "medications");
    expect(medications?.items[0]?.title.toLowerCase()).toContain("acamprosate");
    expect(medications?.items[0]?.href).toBe("/medications/acamprosate");

    const differentialResponse = await runUniversalSearch({ query: "delirium", limitPerDomain: 5, demo: true });
    const differentials = differentialResponse.groups.find((group) => group.kind === "differentials");
    expect(differentials?.items.length ?? 0).toBeGreaterThan(0);
    expect(differentials?.items[0]?.href).toContain("/differentials/diagnoses/");

    const toolsResponse = await runUniversalSearch({ query: "forms", limitPerDomain: 5, demo: true });
    const forms = toolsResponse.groups.find((group) => group.kind === "forms");
    const tools = toolsResponse.groups.find((group) => group.kind === "tools");
    expect(tools?.items.some((item) => item.id === "forms")).toBe(true);
    expect(forms?.items.every((item) => item.href.startsWith("/forms/"))).toBe(true);
  });

  it("filters to requested domains only", async () => {
    const { runUniversalSearch } = await loadUniversalSearch();
    const response = await runUniversalSearch({
      query: "monitoring",
      limitPerDomain: 3,
      domains: ["tools", "differentials"],
      demo: true,
    });
    expect(response.groups.map((group) => group.kind)).toEqual(
      ["documents", "medications", "services", "forms", "differentials", "tools"].filter((domain) =>
        ["tools", "differentials"].includes(domain),
      ),
    );
  });

  it("isolates a failing domain instead of blanking the response", async () => {
    vi.doMock("@/lib/tools-catalog", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../src/lib/tools-catalog")>();
      return {
        ...actual,
        rankToolRecords: () => {
          throw new Error("tools adapter exploded");
        },
      };
    });
    const { runUniversalSearch } = await loadUniversalSearch();
    const response = await runUniversalSearch({ query: "monitoring", limitPerDomain: 3, demo: true });

    const tools = response.groups.find((group) => group.kind === "tools");
    expect(tools?.error).toBe(true);
    expect(tools?.items).toEqual([]);
    const differentials = response.groups.find((group) => group.kind === "differentials");
    expect(differentials?.error).toBeUndefined();
  });

  it("uses demo document search when no Supabase client is supplied", async () => {
    const { runUniversalSearch } = await loadUniversalSearch();
    const response = await runUniversalSearch({ query: "clozapine monitoring", limitPerDomain: 4, demo: true });
    const documents = response.groups.find((group) => group.kind === "documents");
    expect(documents?.items.length ?? 0).toBeGreaterThan(0);
    expect(documents?.items[0]?.href).toContain("/documents/");
  });
});

describe("GET /api/search/universal (demo mode)", () => {
  it("serves fixture-backed groups with demoMode flagged", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const { GET } = await import("../src/app/api/search/universal/route");
    const response = await GET(new Request("http://localhost/api/search/universal?q=acamprosate&limit=3"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const payload = (await response.json()) as {
      demoMode?: boolean;
      groups: Array<{ kind: string; items: Array<{ title: string }> }>;
    };
    expect(payload.demoMode).toBe(true);
    const medications = payload.groups.find((group) => group.kind === "medications");
    expect(medications?.items[0]?.title.toLowerCase()).toContain("acamprosate");
  });

  it("rejects queries under the minimum length", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const { GET } = await import("../src/app/api/search/universal/route");
    const response = await GET(new Request("http://localhost/api/search/universal?q=a"));
    expect(response.status).toBe(400);
  });

  it("ignores unknown domains in the CSV filter", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const { GET } = await import("../src/app/api/search/universal/route");
    const response = await GET(new Request("http://localhost/api/search/universal?q=monitoring&domains=tools,bogus"));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { groups: Array<{ kind: string }> };
    expect(payload.groups.map((group) => group.kind)).toEqual(["tools"]);
  });
});
