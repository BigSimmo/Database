import { describe, expect, it } from "vitest";
import { activeScopeFilterCount, resolveSearchScope, searchScopeFiltersSchema } from "@/lib/search-scope";

describe("search scope filters", () => {
  it("paginates label enumeration beyond the PostgREST 1,000-row cap", async () => {
    const documentIds = ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"];
    const documents = documentIds.map((id) => ({ id, metadata: {}, import_batch_id: null }));
    const labels = Array.from({ length: 1_001 }, (_, index) => ({
      id: String(index).padStart(4, "0"),
      document_id: index === 1_000 ? documentIds[1] : documentIds[0],
      label: index === 1_000 ? "target-service" : `other-service-${index}`,
      label_type: "service",
    }));
    const requestedRanges: Array<[string, number, number]> = [];
    const requestedOrders: Array<[string, string, boolean]> = [];

    const from = (table: string) => {
      let start = 0;
      let end = 999;
      const builder = {
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        in: () => builder,
        or: () => builder,
        order: (column: string, options?: { ascending?: boolean }) => {
          requestedOrders.push([table, column, options?.ascending !== false]);
          return builder;
        },
        abortSignal: () => builder,
        range: (nextStart: number, nextEnd: number) => {
          start = nextStart;
          end = nextEnd;
          requestedRanges.push([table, start, end]);
          return builder;
        },
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => {
          const rows = table === "documents" ? documents : labels;
          return Promise.resolve(resolve({ data: rows.slice(start, end + 1), error: null }));
        },
      };
      return builder;
    };

    await expect(
      resolveSearchScope({
        supabase: { from } as never,
        accessScope: { includePublic: true },
        filters: { services: ["target-service"] },
      }),
    ).resolves.toMatchObject({ documentIds: [documentIds[1]], matchedDocumentCount: 1 });
    expect(requestedRanges.filter(([table]) => table === "document_labels")).toEqual([
      ["document_labels", 0, 999],
      ["document_labels", 1_000, 1_999],
    ]);
    expect(requestedOrders.filter(([table]) => table === "document_labels")).toEqual([
      ["document_labels", "id", true],
      ["document_labels", "id", true],
    ]);
  });

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
});
