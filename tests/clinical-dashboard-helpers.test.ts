import { describe, expect, it } from "vitest";

import { navigationHashes } from "@/components/clinical-dashboard/dashboard-contracts";
import type { SetupCheck } from "@/components/clinical-dashboard/DocumentManagerPanel";
import {
  answerReferencesDocument,
  answerTimedOutError,
  applyRenamedDocumentToAnswer,
  compactScopeFilters,
  hasActiveIndexingWork,
  hasNonProductionSupabaseApiKeyFallback,
  isAbortError,
  mergeDocumentRefresh,
  normalizeNavigationHash,
  normalizedPollDelay,
  setupNeedsSlowRecheck,
  setupRecheckPollMs,
  shorterPollDelay,
} from "@/components/clinical-dashboard/clinical-dashboard-helpers";
import type { ClinicalDocument, ImportBatch, IngestionJob, RagAnswer } from "@/lib/types";

function check(partial: Partial<SetupCheck>): SetupCheck {
  return { id: "search", label: "Search", status: "ready", detail: "", ...partial };
}

function doc(partial: {
  id: string;
  title?: string;
  status?: string;
  labels?: unknown[];
  summary?: string;
}): ClinicalDocument {
  return { title: "Doc", status: "indexed", ...partial } as unknown as ClinicalDocument;
}

describe("normalizedPollDelay / shorterPollDelay", () => {
  it("clamps to [3000, setupRecheckPollMs] and rejects invalid values", () => {
    expect(normalizedPollDelay(1000)).toBe(3000); // floor
    expect(normalizedPollDelay(5000)).toBe(5000);
    expect(normalizedPollDelay(999999)).toBe(setupRecheckPollMs); // ceiling
    expect(normalizedPollDelay("8000")).toBe(8000); // numeric string
    expect(normalizedPollDelay(0)).toBeNull();
    expect(normalizedPollDelay(-5)).toBeNull();
    expect(normalizedPollDelay("abc")).toBeNull();
    expect(normalizedPollDelay(null)).toBeNull();
  });

  it("keeps the shorter of current and next, ignoring invalid next", () => {
    expect(shorterPollDelay(null, 5000)).toBe(5000);
    expect(shorterPollDelay(10000, 5000)).toBe(5000);
    expect(shorterPollDelay(4000, 8000)).toBe(4000);
    expect(shorterPollDelay(10000, 0)).toBe(10000); // invalid next → keep current
    expect(shorterPollDelay(null, 0)).toBeNull();
  });
});

describe("hasActiveIndexingWork / setupNeedsSlowRecheck", () => {
  it("detects in-flight work across documents, jobs, batches, and the route hint", () => {
    expect(hasActiveIndexingWork([], [], [], true)).toBe(true);
    expect(hasActiveIndexingWork([doc({ id: "a", status: "processing" })])).toBe(true);
    expect(hasActiveIndexingWork([], [{ status: "pending" } as IngestionJob])).toBe(true);
    expect(hasActiveIndexingWork([], [], [{ status: "queued" } as ImportBatch])).toBe(true);
    expect(hasActiveIndexingWork([doc({ id: "a", status: "indexed" })], [], [])).toBe(false);
  });

  it("flags a slow recheck when any setup check is not ready", () => {
    expect(setupNeedsSlowRecheck([check({ status: "ready" }), check({ id: "openai", status: "ready" })])).toBe(false);
    expect(setupNeedsSlowRecheck([check({ status: "ready" }), check({ id: "openai", status: "needs_setup" })])).toBe(
      true,
    );
  });
});

describe("hasNonProductionSupabaseApiKeyFallback", () => {
  it("matches an unregistered/invalid search API key outside production", () => {
    // vitest runs with NODE_ENV=test (not production), so the guard passes.
    expect(
      hasNonProductionSupabaseApiKeyFallback([check({ status: "needs_setup", detail: "Unregistered API key" })]),
    ).toBe(true);
    expect(
      hasNonProductionSupabaseApiKeyFallback([check({ status: "needs_setup", detail: "invalid api key here" })]),
    ).toBe(true);
    expect(hasNonProductionSupabaseApiKeyFallback([check({ status: "needs_setup", detail: "network down" })])).toBe(
      false,
    );
    expect(
      hasNonProductionSupabaseApiKeyFallback([
        check({ id: "openai", status: "needs_setup", detail: "invalid api key" }),
      ]),
    ).toBe(false);
    expect(hasNonProductionSupabaseApiKeyFallback([check({ status: "ready", detail: "invalid api key" })])).toBe(false);
  });
});

