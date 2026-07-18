import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchTelemetry } from "../src/lib/rag-contracts";
import type { RagAnswer } from "../src/lib/types";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ragVersion = "test-rag-version";

function indexingVersion(stamp: string) {
  return `${ragVersion}:doc-1:${stamp}:`;
}

function baseTelemetry(overrides: Partial<SearchTelemetry> = {}): SearchTelemetry {
  return {
    search_cache_hit: false,
    text_fast_path_latency_ms: 0,
    embedding_skipped: true,
    embedding_latency_ms: 0,
    embedding_cache_hit: false,
    supabase_rpc_latency_ms: 0,
    rerank_latency_ms: 0,
    ...overrides,
  };
}

type CacheHarness = ReturnType<typeof createCacheHarness>;

function createCacheHarness() {
  let documentStamp = "request-start";
  let documentReads = 0;
  let clientCreations = 0;
  let advanceClockOnSecondClient = false;
  const sharedReadVersions: string[] = [];
  const inserts: Array<Record<string, unknown>> = [];

  function chain(table: string) {
    const filters = new Map<string, unknown>();
    const builder = {
      select: () => builder,
      delete: () => builder,
      eq: (column: string, value: unknown) => {
        filters.set(column, value);
        return builder;
      },
      is: (column: string, value: unknown) => {
        filters.set(column, value);
        return builder;
      },
      in: () => builder,
      or: () => builder,
      gt: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => {
        sharedReadVersions.push(String(filters.get("indexing_version")));
        return { data: null, error: null };
      },
      then: (
        resolve: (value: { data: unknown[] | null; error: null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => {
        if (table === "documents") {
          documentReads += 1;
          return Promise.resolve({
            data: [{ id: "doc-1", updated_at: documentStamp, metadata: {} }],
            error: null,
          }).then(resolve, reject);
        }
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      },
    };
    return builder;
  }

  const createAdminClient = vi.fn(() => {
    clientCreations += 1;
    if (advanceClockOnSecondClient && clientCreations === 2) {
      vi.setSystemTime(new Date(Date.now() + 6_000));
    }
    return {
      from: (table: string) => ({
        ...chain(table),
        insert: async (row: Record<string, unknown>) => {
          inserts.push(row);
          return { data: null, error: null };
        },
      }),
    };
  });

  return {
    createAdminClient,
    get documentReads() {
      return documentReads;
    },
    get sharedReadVersions() {
      return sharedReadVersions;
    },
    get inserts() {
      return inserts;
    },
    setDocumentStamp(stamp: string) {
      documentStamp = stamp;
    },
    expireVersionBeforeSharedWrite() {
      advanceClockOnSecondClient = true;
    },
  };
}

async function loadCache(harness: CacheHarness) {
  vi.doMock("@/lib/env", () => ({
    env: {
      RAG_SEARCH_CACHE_TTL_MS: 60_000,
      RAG_SEARCH_CACHE_SIZE: 200,
      RAG_ANSWER_CACHE_TTL_MS: 60_000,
      RAG_ANSWER_CACHE_SIZE: 200,
      RAG_PERSIST_RAW_QUERY_TEXT: false,
      RAG_QUERY_HASH_SECRET: "test-query-hash-secret",
    },
    isDemoMode: () => false,
    isLocalNoAuthMode: () => false,
  }));
  vi.doMock("@/lib/deep-memory", () => ({ ragDeepMemoryVersion: ragVersion }));
  vi.doMock("@/lib/clinical-search", () => ({
    buildClinicalTextSearchQuery: (query: string) => query.trim(),
  }));
  vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: harness.createAdminClient }));
  return import("../src/lib/rag-cache");
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("RAG cache request indexing version", () => {
  it("reuses one request-start version across shared answer and search cache reads", async () => {
    const harness = createCacheHarness();
    const cache = await loadCache(harness);
    const requestVersion = indexingVersion("request-start");
    const args = { query: "lithium monitoring", ownerId };

    await cache.getSharedCachedAnswer(args, Date.now(), { indexingVersionAtRequestStart: requestVersion });
    await cache.getSharedCachedSearch(args, "medication_dose_risk", [], {
      indexingVersionAtRequestStart: requestVersion,
    });

    expect(harness.documentReads).toBe(0);
    expect(harness.sharedReadVersions).toEqual([requestVersion, requestVersion]);
  });

  it("uses the request-start version for a process-local search cache read", async () => {
    const harness = createCacheHarness();
    const cache = await loadCache(harness);
    const args = { query: "lithium monitoring", ownerId };
    const requestVersion = indexingVersion("request-start");

    await cache.setCachedSearch(args, [], baseTelemetry({ query_class: "medication_dose_risk" }), [], {
      indexingVersionAtRetrievalStart: requestVersion,
    });
    harness.setDocumentStamp("changed-after-request-start");
    await cache.cacheIndexingVersion(args, { forceRefresh: true });

    const cached = await cache.getCachedSearch(args, "medication_dose_risk", [], {
      indexingVersionAtRequestStart: requestVersion,
    });

    expect(cached?.telemetry.search_cache_hit).toBe(true);
  });

  it("keeps one forced write refresh, rejects changed indexing, and passes the refresh to the shared writer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T00:00:00.000Z"));
    const harness = createCacheHarness();
    harness.setDocumentStamp("changed");
    const cache = await loadCache(harness);
    const args = { query: "lithium monitoring", ownerId };

    await cache.setCachedSearch(args, [], baseTelemetry({ query_class: "medication_dose_risk" }), [], {
      indexingVersionAtRetrievalStart: indexingVersion("request-start"),
    });
    await Promise.resolve();

    expect(harness.documentReads).toBe(1);
    expect(harness.inserts).toHaveLength(0);

    vi.resetModules();
    const matchingHarness = createCacheHarness();
    matchingHarness.expireVersionBeforeSharedWrite();
    const matchingCache = await loadCache(matchingHarness);
    await matchingCache.setCachedSearch(args, [], baseTelemetry({ query_class: "medication_dose_risk" }), [], {
      indexingVersionAtRetrievalStart: indexingVersion("request-start"),
    });
    await vi.waitFor(() => expect(matchingHarness.inserts).toHaveLength(1));

    expect(matchingHarness.documentReads).toBe(1);
    expect(matchingHarness.inserts[0]?.indexing_version).toBe(indexingVersion("request-start"));
  });
});

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

