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
} from "../src/lib/rag/rag-cache";
import { governedCorpusComponentState } from "../src/lib/rag/rag-contracts";
import type { RagContextSnapshot } from "../src/lib/site-content/site-content-contracts";
import type { RagQueryPlan, SourceCorpusScope } from "../src/lib/types";

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

function row(id: string, corpusScope: SourceCorpusScope): Record<string, unknown> {
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
      corpus_scope: corpusScope,
      uploaded_by: "user-id-canary",
      public_source_steward_id: "administrator-id-canary",
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
    const data = scopes.flatMap((scope) => {
      if (scope === "uploaded_local") return [];
      return [row(scope, scope)];
    });
    return {
      abortSignal: vi.fn(async () => ({ data, error: null })),
    };
  });
  return { calls, supabase: { rpc } as never };
}

describe("governed public corpus retrieval", () => {
  it("builds ordered public-only primary and explicit-gap supplementary phases", () => {
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

  it("does not admit uploaded_local without a trusted atomic activation boundary", async () => {
    const { supabase } = harness();
    const results = await searchGovernedCorpora({
      supabase,
      queryVariants: ["local guideline"],
      matchCount: 12,
      snapshot: snapshot(),
      components: { siteContent: true, australianAugmentation: true, australianCurrent: true },
      targetSiteDomains: [],
      internationalCoverageGap: false,
    });

    expect(results.some((candidate) => candidate.corpus_scope === "uploaded_local")).toBe(false);
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
    expect(results.map((result) => result.corpus_scope)).toEqual(["australian_public"]);
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
});