describe("normalizeNavigationHash / isAbortError / answerTimedOutError", () => {
  it("keeps known hashes and falls back to #search", () => {
    for (const hash of navigationHashes) expect(normalizeNavigationHash(hash)).toBe(hash);
    expect(normalizeNavigationHash("#unknown")).toBe("#search");
    expect(normalizeNavigationHash("")).toBe("#search");
  });

  it("recognises AbortController errors only", () => {
    expect(isAbortError(new DOMException("stop", "AbortError"))).toBe(true);
    expect(isAbortError(new DOMException("boom", "InvalidStateError"))).toBe(false);
    expect(isAbortError(new Error("AbortError"))).toBe(false);
    expect(isAbortError("AbortError")).toBe(false);
  });

  it("builds a non-retryable 408 timeout error", () => {
    const error = answerTimedOutError();
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/timed out/i);
    expect(error.status).toBe(408);
    expect(error.retryable).toBe(false);
  });
});

describe("compactScopeFilters", () => {
  it("keeps only populated array facets and truthy locality", () => {
    const compacted = compactScopeFilters({
      medications: ["metformin"],
      topics: [],
      sites: ["ed"],
      locality: "local",
      collections: [],
    });
    expect(compacted).toEqual({ medications: ["metformin"], sites: ["ed"], locality: "local" });
    expect(compactScopeFilters({})).toEqual({});
  });
});

describe("mergeDocumentRefresh", () => {
  it("merges updates over existing by id, preserves labels/summary fallbacks, and follows update order", () => {
    const current = [
      doc({ id: "1", title: "Old One", labels: ["x"], summary: "old summary" }),
      doc({ id: "2", title: "Two" }),
    ];
    const updates = [
      doc({ id: "2", title: "Two v2" }),
      doc({ id: "1", title: "New One" }),
      doc({ id: "3", title: "Three" }),
    ];
    const merged = mergeDocumentRefresh(current, updates);
    expect(merged.map((d) => d.id)).toEqual(["2", "1", "3"]); // order follows updates
    const one = merged.find((d) => d.id === "1")!;
    expect(one.title).toBe("New One"); // update wins
    expect(one.labels).toEqual(["x"]); // fallback to existing when update omits
    expect(one.summary).toBe("old summary");
    expect(merged.find((d) => d.id === "3")!.title).toBe("Three"); // brand-new passthrough
  });
});

describe("answerReferencesDocument / applyRenamedDocumentToAnswer", () => {
  function answer(overrides: Partial<RagAnswer>): RagAnswer {
    return {
      citations: [],
      sources: [],
      ...overrides,
    } as unknown as RagAnswer;
  }

  it("detects references across citations and sources, and no-ops on null", () => {
    expect(answerReferencesDocument(null, "d1")).toBe(false);
    expect(answerReferencesDocument(answer({ citations: [{ document_id: "d1", title: "T" }] as never }), "d1")).toBe(
      true,
    );
    expect(answerReferencesDocument(answer({ sources: [{ document_id: "d2" }] as never }), "d2")).toBe(true);
    expect(answerReferencesDocument(answer({}), "d9")).toBe(false);
  });

  it("renames the document title everywhere it is referenced and no-ops otherwise", () => {
    const original = answer({
      citations: [{ document_id: "d1", title: "Old" }] as never,
      sources: [{ document_id: "d1", title: "Old" }] as never,
    });
    const renamed = applyRenamedDocumentToAnswer(original, doc({ id: "d1", title: "New Title" }));
    expect(renamed?.citations[0].title).toBe("New Title");
    expect(renamed?.sources[0].title).toBe("New Title");

    const unrelated = applyRenamedDocumentToAnswer(original, doc({ id: "dX", title: "Nope" }));
    expect(unrelated).toBe(original); // unchanged reference when not referenced
  });
});
