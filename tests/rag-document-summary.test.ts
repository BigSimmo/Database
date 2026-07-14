import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("document summary context", () => {
  it("summarizes up to 40 ordered committed chunks instead of normal retrieval results", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");

    const documentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const ownerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const chunks = Array.from({ length: 45 }, (_, index) => ({
      id: `summary-chunk-${index + 1}`,
      document_id: documentId,
      page_number: index + 1,
      chunk_index: index,
      section_heading: `Section ${index + 1}`,
      content: `Committed summary evidence ${index + 1}.`,
      retrieval_synopsis: null,
      image_ids: [],
      index_generation_id: "generation-current",
    }));

    const documentQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: documentId,
          title: "Long clinical guideline",
          file_name: "long-guideline.pdf",
          metadata: {
            index_generation_id: "generation-current",
            publisher: "WA Health",
            jurisdiction: "Australia/WA",
            document_status: "current",
            clinical_validation_status: "approved",
            extraction_quality: "good",
          },
        },
        error: null,
      })),
    };
    const chunkQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(async (limit: number) => ({ data: chunks.slice(0, limit), error: null })),
    };
    const rpc = vi.fn();
    const from = vi.fn((table: string) => (table === "documents" ? documentQuery : chunkQuery));

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({ from, rpc }),
    }));

    const generateStructuredTextResult = vi.fn(
      async (input: string, schema?: Record<string, unknown>, options?: { signal?: AbortSignal }) => {
        void input;
        void schema;
        void options;
        return {
          text: JSON.stringify({
            answer:
              "The document provides practical psychiatric guidance across the full indexed source, including the final committed section.",
            grounded: true,
            confidence: "high",
            answerSections: [],
            citations: [{ chunk_id: "summary-chunk-40" }],
            quoteCards: [],
            conflictsOrGaps: [],
          }),
          model: "gpt-4.1-mini",
          operation: "summary",
          latencyMs: 12,
          requestId: "req_document_summary",
          usage: { input_tokens: 400, output_tokens: 60, total_tokens: 460 },
        };
      },
    );
    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry: vi.fn(),
      generateStructuredTextResult,
    }));

    const { summarizeDocument } = await import("../src/lib/rag");
    const controller = new AbortController();
    const answer = await summarizeDocument(documentId, ownerId, { signal: controller.signal });

    expect(documentQuery.eq).toHaveBeenCalledWith("owner_id", ownerId);
    expect(chunkQuery.order).toHaveBeenCalledWith("chunk_index", { ascending: true });
    expect(chunkQuery.limit).toHaveBeenCalledWith(40);
    expect(rpc).not.toHaveBeenCalled();
    expect(generateStructuredTextResult).toHaveBeenCalledTimes(1);
    const summaryInput = generateStructuredTextResult.mock.calls[0]?.[0] ?? "";
    expect(generateStructuredTextResult.mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({ signal: controller.signal }),
    );
    expect(summaryInput).toContain("Committed summary evidence 1.");
    expect(summaryInput).toContain("Committed summary evidence 40.");
    expect(summaryInput).not.toContain("Committed summary evidence 41.");
    expect(answer.citations).toEqual(
      expect.arrayContaining([expect.objectContaining({ chunk_id: "summary-chunk-40" })]),
    );
  });
});
