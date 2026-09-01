import { afterEach, describe, expect, it, vi } from "vitest";

import type { RagContextSnapshotInput } from "../src/lib/rag/rag-context-snapshot";
import type { ClinicalSourceMetadata, SearchResult, SourceCorpusScope } from "../src/lib/types";

const RELEASE_ID = "c0f6c316-b6f8-5c55-87ce-6b486032af03";
const STATIC_DIGEST = "a".repeat(64);
const DYNAMIC_DIGEST = "b".repeat(64);
const RELEASE_DIGEST = "c".repeat(64);
const snapshotInput: RagContextSnapshotInput = {
  expectedSiteStaticManifestDigest: STATIC_DIGEST,
  activePublicSiteRelease: {
    version: "clinical-kb-site-release-v1",
    releaseId: RELEASE_ID,
    registryVersion: "site-content-registry-v1",
    staticManifestDigest: STATIC_DIGEST,
    dynamicStateDigest: DYNAMIC_DIGEST,
    releaseDigest: RELEASE_DIGEST,
    state: "active",
    activatedAt: "2026-08-30T00:00:00.000Z",
  },
  publicSiteChangeEpoch: "7",
  pendingPublicSiteChangeCount: 0,
  documentIndexGeneration: "document-generation-v1",
  sourcePolicyVersion: "source-policy-v1",
  rolloutVersion: "rollout-v1",
};

class EmptyQuery implements PromiseLike<{ data: unknown[]; error: null }> {
  select() {
    return this;
  }
  eq() {
    return this;
  }
  is() {
    return this;
  }
  in() {
    return this;
  }
  or() {
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  abortSignal() {
    return this;
  }
  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected);
  }
}

type GovernedTestSourceMetadata = ClinicalSourceMetadata & {
  site_content_logical_id?: string;
  site_content_lineage?: Array<{
    sourceId: string;
    sourceHash: string;
    relationship: "derived_from" | "references";
  }>;
};

type GovernedTestRow = Omit<SearchResult, "source_metadata"> & {
  source_metadata: GovernedTestSourceMetadata;
  site_release_id: string | null;
  site_change_epoch: string | null;
  pending_exclusion_exact: boolean | null;
};

function governedRow(id: string, scope: SourceCorpusScope): GovernedTestRow {
  return {
    id,
    document_id: `${id}-document`,
    title: "Clozapine monitoring",
    file_name: "clozapine-monitoring.md",
    page_number: null,
    chunk_index: 0,
    section_heading: "Monitoring",
    content: "Clozapine monitoring requires regular blood tests.",
    image_ids: [],
    images: [],
    similarity: 0.9,
    text_rank: 0.8,
    hybrid_score: 0.9,
    corpus_scope: scope,
    site_content_domain: scope === "clinical_kb_site" ? "medications" : null,
    source_metadata: {
      source_title: "Clozapine source",
      publisher: "Clinical KB",
      jurisdiction: "Australia/WA",
      version: "1",
      publication_date: null,
      review_date: null,
      uploaded_at: null,
      indexed_at: null,
      uploaded_by: null,
      document_status: "current",
      clinical_validation_status: "approved",
      extraction_quality: "good",
      content_mode: "indexed_content",
      licence_policy: "public_index_permitted",
      corpus_scope: scope,
      source_kind: scope === "clinical_kb_site" ? "registry_record" : "document",
      source_role: "clinical_guideline",
      source_catalogue_key: `${scope}:${id}`,
    },
    site_release_id: scope === "clinical_kb_site" ? RELEASE_ID : null,
    site_change_epoch: scope === "clinical_kb_site" ? "7" : null,
    pending_exclusion_exact: scope === "clinical_kb_site" ? true : null,
  };
}

