import { describe, expect, it, vi } from "vitest";

import {
  callGovernedRetrievalRpc,
  retrievalCorpusScopes,
  searchGovernedCorpora,
} from "../src/lib/rag/rag-candidate-sources";
import {
  governedCorpusComponentCacheNamespace,
  retrievalPlanCacheQuery,
  scopedAnswerCacheKey,
  scopedSearchCacheKey,
  sharedAnswerNormalizedQuery,
} from "../src/lib/rag/rag-cache";
import { governedCorpusComponentState } from "../src/lib/rag/rag-contracts";
import type { RagContextSnapshot } from "../src/lib/site-content/site-content-contracts";
import type { ClinicalSourceMetadata, RagQueryPlan, SearchResult, SourceCorpusScope } from "../src/lib/types";

const RELEASE_ID = "c0f6c316-b6f8-5c55-87ce-6b486032af03";
const DIGEST = "a".repeat(64);

function snapshot(state: RagContextSnapshot["publicSiteContent"]["state"] = "current"): RagContextSnapshot {
  return {
    version: "rag-context-snapshot-v1",
    resolvedAt: "2026-08-30T00:00:00.000Z",
    documentIndexGeneration: "generation-1",
    sourcePolicyVersion: "source-policy-v1",
    rolloutVersion: "rollout-v1",
    siteContentRegistryVersion: "site-content-registry-v1",
    publicSiteContent: {
      releaseId: RELEASE_ID,
      staticManifestDigest: DIGEST,
      dynamicStateDigest: DIGEST,
      releaseDigest: DIGEST,
      changeEpoch: "7",
      state,
    },
  };
}

type GovernedTestRow = Omit<SearchResult, "source_metadata"> & {
  source_metadata: ClinicalSourceMetadata & { public_source_steward_id: string };
  site_release_id: string | null;
  site_change_epoch: string | null;
  pending_exclusion_exact: boolean | null;
};

function row(id: string, corpusScope: SourceCorpusScope): GovernedTestRow {
  return {
    id,
    document_id: `${id}-document`,
    title: id,
    file_name: `${id}.md`,
    page_number: null,
    chunk_index: 0,
    section_heading: null,
    content: `${id} governed content`,
    image_ids: [],
    similarity: 0.8,
    text_rank: 0.7,
    hybrid_score: 0.8,
    source_metadata: {
      source_title: id,
      publisher: "Clinical KB",
      jurisdiction: "Australia/WA",
      version: "1",
      publication_date: null,
      review_date: null,
      uploaded_at: null,
      indexed_at: null,
      corpus_scope: corpusScope,
      source_kind: corpusScope === "clinical_kb_site" ? "registry_record" : "document",
      uploaded_by: "user-id-canary",
      public_source_steward_id: "administrator-id-canary",
      source_role: corpusScope === "clinical_kb_site" ? "clinical_reference" : "clinical_guideline",
      content_mode: "indexed_content",
      licence_policy: "public_index_permitted",
      document_status: "current",
      clinical_validation_status: "approved",
      extraction_quality: "good",
      source_catalogue_key: `${corpusScope}:${id}`,
    },
    corpus_scope: corpusScope,
    site_content_domain: corpusScope === "clinical_kb_site" ? "medications" : null,
    site_release_id: corpusScope === "clinical_kb_site" ? RELEASE_ID : null,
    site_change_epoch: corpusScope === "clinical_kb_site" ? "7" : null,
    pending_exclusion_exact: corpusScope === "clinical_kb_site" ? true : null,
    images: [],
  };
}

function harness() {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const rpc = vi.fn((name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    const scopes = args.corpus_scopes as SourceCorpusScope[];
    const data = scopes.map((scope) => row(scope, scope));
    return {
      abortSignal: vi.fn(async () => ({ data, error: null })),
    };
  });
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      in: vi.fn(async (_column: string, ids: string[]) => ({
        data: ids.map((id) => ({
          id,
          document_id: `${id}-document`,
          index_generation_id: "generation-1",
          documents: {
            owner_id: null,
            status: "indexed",
            index_generation_id: "generation-1",
            metadata: {
              corpus_scope: id,
              publication_manifest_version: 2,
              source_policy_version: "source-policy-v1",
              publication_source_policy_version: "source-policy-v1",
              publication_reviewed_index_generation_id: "generation-1",
            },
          },
        })),
        error: null,
      })),
    })),
  }));
  return { calls, supabase: { rpc, from } as never };
}

