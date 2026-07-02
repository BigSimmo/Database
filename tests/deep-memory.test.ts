import { describe, expect, it, vi } from "vitest";
import { rankClinicalResults } from "../src/lib/clinical-search";
import {
  applyMemoryCardBoosts,
  buildDocumentMemoryCards,
  buildDocumentSections,
  fetchMemoryCardsForQuery,
  ragDeepMemoryVersion,
  upsertDocumentDeepMemory,
} from "../src/lib/deep-memory";
import type { DocumentMemoryCard, SearchResult } from "../src/lib/types";

vi.mock("@/lib/openai", () => ({
  embedTexts: vi.fn(async (texts: string[]) => texts.map(() => Array.from({ length: 1536 }, () => 0.01))),
}));

const document = {
  id: "doc-1",
  owner_id: "user-1",
  title: "Future Uploaded Clinical Protocol",
  file_name: "future-upload.pdf",
  source_path: "uploads/future-upload.pdf",
  metadata: {},
};

function chunk(overrides: Partial<SearchResult> & { chunk_index?: number; page_number?: number | null }) {
  return {
    id: overrides.id ?? "chunk-1",
    document_id: overrides.document_id ?? "doc-1",
    page_number: overrides.page_number ?? 1,
    chunk_index: overrides.chunk_index ?? 0,
    section_heading: overrides.section_heading ?? "Clinical Workflow",
    content: overrides.content ?? "Clinical protocol text.",
    image_ids: overrides.image_ids ?? [],
    metadata: overrides.source_metadata ?? {},
  };
}

function result(overrides: Partial<SearchResult>): SearchResult {
  return {
    id: overrides.id ?? "chunk-1",
    document_id: overrides.document_id ?? "doc-1",
    title: overrides.title ?? "Future Uploaded Clinical Protocol",
    file_name: overrides.file_name ?? "future-upload.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: "Clinical Workflow",
    content: overrides.content ?? "Clinical protocol text.",
    image_ids: [],
    similarity: overrides.similarity ?? 0.55,
    hybrid_score: overrides.hybrid_score ?? 0.55,
    images: [],
    ...overrides,
  };
}

