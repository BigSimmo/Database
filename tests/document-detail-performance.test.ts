import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sourceSegment } from "./helpers/source-contract";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("document detail loading contract", () => {
  it("uses one server-only authorized loader from both the route and page", () => {
    const loader = source("src/lib/document-detail.ts");
    const route = source("src/app/api/documents/[id]/route.ts");
    const page = source("src/app/(search-app)/documents/[id]/page.tsx");

    expect(loader).toContain('import "server-only"');
    expect(loader).toContain("loadAuthorizedDocumentDetail");
    expect(route).toContain("loadAuthorizedDocumentDetail");
    expect(page).toContain("loadAuthorizedDocumentDetail");
    expect(page).toContain("initialDetail={initialDetail}");
    expect(page).toContain("initialError={initialError}");
    // Page/chunk updates stay inside DocumentViewer via URL sync — remounting
    // on every page flip reloaded the PDF and felt like loading lag.
    expect(page).toContain("key={id}");
    expect(page).not.toContain('key={`${id}:${initialPage}:${query.chunk ?? ""}`}');
  });

  it("supports document and window asset scopes and starts independent detail reads together", () => {
    const loader = source("src/lib/document-detail.ts");

    expect(loader).toContain('assetScope: "document" | "window"');
    expect(loader).toContain("Promise.all([");
    expect(loader).toContain("pagesRequest");
    expect(loader).toContain("chunksRequest");
    expect(loader).toContain("imagesRequest");
    expect(loader).toContain("tableFactsRequest");
    expect(loader).toContain("labelsRequest");
    expect(loader).toContain("summaryRequest");
    expect(loader).toContain("selectedImageIds(selectedChunk)");
    expect(loader).toContain("imagesRequest.or(imageWindowFilter");
    expect(loader).toContain("documentViewImageVisibility");
    expect(loader).toContain(
      "or(searchable.eq.true,source_kind.eq.table_crop,metadata->>retained_for_document_view.eq.true)",
    );
    expect(loader).toContain("and(image_type.neq.logo_decorative,${documentViewImageVisibility},page_number.gte.");
    expect(loader).toContain("id.in.(${imageIds.join");
    expect(loader).toContain("tableFactsRequest.or(tableFactWindowFilter");
    expect(loader).toContain("page_number.is.null");

    const chunkGenerationFilter = loader.indexOf("const filteredChunkQuery = generationFilter");
    const chunkRange = loader.indexOf("orderedChunkQuery.range", chunkGenerationFilter);
    const tableFactGenerationFilter = loader.indexOf("tableFactsRequest = tableFactsRequest.or(generationFilter)");
    const tableFactLimit = loader.indexOf(".limit(200)", tableFactGenerationFilter);
    expect(chunkGenerationFilter).toBeGreaterThan(-1);
    expect(chunkRange).toBeGreaterThan(chunkGenerationFilter);
    expect(tableFactGenerationFilter).toBeGreaterThan(-1);
    expect(tableFactLimit).toBeGreaterThan(tableFactGenerationFilter);
  });

  it("cancels every database phase and projects only viewer fields", () => {
    const loader = source("src/lib/document-detail.ts");
    const abortAttachments = loader.match(/\.abortSignal\(args\.request\.signal\)/g) ?? [];

    expect(abortAttachments).toHaveLength(8);
    expect(loader).toContain("args.request.signal.throwIfAborted()");
    expect(loader).not.toContain('.select("*")');
    expect(loader).toContain("documentDetailProjection");
    expect(loader).toContain("documentImageDetailProjection");
    expect(loader).toContain("tableFactDetailProjection");
    expect(loader).toContain("map(withoutMetadata)");
    expect(loader).toContain("map(withTableFactReviewMetadata)");
    expect(loader).toContain("map(withDocumentLabelReviewMetadata)");
    expect(loader).toContain("isHiddenDocumentLabel");
    expect(loader).toContain('metadataNumber(metadata, "row_count")');
    expect(loader).toContain('metadataBoolean(metadata, "rows_truncated")');
    expect(loader).toContain('metadataNumber(metadata, "crop_completeness")');
    expect(loader).toContain('metadataNumber(metadata, "structured_extraction_confidence")');
  });

  it("returns explicit demo, scope, and request-window metadata", () => {
    const loader = source("src/lib/document-detail.ts");

    expect(loader).toContain("demoMode:");
    expect(loader).toContain("assetScope:");
    expect(loader).toContain("window:");
    expect(loader).toContain("requestedPage:");
    expect(loader).toContain("effectivePage:");
  });
});