describe("governed public corpus retrieval", () => {
  it("builds ordered public-only primary and internally eligible supplementary phases", () => {
    expect(
      retrievalCorpusScopes({
        siteContentEnabled: true,
        siteContentState: "current",
        australianAugmentationEnabled: true,
        australianCurrent: true,
        internationalCoverageGap: false,
      }),
    ).toEqual([
      {
        accessScope: { includePublic: true },
        corpusScopes: ["uploaded_local", "clinical_kb_site", "australian_public"],
        phase: "primary",
      },
      {
        accessScope: { includePublic: true },
        corpusScopes: ["international_supplementary"],
        phase: "supplementary",
      },
    ]);

    expect(
      retrievalCorpusScopes({
        siteContentEnabled: true,
        siteContentState: "current",
        australianAugmentationEnabled: true,
        australianCurrent: true,
        internationalCoverageGap: true,
      }).at(-1),
    ).toEqual({
      accessScope: { includePublic: true },
      corpusScopes: ["international_supplementary"],
      phase: "supplementary",
    });
  });

  it("searches one shared primary population independent of authenticated or administrator identity", async () => {
    const populations = await Promise.all(
      [null, "user-a", "administrator-a"].map(async () => {
        const { calls, supabase } = harness();
        const results = await searchGovernedCorpora({
          supabase,
          queryVariants: ["clozapine monitoring"],
          matchCount: 12,
          snapshot: snapshot(),
          components: { siteContent: true, australianAugmentation: true, australianCurrent: true },
          targetSiteDomains: ["medications"],
          internationalCoverageGap: false,
        });
        return {
          calls,
          ids: results.map(({ id }) => id),
          metadata: results.map(({ source_metadata }) => source_metadata),
        };
      }),
    );

    expect(populations[1]?.ids).toEqual(populations[0]?.ids);
    expect(populations[2]?.ids).toEqual(populations[0]?.ids);
    for (const population of populations) {
      expect(population.calls).toHaveLength(1);
      expect(population.calls[0]).toMatchObject({
        name: "match_document_chunks_text_v3",
        args: {
          include_public: true,
          owner_filter: "00000000-0000-0000-0000-000000000000",
          corpus_scopes: ["uploaded_local", "clinical_kb_site", "australian_public"],
        },
      });
      expect(population.calls[0]?.args).not.toHaveProperty("authenticated_user_id");
      expect(population.calls[0]?.args).not.toHaveProperty("administrator_id");
      expect(JSON.stringify(population.metadata)).not.toContain("user-id-canary");
      expect(JSON.stringify(population.metadata)).not.toContain("administrator-id-canary");
      expect(population.metadata.every((metadata) => metadata?.uploaded_by === null)).toBe(true);
    }
  });

  it("fails a missing v3 candidate RPC closed without calling v2 or legacy", async () => {
    const calls: string[] = [];
    const supabase = {
      rpc: vi.fn(async (name: string) => {
        calls.push(name);
        return { data: null, error: { code: "PGRST202", message: "schema cache miss" } };
      }),
    };

    const result = await callGovernedRetrievalRpc(supabase as never, "match_document_chunks_text_v3", {
      query_text: "clozapine",
      match_count: 8,
      owner_filter: "00000000-0000-0000-0000-000000000000",
      include_public: true,
      corpus_scopes: ["australian_public"],
    });

    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
    expect(calls).toEqual(["match_document_chunks_text_v3"]);
  });

  it("issues document admission only for current australian-public rows", async () => {
    const { supabase } = harness();
    const results = await searchGovernedCorpora({
      supabase,
      queryVariants: ["local guideline"],
      matchCount: 12,
      snapshot: snapshot(),
      components: { siteContent: true, australianAugmentation: true, australianCurrent: true },
      targetSiteDomains: [],
      internationalCoverageGap: false,
      signal: new AbortController().signal,
    });

    const australian = results.find((candidate) => candidate.corpus_scope === "australian_public");
    expect(australian?.source_metadata).toMatchObject({
      corpus_scope: "australian_public",
      source_kind: "document",
      uploaded_by: null,
    });
    expect(australian?.context_pack_admission).toMatchObject({
      ownerId: null,
      sourcePolicyVersion: "source-policy-v1",
      indexGeneration: "generation-1",
      document: {
        corpusScope: "australian_public",
        documentId: "australian_public-document",
        chunkId: "australian_public",
      },
      siteContent: null,
    });
    expect(
      results.find((candidate) => candidate.corpus_scope === "uploaded_local")?.context_pack_admission,
    ).toBeUndefined();
    expect(
      results.find((candidate) => candidate.corpus_scope === "international_supplementary")?.context_pack_admission,
    ).toBeUndefined();
  });

  it("does not issue admission when the authoritative chunk document differs from the candidate", async () => {
    const candidate = row("australian-mismatch", "australian_public");
    const supabase = {
      rpc: vi.fn(() => ({ abortSignal: vi.fn(async () => ({ data: [candidate], error: null })) })),
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(async () => ({
            data: [
              {
                id: candidate.id,
                document_id: "authoritative-other-document",
                index_generation_id: "generation-1",
                documents: {
                  owner_id: null,
                  status: "indexed",
                  index_generation_id: "generation-1",
                  metadata: {
                    corpus_scope: "australian_public",
                    publication_manifest_version: 2,
                    source_policy_version: "source-policy-v1",
                    publication_source_policy_version: "source-policy-v1",
                    publication_reviewed_index_generation_id: "generation-1",
                  },
                },
              },
            ],
            error: null,
          })),
        })),
      })),
    };

    const results = await searchGovernedCorpora({
      supabase: supabase as never,
      queryVariants: ["current guidance"],
      matchCount: 12,
      snapshot: snapshot(),
      components: { siteContent: false, australianAugmentation: true, australianCurrent: true },
      targetSiteDomains: [],
      internationalCoverageGap: false,
      signal: new AbortController().signal,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.context_pack_admission).toBeUndefined();
  });

  it("fails closed when a governed scope carries the wrong canonical source kind", async () => {
    const rows = [
      row("uploaded-wrong", "uploaded_local"),
      row("australian-wrong", "australian_public"),
      row("international-wrong", "international_supplementary"),
    ].map((candidate) => ({
      ...candidate,
      source_metadata: {
        ...candidate.source_metadata,
        source_kind: "registry_record",
      },
    }));
    const supabase = {
      rpc: vi.fn(() => ({ abortSignal: vi.fn(async () => ({ data: rows, error: null })) })),
    };

    const results = await searchGovernedCorpora({
      supabase: supabase as never,
      queryVariants: ["governed source"],
      matchCount: 12,
      snapshot: snapshot(),
      components: { siteContent: false, australianAugmentation: true, australianCurrent: true },
      targetSiteDomains: [],
      internationalCoverageGap: true,
      signal: new AbortController().signal,
    });

    expect(results).toEqual([]);
  });

  it("spends the shared cap only on the original query and still-uncovered plan subquestions", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const supabase = {
      rpc: vi.fn((name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return Promise.resolve({ data: [], error: null });
      }),
    } as never;
    const plan: RagQueryPlan = {
      version: "rag-query-plan-v1",
      kind: "decomposed",
      originalQuery: "primary question",
      interpretation: "test",
      subquestions: [
        { id: "sq-1", question: "primary question", purpose: "primary", required: true },
        { id: "sq-2", question: "monitoring question", purpose: "monitoring", required: true },
        { id: "sq-3", question: "risk question", purpose: "risk", required: true },
        { id: "sq-4", question: "action question", purpose: "required_action", required: true },
      ],
      targetSiteDomains: ["medications"],
      siteDomainDecision: "explicit",
      reasonCodes: [],
    };

    await searchGovernedCorpora({
      supabase,
      queryVariants: ["primary question", "unallocated legacy poison"],
      queryPlan: plan,
      retrievalMode: "text",
      matchCount: 12,
      snapshot: snapshot(),
      components: { siteContent: true, australianAugmentation: false, australianCurrent: false },
      targetSiteDomains: ["medications"],
      internationalCoverageGap: false,
      signal: new AbortController().signal,
      maxRpcCalls: 3,
    });

    expect(calls.map(({ name }) => name)).toEqual(Array(3).fill("match_document_chunks_text_v3"));
    expect(calls.map(({ args }) => args.query_text)).toEqual([
      "primary question",
      "monitoring question",
      "risk question",
    ]);
    expect(calls.map(({ args }) => args.query_text)).not.toContain("unallocated legacy poison");
  });

  it("preserves a later required-subquestion lane when the original lane saturates the result bound", async () => {
    const calls: string[] = [];
    const supabase = {
      rpc: vi.fn((_name: string, args: Record<string, unknown>) => {
        const query = String(args.query_text);
        calls.push(query);
        const data =
          query === "primary question"
            ? [
                { ...row("primary-a", "uploaded_local"), content: "Primary treatment evidence." },
                { ...row("primary-b", "uploaded_local"), content: "Additional treatment evidence." },
              ]
            : [
                {
                  ...row("monitoring-lane", "uploaded_local"),
                  content: "Lithium monitoring interval guidance.",
                },
              ];
        return Promise.resolve({ data, error: null });
      }),
    } as never;
    const plan: RagQueryPlan = {
      version: "rag-query-plan-v1",
      kind: "decomposed",
      originalQuery: "primary question",
      interpretation: "lane preservation",
      subquestions: [
        { id: "primary", question: "primary question", purpose: "primary", required: true },
        { id: "monitoring", question: "lithium monitoring interval", purpose: "monitoring", required: true },
      ],
      targetSiteDomains: [],
      siteDomainDecision: "none",
      reasonCodes: [],
    };

    const results = await searchGovernedCorpora({
      supabase,
      queryVariants: ["primary question"],
      queryPlan: plan,
      matchCount: 2,
      snapshot: snapshot(),
      components: { siteContent: false, australianAugmentation: false, australianCurrent: false },
      targetSiteDomains: [],
      internationalCoverageGap: false,
      maxRpcCalls: 2,
    });

    expect(calls).toEqual(["primary question", "lithium monitoring interval"]);
    expect(results).toHaveLength(2);
    expect(results.map(({ id }) => id)).toContain("monitoring-lane");
  });

  it("preserves a later supplementary lane when the original lane saturates the result bound", async () => {
    const calls: Array<{ query: string; scopes: SourceCorpusScope[] }> = [];
    const supabase = {
      rpc: vi.fn((_name: string, args: Record<string, unknown>) => {
        const scopes = args.corpus_scopes as SourceCorpusScope[];
        const query = String(args.query_text);
        calls.push({ query, scopes });
        const data = scopes.includes("international_supplementary")
          ? [
              {
                ...row("supplementary-lane", "international_supplementary"),
                content: "Lithium monitoring interval guidance.",
              },
            ]
          : [
              { ...row("primary-a", "uploaded_local"), content: "Primary question treatment evidence." },
              { ...row("primary-b", "uploaded_local"), content: "Additional primary question evidence." },
            ];
        return Promise.resolve({ data, error: null });
      }),
    } as never;
    const plan: RagQueryPlan = {
      version: "rag-query-plan-v1",
      kind: "decomposed",
      originalQuery: "primary question",
      interpretation: "supplementary lane preservation",
      subquestions: [
        { id: "primary", question: "primary question", purpose: "primary", required: true },
        { id: "monitoring", question: "lithium monitoring interval", purpose: "monitoring", required: true },
      ],
      targetSiteDomains: [],
      siteDomainDecision: "none",
      reasonCodes: [],
    };

    const results = await searchGovernedCorpora({
      supabase,
      queryVariants: ["primary question"],
      queryPlan: plan,
      matchCount: 2,
      snapshot: snapshot(),
      components: { siteContent: false, australianAugmentation: true, australianCurrent: true },
      targetSiteDomains: [],
      internationalCoverageGap: false,
      maxRpcCalls: 2,
    });

    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual({ query: "lithium monitoring interval", scopes: ["international_supplementary"] });
    expect(results).toHaveLength(2);
    expect(results.map(({ id }) => id)).toContain("supplementary-lane");
  });

  it("derives supplementary retrieval from eligible remaining gaps instead of the caller flag", async () => {
    const plan: RagQueryPlan = {
      version: "rag-query-plan-v1",
      kind: "decomposed",
      originalQuery: "catatonia urgent assessment",
      interpretation: "internal gap decision",
      subquestions: [
        { id: "assessment", question: "catatonia urgent assessment", purpose: "primary", required: true },
        { id: "relapse", question: "catatonia relapse prevention", purpose: "primary", required: true },
      ],
      targetSiteDomains: [],
      siteDomainDecision: "none",
      reasonCodes: [],
    };
    const run = async (callerFlag: boolean, primaryVariantEligible: boolean, directCoverage: boolean) => {
      const calls: Array<{ query: string; scopes: SourceCorpusScope[] }> = [];
      const supabase = {
        rpc: vi.fn((_name: string, args: Record<string, unknown>) => {
          const scopes = args.corpus_scopes as SourceCorpusScope[];
          const query = String(args.query_text);
          calls.push({ query, scopes });
          if (scopes.includes("international_supplementary")) {
            return Promise.resolve({
              data: [
                {
                  ...row("international", "international_supplementary"),
                  content: "Catatonia relapse prevention guidance.",
                },
              ],
              error: null,
            });
          }
          if (query === "catatonia urgent assessment") {
            const primary = { ...row("primary", "uploaded_local"), content: "Catatonia urgent assessment guidance." };
            return Promise.resolve({
              data: directCoverage
                ? [{ ...primary, content: "Catatonia urgent assessment and catatonia relapse prevention guidance." }]
                : [primary],
              error: null,
            });
          }
          const candidate = {
            ...row("variant", "uploaded_local"),
            content: "Catatonia relapse prevention guidance.",
          };
          if (!primaryVariantEligible) {
            candidate.source_metadata = { ...candidate.source_metadata, source_role: "form_reference" };
          }
          return Promise.resolve({ data: [candidate], error: null });
        }),
      } as never;
      await searchGovernedCorpora({
        supabase,
        queryVariants: ["catatonia urgent assessment"],
        queryPlan: plan,
        matchCount: 6,
        snapshot: snapshot(),
        components: { siteContent: false, australianAugmentation: true, australianCurrent: true },
        targetSiteDomains: [],
        internationalCoverageGap: callerFlag,
        maxRpcCalls: 3,
      });
      return calls;
    };

    const direct = await run(true, false, true);
    expect(direct.filter(({ scopes }) => scopes.includes("international_supplementary"))).toHaveLength(0);
    const closedByVariant = await run(true, true, false);
    expect(closedByVariant.filter(({ scopes }) => scopes.includes("international_supplementary"))).toHaveLength(0);
    const genuineGap = await run(false, false, false);
    expect(genuineGap.filter(({ scopes }) => scopes.includes("international_supplementary"))).toHaveLength(1);
  });

  it.each([
    {
      domain: "services" as const,
      question: "Which Clinical KB service page is available?",
      registryKind: "service",
    },
    {
      domain: "forms" as const,
      question: "Which Clinical KB form page is available?",
      registryKind: "form",
    },
    {
      domain: "tools" as const,
      question: "Which Clinical KB tool page is available?",
      registryKind: "tool",
    },
  ])(
    "does not open an international gap for an eligible $domain product lookup",
    async ({ domain, question, registryKind }) => {
      const calls: SourceCorpusScope[][] = [];
      const site = {
        ...row(`site-${domain}`, "clinical_kb_site"),
        content: `${question} The matching Clinical KB ${registryKind} record is available.`,
        site_content_domain: domain,
      };
      site.source_metadata = {
        ...site.source_metadata,
        registry_record_kind: registryKind,
        source_role: "clinical_reference",
      };
      const supabase = {
        rpc: vi.fn((_name: string, args: Record<string, unknown>) => {
          const scopes = args.corpus_scopes as SourceCorpusScope[];
          calls.push(scopes);
          return Promise.resolve({
            data: scopes.includes("international_supplementary")
              ? [row(`international-${domain}`, "international_supplementary")]
              : [site],
            error: null,
          });
        }),
      } as never;
      const plan: RagQueryPlan = {
        version: "rag-query-plan-v1",
        kind: "single",
        originalQuery: question,
        interpretation: "explicit Clinical KB product lookup",
        subquestions: [{ id: "product", question, purpose: "primary", required: true }],
        targetSiteDomains: [domain],
        siteDomainDecision: "explicit",
        reasonCodes: [],
      };

      await searchGovernedCorpora({
        supabase,
        queryVariants: [question],
        queryPlan: plan,
        retrievalMode: "text",
        matchCount: 6,
        snapshot: snapshot(),
        components: { siteContent: true, australianAugmentation: true, australianCurrent: true },
        targetSiteDomains: [domain],
        internationalCoverageGap: true,
        maxRpcCalls: 2,
      });

      expect(calls).toEqual([["uploaded_local", "clinical_kb_site", "australian_public"]]);
    },
  );

  it("removes site candidates from caller-disabled retrieval without changing Australian retrieval", async () => {
    const { calls, supabase } = harness();

    const results = await searchGovernedCorpora({
      supabase,
      queryVariants: ["clozapine monitoring"],
      matchCount: 12,
      snapshot: snapshot(),
      components: { siteContent: false, australianAugmentation: true, australianCurrent: true },
      targetSiteDomains: ["medications"],
      internationalCoverageGap: false,
      signal: new AbortController().signal,
    });

    expect(calls[0]?.args.corpus_scopes).toEqual(["uploaded_local", "australian_public"]);
    expect(results.map((result) => result.corpus_scope)).toEqual(["uploaded_local", "australian_public"]);
    expect(calls[0]?.args.expected_site_release_id).toBeNull();
  });

  it("makes the caller-disabled Australian lane a no-RPC bounded cache state", async () => {
    const { calls, supabase } = harness();
    const enabled = { siteContent: true, australianAugmentation: true, australianCurrent: true } as const;
    const disabled = { siteContent: true, australianAugmentation: false, australianCurrent: false } as const;

    await searchGovernedCorpora({
      supabase,
      queryVariants: ["clozapine monitoring"],
      matchCount: 12,
      snapshot: snapshot(),
      components: disabled,
      targetSiteDomains: ["medications"],
      internationalCoverageGap: true,
      signal: new AbortController().signal,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.args.corpus_scopes).toEqual(["uploaded_local", "clinical_kb_site"]);
    expect(calls.flatMap(({ args }) => args.corpus_scopes as string[])).not.toContain("australian_public");
    expect(calls.flatMap(({ args }) => args.corpus_scopes as string[])).not.toContain("international_supplementary");
    expect(governedCorpusComponentCacheNamespace("rag-query-plan-v1", enabled)).not.toBe(
      governedCorpusComponentCacheNamespace("rag-query-plan-v1", disabled),
    );
    const cacheArgs = { query: "clozapine monitoring", ragQueryPlanMode: "canary" as const };
    expect(retrievalPlanCacheQuery({ ...cacheArgs, governedCorpusComponents: enabled })).not.toBe(
      retrievalPlanCacheQuery({ ...cacheArgs, governedCorpusComponents: disabled }),
    );
    expect(scopedAnswerCacheKey({ ...cacheArgs, governedCorpusComponents: enabled })).not.toBe(
      scopedAnswerCacheKey({ ...cacheArgs, governedCorpusComponents: disabled }),
    );
    expect(governedCorpusComponentCacheNamespace("rag-query-plan-v1", disabled)).toBe(
      "rag-query-plan-v1|site:on|australian:off|australian-current:off",
    );
    expect(governedCorpusComponentState(disabled)).toEqual({
      siteContent: "enabled",
      australianAugmentation: "disabled",
    });
  });

  it("keeps the deprecated caller gap flag out of every retrieval and answer cache identity", () => {
    const cacheArgs = {
      query: "lithium monitoring",
      ragQueryPlanMode: "canary" as const,
      governedCorpusComponents: {
        siteContent: true,
        australianAugmentation: true,
        australianCurrent: true,
      },
    };
    const withoutGap = { ...cacheArgs, governedInternationalCoverageGap: false };
    const withGap = { ...cacheArgs, governedInternationalCoverageGap: true };

    expect(retrievalPlanCacheQuery(withoutGap)).toBe(retrievalPlanCacheQuery(withGap));
    expect(scopedSearchCacheKey(withoutGap)).toBe(scopedSearchCacheKey(withGap));
    expect(scopedAnswerCacheKey(withoutGap)).toBe(scopedAnswerCacheKey(withGap));
    expect(sharedAnswerNormalizedQuery(withoutGap)).toBe(sharedAnswerNormalizedQuery(withGap));
  });
});