class EmptyQuery implements PromiseLike<{ data: unknown[]; error: null }> {
  select() {
    return this;
  }
  in() {
    return this;
  }
  eq() {
    return this;
  }
  is() {
    return this;
  }
  neq() {
    return this;
  }
  or() {
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return Promise.resolve({ data: [], error: null });
  }
  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected);
  }
}

async function loadSearchWithCacheOutcome(
  outcome: "cold" | "local" | "shared",
  bootstrap?: {
    version: Deferred<string>;
    classification: Deferred<{ verdict: "out_of_corpus" }>;
    aliases: Deferred<never[]>;
  },
) {
  vi.doUnmock("@/lib/env");
  vi.doUnmock("@/lib/deep-memory");
  vi.doUnmock("@/lib/clinical-search");
  const staleTelemetry = baseTelemetry({
    search_cache_hit: true,
    search_total_latency_ms: 99_999,
    retrieval_phase_latencies_ms: { stale_phase: 99_999 },
    retrieval_strategy: "search_cache",
  });
  const getCachedSearch = vi.fn(async () =>
    outcome === "local" ? { results: [], telemetry: { ...staleTelemetry } } : null,
  );
  const getSharedCachedSearch = vi.fn(async () =>
    outcome === "shared" ? { kind: "hit" as const, results: [], telemetry: { ...staleTelemetry } } : null,
  );
  let versionStarted = false;
  let aliasesStarted = false;
  let classificationStarted = false;
  const fetchEnabledRagAliases = vi.fn(() => {
    aliasesStarted = true;
    return bootstrap?.aliases.promise ?? Promise.resolve([]);
  });

  vi.doMock("@/lib/rag-cache", async () => {
    const actual = await vi.importActual<typeof import("../src/lib/rag-cache")>("@/lib/rag-cache");
    return {
      ...actual,
      cacheIndexingVersion: vi.fn(() => {
        versionStarted = true;
        return bootstrap?.version.promise ?? Promise.resolve(indexingVersion("request-start"));
      }),
      getCachedSearch,
      getSharedCachedSearch,
      isSearchCacheEnabled: () => true,
      setCachedSearch: vi.fn(async () => undefined),
    };
  });
  vi.doMock("@/lib/rag-retrieval-variants", async () => {
    const actual =
      await vi.importActual<typeof import("../src/lib/rag-retrieval-variants")>("@/lib/rag-retrieval-variants");
    return {
      ...actual,
      fetchEnabledRagAliases,
    };
  });
  vi.doMock("@/lib/corpus-grounding", () => ({
    classifyCorpusGrounding: vi.fn(() => {
      classificationStarted = true;
      return bootstrap?.classification.promise ?? Promise.resolve({ verdict: "out_of_corpus" });
    }),
  }));
  vi.doMock("@/lib/rag-provider", () => ({
    isSourceOnlyMode: () => true,
    allowsAutoDegrade: () => true,
    sourceOnlyReason: () => "source_only",
    classifyProviderFailure: () => "provider_failure",
    SOURCE_ONLY_EMBEDDING_SKIP_REASON: "source_only",
  }));
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({
      rpc: vi.fn(async () => ({ data: [], error: null })),
      from: vi.fn(() => new EmptyQuery()),
    }),
  }));
  vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "60000");
  vi.stubEnv("RAG_SEARCH_CACHE_SIZE", "200");
  vi.stubEnv("OPENAI_API_KEY", "");

  const { searchChunksWithTelemetry } = await import("../src/lib/rag");
  return {
    searchChunksWithTelemetry,
    get started() {
      return { versionStarted, aliasesStarted, classificationStarted };
    },
    fetchEnabledRagAliases,
  };
}

