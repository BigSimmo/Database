import { describe, expect, it, vi } from "vitest";

import { fetchRelatedDocumentMetadata, fetchRelatedDocuments } from "../src/lib/document-enrichment";
import type { SearchResult } from "../src/lib/types";

const results = [
  {
    id: "chunk-1",
    document_id: "document-1",
    title: "Clozapine monitoring",
    file_name: "clozapine.pdf",
    page_number: 2,
    chunk_index: 0,
    section_heading: "Monitoring",
    content: "Clozapine monitoring guidance.",
    image_ids: [],
    similarity: 0.9,
    hybrid_score: 0.92,
    images: [],
  },
] as SearchResult[];

function metadataRpc() {
  return vi.fn(async () => ({
    data: [{ document_id: "document-1", labels: [], summary: "Monitoring guidance." }],
    error: null,
  }));
}

describe("related-document visual counts", () => {
  it("skips the visual-count query when includeVisualCounts is false", async () => {
    const from = vi.fn(() => {
      throw new Error("visual-count query should not run");
    });
    const supabase = { rpc: metadataRpc(), from };

    const related = await fetchRelatedDocuments({
      supabase: supabase as never,
      query: "clozapine",
      results,
      includeVisualCounts: false,
    });

    expect(from).not.toHaveBeenCalled();
    expect(related[0]).toMatchObject({ document_id: "document-1", image_count: 0, table_count: 0 });
  });

  it("keeps visual counts enabled by default", async () => {
    const query = {
      select: vi.fn(),
      in: vi.fn(),
      neq: vi.fn(async () => ({
        data: [
          {
            document_id: "document-1",
            source_kind: "table_crop",
            searchable: true,
            image_type: "table",
            clinical_relevance_score: 0.9,
            metadata: { clinical_use_class: "clinical_evidence" },
          },
        ],
        error: null,
      })),
    };
    query.select.mockReturnValue(query);
    query.in.mockReturnValue(query);
    const from = vi.fn(() => query);
    const supabase = { rpc: metadataRpc(), from };

    const related = await fetchRelatedDocuments({
      supabase: supabase as never,
      query: "clozapine",
      results,
    });

    expect(from).toHaveBeenCalledWith("document_images");
    expect(related[0]).toMatchObject({ document_id: "document-1", image_count: 1, table_count: 1 });
  });

  it("attaches the caller signal to metadata RPC builders", async () => {
    const controller = new AbortController();
    const abortSignal = vi.fn(async () => ({
      data: [{ document_id: "document-1", labels: [], summary: null }],
      error: null,
    }));
    const supabase = { rpc: vi.fn(() => ({ abortSignal })) };

    await fetchRelatedDocumentMetadata({
      supabase: supabase as never,
      documentIds: ["document-1"],
      signal: controller.signal,
    });

    expect(abortSignal).toHaveBeenCalledWith(controller.signal);
  });
});
