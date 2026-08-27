import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDemoDocumentPayload: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {},
  isDemoMode: () => true,
}));

vi.mock("@/lib/demo-data", () => ({
  getDemoDocumentPayload: mocks.getDemoDocumentPayload,
}));

import {
  loadAuthorizedDocumentDetail,
  sanitizeDocumentDetailError,
  type DocumentDetailQuery,
} from "@/lib/document-detail";
import { PublicApiError } from "@/lib/http";

const baseQuery: DocumentDetailQuery = {
  page: 1,
  pageLimit: 5,
  chunkLimit: 4,
  chunkOffset: 0,
  assetScope: "document",
};

function demoPayload() {
  const documentId = "demo-lithium";
  return {
    document: {
      id: documentId,
      title: "Lithium Protocol",
      description: null,
      file_name: "lithium-protocol.pdf",
      file_type: "application/pdf",
      file_size: 1024,
      storage_path: "/demo-documents/lithium-protocol.pdf",
      status: "indexed",
      page_count: 12,
      chunk_count: 9,
      image_count: 3,
      error_message: null,
      metadata: {},
      labels: [],
      summary: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    pages: Array.from({ length: 12 }, (_, index) => ({
      id: `page-${index + 1}`,
      document_id: documentId,
      page_number: index + 1,
      text: `Page ${index + 1}`,
      ocr_used: false,
      metadata: {},
    })),
    chunks: Array.from({ length: 9 }, (_, index) => ({
      id: `chunk-${index}`,
      document_id: documentId,
      chunk_index: index,
      page_number: index + 1,
      section_heading: `Section ${index + 1}`,
      content: `Chunk ${index + 1}`,
      image_ids: index === 6 ? ["image-far"] : [],
    })),
    images: [
      {
        id: "image-near",
        document_id: documentId,
        page_number: 5,
        caption: "Near image",
        storage_path: "private/near.png",
        signed_url: "https://example.test/private/near.png",
        mime_type: "image/png",
      },
      { id: "image-far", document_id: documentId, page_number: 11, caption: "Far image" },
      { id: "image-global", document_id: documentId, page_number: null, caption: "Global image" },
    ],
    tableFacts: [
      { id: "fact-near", page_number: 5, source_image_id: null },
      { id: "fact-far", page_number: 11, source_image_id: null },
      { id: "fact-global", page_number: null, source_image_id: null },
      { id: "fact-selected-image", page_number: 11, source_image_id: "image-far" },
    ].map((fact) => ({
      ...fact,
      document_id: documentId,
      table_title: null,
      row_label: null,
      clinical_parameter: null,
      threshold_value: null,
      action: null,
    })),
  };
}

function load(query: Partial<DocumentDetailQuery> = {}) {
  return loadAuthorizedDocumentDetail({
    request: new Request("http://localhost:3100/api/documents/demo-lithium"),
    rawId: "demo-lithium",
    query: { ...baseQuery, ...query },
  });
}

beforeEach(() => {
  mocks.getDemoDocumentPayload.mockReturnValue(demoPayload());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("demo document detail windows", () => {
  it("windows pages and chunks around the requested page", async () => {
    const detail = await load({ page: 6 });

    expect(detail.demoMode).toBe(true);
    expect(detail.pages.map((page) => page.page_number)).toEqual([4, 5, 6, 7, 8]);
    expect(detail.chunks.map((chunk) => chunk.chunk_index)).toEqual([0, 1, 2, 3]);
    expect(detail.pageWindow).toEqual({ from: 4, to: 8, limit: 5, total: 12, hasBefore: true, hasAfter: true });
    expect(detail.chunkWindow).toMatchObject({ offset: 0, limit: 4, total: 9, hasBefore: false, hasAfter: true });
    expect(detail.window).toMatchObject({ requestedPage: 6, effectivePage: 6, selectedChunkId: null });
  });

  it("clamps a page beyond the document and reports the closing window", async () => {
    const detail = await load({ page: 99, chunkOffset: 6 });

    expect(detail.window).toMatchObject({ requestedPage: 12, effectivePage: 12 });
    expect(detail.pageWindow).toMatchObject({ from: 8, to: 12, hasBefore: true, hasAfter: false });
    expect(detail.chunkWindow).toMatchObject({ offset: 6, hasBefore: true, hasAfter: false });
  });

  it("recenters both windows on a selected chunk and keeps its neighbours", async () => {
    const detail = await load({ page: 1, chunk: "chunk-6" });

    expect(detail.window).toMatchObject({ requestedPage: 1, effectivePage: 7, selectedChunkId: "chunk-6" });
    expect(detail.chunks.map((chunk) => chunk.chunk_index)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(detail.chunkWindow).toMatchObject({ offset: 3, limit: 7, selectedChunkId: "chunk-6" });
    expect(detail.pages.map((page) => page.page_number)).toEqual([5, 6, 7, 8, 9]);
  });

  it("ignores a chunk anchor that the demo document does not contain", async () => {
    const detail = await load({ page: 2, chunk: "chunk-missing" });

    expect(detail.window).toMatchObject({ effectivePage: 2, selectedChunkId: null });
    expect(detail.chunks.map((chunk) => chunk.chunk_index)).toEqual([0, 1, 2, 3]);
  });

  it("returns every asset for the document scope", async () => {
    const detail = await load({ page: 5 });

    expect(detail.assetScope).toBe("document");
    expect(detail.images.map((image) => image.id)).toEqual(["image-near", "image-far", "image-global"]);
    expect(detail.tableFacts).toHaveLength(4);
  });

  it("projects fixture-only and private image fields out of the wire DTO", async () => {
    const detail = await load({ page: 5 });

    expect(detail.pages[0]).not.toHaveProperty("document_id");
    expect(detail.chunks[0]).not.toHaveProperty("document_id");
    expect(detail.images[0]).not.toHaveProperty("document_id");
    expect(detail.images[0]).not.toHaveProperty("storage_path");
    expect(detail.images[0]).not.toHaveProperty("signed_url");
    expect(detail.images[0]).not.toHaveProperty("mime_type");
  });

  it("restricts window-scoped assets to the page window plus selected-chunk images", async () => {
    const detail = await load({ page: 1, chunk: "chunk-6", assetScope: "window" });

    // Page window is 5-9; image-far sits on page 11 but is cited by the selected chunk.
    expect(detail.images.map((image) => image.id)).toEqual(["image-near", "image-far"]);
    // Page-less table facts stay in scope; the off-window fact only survives via its image.
    expect(detail.tableFacts.map((fact) => fact.id)).toEqual(["fact-near", "fact-global", "fact-selected-image"]);
  });

  it("raises a 404 for an unknown demo document and sanitizes it for the client", async () => {
    mocks.getDemoDocumentPayload.mockReturnValueOnce(null);

    const error = await load().catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(PublicApiError);
    expect((error as PublicApiError).status).toBe(404);
    expect(sanitizeDocumentDetailError(error)).toBe("Demo document not found.");
    expect(sanitizeDocumentDetailError(new Error("relation does not exist"))).toBe("Document could not be loaded.");
  });

  it("rejects an aborted request before touching the demo payload", async () => {
    await expect(
      loadAuthorizedDocumentDetail({
        request: new Request("http://localhost:3100/api/documents/demo-lithium", {
          signal: AbortSignal.abort(),
        }),
        rawId: "demo-lithium",
        query: baseQuery,
      }),
    ).rejects.toThrow();
    expect(mocks.getDemoDocumentPayload).not.toHaveBeenCalled();
  });
});
