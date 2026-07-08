import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadUniversalSearch() {
  return import("../src/lib/universal-search");
}

describe("runUniversalSearch (demo/fixtures path)", () => {
  // 60s timeout: the first test in this file pays the one-off vite transform cost of the large
  // universal-search module graph (~15s on a cold, loaded worker — right at the global 15s
  // limit), which made this the suite's most frequent first-test timeout flake.
  it("returns groups in the fixed domain order without touching Supabase", { timeout: 60000 }, async () => {
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

describe("runUniversalSearch (query intelligence & ranking)", () => {
  it("keeps groups in canonical order but exposes an intent-aware domainOrder", async () => {
    const { runUniversalSearch, universalSearchDomains } = await loadUniversalSearch();
    const response = await runUniversalSearch({ query: "clozapine dose", limitPerDomain: 5, demo: true });
    // The groups array is unchanged (canonical order); only the separate domainOrder reorders.
    expect(response.groups.map((group) => group.kind)).toEqual(universalSearchDomains);
    expect(response.domainOrder?.[0]).toBe("medications");
  });

  it("typo-corrects the base query so a misspelled drug still finds the record", async () => {
    const { runUniversalSearch } = await loadUniversalSearch();
    const response = await runUniversalSearch({ query: "clozapin", limitPerDomain: 5, demo: true });
    // Interpretation surfaces the correction for the "Showing results for…" affordance.
    expect(response.interpretation?.correctedQuery).toBe("clozapine");
    expect(response.interpretation?.typoCorrections).toContainEqual({ from: "clozapin", to: "clozapine" });
    // The corrected base query drives the registry ranker, so Clozapine now surfaces.
    const medications = response.groups.find((group) => group.kind === "medications");
    expect(medications?.items.some((item) => item.title.toLowerCase().includes("clozapine"))).toBe(true);
  });

  it("pins a confident best-bet as topHit and omits it when nothing is near-exact", async () => {
    const { runUniversalSearch } = await loadUniversalSearch();
    const hit = await runUniversalSearch({ query: "acamprosate", limitPerDomain: 5, demo: true });
    expect(hit.topHit).toBeDefined();
    expect(hit.topHit?.title.toLowerCase()).toContain("acamprosate");

    const vague = await runUniversalSearch({ query: "monitoring overview summary", limitPerDomain: 5, demo: true });
    expect(vague.topHit).toBeUndefined();
  });

  it("offers an Answer-mode bridge for question-like queries only", async () => {
    const { runUniversalSearch } = await loadUniversalSearch();
    const question = await runUniversalSearch({
      query: "how do i manage clozapine toxicity",
      limitPerDomain: 5,
      demo: true,
    });
    expect(question.answerAction?.href).toContain("/?mode=answer");
    expect(question.answerAction?.href).toContain("run=1");

    const bareTerm = await runUniversalSearch({ query: "acamprosate", limitPerDomain: 5, demo: true });
    expect(bareTerm.answerAction).toBeUndefined();
  });

  it("passes the ORIGINAL (uncorrected) query to the documents domain", async () => {
    const captured: string[] = [];
    vi.doMock("@/lib/demo-data", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../src/lib/demo-data")>();
      return {
        ...actual,
        demoSearch: (query: string, limit?: number) => {
          captured.push(query);
          return actual.demoSearch(query, limit);
        },
      };
    });
    const { runUniversalSearch } = await loadUniversalSearch();
    await runUniversalSearch({
      query: "clozapin monitoring",
      limitPerDomain: 3,
      domains: ["documents", "medications"],
      demo: true,
    });
    // Documents self-analyse in retrieval, so they must receive the raw query — not the
    // typo-corrected base query the registry rankers use — to avoid double expansion.
    expect(captured).toContain("clozapin monitoring");
  });

  it("threads expansions into a registry ranker's low-weight lane", async () => {
    const { defaultMedicationRecords } = await import("../src/lib/medication-seed");
    const { rankMedicationRecords } = await import("../src/lib/medications");
    const records = defaultMedicationRecords();
    // A nonsense base query matches nothing on its own…
    expect(rankMedicationRecords(records, "zzznotarealterm", 5)).toHaveLength(0);
    // …but an expansion term surfaces the matching record via the content (expanded) lane.
    const expanded = rankMedicationRecords(records, "zzznotarealterm", 5, ["clozapine"]);
    expect(expanded.some((match) => match.medication.name.toLowerCase() === "clozapine")).toBe(true);
  });
});
