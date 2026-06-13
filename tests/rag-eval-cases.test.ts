import { describe, expect, it } from "vitest";
import { loadCapturedRagEvalCases, mapCapturedEvalCase, mergeRagEvalCases } from "../src/lib/rag-eval-cases";

const row = {
  id: "capture-1",
  query: "What FBC threshold should withhold clozapine?",
  query_class: "table_threshold",
  top_files: ["CG.MHSP.ClozapinePresAdminMonitor.pdf"],
  expected_file: null,
  miss_reason: "answer_good_eval",
  metadata: { rating: "good" },
  created_at: "2026-06-13T00:00:00.000Z",
};

function clientWithRows(rows: (typeof row)[]) {
  const filters: Array<{ column: string; value: unknown }> = [];
  const query = {
    eq(column: string, value: unknown) {
      filters.push({ column, value });
      return query;
    },
    order() {
      return {
        limit: async () => ({ data: rows, error: null }),
      };
    },
  };
  return {
    filters,
    from: () => ({
      select: () => query,
    }),
  };
}

describe("captured RAG eval cases", () => {
  it("maps good captures to source-backed reusable eval cases", () => {
    const testCase = mapCapturedEvalCase(row);

    expect(testCase).toMatchObject({
      id: "captured-capture-1",
      question: row.query,
      expectedQueryClass: "table_threshold",
      expectedFiles: ["CG.MHSP.ClozapinePresAdminMonitor.pdf"],
      supported: true,
      minCitations: 1,
    });
  });

  it("does not treat needs-fixing top files as expected hits without explicit review", () => {
    const testCase = mapCapturedEvalCase({
      ...row,
      id: "capture-2",
      miss_reason: "answer_needs_fixing",
      metadata: { rating: "needs_fixing" },
    });

    expect(testCase.expectedFiles).toEqual([]);
    expect(testCase.minCitations).toBe(0);
  });

  it("loads only promoted captures and scopes to the owner when provided", async () => {
    const client = clientWithRows([row]);
    const cases = await loadCapturedRagEvalCases({
      supabase: client,
      ownerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      limit: 3,
    });

    expect(cases).toHaveLength(1);
    expect(client.filters).toEqual([
      { column: "promoted_eval_case", value: true },
      { column: "owner_id", value: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    ]);
  });

  it("prefers captured regressions while deduping matching static questions", () => {
    const captured = mapCapturedEvalCase(row);
    const merged = mergeRagEvalCases(
      [
        {
          ...captured,
          id: "static-duplicate",
          expectedFiles: [],
        },
      ],
      [captured],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("captured-capture-1");
  });
});
