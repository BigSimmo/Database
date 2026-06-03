import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateStructuredTextResponse: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    OPENAI_FAST_ANSWER_MODEL: "gpt-fast-test",
  },
}));

vi.mock("@/lib/openai", () => ({
  generateStructuredTextResponse: mocks.generateStructuredTextResponse,
}));

import { generateDocumentEnrichment, ragEnrichmentVersion, upsertDocumentEnrichment } from "@/lib/document-enrichment";

type QueryResult = { data: unknown; error: { message: string } | null };
type QueryCall = {
  table: string;
  operation: "select" | "upsert" | "insert" | "update" | "delete";
  payload?: unknown;
  filters: Array<{ column: string; value: unknown }>;
  selected?: string;
};

function createSupabaseMock() {
  const calls: QueryCall[] = [];

  class QueryBuilder implements PromiseLike<QueryResult> {
    constructor(private readonly call: QueryCall) {}

    upsert(payload: unknown) {
      this.call.operation = "upsert";
      this.call.payload = payload;
      return this;
    }

    insert(payload: unknown) {
      this.call.operation = "insert";
      this.call.payload = payload;
      return this;
    }

    update(payload: unknown) {
      this.call.operation = "update";
      this.call.payload = payload;
      return this;
    }

    delete() {
      this.call.operation = "delete";
      return this;
    }

    select(selected?: string) {
      this.call.selected = selected;
      return this;
    }

    eq(column: string, value: unknown) {
      this.call.filters.push({ column, value });
      return this;
    }

    single() {
      return this.resolve();
    }

    then<TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      return this.resolve().then(onfulfilled, onrejected);
    }

    private resolve() {
      if (this.call.table === "document_summaries" && this.call.operation === "upsert") {
        return Promise.resolve({ data: { id: "summary-1", ...(this.call.payload as object) }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }
  }

  const supabase = {
    calls,
    from: vi.fn((table: string) => {
      const call: QueryCall = { table, operation: "select", filters: [] };
      calls.push(call);
      return new QueryBuilder(call);
    }),
  };

  return supabase;
}

describe("document enrichment", () => {
  beforeEach(() => {
    mocks.generateStructuredTextResponse.mockResolvedValue(
      JSON.stringify({
        summary: "- Use the uploaded source for future-document clinical workflow review.",
        clinical_specifics: {
          actions: ["Check the source workflow."],
          thresholds_timing: [],
          medication_monitoring: [],
          risk_escalation: [],
          documentation_forms: [],
          exceptions_gaps: [],
        },
        labels: [{ label: "future workflow", label_type: "workflow", confidence: 0.92 }],
      }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("writes the current RAG enrichment version to summaries, labels, and document metadata", async () => {
    const supabase = createSupabaseMock();

    await upsertDocumentEnrichment({
      supabase: supabase as never,
      document: {
        id: "doc-future",
        owner_id: null,
        title: "Future Uploaded Protocol",
        file_name: "future-upload.pdf",
        source_path: null,
        metadata: { existing: true },
      },
      chunks: [
        {
          id: "chunk-1",
          page_number: 1,
          chunk_index: 0,
          section_heading: "Workflow",
          content: "Future uploaded document workflow content for indexing and search.",
        },
      ],
      images: [],
    });

    const summaryUpsert = supabase.calls.find(
      (call) => call.table === "document_summaries" && call.operation === "upsert",
    );
    const labelsInsert = supabase.calls.find((call) => call.table === "document_labels" && call.operation === "insert");
    const documentUpdate = supabase.calls.find((call) => call.table === "documents" && call.operation === "update");

    expect((summaryUpsert?.payload as { metadata: Record<string, unknown> }).metadata).toMatchObject({
      generated_by: "local-worker",
      rag_enrichment_version: ragEnrichmentVersion,
      label_count: expect.any(Number),
      coverage_profile: expect.objectContaining({ chunk_count: 1 }),
    });
    expect(labelsInsert?.payload).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          document_id: "doc-future",
          source: "generated",
          metadata: expect.objectContaining({ rag_enrichment_version: ragEnrichmentVersion }),
        }),
      ]),
    );
    expect((documentUpdate?.payload as { metadata: Record<string, unknown> }).metadata).toMatchObject({
      existing: true,
      rag_enrichment_version: ragEnrichmentVersion,
      generated_label_count: expect.any(Number),
      coverage_profile: expect.objectContaining({ chunk_count: 1 }),
    });
    expect(documentUpdate?.filters).toContainEqual({ column: "id", value: "doc-future" });
  });

  it("uses coverage-aware source excerpts instead of only the first chunks for large documents", async () => {
    await generateDocumentEnrichment({
      document: {
        title: "Large Clozapine Protocol",
        file_name: "large-clozapine.pdf",
        source_path: null,
      },
      chunks: Array.from({ length: 60 }, (_, index) => ({
        id: `chunk-${index}`,
        page_number: index + 1,
        chunk_index: index,
        section_heading: index % 10 === 0 ? `Section ${index}` : null,
        content:
          index === 52
            ? "If ANC is < 1.5, stop clozapine and seek urgent specialist review."
            : `Routine source content ${index}.`,
      })),
      images: [],
    });

    const prompt = String(mocks.generateStructuredTextResponse.mock.calls.at(-1)?.[0] ?? "");
    expect(prompt).toContain("Coverage: 60 indexed chunks");
    expect(prompt).toContain("chunk_id: chunk-52");
    expect(prompt).toContain("remain indexed and retrievable");
  });
});
