import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("document detail loading contract", () => {
  it("uses one server-only authorized loader from both the route and page", () => {
    const loader = source("src/lib/document-detail.ts");
    const route = source("src/app/api/documents/[id]/route.ts");
    const page = source("src/app/documents/[id]/page.tsx");

    expect(loader).toContain('import "server-only"');
    expect(loader).toContain("loadAuthorizedDocumentDetail");
    expect(route).toContain("loadAuthorizedDocumentDetail");
    expect(page).toContain("loadAuthorizedDocumentDetail");
    expect(page).toContain("initialDetail={initialDetail}");
    expect(page).toContain("initialError={initialError}");
    expect(page).toContain('key={`${id}:${initialPage}:${query.chunk ?? ""}`}');
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
    expect(loader).toContain("and(image_type.neq.logo_decorative,or(searchable.eq.true,source_kind.eq.table_crop)");
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
    const panelInstances = viewer.match(/<IndexedTextPanel\b/g) ?? [];
    const retryStart = viewer.indexOf("const retryPreview");
    const retryBlock = viewer.slice(retryStart, viewer.indexOf("useEffect", retryStart));

    expect(viewer).toContain('assetScope: "window"');
    expect(viewer).toContain("useInitialResult");
    expect(viewer).toContain("initialDetail?.document");
    expect(viewer).toContain("initialDetail?.pages");
    expect(viewer).toContain("detailRequestSequenceRef");
    expect(viewer).toContain("detailControllerRef.current?.abort()");
    expect(viewer).toContain("pageByNumber");
    expect(viewer).toContain("chunkById");
    expect(viewer).toContain("window.history.pushState");
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
});
