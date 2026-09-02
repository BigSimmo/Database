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
    const query = "future synthetic checklist";
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

// #000GN4 — the out-of-corpus guard is a hard pin on four eval controls, and nothing more.
//
// `clearlyOutsideCorpusMedicalPattern` exists so the four medical false-positive controls in
// `rag-eval-cases.ts` hold `unsupported_correct_rate` at 1.0; deleting it was measured at 0.79
// on 2026-07-03, because three of those four contain the word "dose" and are therefore not
// soft-tail eligible, so `classifyCorpusGrounding` never sees them.
//
// It shipped as an unpinned regex literal whose entries had been transcribed from the controls'
// own question text, including the bare tokens `ssri`, `antibiotic`, `pneumonia` and `dka`. That
// refused in-corpus psychiatric queries content-blind, with zero retrieval, and cached the empty
// result. No retrieval gate could catch it, for a precise reason: not one of the 36 golden
// QUERIES matches this pattern in either form — `ssri` appears only in a case's
// expectedContentTerms, never in a question — so the guard never fires during
// eval:retrieval:quality at all.
//
// These assertions are the contract that replaced the literal. Both directions matter — a future
// edit that widens the pattern back toward bare tokens fails the second block, and one that
// narrows it past the controls fails the first. Only three of the second block's cases were
// actually red on the old pattern (marked below); the rest are forward pins, which is the point
// of writing a contract rather than only a regression test.
describe("out-of-corpus guard (#000GN4)", () => {
  async function load() {
    const [{ analyzeClinicalQuery }, { shouldShortCircuitUnsupportedSearch }] = await Promise.all([
      import("../src/lib/clinical-search"),
      import("../src/lib/rag/rag-query-guard"),
    ]);
    return (query: string) => shouldShortCircuitUnsupportedSearch(query, analyzeClinicalQuery(query));
  }

  // Verbatim from src/lib/rag/rag-eval-cases.ts. Each declares
  // `expectedQueryClass: "unsupported_or_general"`, and scripts/eval-utils.ts asserts it.
  it.each([
    "What is the diabetic ketoacidosis insulin protocol?",
    "What antibiotic dose is recommended for community-acquired pneumonia?",
    "What SSRI dose is recommended for adolescent depression?",
    "What insulin dose should be used for hyperkalaemia?",
  ])("still refuses the eval control %j", async (query) => {
    expect(await (await load())(query)).toBe(true);
  });

  // The defect itself. These three were `true` on the old pattern and are `false` now — they
  // are the red-provable core. "ssri" is an expectedContentTerms entry of the golden case
  // `vector-gad-worry`, which expects a Generalised Anxiety document at rank 1, so the token is
  // demonstrably in-corpus and a query carrying it must reach retrieval and be judged on what
  // comes back.
  it.each([
    "Which SSRI is first line for generalised anxiety disorder?",
    "ssri induced hyponatraemia monitoring",
    "aspiration pneumonia risk in catatonia",
  ])("no longer refuses the in-corpus query %j", async (query) => {
    expect(await (await load())(query)).toBe(false);
  });

  // Forward pins, not defect proofs: each of these already reached retrieval on the old pattern,
  // by a route that has nothing to do with the tokens — "SSRIs" escapes `\bssri\b` on the
  // trailing s, the clozapine queries carry documentTitleTerms so the guard's
  // `documentTitleTerms.length === 0` condition fails, and the guard's copy never held
  // `ketamine sedation`. They are here so a future widening of the pattern cannot quietly take
  // any of them.
  it.each([
    "Which SSRIs are first line for generalised anxiety disorder?",
    "clozapine antibiotic prophylaxis",
    "Which antibiotic interacts with clozapine?",
    "ketamine sedation in acute behavioural disturbance",
  ])("keeps reaching retrieval for %j", async (query) => {
    expect(await (await load())(query)).toBe(false);
  });

  // The one behaviour change the clinical-search half makes on its own. That copy carried
  // `ketamine sedation` and the guard's did not, so classifyRagQuery forced
  // `unsupported_or_general` for these while the guard let them through — the divergence in its
  // most consequential form, since the class selects the composition menu and second-stage
  // rerank engagement (docs/rag-behaviour/behaviour-map.md) and is a search cache key
  // component. Ketamine sedation is in corpus: tests/rag-routing.test.ts uses it as
  // Agitation/Arousal document content.
  it.each([
    ["ketamine sedation dose", "medication_dose_risk"],
    ["What is the ketamine sedation protocol?", "document_lookup"],
  ])("classifies %j as %s rather than unsupported", async (query, expected) => {
    const { classifyRagQuery } = await import("../src/lib/clinical-search");
    expect(classifyRagQuery(query).queryClass).toBe(expected);
  });

  // The two copies of this pattern had diverged: clinical-search.ts carried `ketamine sedation`
  // and rag-query-guard.ts did not, so the same query could be classified `unsupported_or_general`
  // in one and still reach retrieval in the other. They now share one constant, matched against
  // the normalized query in one place and the raw query in the other.
  it("classifies and short-circuits the controls consistently across both call sites", async () => {
    const [{ analyzeClinicalQuery, classifyRagQuery }, { shouldShortCircuitUnsupportedSearch }] = await Promise.all([
      import("../src/lib/clinical-search"),
      import("../src/lib/rag/rag-query-guard"),
    ]);
    // The hyphen is the case that makes the two normalizations disagree: `normalizeAnalysisText`
    // folds it to a space before classifyRagQuery sees it, while the guard tests the raw string.
    for (const query of [
      "What antibiotic dose is recommended for community-acquired pneumonia?",
      "What antibiotic dose is recommended for community acquired pneumonia?",
    ]) {
      expect(classifyRagQuery(query).queryClass).toBe("unsupported_or_general");
      expect(shouldShortCircuitUnsupportedSearch(query, analyzeClinicalQuery(query))).toBe(true);
    }
  });
});
