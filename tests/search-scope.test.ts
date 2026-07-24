import { describe, expect, it, vi } from "vitest";
import { activeScopeFilterCount, resolveSearchScope, searchScopeFiltersSchema } from "@/lib/search-scope";

type QueryCall = {
  table: string;
  selected?: string;
  range?: { from: number; to: number };
  filters: Array<{ column: string; value: unknown }>;
  inFilters: Array<{ column: string; values: unknown[] }>;
  orders: string[];
  abortSignals: AbortSignal[];
};

type QueryResult = { data: unknown[]; error: { message: string } | null };
type QueryResolver = (call: QueryCall) => QueryResult;

class QueryBuilder implements PromiseLike<QueryResult> {
  constructor(
    private readonly call: QueryCall,
    private readonly resolver: QueryResolver,
  ) {}

  select(selected: string) {
    this.call.selected = selected;
    return this;
  }

  eq(column: string, value: unknown) {
    this.call.filters.push({ column, value });
    return this;
  }

  is(column: string, value: unknown) {
    this.call.filters.push({ column, value });
    return this;
  }

  or() {
    return this;
  }

  in(column: string, values: unknown[]) {
    this.call.inFilters.push({ column, values });
    return this;
  }

  order(column: string) {
    this.call.orders.push(column);
    return this;
  }

  range(from: number, to: number) {
    this.call.range = { from, to };
    return this;
  }

  abortSignal(signal: AbortSignal) {
    this.call.abortSignals.push(signal);
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.resolver(this.call)).then(onfulfilled, onrejected);
  }
}

function supabaseMock(resolver: QueryResolver) {
  const calls: QueryCall[] = [];
  return {
    calls,
    from: vi.fn((table: string) => {
      const call: QueryCall = { table, filters: [], inFilters: [], orders: [], abortSignals: [] };
      calls.push(call);
      return new QueryBuilder(call, resolver);
    }),
  };
}

describe("search scope filters", () => {
  it("accepts smart document label filter groups", () => {
    const filters = searchScopeFiltersSchema.parse({
      services: ["mental-health"],
      settings: ["inpatient"],
      populations: ["youth"],
      risks: ["high-risk-medication"],
      clinicalActions: ["monitor"],
      carePhases: ["discharge-planning"],
      documentIntents: ["medication-instruction"],
      contentFeatures: ["contains-monitoring-schedule"],
    });

    expect(filters).toMatchObject({
      services: ["mental-health"],
      settings: ["inpatient"],
      populations: ["youth"],
      risks: ["high-risk-medication"],
      clinicalActions: ["monitor"],
      carePhases: ["discharge-planning"],
      documentIntents: ["medication-instruction"],
      contentFeatures: ["contains-monitoring-schedule"],
    });
    expect(activeScopeFilterCount(filters)).toBe(8);
  });

  it("accepts label-type-any filters used by mode-default scopes", () => {
    const filters = searchScopeFiltersSchema.parse({ labelTypesAny: ["service"] });

    expect(filters.labelTypesAny).toEqual(["service"]);
    expect(activeScopeFilterCount(filters)).toBe(1);
  });

  it("rejects unknown label types in labelTypesAny", () => {
    expect(() => searchScopeFiltersSchema.parse({ labelTypesAny: ["not-a-label-type"] })).toThrow();
  });

  it("does not enumerate every public document when no filters are requested", async () => {
    const from = () => {
      throw new Error("public all-document scope should be enforced by the retrieval owner sentinel");
    };

    await expect(
      resolveSearchScope({
        supabase: { from } as never,
        accessScope: { includePublic: true },
      }),
    ).resolves.toMatchObject({
      documentIds: undefined,
      activeFilterCount: 0,
      matchedDocumentCount: null,
      summary: "All public documents",
    });
  });

  it("paginates label rows so later-page label matches are not silently dropped", async () => {
    const wantedDocumentId = "22222222-2222-4222-8222-222222222222";
    const supabase = supabaseMock((call) => {
      if (call.table === "documents") {
        return {
          data: [
            { id: "11111111-1111-4111-8111-111111111111", metadata: {}, import_batch_id: null },
            { id: wantedDocumentId, metadata: {}, import_batch_id: null },
          ],
          error: null,
        };
      }
      if (call.table === "document_labels") {
        if (call.range?.from === 0) {
          return {
            data: Array.from({ length: 1000 }, (_, index) => ({
              id: `label-${index.toString().padStart(4, "0")}`,
              document_id: "11111111-1111-4111-8111-111111111111",
              label: "other topic",
              label_type: "topic",
            })),
            error: null,
          };
        }
        return {
          data: [
            {
              id: "label-wanted",
              document_id: wantedDocumentId,
              label: "clozapine",
              label_type: "topic",
            },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    });

    await expect(
      resolveSearchScope({
        supabase: supabase as never,
        accessScope: { ownerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", includePublic: false },
        filters: { topics: ["clozapine"] },
      }),
    ).resolves.toMatchObject({
      documentIds: [wantedDocumentId],
      matchedDocumentCount: 1,
    });

    const labelCalls = supabase.calls.filter((call) => call.table === "document_labels");
    expect(labelCalls.map((call) => call.range)).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
    ]);
    expect(labelCalls.every((call) => call.orders.includes("id"))).toBe(true);
  });

  it("propagates caller cancellation to label scope queries", async () => {
    const controller = new AbortController();
    const supabase = supabaseMock((call) => {
      if (call.table === "documents") {
        return {
          data: [{ id: "11111111-1111-4111-8111-111111111111", metadata: {}, import_batch_id: null }],
          error: null,
        };
      }
      return { data: [], error: null };
    });

    await resolveSearchScope({
      supabase: supabase as never,
      accessScope: { ownerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", includePublic: false },
      filters: { labelTypesAny: ["topic"] },
      signal: controller.signal,
    });

    const labelCall = supabase.calls.find((call) => call.table === "document_labels");
    expect(labelCall?.abortSignals).toContain(controller.signal);
  });
});