describe("document viewer latency guards", () => {
  it("server-prerenders the viewer without a setup-status round trip", () => {
    const lazy = source("src/components/document-viewer-lazy.tsx");
    const viewer = source("src/components/DocumentViewer.tsx");

    expect(lazy).not.toContain("ssr: false");
    expect(viewer).not.toContain("/api/setup-status");
  });

  it("loads window-scoped navigation details and renders one indexed-text panel", () => {
    const viewer = source("src/components/DocumentViewer.tsx");
    const routeHook = source("src/components/document-viewer/use-document-viewer-route.ts");
    const panelInstances = viewer.match(/<IndexedTextPanel\b/g) ?? [];
    // `useEffect` as an end marker is an arbitrary token, not a structure —
    // DocumentViewer has several. Guarded so a reorder fails loudly instead of
    // widening this window to the rest of the file.
    const retryBlock = sourceSegment(viewer, "const retryPreview", "useEffect", {
      label: "DocumentViewer retryPreview block",
    });

    expect(viewer).toContain('assetScope: "window"');
    expect(viewer).toContain("useInitialResult");
    expect(viewer).toContain("initialDetail?.document");
    expect(viewer).toContain("initialDetail?.pages");
    expect(viewer).toContain("detailRequestSequenceRef");
    expect(viewer).toContain("detailControllerRef.current?.abort()");
    expect(viewer).toContain("pageByNumber");
    expect(viewer).toContain("chunkById");
    expect(viewer).toContain("useDocumentViewerRoute");
    expect(routeHook).toContain("window.history.replaceState");
    expect(routeHook).not.toContain("window.history.pushState");
    expect(viewer).not.toContain("router.push(documentPageHref");
    expect(viewer).toContain("localProjectIdentityPromiseRef.current = null");
    expect(retryBlock).toContain("setLocalProjectReady(true)");
    expect(viewer).toContain("setPages(rowsById(detail.pages))");
    expect(viewer).not.toContain("mergeRowsById");
    expect(viewer).toContain("Never retain evidence from the previous page");
    expect(panelInstances).toHaveLength(1);
  });

  it("mints preview and download URLs only from explicit actions", () => {
    const viewer = source("src/components/DocumentViewer.tsx");

    expect(viewer).toContain("openSourcePreview");
    expect(viewer).toContain("openSourceDownload");
    expect(viewer).toContain("downloadActionRef");
    expect(viewer.indexOf("?download=true")).toBeGreaterThan(viewer.indexOf("openSourceDownload"));
    expect(viewer).not.toContain("fetchSignedUrlPair");
  });

  it("keeps indexed-text search separate from answer generation and discards stale hits", () => {
    const viewer = source("src/components/DocumentViewer.tsx");
    const panels = source("src/components/document-viewer/source-panels.tsx");

    expect(viewer).toContain("const currentDocumentSearchResults =");
    expect(viewer).toContain("documentSearchState.query === normalizedSourceSearch");
    expect(viewer).toContain("submitSourceSearch");
    expect(viewer).toContain("sourceSearchInputRef.current?.focus()");
    expect(viewer).toContain("Search within this document");
    expect(viewer).toContain("documentsSearchHref({ query: tag.searchText || tag.label, run: true })");
    expect(viewer).not.toContain("Search or answer from this document");
    expect(panels).toContain("Enter at least 2 characters to search all indexed passages.");
    expect(panels).toContain("const searchEligible = normalizedSearch.length >= 2;");
    expect(panels).toContain("const displayChunks = useMemo(");
  });

  it("wires filmstrip page jumps through navigateToPage without remounting the PDF viewer", () => {
    const viewer = source("src/components/DocumentViewer.tsx");
    // The visuals panel sits in the main reading column, not the rail; the wiring
    // guarded here is the same either way.
    const visuals = source("src/components/document-viewer/document-visuals-panel.tsx");
    const filmstrip = source("src/components/document-viewer/document-image-filmstrip.tsx");
    const routeHook = source("src/components/document-viewer/use-document-viewer-route.ts");

    expect(viewer).toContain("onSelectPage={navigateToPage}");
    expect(viewer).toContain("activePage={activePage}");
    expect(visuals).toContain("DocumentImageFilmstrip");
    expect(visuals).toContain("onSelectPage={onSelectPage}");
    expect(filmstrip).toContain('data-testid="document-image-filmstrip"');
    expect(routeHook).toContain("window.history.replaceState");
    expect(routeHook).not.toContain("window.history.pushState");
    expect(viewer).not.toContain("router.push(documentPageHref");
    // Page must not be part of the canvas key — that remounts pdf.js on every flip.
    expect(viewer).toContain("key={documentId}");
    expect(viewer).not.toMatch(/key=\{`\$\{documentId\}.*\$\{activePage\}/);
  });
});

/**
 * The document-scope image cap, exercised rather than read.
 *
 * The previous guard for it asserted that the string `.limit(200)` appeared somewhere in the
 * loader — which it did, on the table-facts line beside it, so the assertion held whether or not
 * the image read was bounded at all. These drive the loader against a stubbed database instead,
 * so what is pinned is the rows the caller receives.
 *
 * Every other read in the fan-out is bounded: pages by the page window, chunks by the chunk range,
 * table facts by their own cap. The document-scope image read was filtered by `document_id` alone
 * over fourteen columns including `metadata`, `labels` and `bbox`, and a large scanned PDF carries
 * thousands of those rows. `assetScope` defaults to `"document"`, so the cap is what an ordinary
 * API caller gets — which is why losing rows to it quietly matters.
 */
describe("document detail image reads", () => {
  const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const documentId = "11111111-1111-4111-8111-111111111111";
  const chunkId = "22222222-2222-4222-8222-222222222222";
  const imageCap = 200;

  type QueryCall = {
    table: string;
    filters: Array<{ column: string; value: unknown }>;
    inFilters: Array<{ column: string; values: unknown[] }>;
    orFilters: string[];
    limit?: number;
    maybeSingle: boolean;
  };
  type QueryResult = { data: unknown; error: { message: string } | null };

  function imageUuid(index: number) {
    return `33333333-3333-4333-8333-${String(index).padStart(12, "0")}`;
  }

  function imageRow(index: number, pageNumber: number) {
    return {
      id: imageUuid(index),
      page_number: pageNumber,
      storage_path: `documents/${documentId}/images/${index}.png`,
      caption: `Figure ${index}`,
      bbox: null,
      mime_type: "image/png",
      image_type: "figure",
      searchable: true,
      clinical_relevance_score: 0.5,
      source_kind: "page_render",
      width: 800,
      height: 600,
      labels: [],
      metadata: {},
    };
  }

  const documentRow = {
    id: documentId,
    owner_id: ownerId,
    title: "Antipsychotic monitoring",
    description: null,
    file_name: "monitoring.pdf",
    file_type: "application/pdf",
    file_size: 1024,
    storage_path: `documents/${documentId}/source.pdf`,
    content_hash: null,
    source_path: null,
    import_batch_id: null,
    status: "indexed",
    page_count: 1200,
    chunk_count: 40,
    image_count: 4000,
    error_message: null,
    metadata: {},
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  };

  const selectedChunkRow = {
    id: chunkId,
    page_number: 900,
    chunk_index: 12,
    section_heading: "Clozapine titration",
    content: "Titration table for clozapine.",
    image_ids: [imageUuid(9001)],
    metadata: {},
  };

  function createSupabaseMock(resolve: (call: QueryCall) => QueryResult) {
    const calls: QueryCall[] = [];
    const client = {
      calls,
      from(table: string) {
        const call: QueryCall = { table, filters: [], inFilters: [], orFilters: [], maybeSingle: false };
        calls.push(call);
        const builder = {
          select: () => builder,
          eq(column: string, value: unknown) {
            call.filters.push({ column, value });
            return builder;
          },
          neq: () => builder,
          is: () => builder,
          gte: () => builder,
          lte: () => builder,
          in(column: string, values: unknown[]) {
            call.inFilters.push({ column, values });
            return builder;
          },
          or(filter: string) {
            call.orFilters.push(filter);
            return builder;
          },
          order: () => builder,
          range: () => builder,
          limit(value: number) {
            call.limit = value;
            return builder;
          },
          abortSignal: () => builder,
          maybeSingle() {
            call.maybeSingle = true;
            return Promise.resolve(resolve(call));
          },
          then(onfulfilled: (value: QueryResult) => unknown) {
            return Promise.resolve(resolve(call)).then(onfulfilled);
          },
        };
        return builder;
      },
      rpc: async () => ({
        data: [
          {
            limited: false,
            limit_value: 100,
            remaining: 99,
            retry_after_seconds: 60,
            reset_at: new Date(Date.now() + 60_000).toISOString(),
          },
        ],
        error: null,
      }),
    };
    return client;
  }

  /**
   * Returns the loader's own `logger.warn`. The loader is imported after `vi.resetModules()`, so
   * it holds a fresh copy of every module — spying on this file's import of the logger would watch
   * an instance the loader never calls.
   */
  function mockRuntime(client: ReturnType<typeof createSupabaseMock>) {
    vi.resetModules();
    const warn = vi.fn();
    vi.doMock("@/lib/logger", () => ({
      logger: { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() },
      redactLogContext: (context: Record<string, unknown>) => context,
    }));
    vi.doMock("@/lib/env", () => ({
      env: {},
      isDemoMode: () => false,
      isLocalNoAuthMode: () => false,
      requireServerEnv: () => undefined,
      requireOpenAIEnv: () => undefined,
    }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
    vi.doMock("@/lib/supabase/auth", () => ({
      AuthenticationError: class AuthenticationError extends Error {},
      requireAuthenticatedUser: vi.fn(async () => ({ id: ownerId })),
      getOptionalAuthenticatedUser: vi.fn(async () => ({ id: ownerId })),
      unauthorizedResponse: () => new Response(null, { status: 401 }),
    }));
    return { warn };
  }

  async function loadDetail(query: Record<string, string>) {
    const { loadAuthorizedDocumentDetail, documentDetailQuerySchema } = await import("@/lib/document-detail");
    return loadAuthorizedDocumentDetail({
      request: new Request(`http://localhost/api/documents/${documentId}`, {
        headers: { authorization: "Bearer valid-token" },
      }),
      rawId: documentId,
      query: documentDetailQuerySchema.parse(query),
    });
  }

  function imageCalls(client: ReturnType<typeof createSupabaseMock>) {
    return client.calls.filter((call) => call.table === "document_images");
  }

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("returns the document-scope cap, and says so in the log rather than losing rows in silence", async () => {
    const rows = Array.from({ length: imageCap + 1 }, (_, index) => imageRow(index, index + 1));
    const client = createSupabaseMock((call) =>
      call.table === "document_images" ? { data: rows, error: null } : row(call),
    );
    const { warn: reported } = mockRuntime(client);

    const detail = await loadDetail({});

    expect(detail.images).toHaveLength(imageCap);
    // One row past the cap is read deliberately: it is the only way to tell a document with
    // exactly `imageCap` images from one that was truncated.
    expect(imageCalls(client)[0]?.limit).toBe(imageCap + 1);
    expect(reported).toHaveBeenCalledTimes(1);
    expect(reported.mock.calls[0]?.[0]).toContain("hit its cap");
    expect(reported.mock.calls[0]?.[1]).toMatchObject({ document_id: documentId, image_limit: imageCap });
  });

  it("stays quiet and returns everything when the document is inside the cap", async () => {
    const rows = Array.from({ length: imageCap }, (_, index) => imageRow(index, index + 1));
    const client = createSupabaseMock((call) =>
      call.table === "document_images" ? { data: rows, error: null } : row(call),
    );
    const { warn: reported } = mockRuntime(client);

    const detail = await loadDetail({});

    expect(detail.images).toHaveLength(imageCap);
    expect(reported).not.toHaveBeenCalled();
  });

  it("carries a selected chunk's own images by id, whatever the visibility filter would say", async () => {
    // The window scope has always done this: the reader clicked through to that chunk, so an image
    // it cites is wanted even when it is not `searchable`, not a table crop and not retained for
    // the document view. The document scope — which is what `assetScope` defaults to — dropped
    // them. One request, not two: the tenancy scan inventories this loader at a single
    // `document_images` query.
    const client = createSupabaseMock((call) =>
      call.table === "document_images" ? { data: [imageRow(1, 1)], error: null } : row(call),
    );
    mockRuntime(client);

    await loadDetail({ chunk: chunkId });

    const images = imageCalls(client);
    expect(images).toHaveLength(1);
    expect(images[0]?.orFilters).toEqual([
      "and(image_type.neq.logo_decorative,or(searchable.eq.true,source_kind.eq.table_crop,metadata->>retained_for_document_view.eq.true))," +
        `id.in.(${imageUuid(9001)})`,
    ]);
  });

  it("asks only for the visible set when no chunk is selected", async () => {
    const client = createSupabaseMock((call) =>
      call.table === "document_images" ? { data: [imageRow(1, 1)], error: null } : row(call),
    );
    mockRuntime(client);

    await loadDetail({});

    // No chunk, no id arm: the plain visibility filter, unchanged.
    expect(imageCalls(client)[0]?.orFilters).toEqual([
      "or(searchable.eq.true,source_kind.eq.table_crop,metadata->>retained_for_document_view.eq.true)",
    ]);
  });

  it("leaves the window scope uncapped", async () => {
    const rows = Array.from({ length: imageCap + 40 }, (_, index) => imageRow(index, index + 1));
    const client = createSupabaseMock((call) =>
      call.table === "document_images" ? { data: rows, error: null } : row(call),
    );
    const { warn: reported } = mockRuntime(client);

    const detail = await loadDetail({ chunk: chunkId, assetScope: "window" });

    // Bounded by its page window and carrying the selected chunk's ids in the same request, so a
    // row cap could only drop the image the reader navigated to.
    expect(detail.images).toHaveLength(imageCap + 40);
    expect(imageCalls(client)).toHaveLength(1);
    expect(imageCalls(client)[0]?.limit).toBeUndefined();
    expect(reported).not.toHaveBeenCalled();
  });

  function row(call: QueryCall): QueryResult {
    if (call.table === "documents") return { data: documentRow, error: null };
    if (call.table === "document_chunks") {
      return call.maybeSingle ? { data: selectedChunkRow, error: null } : { data: [], error: null };
    }
    if (call.table === "document_summaries") return { data: null, error: null };
    return { data: [], error: null };
  }
});
