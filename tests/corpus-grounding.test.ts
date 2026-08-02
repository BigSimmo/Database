import { afterEach, describe, expect, it, vi } from "vitest";
import type { CorpusTopicTermStats } from "../src/lib/corpus-grounding";

// Finding #11 corpus-grounded relevance: the corpus — not the LLM classifier lottery — decides
// whether an unsupported-soft-tail query is an in-corpus bare topic (answer), an
// invented/out-of-corpus query (refuse deterministically), or inconclusive (legacy behaviour).

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

function stats(overrides: Partial<CorpusTopicTermStats> & { term: string }): CorpusTopicTermStats {
  return {
    has_ts_signal: true,
    title_doc_count: 0,
    chunk_present: true,
    total_doc_count: 2000,
    ...overrides,
  };
}

describe("classifyCorpusGroundingFromStats", () => {
  async function load() {
    return import("../src/lib/corpus-grounding");
  }

  it("classifies a bare in-corpus topic: title anchor present, nothing absent", async () => {
    const { classifyCorpusGroundingFromStats } = await load();
    // "bipolar disorder" — measured live: bipolar 1 title, disorder 33/2065 titles (1.6%).
    const result = classifyCorpusGroundingFromStats([
      stats({ term: "bipolar", title_doc_count: 1 }),
      stats({ term: "disorder", title_doc_count: 33 }),
    ]);
    expect(result.verdict).toBe("in_corpus_topic");
    expect(result.anchorTerms).toEqual(["bipolar", "disorder"]);
  });

  it("treats corpus-ubiquitous title words as scaffolding, not topics", async () => {
    const { classifyCorpusGroundingFromStats } = await load();
    // "management guideline" — management headlines ~18% of titles, guideline ~20%; neither is
    // a topic anchor, so presence alone must not rescue the query.
    const result = classifyCorpusGroundingFromStats([
      stats({ term: "management", title_doc_count: 375 }),
      stats({ term: "guideline", title_doc_count: 405 }),
    ]);
    expect(result.verdict).toBe("inconclusive");
    expect(result.anchorTerms).toEqual([]);
  });

  it("refuses when any term is corpus-absent, even next to a real anchor", async () => {
    const { classifyCorpusGroundingFromStats } = await load();
    // "florbizone syndrome management" — syndrome IS a title anchor (12 titles), but the
    // invented head noun has never been seen by any chunk: absent always vetoes.
    const result = classifyCorpusGroundingFromStats([
      stats({ term: "florbizone", chunk_present: false, title_doc_count: 0 }),
      stats({ term: "syndrome", title_doc_count: 12 }),
      stats({ term: "management", title_doc_count: 375 }),
    ]);
    expect(result.verdict).toBe("out_of_corpus");
    expect(result.absentTerms).toEqual(["florbizone"]);
  });

  it("is inconclusive for chunk-present terms with no title topic (no gout guideline)", async () => {
    const { classifyCorpusGroundingFromStats } = await load();
    const result = classifyCorpusGroundingFromStats([
      stats({ term: "gout", title_doc_count: 0, chunk_present: true }),
      stats({ term: "management", title_doc_count: 375 }),
    ]);
    expect(result.verdict).toBe("inconclusive");
  });

  it("ignores tokens that stem to an empty tsquery instead of calling them absent", async () => {
    const { classifyCorpusGroundingFromStats } = await load();
    const result = classifyCorpusGroundingFromStats([
      stats({ term: "the", has_ts_signal: false, chunk_present: false }),
    ]);
    expect(result.verdict).toBe("inconclusive");
  });

  it("is inconclusive when the scoped corpus is empty", async () => {
    const { classifyCorpusGroundingFromStats } = await load();
    const result = classifyCorpusGroundingFromStats([
      stats({ term: "bipolar", title_doc_count: 1, total_doc_count: 0 }),
    ]);
    expect(result.verdict).toBe("inconclusive");
  });
});

describe("corpusGroundingTerms", () => {
  it("drops stopwords and numerals, dedupes, and caps the term list", async () => {
    const { corpusGroundingTerms } = await load();
    expect(corpusGroundingTerms("what is the bipolar disorder 2027 bipolar")).toEqual(["bipolar", "disorder"]);
    const many = corpusGroundingTerms("alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo");
    expect(many.length).toBeLessThanOrEqual(8);
  });

  async function load() {
    return import("../src/lib/corpus-grounding");
  }
});

