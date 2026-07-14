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

    const formulationResponse = await runUniversalSearch({
      query: "avoidance",
      limitPerDomain: 5,
      demo: true,
    });
    const formulation = formulationResponse.groups.find((group) => group.kind === "formulation");
    expect(formulation?.items[0]?.title).toBe("Avoidance");
    expect(formulation?.items[0]?.href).toBe("/formulation/avoidance");

    const specifierResponse = await runUniversalSearch({
      query: "depressed but racing thoughts",
      limitPerDomain: 5,
      demo: true,
    });
    const specifiers = specifierResponse.groups.find((group) => group.kind === "specifiers");
    expect(specifiers?.items[0]?.title).toBe("With mixed features");
    expect(specifiers?.items[0]?.href).toBe("/specifiers/with-mixed-features");
  });

  it("keeps view-all destinations separate for specifiers and formulation", async () => {
    const { universalSearchViewAllHref } = await loadUniversalSearch();

    expect(universalSearchViewAllHref("specifiers", "mixed features")).toBe("/specifiers?q=mixed%20features&run=1");
    expect(universalSearchViewAllHref("formulation", "rumination")).toBe("/formulation?q=rumination&run=1");
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
      [
        "documents",
        "medications",
        "services",
        "forms",
        "differentials",
        "presentations",
        "specifiers",
        "formulation",
        "tools",
      ].filter((domain) => ["tools", "differentials"].includes(domain)),
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

  it("isolates a failing presentations adapter without touching the differentials group", async () => {
    vi.doMock("@/lib/differentials", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../src/lib/differentials")>();
      return {
        ...actual,
        rankPresentationWorkflows: () => {
          throw new Error("presentations adapter exploded");
        },
      };
    });
    const { runUniversalSearch } = await loadUniversalSearch();
    const response = await runUniversalSearch({ query: "confusion", limitPerDomain: 3, demo: true });

    const presentations = response.groups.find((group) => group.kind === "presentations");
    expect(presentations?.error).toBe(true);
    expect(presentations?.items).toEqual([]);
    const differentials = response.groups.find((group) => group.kind === "differentials");
    expect(differentials?.error).toBeUndefined();
    expect(differentials?.items.length ?? 0).toBeGreaterThan(0);

    // doMock registrations survive resetModules, so drop it here or every later test in this
    // file would import the throwing presentations ranker.
    vi.doUnmock("@/lib/differentials");
  });

  it("uses demo document search when no Supabase client is supplied", async () => {
    const { runUniversalSearch } = await loadUniversalSearch();
    const response = await runUniversalSearch({ query: "clozapine monitoring", limitPerDomain: 4, demo: true });
    const documents = response.groups.find((group) => group.kind === "documents");
    expect(documents?.items.length ?? 0).toBeGreaterThan(0);
    expect(documents?.items[0]?.href).toContain("/documents/");
  });

  it("keeps registry hrefs when document search uses related-document mapping", async () => {
    vi.doMock("@/lib/rag", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../src/lib/rag")>();
      return {
        ...actual,
        searchChunksWithTelemetry: vi.fn(async () => ({
          results: [
            {
              id: "registry-chunk",
              document_id: "registry-doc",
              title: "Crisis service",
              file_name: "service-crisis-service.registry.json",
              page_number: 1,
              hybrid_score: 0.92,
              similarity: 0.9,
              images: [],
              source_metadata: {
                source_kind: "registry_record",
                registry_record_kind: "service",
                registry_record_slug: "crisis-service",
              },
            },
          ],
        })),
      };
    });
    vi.doMock("@/lib/document-enrichment", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../src/lib/document-enrichment")>();
      return {
        ...actual,
        fetchRelatedDocuments: vi.fn(async () => [
          {
            document_id: "registry-doc",
            title: "Crisis service",
            file_name: "service-crisis-service.registry.json",
            labels: [],
            summary: null,
            best_pages: [1],
            best_chunk_ids: ["registry-chunk"],
            image_count: 0,
            table_count: 0,
            match_reason: "Matched 1 indexed passage",
            score: 0.92,
          },
        ]),
      };
    });

    const { runUniversalSearch } = await loadUniversalSearch();
    const response = await runUniversalSearch({
      query: "crisis service",
      limitPerDomain: 5,
      domains: ["documents"],
      demo: false,
      supabase: {} as Parameters<typeof runUniversalSearch>[0]["supabase"],
    });

    expect(response.groups[0]?.items[0]?.href).toBe("/services/crisis-service");
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

  it("serves the presentations domain through the CSV filter", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const { GET } = await import("../src/app/api/search/universal/route");
    const response = await GET(
      new Request("http://localhost/api/search/universal?q=confusion&domains=presentations,bogus"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { groups: Array<{ kind: string; items: Array<{ href: string }> }> };
    expect(payload.groups.map((group) => group.kind)).toEqual(["presentations"]);
    expect(payload.groups[0]?.items[0]?.href).toContain("/differentials/presentations/");
  });

  it("accepts a mode context and rejects unknown modes", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const { GET } = await import("../src/app/api/search/universal/route");
    const response = await GET(
      new Request("http://localhost/api/search/universal?q=transport&mode=forms&domains=forms,services"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      contextMode?: string;
      preferredDomains?: string[];
      domainOrder?: string[];
    };
    expect(payload.contextMode).toBe("forms");
    expect(payload.preferredDomains).toEqual(["forms"]);
    expect(payload.domainOrder?.[0]).toBe("forms");

    const invalid = await GET(new Request("http://localhost/api/search/universal?q=transport&mode=bogus"));
    expect(invalid.status).toBe(400);
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

  it("leads normal groups with the active mode but still allows an exact external Best match", async () => {
    const { runUniversalSearch } = await loadUniversalSearch();
    const response = await runUniversalSearch({
      query: "avoidance",
      limitPerDomain: 5,
      contextMode: "documents",
      demo: true,
    });

    expect(response.contextMode).toBe("documents");
    expect(response.preferredDomains).toEqual(["documents"]);
    expect(response.domainOrder?.[0]).toBe("documents");
    expect(response.topHit?.kind).toBe("formulation");
    expect(response.topHit?.title).toBe("Avoidance");
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

  it("surfaces both the presentation and its candidate differentials for a symptom query", async () => {
    const { runUniversalSearch } = await loadUniversalSearch();
    const response = await runUniversalSearch({
      query: "confusion",
      limitPerDomain: 5,
      domains: ["differentials", "presentations"],
      demo: true,
    });
    const presentations = response.groups.find((group) => group.kind === "presentations");
    expect(presentations?.items[0]?.id).toBe("acute-confusion-encephalopathy");
    expect(presentations?.items[0]?.href).toBe("/differentials/presentations/acute-confusion-encephalopathy");
    expect(presentations?.items[0]?.badge).toBe("Emergent");
    // The reverse link lane surfaces the presentation's candidate differentials for the same
    // symptom vocabulary even though their own titles never contain "confusion".
    const differentials = response.groups.find((group) => group.kind === "differentials");
    const candidateSlugs = new Set([
      "delirium",
      "substance-intoxication",
      "substance-withdrawal",
      "post-ictal-confusion",
      "dementia-with-superimposed-delirium",
      "wernicke-encephalopathy",
      "hepatic-encephalopathy",
    ]);
    expect(differentials?.items.some((item) => candidateSlugs.has(item.id))).toBe(true);
  });

  it("leads with the presentation for a symptom phrase that whole-phrase-matches its title", async () => {
    const { runUniversalSearch } = await loadUniversalSearch();
    const response = await runUniversalSearch({
      query: "acute confusion",
      limitPerDomain: 5,
      domains: ["differentials", "presentations"],
      demo: true,
    });
    // No diagnosis title contains the phrase, so only the presentations group is confident and
    // it is promoted to lead + Best match.
    expect(response.domainOrder?.[0]).toBe("presentations");
    expect(response.topHit?.kind).toBe("presentations");
    expect(response.topHit?.href).toBe("/differentials/presentations/acute-confusion-encephalopathy");
  });

  it("prefers the exact diagnosis over the umbrella presentation when both titles match", async () => {
    const { runUniversalSearch } = await loadUniversalSearch();
    const response = await runUniversalSearch({
      query: "substance intoxication",
      limitPerDomain: 5,
      domains: ["differentials", "presentations"],
      demo: true,
    });
    // Both kinds hold a confident whole-phrase title match ("Substance intoxication" is a
    // diagnosis and an umbrella presentation); canonical order pins Best match to the precise
    // diagnosis page ahead of the umbrella.
    expect(response.topHit?.kind).toBe("differentials");
    expect(response.domainOrder?.slice(0, 2)).toEqual(["differentials", "presentations"]);
  });
});

// Regression guard: outside an explicit demo/local deploy, no caller — including an anonymous,
// no-cookie live visitor — may be served the synthetic demo corpus. The documents domain must
// reach the real retrieval pipeline (demo:false + supabase), scoped to the public corpus for
// anonymous callers, and the anonymous path must be rate limited.
describe("GET /api/search/universal (live public/owner path)", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const token = "session-token";

  type RunArgs = { demo: boolean; ownerId?: string; supabase?: unknown };
  const createRunMock = () =>
    vi.fn<(args: RunArgs) => Promise<{ query: string; groups: unknown[]; tookMs: number }>>(async () => ({
      query: "clozapine",
      groups: [],
      tookMs: 1,
    }));

  function createSupabaseMock(options: { limited?: boolean } = {}) {
    const rpc = vi.fn(async () => ({
      data: [
        {
          limited: Boolean(options.limited),
          limit_value: 120,
          remaining: options.limited ? 0 : 119,
          retry_after_seconds: 60,
          reset_at: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
      error: null,
    }));
    const getUser = vi.fn(async (receivedToken?: string) =>
      receivedToken === token
        ? { data: { user: { id: userId } }, error: null }
        : { data: { user: null }, error: { message: "Invalid token" } },
    );
    return { rpc, auth: { getUser } };
  }

  function mockRuntime(
    client: ReturnType<typeof createSupabaseMock>,
    runUniversalSearch: ReturnType<typeof createRunMock>,
  ) {
    // env:{} keeps isDemoMode false (forcing the live path) while leaving the Supabase public
    // keys unset, so the cookie-session probe resolves anonymous without a network call.
    vi.doMock("@/lib/env", () => ({
      env: {},
      isDemoMode: () => false,
      isLocalNoAuthMode: () => false,
      requireOpenAIEnv: () => undefined,
      requireServerEnv: () => undefined,
    }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
    // Replace only the entrypoint; the schema still needs the real domain list.
    vi.doMock("@/lib/universal-search", () => ({
      runUniversalSearch,
      universalSearchDomains: [
        "documents",
        "medications",
        "services",
        "forms",
        "differentials",
        "presentations",
        "specifiers",
        "formulation",
        "tools",
      ],
    }));
  }

  it("runs the REAL public pipeline (never demo fixtures) for an unauthenticated live request", async () => {
    const client = createSupabaseMock();
    const runUniversalSearch = createRunMock();
    mockRuntime(client, runUniversalSearch);
    const { GET } = await import("../src/app/api/search/universal/route");

    const response = await GET(new Request("http://localhost/api/search/universal?q=clozapine"));
    const payload = (await response.json()) as { demoMode?: boolean; publicAccess?: boolean };

    expect(response.status).toBe(200);
    // The anonymous public view is flagged; demo is NOT — the synthetic corpus must not leak.
    expect(payload.publicAccess).toBe(true);
    expect(payload.demoMode).toBeUndefined();
    // The live pipeline is invoked with demo:false + a supabase client and no ownerId, so the
    // documents domain runs allowGlobalSearch against the real public corpus.
    expect(runUniversalSearch).toHaveBeenCalledTimes(1);
    const args = runUniversalSearch.mock.calls[0]![0];
    expect(args.demo).toBe(false);
    expect(args.ownerId).toBeUndefined();
    expect(args.supabase).toBeDefined();
    // The anonymous path is now rate limited (it previously short-circuited before any limit).
    expect(client.rpc).toHaveBeenCalledWith("consume_api_subject_rate_limit", expect.anything());
  });

  it("rate limits the anonymous universal-search path instead of leaving it unthrottled", async () => {
    const client = createSupabaseMock({ limited: true });
    const runUniversalSearch = createRunMock();
    mockRuntime(client, runUniversalSearch);
    const { GET } = await import("../src/app/api/search/universal/route");

    const response = await GET(new Request("http://localhost/api/search/universal?q=clozapine"));

    expect(response.status).toBe(429);
    // A throttled request must never fall through to any search pipeline.
    expect(runUniversalSearch).not.toHaveBeenCalled();
  });

  it("serves an authenticated owner their own records with demo:false and no public flag", async () => {
    const client = createSupabaseMock();
    const runUniversalSearch = createRunMock();
    mockRuntime(client, runUniversalSearch);
    const { GET } = await import("../src/app/api/search/universal/route");

    const response = await GET(
      new Request("http://localhost/api/search/universal?q=clozapine", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    const payload = (await response.json()) as { demoMode?: boolean; publicAccess?: boolean };

    expect(response.status).toBe(200);
    expect(payload.publicAccess).toBeUndefined();
    expect(payload.demoMode).toBeUndefined();
    const args = runUniversalSearch.mock.calls[0]![0];
    expect(args.demo).toBe(false);
    expect(args.ownerId).toBe(userId);
  });
});