describe("RAG search bootstrap and latency telemetry", () => {
  it("starts indexing-version, query-classification, and alias bootstrap work concurrently", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T00:00:00.000Z"));
    const bootstrap = {
      version: deferred<string>(),
      classification: deferred<{ verdict: "out_of_corpus" }>(),
      aliases: deferred<never[]>(),
    };
    const loaded = await loadSearchWithCacheOutcome("cold", bootstrap);
    const controller = new AbortController();

    const pending = loaded.searchChunksWithTelemetry({
      query: "bipolar disorder",
      ownerId,
      lexicalOnly: true,
      signal: controller.signal,
    });
    await Promise.resolve();

    expect(loaded.started).toEqual({
      versionStarted: true,
      aliasesStarted: true,
      classificationStarted: true,
    });
    expect(loaded.fetchEnabledRagAliases).toHaveBeenCalledWith(
      expect.anything(),
      ownerId,
      expect.objectContaining({ ownerId, includePublic: true }),
      controller.signal,
    );

    vi.setSystemTime(new Date("2026-07-14T00:00:00.100Z"));
    bootstrap.version.resolve(indexingVersion("request-start"));
    bootstrap.classification.resolve({ verdict: "out_of_corpus" });
    bootstrap.aliases.resolve([]);
    const result = await pending;

    expect(result.telemetry.retrieval_phase_latencies_ms).toMatchObject({
      index_version: 100,
      query_classification: 100,
      alias_load: 100,
    });
    expect(result.telemetry.search_total_latency_ms).toBe(100);
    expect(result.telemetry.search_total_latency_ms).toBeLessThan(
      Object.values(result.telemetry.retrieval_phase_latencies_ms ?? {}).reduce((sum, value) => sum + value, 0),
    );
  });

  it.each(["cold", "local", "shared"] as const)(
    "records current phase and total telemetry for the %s path",
    async (outcome) => {
      const loaded = await loadSearchWithCacheOutcome(outcome);
      const result = await loaded.searchChunksWithTelemetry({
        query: outcome === "cold" ? "bipolar disorder" : "clozapine monitoring",
        ownerId,
        lexicalOnly: true,
      });

      expect(result.telemetry.search_total_latency_ms).toEqual(expect.any(Number));
      expect(result.telemetry.search_total_latency_ms).not.toBe(99_999);
      expect(result.telemetry.retrieval_phase_latencies_ms).toEqual(
        expect.objectContaining({
          index_version: expect.any(Number),
          query_classification: expect.any(Number),
          alias_load: expect.any(Number),
          local_cache_lookup: expect.any(Number),
        }),
      );
      expect(result.telemetry.retrieval_phase_latencies_ms).not.toHaveProperty("stale_phase");
      if (outcome !== "local") {
        expect(result.telemetry.retrieval_phase_latencies_ms).toHaveProperty("shared_cache_lookup");
      }
    },
  );
});

type OrchestrationEvent =
  | { kind: "index_version"; value: string }
  | { kind: "shared_read"; cacheKind: string; indexingVersion: string }
  | { kind: "shared_write"; cacheKind: string; indexingVersion: string };