describe("classifyCorpusGrounding (RPC + cache)", () => {
  async function load() {
    return import("../src/lib/corpus-grounding");
  }

  function fakeSupabase(rows: CorpusTopicTermStats[] | (() => CorpusTopicTermStats[])) {
    const rpc = vi.fn(async (_fn: string, args: { terms: string[] }) => {
      const all = typeof rows === "function" ? rows() : rows;
      return { data: all.filter((row) => args.terms.includes(row.term)), error: null };
    });
    return { client: { rpc } as never, rpc };
  }

  it("caches per-term stats so a repeated query does not re-query the corpus", async () => {
    const { classifyCorpusGrounding, resetCorpusGroundingCacheForTests } = await load();
    resetCorpusGroundingCacheForTests();
    const { client, rpc } = fakeSupabase([
      stats({ term: "bipolar", title_doc_count: 1 }),
      stats({ term: "disorder", title_doc_count: 33 }),
    ]);

    const first = await classifyCorpusGrounding({ supabase: client, query: "bipolar disorder", ownerFilter: null });
    const second = await classifyCorpusGrounding({ supabase: client, query: "bipolar disorder", ownerFilter: null });

    expect(first.verdict).toBe("in_corpus_topic");
    expect(second).toEqual(first);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("fails open to inconclusive on RPC errors (missing migration, transient DB failure)", async () => {
    const { classifyCorpusGrounding, resetCorpusGroundingCacheForTests } = await load();
    resetCorpusGroundingCacheForTests();
    const rpc = vi.fn(async () => ({ data: null, error: new Error("function does not exist") }));

    const result = await classifyCorpusGrounding({
      supabase: { rpc } as never,
      query: "bipolar disorder",
      ownerFilter: null,
    });
    expect(result.verdict).toBe("inconclusive");
  });

  it("shares the public sentinel cache and separates authenticated owners", async () => {
    const { classifyCorpusGrounding, resetCorpusGroundingCacheForTests } = await load();
    resetCorpusGroundingCacheForTests();
    const { client, rpc } = fakeSupabase([
      stats({ term: "bipolar", title_doc_count: 1 }),
      stats({ term: "disorder", title_doc_count: 33 }),
    ]);

    await classifyCorpusGrounding({ supabase: client, query: "bipolar disorder", ownerFilter: null });
    await classifyCorpusGrounding({
      supabase: client,
      query: "bipolar disorder",
      ownerFilter: "00000000-0000-0000-0000-000000000000",
    });
    await classifyCorpusGrounding({
      supabase: client,
      query: "bipolar disorder",
      ownerFilter: "owner-a",
    });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it.each(["42883", "PGRST202"])(
    "prefers v2 and safely merges owner and public aggregates during %s rollout",
    async (missingCode) => {
      const { classifyCorpusGrounding, resetCorpusGroundingCacheForTests } = await load();
      resetCorpusGroundingCacheForTests();
      const rpc = vi.fn(async (name: string, args: { terms: string[]; owner_filter: string }) => {
        if (name === "corpus_topic_term_stats_v2") {
          return { data: null, error: { code: missingCode, message: "missing" } };
        }
        return {
          data: [
            stats({
              term: "bipolar",
              title_doc_count: args.owner_filter === "owner-a" ? 1 : 0,
              total_doc_count: 100,
            }),
          ],
          error: null,
        };
      });
      const result = await classifyCorpusGrounding({
        supabase: { rpc } as never,
        query: "bipolar",
        ownerFilter: "owner-a",
        accessScope: { ownerId: "owner-a", includePublic: true },
      });
      expect(result.verdict).toBe("in_corpus_topic");
      expect(rpc).toHaveBeenCalledWith(
        "corpus_topic_term_stats_v2",
        expect.objectContaining({ owner_filter: "owner-a", include_public: true }),
      );
      expect(rpc.mock.calls.filter(([name]) => name === "corpus_topic_term_stats")).toHaveLength(2);
    },
  );
});

describe("analyzeQueryWithClassifierFallback corpus grounding", () => {
  async function loadRag(args: { classifierMock?: ReturnType<typeof vi.fn>; rows: CorpusTopicTermStats[] }) {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const classifierMock =
      args.classifierMock ??
      vi.fn(async () => {
        throw new Error("LLM classifier must not be called for corpus-decided queries");
      });
    vi.doMock("@/lib/openai", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../src/lib/openai")>();
      return { ...actual, generateParsedTextResult: classifierMock };
    });
    const rag = await import("../src/lib/rag/rag");
    const corpusGrounding = await import("../src/lib/corpus-grounding");
    const { analyzeClinicalQuery } = await import("../src/lib/clinical-search");
    rag.resetClassifierVerdictMemoForTests();
    corpusGrounding.resetCorpusGroundingCacheForTests();
    const rpc = vi.fn(async (_fn: string, rpcArgs: { terms: string[] }) => ({
      data: args.rows.filter((row) => rpcArgs.terms.includes(row.term)),
      error: null,
    }));
    return {
      rag,
      analyzeClinicalQuery,
      classifierMock,
      rpc,
      opts: { corpusGrounding: { supabase: { rpc } as never, ownerFilter: null } },
    };
  }

  // 60s timeout: the first test in this block pays the one-off vite transform cost of the
  // large rag.ts module graph (~15s on a cold worker) before any assertion runs.
  it(
    "deterministically reclassifies an in-corpus bare topic to broad_summary without the LLM",
    { timeout: 60000 },
    async () => {
      const { rag, analyzeClinicalQuery, classifierMock, opts } = await loadRag({
        rows: [stats({ term: "bipolar", title_doc_count: 1 }), stats({ term: "disorder", title_doc_count: 33 })],
      });
      const analysis = analyzeClinicalQuery("bipolar disorder");
      expect(analysis.queryClass).toBe("unsupported_or_general");

      const result = await rag.analyzeQueryWithClassifierFallback("bipolar disorder", analysis, opts);

      expect(classifierMock).not.toHaveBeenCalled();
      expect(result.queryClass).toBe("broad_summary");
      expect(result.confidence).toBeGreaterThanOrEqual(0.62);
      expect(result.needsSynthesis).toBe(true);
      expect(result.corpusGrounding).toBe("in_corpus_topic");
      expect(result.reasons).toContain("corpus_topic_grounding");
      // The reclassified analysis must no longer short-circuit to 0 results.
      expect(rag.shouldApplyUnsupportedSearchShortCircuit("bipolar disorder", result, [])).toBe(false);
    },
  );

  it("skips the LLM and keeps the deterministic refusal for corpus-absent invented terms", async () => {
    const { rag, analyzeClinicalQuery, classifierMock, opts } = await loadRag({
      rows: [
        stats({ term: "florbizone", chunk_present: false, title_doc_count: 0 }),
        stats({ term: "syndrome", title_doc_count: 12 }),
        stats({ term: "management", title_doc_count: 375 }),
      ],
    });
    const analysis = analyzeClinicalQuery("florbizone syndrome management");

    const result = await rag.analyzeQueryWithClassifierFallback("florbizone syndrome management", analysis, opts);

    expect(classifierMock).not.toHaveBeenCalled();
    expect(result.queryClass).toBe("unsupported_or_general");
    expect(result.needsClassifierFallback).toBe(false);
    expect(result.corpusGrounding).toBe("out_of_corpus");
    // The refusal machinery keeps firing exactly as before — the LLM lottery is just removed.
    expect(rag.shouldApplyUnsupportedSearchShortCircuit("florbizone syndrome management", result, [])).toBe(true);
    // Alias expansions still rescue the query from the short-circuit (escape hatch preserved).
    expect(rag.shouldApplyUnsupportedSearchShortCircuit("florbizone syndrome management", result, ["expansion"])).toBe(
      false,
    );
  });

  it("falls through to the LLM classifier when grounding is inconclusive", async () => {
    const classifierMock = vi.fn(async () => ({
      parsed: {
        queryClass: "broad_summary",
        confidence: 0.9,
        reasons: ["classifier_test"],
        expandedTerms: [],
      },
    }));
    const { rag, analyzeClinicalQuery, opts } = await loadRag({
      classifierMock,
      rows: [stats({ term: "gout", title_doc_count: 0 }), stats({ term: "management", title_doc_count: 375 })],
    });
    const analysis = analyzeClinicalQuery("gout management");

    const result = await rag.analyzeQueryWithClassifierFallback("gout management", analysis, opts);

    expect(classifierMock).toHaveBeenCalledTimes(1);
    expect(result.queryClass).toBe("broad_summary");
    expect(result.corpusGrounding).toBe("inconclusive");
  });

  it("never sends pattern-guarded out-of-corpus medical queries to the corpus check or LLM", async () => {
    const { rag, analyzeClinicalQuery, classifierMock, rpc, opts } = await loadRag({ rows: [] });
    const query = "What SSRI dose is recommended for adolescent depression?";
    const analysis = analyzeClinicalQuery(query);

    const result = await rag.analyzeQueryWithClassifierFallback(query, analysis, opts);

    expect(rpc).not.toHaveBeenCalled();
    expect(classifierMock).not.toHaveBeenCalled();
    expect(result.needsClassifierFallback).toBe(false);
    expect(result.queryClass).toBe("unsupported_or_general");
  });

  it("keeps legacy behaviour when no corpus grounding scope is provided", async () => {
    const classifierMock = vi.fn(async () => ({
      parsed: {
        queryClass: "broad_summary",
        confidence: 0.9,
        reasons: ["classifier_test"],
        expandedTerms: [],
      },
    }));
    const { rag, analyzeClinicalQuery } = await loadRag({ classifierMock, rows: [] });
    const query = "bipolar disorder long term care";
    const analysis = analyzeClinicalQuery(query);

    const result = await rag.analyzeQueryWithClassifierFallback(query, analysis);

    expect(classifierMock).toHaveBeenCalledTimes(1);
    expect(result.queryClass).toBe("broad_summary");
    expect(result.corpusGrounding).toBeUndefined();
  });
});