async function loadHarness(
  options: {
    abortDuringImageHydration?: { controller: AbortController; reason: Error };
    abortDuringMetadataHydration?: { controller: AbortController; reason: Error };
    divergentCorpusGrounding?: boolean;
    hybridError?: boolean;
    missingV3?: boolean;
    candidateRows?: GovernedTestRow[];
  } = {},
) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const setCachedSearch = vi.fn(async () => undefined);
  const attachDocumentRankingMetadata = vi.fn(
    async (_client, rows: SearchResult[], _ownerId?: string, _cache?: unknown, signal?: AbortSignal) => {
      if (signal && options.abortDuringMetadataHydration) {
        options.abortDuringMetadataHydration.controller.abort(options.abortDuringMetadataHydration.reason);
        signal.throwIfAborted();
      }
      return rows;
    },
  );
  const attachPageVisualEvidence = vi.fn(async (_client, rows: SearchResult[], signal?: AbortSignal) => {
    if (signal && options.abortDuringImageHydration) {
      options.abortDuringImageHydration.controller.abort(options.abortDuringImageHydration.reason);
      signal.throwIfAborted();
    }
    return rows;
  });
  const rpc = vi.fn((name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    const response = (() => {
      if (name.endsWith("_v3") && options.missingV3) {
        return { data: null, error: { code: "PGRST202", message: "candidate RPC is absent" } };
      }
      if (name === "match_document_chunks_hybrid_v3" && options.hybridError) {
        return { data: null, error: { code: "XX000", message: "hybrid unavailable" } };
      }
      if (name.endsWith("_v3")) {
        return { data: options.candidateRows ?? [governedRow("governed-row", "uploaded_local")], error: null };
      }
      return { data: [], error: null };
    })();
    return Object.assign(Promise.resolve(response), { abortSignal: vi.fn(async () => response) });
  });

  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({ rpc, from: vi.fn(() => new EmptyQuery()) }),
  }));
  vi.doMock("@/lib/rag/rag-cache", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../src/lib/rag/rag-cache")>()),
    getCachedSearch: vi.fn(async () => null),
    getSharedCachedSearch: vi.fn(async () => null),
    setCachedSearch,
  }));
  vi.doMock("@/lib/rag/rag-retrieval-variants", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../src/lib/rag/rag-retrieval-variants")>()),
    fetchEnabledRagAliases: vi.fn(async () => []),
  }));
  vi.doMock("@/lib/corpus-grounding", () => ({
    classifyCorpusGrounding: vi.fn(async ({ ownerFilter }: { ownerFilter: string }) => ({
      verdict: options.divergentCorpusGrounding
        ? ownerFilter === "00000000-0000-0000-0000-000000000000"
          ? "out_of_corpus"
          : "in_corpus_topic"
        : "inconclusive",
      anchorTerms: [],
      absentTerms: [],
    })),
  }));
  vi.doMock("@/lib/rag/rag-provider", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../src/lib/rag/rag-provider")>()),
    isSourceOnlyMode: () => false,
  }));
  vi.doMock("@/lib/openai", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../src/lib/openai")>()),
    embedTextWithTelemetry: vi.fn(async () => ({ embedding: [0.1, 0.2], cacheHit: false })),
  }));
  vi.doMock("@/lib/rag/rag-hydration", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../src/lib/rag/rag-hydration")>()),
    attachDocumentRankingMetadata,
    attachPageVisualEvidence,
  }));

  const { searchChunksWithTelemetry } = await import("../src/lib/rag/rag");
  return {
    searchChunksWithTelemetry,
    calls,
    rpc,
    setCachedSearch,
    attachDocumentRankingMetadata,
    attachPageVisualEvidence,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("governed retrieval production entrypoint", () => {
  it("routes anonymous, authenticated, and administrator candidate searches through one v3 public population", async () => {
    const {
      searchChunksWithTelemetry,
      calls,
      setCachedSearch,
      attachDocumentRankingMetadata,
      attachPageVisualEvidence,
    } = await loadHarness();

    const resultIds = [];
    for (const ownerId of [undefined, "user-a", "administrator-a"]) {
      const result = await searchChunksWithTelemetry({
        query: "What is clozapine?",
        ownerId,
        allowGlobalSearch: true,
        skipCache: true,
        ragQueryPlanMode: "canary",
        ragContextSnapshotInput: snapshotInput,
        governedCorpusComponents: { siteContent: true, australianAugmentation: true, australianCurrent: true },
      });
      resultIds.push(result.results.map(({ document_id }) => document_id));
    }

    expect(resultIds[1]).toEqual(resultIds[0]);
    expect(resultIds[2]).toEqual(resultIds[0]);
    expect(calls).toHaveLength(6);
    expect(calls.map(({ args }) => args.query_text)).toEqual(Array(6).fill("clozapine"));
    expect(calls.map(({ args }) => args.corpus_scopes)).toEqual(
      Array.from({ length: 3 }, () => [
        ["uploaded_local", "clinical_kb_site", "australian_public"],
        ["international_supplementary"],
      ]).flat(),
    );
    expect(calls.every(({ name }) => name === "match_document_chunks_hybrid_v3")).toBe(true);
    expect(calls.every(({ args }) => args.owner_filter === "00000000-0000-0000-0000-000000000000")).toBe(true);
    expect(calls.every(({ args }) => args.include_public === true)).toBe(true);
    expect(calls.some(({ name }) => /_v2$/.test(name) || !/_v3$/.test(name))).toBe(false);
    expect(attachDocumentRankingMetadata).toHaveBeenCalledTimes(3);
    expect(attachDocumentRankingMetadata.mock.calls.every((call) => call[2] === undefined)).toBe(true);
    expect(attachPageVisualEvidence).toHaveBeenCalledTimes(3);
    expect(setCachedSearch).not.toHaveBeenCalled();
  });

  it("uses v3 vector fallback with the same document filter and never falls through to v2", async () => {
    const { searchChunksWithTelemetry, calls } = await loadHarness();
    const controller = new AbortController();

    await searchChunksWithTelemetry({
      query: "Clozapine monitoring guideline",
      documentId: "11111111-1111-4111-8111-111111111111",
      ownerId: "user-a",
      skipCache: true,
      forceEmbedding: true,
      signal: controller.signal,
      ragQueryPlanMode: "canary",
      ragContextSnapshotInput: snapshotInput,
      governedCorpusComponents: { siteContent: true, australianAugmentation: false, australianCurrent: false },
    });

    expect(calls.map(({ name }) => name)).toEqual(["match_document_chunks_v3"]);
    expect(calls[0]?.args.document_filter).toBe("11111111-1111-4111-8111-111111111111");
    expect(calls.every(({ name }) => name.endsWith("_v3"))).toBe(true);
  });

  it("falls back from hybrid only to vector v3 inside the shared candidate budget", async () => {
    const { searchChunksWithTelemetry, calls } = await loadHarness({ hybridError: true });

    await searchChunksWithTelemetry({
      query: "What is clozapine?",
      allowGlobalSearch: true,
      skipCache: true,
      ragQueryPlanMode: "canary",
      ragContextSnapshotInput: snapshotInput,
      governedCorpusComponents: { siteContent: true, australianAugmentation: false, australianCurrent: false },
    });

    expect(calls.map(({ name }) => name)).toEqual(["match_document_chunks_hybrid_v3", "match_document_chunks_v3"]);
  });

  it("fails a missing candidate RPC closed at the production entrypoint without legacy fallback", async () => {
    const { searchChunksWithTelemetry, calls } = await loadHarness({ missingV3: true });

    const result = await searchChunksWithTelemetry({
      query: "What is clozapine?",
      allowGlobalSearch: true,
      skipCache: true,
      ragQueryPlanMode: "canary",
      ragContextSnapshotInput: snapshotInput,
      governedCorpusComponents: { siteContent: true, australianAugmentation: false, australianCurrent: false },
    });

    expect(result.results).toEqual([]);
    expect(calls.map(({ name }) => name)).toEqual(["match_document_chunks_hybrid_v3"]);
  });

  it("keeps shadow v2 results as the control while its bounded candidate lane is v3-only", async () => {
    const { searchChunksWithTelemetry, calls, setCachedSearch } = await loadHarness();

    const result = await searchChunksWithTelemetry({
      query: "What is clozapine?",
      documentId: "11111111-1111-4111-8111-111111111111",
      ownerId: "user-a",
      lexicalOnly: true,
      skipCache: true,
      ragQueryPlanMode: "shadow",
      ragContextSnapshotInput: snapshotInput,
      governedCorpusComponents: { siteContent: true, australianAugmentation: false, australianCurrent: false },
    });

    const candidateCalls = calls.filter(({ name }) => name.endsWith("_v3"));
    const controlCalls = calls.filter(({ name }) => name.endsWith("_v2"));
    expect(candidateCalls.map(({ name }) => name)).toEqual(["match_document_chunks_text_v3"]);
    expect(candidateCalls[0]?.args.document_filters).toEqual(["11111111-1111-4111-8111-111111111111"]);
    expect(controlCalls.length).toBeGreaterThan(0);
    expect(result.results).toEqual([]);
    expect(result.telemetry.governed_candidate_count).toBe(1);
    expect(result.telemetry.governed_candidate_rpc_calls).toBe(1);
    expect(calls.filter(({ name }) => /^match_document_chunks(?:_text)?_v[23]$/.test(name)).length).toBeLessThanOrEqual(
      4,
    );
    expect(setCachedSearch).not.toHaveBeenCalled();
  });

  it("keeps the shadow candidate plan public and identity-invariant while preserving identity-scoped controls", async () => {
    const { searchChunksWithTelemetry, calls } = await loadHarness({ divergentCorpusGrounding: true });
    const candidateArgs: Record<string, unknown>[] = [];
    const candidateCounts = [];

    for (const ownerId of [undefined, "user-a", "administrator-a"]) {
      const callStart = calls.length;
      const result = await searchChunksWithTelemetry({
        query: "bipolar disorder",
        ownerId,
        allowGlobalSearch: true,
        lexicalOnly: true,
        skipCache: true,
        ragQueryPlanMode: "shadow",
        ragContextSnapshotInput: snapshotInput,
        governedCorpusComponents: { siteContent: true, australianAugmentation: false, australianCurrent: false },
      });
      const requestCalls = calls.slice(callStart);
      candidateArgs.push(requestCalls.find(({ name }) => name === "match_document_chunks_text_v3")?.args ?? {});
      candidateCounts.push(result.telemetry.candidate_match_counts);
    }

    expect(candidateArgs[1]).toEqual(candidateArgs[0]);
    expect(candidateArgs[2]).toEqual(candidateArgs[0]);
    expect(candidateCounts[1]).toEqual(candidateCounts[0]);
    expect(candidateCounts[2]).toEqual(candidateCounts[0]);
    const controlOwnerFilters = calls.filter(({ name }) => name.endsWith("_v2")).map(({ args }) => args.owner_filter);
    expect(controlOwnerFilters).toContain("user-a");
    expect(controlOwnerFilters).toContain("administrator-a");
  });

  it("propagates caller cancellation from the production v3 lane without issuing legacy retrieval", async () => {
    const { searchChunksWithTelemetry, calls, rpc } = await loadHarness();
    const controller = new AbortController();
    const reason = new DOMException("caller left governed retrieval", "AbortError");
    rpc.mockImplementationOnce((name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return {
        abortSignal: vi.fn(async (signal: AbortSignal) => {
          controller.abort(reason);
          signal.throwIfAborted();
          return { data: [], error: null };
        }),
      } as never;
    });

    await expect(
      searchChunksWithTelemetry({
        query: "What is clozapine?",
        allowGlobalSearch: true,
        skipCache: true,
        signal: controller.signal,
        ragQueryPlanMode: "canary",
        ragContextSnapshotInput: snapshotInput,
        governedCorpusComponents: { siteContent: true, australianAugmentation: false, australianCurrent: false },
      }),
    ).rejects.toBe(reason);

    expect(calls.map(({ name }) => name)).toEqual(["match_document_chunks_hybrid_v3"]);
  });

  it("propagates caller cancellation during governed metadata hydration", async () => {
    const controller = new AbortController();
    const reason = new DOMException("caller left metadata hydration", "AbortError");
    const { searchChunksWithTelemetry, attachPageVisualEvidence } = await loadHarness({
      abortDuringMetadataHydration: { controller, reason },
    });

    await expect(
      searchChunksWithTelemetry({
        query: "What is clozapine?",
        allowGlobalSearch: true,
        skipCache: true,
        signal: controller.signal,
        ragQueryPlanMode: "canary",
        ragContextSnapshotInput: snapshotInput,
        governedCorpusComponents: { siteContent: true, australianAugmentation: false, australianCurrent: false },
      }),
    ).rejects.toBe(reason);

    expect(attachPageVisualEvidence).not.toHaveBeenCalled();
  });

  it("propagates caller cancellation during governed image hydration", async () => {
    const controller = new AbortController();
    const reason = new DOMException("caller left image hydration", "AbortError");
    const { searchChunksWithTelemetry, attachDocumentRankingMetadata } = await loadHarness({
      abortDuringImageHydration: { controller, reason },
    });

    await expect(
      searchChunksWithTelemetry({
        query: "What is clozapine?",
        allowGlobalSearch: true,
        skipCache: true,
        signal: controller.signal,
        ragQueryPlanMode: "canary",
        ragContextSnapshotInput: snapshotInput,
        governedCorpusComponents: { siteContent: true, australianAugmentation: false, australianCurrent: false },
      }),
    ).rejects.toBe(reason);

    expect(attachDocumentRankingMetadata).toHaveBeenCalledOnce();
  });

  it("applies claim-role eligibility before final governed top-K", async () => {
    const wrongRole = Array.from({ length: 4 }, (_, index): GovernedTestRow => {
      const candidate = governedRow(`form-${index}`, "uploaded_local");
      return {
        ...candidate,
        content: "Clozapine maintenance treatment guidance.",
        hybrid_score: 0.99 - index * 0.01,
        similarity: 0.99 - index * 0.01,
        source_metadata: { ...candidate.source_metadata, source_role: "form_reference" },
      };
    });
    const guideline = governedRow("eligible-guideline", "uploaded_local");
    guideline.content = "Clozapine maintenance treatment guidance.";
    guideline.hybrid_score = 0.2;
    guideline.similarity = 0.2;
    guideline.source_metadata = { ...guideline.source_metadata, source_role: "local_guideline" };
    const { searchChunksWithTelemetry } = await loadHarness({ candidateRows: [...wrongRole, guideline] });

    const response = await searchChunksWithTelemetry({
      query: "What is clozapine maintenance treatment?",
      topK: 2,
      allowGlobalSearch: true,
      skipCache: true,
      lexicalOnly: true,
      ragQueryPlanMode: "canary",
      ragContextSnapshotInput: snapshotInput,
      governedCorpusComponents: { siteContent: false, australianAugmentation: false, australianCurrent: false },
    });

    expect(response.results.map(({ id }) => id)).toContain("eligible-guideline");
    expect(response.results.map(({ id }) => id)).not.toContain("form-0");
  });

  it("collapses derivative lineage families before final governed top-K", async () => {
    const parentHash = "d".repeat(64);
    const derivatives = Array.from({ length: 3 }, (_, index): GovernedTestRow => {
      const candidate = governedRow(`derivative-${index}`, "clinical_kb_site");
      return {
        ...candidate,
        content: "Clinical KB clozapine medication record and product navigation.",
        hybrid_score: 0.99 - index * 0.01,
        similarity: 0.99 - index * 0.01,
        source_metadata: {
          ...candidate.source_metadata,
          source_role: "clinical_reference",
          content_hash: String(index + 1).repeat(64),
          site_content_logical_id: `medications:clozapine-${index}`,
          site_content_lineage: [
            { sourceId: "canonical-clozapine", sourceHash: parentHash, relationship: "derived_from" },
          ],
        },
      };
    });
    const independent = governedRow("independent-record", "clinical_kb_site");
    independent.content = "Clinical KB clozapine medication record and independent product navigation.";
    independent.hybrid_score = 0.2;
    independent.similarity = 0.2;
    independent.source_metadata = {
      ...independent.source_metadata,
      source_role: "clinical_reference",
      content_hash: "e".repeat(64),
      site_content_logical_id: "medications:clozapine-independent",
    };
    const { searchChunksWithTelemetry } = await loadHarness({ candidateRows: [...derivatives, independent] });

    const response = await searchChunksWithTelemetry({
      query: "Which Clinical KB clozapine medication record is available?",
      topK: 2,
      allowGlobalSearch: true,
      skipCache: true,
      lexicalOnly: true,
      ragQueryPlanMode: "canary",
      ragContextSnapshotInput: snapshotInput,
      governedCorpusComponents: { siteContent: true, australianAugmentation: false, australianCurrent: false },
    });

    expect(response.results).toHaveLength(2);
    expect(response.results.map(({ id }) => id)).toContain("independent-record");
    expect(response.results.filter(({ id }) => id.startsWith("derivative-"))).toHaveLength(1);
  });
});