function createOrchestrationHarness() {
  let documentStamp = "stale";
  let events: OrchestrationEvent[] = [];

  class Query implements PromiseLike<{ data: unknown[]; error: null }> {
    private readonly filters = new Map<string, unknown>();

    constructor(private readonly table: string) {}

    select() {
      return this;
    }
    delete() {
      return this;
    }
    eq(column: string, value: unknown) {
      this.filters.set(column, value);
      return this;
    }
    is(column: string, value: unknown) {
      this.filters.set(column, value);
      return this;
    }
    in() {
      return this;
    }
    abortSignal() {
      return this;
    }
    or() {
      return this;
    }
    gt() {
      return this;
    }
    neq() {
      return this;
    }
    order() {
      return this;
    }
    limit() {
      return this;
    }
    async maybeSingle() {
      events.push({
        kind: "shared_read",
        cacheKind: String(this.filters.get("cache_kind")),
        indexingVersion: String(this.filters.get("indexing_version")),
      });
      return { data: null, error: null };
    }
    then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
      onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      if (this.table === "documents") {
        events.push({ kind: "index_version", value: documentStamp });
        return Promise.resolve({
          data: [{ id: "doc-1", updated_at: documentStamp, metadata: {} }],
          error: null,
        }).then(onfulfilled, onrejected);
      }
      return Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected);
    }
  }

  return {
    createAdminClient: () => ({
      rpc: vi.fn(async () => ({ data: [], error: null })),
      from: (table: string) =>
        Object.assign(new Query(table), {
          insert: async (row: Record<string, unknown>) => {
            events.push({
              kind: "shared_write",
              cacheKind: String(row.cache_kind),
              indexingVersion: String(row.indexing_version),
            });
            return { data: null, error: null };
          },
        }),
    }),
    get events() {
      return events;
    },
    setDocumentStamp(stamp: string) {
      documentStamp = stamp;
    },
    clearEvents() {
      events = [];
    },
  };
}

describe("answer-to-search cache request context", () => {
  it("reuses one request-start indexing version across real answer and nested search cache reads", async () => {
    vi.doUnmock("@/lib/env");
    vi.doUnmock("@/lib/deep-memory");
    vi.doUnmock("@/lib/clinical-search");
    vi.doUnmock("@/lib/rag-cache");
    vi.doUnmock("@/lib/rag-retrieval-variants");
    vi.doUnmock("@/lib/corpus-grounding");
    vi.doUnmock("@/lib/rag-provider");
    vi.stubEnv("RAG_PROVIDER_MODE", "offline");
    vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "60000");
    vi.stubEnv("RAG_SEARCH_CACHE_SIZE", "200");
    vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "60000");
    vi.stubEnv("RAG_ANSWER_CACHE_SIZE", "200");
    vi.stubEnv("OPENAI_API_KEY", "");

    const harness = createOrchestrationHarness();
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: harness.createAdminClient }));

    const rag = await import("../src/lib/rag");
    const cache = await import("../src/lib/rag-cache");
    const args = { query: "coffee machine policy", ownerId, logQuery: false };

    // Prime stale process-local answer and search entries. The orchestration request below
    // must reject both local entries, continue through both shared reads, and carry the one
    // request-start version into the nested search instead of resolving it again.
    await rag.searchChunksWithTelemetry(args);
    await cache.setCachedAnswer(args, {} as RagAnswer);
    await vi.waitFor(() => expect(harness.events.some((event) => event.kind === "shared_write")).toBe(true));

    harness.setDocumentStamp("request-start");
    harness.clearEvents();

    const answer = await rag.answerQuestionWithScope(args);
    await vi.waitFor(() =>
      expect(harness.events.filter((event) => event.kind === "shared_read").map((event) => event.cacheKind)).toEqual([
        "answer",
        "search",
      ]),
    );

    const sharedReads = harness.events.filter(
      (event): event is Extract<OrchestrationEvent, { kind: "shared_read" }> => event.kind === "shared_read",
    );
    const requestVersion = sharedReads[0]?.indexingVersion;
    const searchReadIndex = harness.events.findIndex(
      (event) => event.kind === "shared_read" && event.cacheKind === "search",
    );
    const versionsResolvedBeforeNestedSearch = harness.events
      .slice(0, searchReadIndex)
      .filter((event) => event.kind === "index_version");

    expect(answer.routingReason).not.toContain("cache_hit");
    expect(sharedReads.map((event) => event.indexingVersion)).toEqual([requestVersion, requestVersion]);
    expect(requestVersion).toMatch(/:doc-1:request-start:$/);
    expect(versionsResolvedBeforeNestedSearch).toEqual([{ kind: "index_version", value: "request-start" }]);
  });
});
