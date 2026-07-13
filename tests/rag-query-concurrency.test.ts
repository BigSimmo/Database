import { afterEach, describe, expect, it, vi } from "vitest";

import type { SearchResult } from "../src/lib/types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function result(indexUnit?: SearchResult["index_unit"]): SearchResult {
  return {
    id: "chunk-1",
    document_id: "document-1",
    title: "Lithium guideline",
    file_name: "lithium.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: null,
    content: "Lithium monitoring guidance.",
    image_ids: [],
    similarity: 0.9,
    text_rank: 0.8,
    hybrid_score: 0.9,
    document_labels: [],
    images: [],
    index_unit: indexUnit,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("RAG enrichment query concurrency", () => {
  it("starts document metadata and index-quality reads together", async () => {
    vi.resetModules();
    const metadata = deferred<Array<{ document_id: string; labels: string[]; summary: string | null }>>();
    const quality = deferred<{ data: unknown[]; error: null }>();
    const started: string[] = [];

    vi.doMock("@/lib/document-enrichment", async () => {
      const actual =
        await vi.importActual<typeof import("../src/lib/document-enrichment")>("@/lib/document-enrichment");
      return {
        ...actual,
        fetchRelatedDocumentMetadata: vi.fn(() => {
          started.push("metadata");
          return metadata.promise;
        }),
      };
    });

    const query = {
      select: () => query,
      in: () => query,
      eq: () => query,
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => {
        started.push("quality");
        return quality.promise.then(resolve);
      },
    };
    const supabase = { from: vi.fn(() => query) };
    const { attachDocumentRankingMetadata } = await import("../src/lib/rag");

    const pending = attachDocumentRankingMetadata(
      supabase as never,
      [result()],
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    await vi.waitFor(() => expect(started).toEqual(expect.arrayContaining(["metadata", "quality"])));

    metadata.resolve([{ document_id: "document-1", labels: ["lithium"], summary: "Monitoring summary" }]);
    quality.resolve({ data: [], error: null });

    await expect(pending).resolves.toEqual([
      expect.objectContaining({ document_labels: ["lithium"], document_summary: "Monitoring summary" }),
    ]);
  });

  it("starts page and direct-image reads together", async () => {
    vi.resetModules();
    const page = deferred<{ data: unknown[]; error: null }>();
    const direct = deferred<{ data: unknown[]; error: null }>();
    const started: string[] = [];

    const supabase = {
      from: vi.fn(() => {
        let kind = "page";
        const query = {
          select: () => query,
          in: (column: string) => {
            if (column === "id") kind = "direct";
            return query;
          },
          eq: () => query,
          neq: () => query,
          order: () => query,
          limit: () => query,
          then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => {
            started.push(kind);
            return (kind === "direct" ? direct.promise : page.promise).then(resolve);
          },
        };
        return query;
      }),
    };
    const { attachPageVisualEvidence } = await import("../src/lib/rag");
    const searchResult = result({
      id: "unit-1",
      unit_type: "table",
      title: "Lithium table",
      content: "Lithium table",
      source_chunk_id: "chunk-1",
      source_image_id: "image-1",
      page_start: 1,
      page_end: 1,
      heading_path: [],
      normalized_terms: ["lithium"],
      quality_score: 1,
      extraction_mode: "deterministic",
      metadata: {},
    });

    const pending = attachPageVisualEvidence(supabase as never, [searchResult]);
    await vi.waitFor(() => expect(started).toEqual(expect.arrayContaining(["page", "direct"])));

    page.resolve({ data: [], error: null });
    direct.resolve({ data: [], error: null });

    await expect(pending).resolves.toEqual([searchResult]);
  });
});