describe("deep RAG memory indexing", () => {
  it("builds generic section maps from arbitrary uploaded document headings and page gaps", () => {
    const sections = buildDocumentSections({
      document,
      chunks: [
        chunk({ id: "chunk-a", chunk_index: 0, page_number: 1, section_heading: "Assessment" }),
        chunk({ id: "chunk-b", chunk_index: 1, page_number: 2, section_heading: "Assessment" }),
        chunk({ id: "chunk-c", chunk_index: 2, page_number: 5, section_heading: "Escalation" }),
      ],
    });

    expect(sections).toHaveLength(2);
    expect(sections[0]).toEqual(
      expect.objectContaining({
        heading: "Assessment",
        page_start: 1,
        page_end: 2,
        chunk_ids: ["chunk-a", "chunk-b"],
      }),
    );
    expect(sections[1]).toEqual(expect.objectContaining({ heading: "Escalation", chunk_ids: ["chunk-c"] }));
    expect(sections[0].metadata).toEqual(expect.objectContaining({ rag_indexing_version: ragDeepMemoryVersion }));
  });

  it("extracts high-yield memory cards for tables, thresholds, risks, medications, and workflow steps", () => {
    const cards = buildDocumentMemoryCards({
      document,
      chunks: [
        chunk({
          id: "chunk-table",
          content:
            "| Score | Action |\n| --- | --- |\n| 6 | Immediate senior review and lorazepam 1 mg PO. |\nIf ANC is < 1.5, stop clozapine and urgent specialist review is required.\nThe workflow requires documenting the review within 24 hours.",
        }),
      ],
    });

    expect(cards.map((card) => card.card_type)).toEqual(expect.arrayContaining(["table_row", "threshold", "workflow"]));
    expect(cards.some((card) => card.content.includes("lorazepam 1 mg"))).toBe(true);
    expect(
      cards.every((card) => card.source_chunk_ids.includes("chunk-table") || card.card_type === "section_summary"),
    ).toBe(true);
    expect(cards.every((card) => card.metadata?.rag_indexing_version === ragDeepMemoryVersion)).toBe(true);
  });

  it("adds model-backed askable question cards when source IDs validate", () => {
    const cards = buildDocumentMemoryCards({
      document,
      chunks: [
        chunk({
          id: "chunk-question",
          content: "Depot medications are administered through the long acting injectable medication pathway.",
        }),
      ],
      modelProfile: {
        sections: [],
        clinical_facts: [],
        table_facts: [],
        aliases: [],
        quality_issues: [],
        model: "test-model",
        version: "model-heavy-index-v1",
        askable_questions: [
          {
            title: "How are LAI depot medications managed?",
            content: "How are long acting injectable depot medications managed?",
            source_chunk_ids: ["chunk-question"],
            source_image_ids: [],
            confidence: 0.91,
          },
        ],
      },
    });

    expect(cards.some((card) => card.card_type === "askable_question")).toBe(true);
  });

  it("keeps a source-backed fallback card when no enrichment-style high-yield terms are present", () => {
    const cards = buildDocumentMemoryCards({
      document,
      chunks: [
        chunk({
          id: "chunk-low-signal",
          content: "This future upload describes local service background, scope, and routine contact information.",
        }),
      ],
    });

    expect(cards.length).toBeGreaterThan(0);
    expect(cards.some((card) => card.source_chunk_ids.includes("chunk-low-signal"))).toBe(true);
  });

  it("does not cap persisted memory cards for large high-yield documents", () => {
    const cards = buildDocumentMemoryCards({
      document,
      chunks: Array.from({ length: 140 }, (_, index) =>
        chunk({
          id: `chunk-risk-${index}`,
          chunk_index: index,
          page_number: index + 1,
          content: `Risk workflow ${index}: urgent review is required within ${index + 1} hours and medication monitoring must be documented.`,
        }),
      ),
    });

    expect(cards.length).toBeGreaterThan(120);
    expect(cards.some((card) => card.source_chunk_ids.includes("chunk-risk-139"))).toBe(true);
  });

  it("boosts direct memory evidence above a higher raw-score generic chunk", () => {
    const boosted = applyMemoryCardBoosts(
      "ANC threshold stop clozapine",
      [
        result({
          id: "direct-threshold",
          hybrid_score: 0.5,
          content: "If ANC is < 1.5, stop clozapine and seek urgent specialist review.",
        }),
        result({
          id: "generic-monitoring",
          hybrid_score: 0.64,
          content: "General monitoring should be documented in the clinical record.",
        }),
      ],
      [
        {
          id: "card-1",
          document_id: "doc-1",
          owner_id: "user-1",
          section_id: null,
          card_type: "threshold",
          title: "Threshold: ANC clozapine",
          content: "If ANC is < 1.5, stop clozapine and seek urgent specialist review.",
          normalized_terms: ["anc", "threshold", "stop", "clozapine"],
          page_number: 1,
          source_chunk_ids: ["direct-threshold"],
          source_image_ids: [],
          confidence: 0.95,
          metadata: {},
        } satisfies DocumentMemoryCard,
      ],
    );

    const ranked = rankClinicalResults("ANC threshold stop clozapine", boosted);
    expect(ranked[0].id).toBe("direct-threshold");
    expect(ranked[0].memory_cards?.[0]?.id).toBe("card-1");
  });

  it("uses hybrid memory-card scores when mapping memory evidence back to chunks", () => {
    const boosted = applyMemoryCardBoosts(
      "table threshold monitoring",
      [
        result({
          id: "table-threshold",
          hybrid_score: 0.5,
          content: "Table row: monitoring threshold requires escalation.",
        }),
      ],
      [
        {
          id: "card-hybrid",
          document_id: "doc-1",
          owner_id: "user-1",
          section_id: null,
          card_type: "table_row",
          title: "Monitoring threshold table row",
          content: "Monitoring threshold requires escalation.",
          normalized_terms: ["monitoring", "threshold"],
          page_number: 1,
          source_chunk_ids: ["table-threshold"],
          source_image_ids: [],
          confidence: 0.2,
          metadata: { memory_hybrid_score: 0.9 },
        } satisfies DocumentMemoryCard,
      ],
    );

    expect(boosted[0].memory_score).toBe(0.9);
    expect(boosted[0].hybrid_score).toBeGreaterThan(0.7);
  });

  // L8 (audit 2026-07-01): fail CLOSED. When the documents lookup errors we
  // cannot verify which reindex generation is committed, so the fallback must
  // drop its cards for that query rather than risk injecting content from an
  // abandoned/superseded generation into a clinical answer.
  it("drops fallback memory cards when committed-generation metadata lookup fails", async () => {
    const cards = [
      {
        id: "card-new",
        document_id: "doc-1",
        owner_id: "user-1",
        section_id: null,
        card_type: "threshold",
        title: "Lithium monitoring",
        content: "Lithium monitoring threshold evidence.",
        normalized_terms: ["lithium", "monitoring"],
        page_number: 1,
        source_chunk_ids: ["chunk-1"],
        source_image_ids: [],
        confidence: 0.8,
        metadata: { index_generation_id: "replacement-generation" },
      } satisfies DocumentMemoryCard,
    ];
    class QueryStub implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
      constructor(private readonly table: string) {}
      select() {
        return this;
      }
      textSearch() {
        return this;
      }
      order() {
        return this;
      }
      limit() {
        return this;
      }
      eq() {
        return this;
      }
      in() {
        return this;
      }
      then<TResult1 = { data: unknown; error: { message: string } | null }, TResult2 = never>(
        onfulfilled?:
          ((value: { data: unknown; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): PromiseLike<TResult1 | TResult2> {
        const value =
          this.table === "document_memory_cards"
            ? { data: cards, error: null }
            : { data: null, error: { message: "metadata unavailable" } };
        return Promise.resolve(value).then(onfulfilled, onrejected);
      }
    }
    const supabase = {
      from: vi.fn((table: string) => new QueryStub(table)),
    };

    const result = await fetchMemoryCardsForQuery({
      supabase: supabase as never,
      query: "lithium monitoring",
      ownerId: "user-1",
      matchCount: 8,
    });

    expect(result).toEqual([]);
  });

  it("persists memory cards without leaking internal section indexes into inserts", async () => {
    const insertedMemoryRows: Record<string, unknown>[] = [];
    const insertedIndexUnits: Record<string, unknown>[] = [];
    const updatedRows = new Map<string, Record<string, unknown>[]>();
    const supabase = {
      from: vi.fn((table: string) => ({
        delete: () => ({ eq: vi.fn(async () => ({ data: null, error: null })) }),
        insert: (payload: Record<string, unknown>[]) => {
          if (table === "document_sections") {
            return {
              select: async () => ({
                data: payload.map((section, index) => ({
                  id: `section-${index}`,
                  section_index: section.section_index,
                })),
                error: null,
              }),
            };
          }
          if (table === "document_index_units") {
            insertedIndexUnits.push(...payload);
            return Promise.resolve({ data: null, error: null });
          }
          insertedMemoryRows.push(...payload);
          return Promise.resolve({ data: null, error: null });
        },
        select: (columns: string) => ({
          eq: (column: string, value: unknown) => {
            void columns;
            void column;
            void value;
            if (table === "documents") {
              return {
                single: async () => ({ data: { metadata: {} }, error: null }),
              };
            }
            if (table === "document_chunks") {
              return Promise.resolve({
                data: [{ id: "chunk-upsert", metadata: {} }],
                error: null,
              });
            }
            return {
              single: async () => ({ data: null, error: null }),
            };
          },
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: (column: string, value: unknown) => {
            void column;
            void value;
            updatedRows.set(table, [...(updatedRows.get(table) ?? []), payload]);
            return Promise.resolve({ data: null, error: null });
          },
        }),
      })),
      rpc: vi.fn(async () => ({ data: null, error: null })),
    };

    await upsertDocumentDeepMemory({
      supabase: supabase as never,
      document,
      chunks: [
        chunk({
          id: "chunk-upsert",
          content: "If ANC is < 1.5, stop clozapine and urgent specialist review is required.",
        }),
      ],
    });

    expect(insertedMemoryRows.length).toBeGreaterThan(0);
    expect(insertedIndexUnits.length).toBeGreaterThan(0);
    expect(insertedIndexUnits.some((row) => row.unit_type === "document_profile")).toBe(true);
    expect(insertedMemoryRows.every((row) => !("section_index" in row))).toBe(true);
    expect(insertedMemoryRows.every((row) => typeof row.section_id === "string" || row.section_id === null)).toBe(true);

    // Verify JS version stamping updates
    expect(updatedRows.get("documents")?.[0]?.metadata).toEqual(
      expect.objectContaining({
        rag_indexing_version: ragDeepMemoryVersion,
        rag_memory_version: ragDeepMemoryVersion,
      }),
    );
    expect(updatedRows.get("document_chunks")?.[0]?.metadata).toEqual(
      expect.objectContaining({
        rag_indexing_version: ragDeepMemoryVersion,
        rag_memory_version: ragDeepMemoryVersion,
      }),
    );
  });
});
