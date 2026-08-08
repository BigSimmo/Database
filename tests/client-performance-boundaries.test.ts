import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("fixture-free client performance boundaries", () => {
  it("keeps service and form rankers independent of server fixture catalogues", () => {
    const serviceRanker = source("src/lib/service-ranker.ts");
    const formRanker = source("src/lib/form-ranker.ts");
    expect(serviceRanker).not.toMatch(/registry-fixtures|services-snapshot|defaultServiceRecords/);
    expect(formRanker).not.toMatch(/@\/lib\/forms|formRecords|registry-fixtures/);
    expect(source("src/lib/services.ts")).toContain('export * from "@/lib/service-ranker"');
    expect(source("src/lib/forms.ts")).toContain('export * from "@/lib/form-ranker"');
  });

  it("keeps differential result composition independent of the generated snapshot", () => {
    const composition = source("src/lib/differential-search-composition.ts");
    expect(composition).not.toMatch(/differential-fixtures|differentials-snapshot|loadDifferentialSnapshot/);
    const dashboard = source("src/components/clinical-dashboard/differentials-home.tsx");
    expect(dashboard).toContain('from "@/lib/differential-search-composition"');
    expect(dashboard).not.toContain('from "@/lib/differentials"');
  });

  it("keeps the cross-mode links consumer on a dynamic catalog import", () => {
    // The index-module allowlist lives in tests/cross-mode-differentials-index.test.ts.
    // This locks the dashboard consumer: a static import would pull the catalog (and
    // any future regression it reintroduces) into the main dashboard chunk.
    const links = source("src/components/clinical-dashboard/cross-mode-links.tsx");
    expect(links).toContain('import("@/lib/cross-mode-differentials")');
    expect(links).not.toContain('from "@/lib/cross-mode-differentials"');
    expect(links).not.toContain('from "@/lib/differentials"');
  });

  it("keeps initial dashboard rankers on fixture-free entry points", () => {
    const dashboard = source("src/components/ClinicalDashboard.tsx");
    const deferredRegistrySearch = source("src/components/clinical-dashboard/use-deferred-registry-search.ts");
    expect(dashboard).toContain('from "@/components/clinical-dashboard/use-deferred-registry-search"');
    expect(dashboard).not.toContain('from "@/lib/form-ranker"');
    expect(dashboard).not.toContain('from "@/lib/service-ranker"');
    expect(deferredRegistrySearch).toContain('from "@/lib/form-ranker"');
    expect(deferredRegistrySearch).toContain('from "@/lib/service-ranker"');
    expect(deferredRegistrySearch).toContain("useDeferredValue");
    expect(source("src/lib/cross-mode-links.ts")).not.toMatch(/@\/lib\/(forms|services)"/);
  });

  it("loads administration data only after its source surface opens", () => {
    const dashboard = source("src/components/ClinicalDashboard.tsx");
    expect(dashboard).not.toContain('from "@/components/clinical-dashboard/DocumentManagerPanel"');
    expect(dashboard).toContain('from "@/components/clinical-dashboard/document-manager-contracts"');
    expect(dashboard).toContain('from "@/components/clinical-dashboard/library-health-strip"');
    expect(dashboard).toContain("includeSetup: true, includeDashboardData: false");
    expect(dashboard).toContain("dashboardDataSurfaceVisible && !dashboardDataLoadedRef.current");
    expect(dashboard).toContain("administrationSurfaceVisible && !administrationDataLoadedRef.current");
    expect(dashboard).toContain("userStartedIngestion && activeIndexingWork");
  });

  it("retains PDF.js as an on-demand import", () => {
    const pdfViewer = source("src/components/document-viewer/pdf-canvas-viewer.tsx");
    const eagerPdfJsImport = /^[ \t]*import[ \t]+(?!type\b)(?:[^\r\n"']+[ \t]+from[ \t]+)?["']pdfjs-dist["'][ \t]*;?/m;

    expect(pdfViewer).toContain('await import("pdfjs-dist")');
    expect(pdfViewer).not.toMatch(eagerPdfJsImport);
    expect('import "pdfjs-dist";').toMatch(eagerPdfJsImport);
    expect('import pdfjs from "pdfjs-dist";').toMatch(eagerPdfJsImport);
    expect('import type { PDFDocumentProxy } from "pdfjs-dist";').not.toMatch(eagerPdfJsImport);
  });

  it("fetches PDF bytes on demand and releases the raster on teardown", () => {
    const pdfViewer = source("src/components/document-viewer/pdf-canvas-viewer.tsx");

    // pdf.js otherwise keeps pulling the rest of the file down in the background
    // even when the reader only ever looks at one page. The two flags are a pair:
    // disabling pre-fetch has no effect while streaming is on (pdfjs-dist types,
    // GetDocumentParameters.disableAutoFetch), so neither may be dropped alone.
    expect(pdfViewer).toContain("disableAutoFetch: true");
    expect(pdfViewer).toContain("disableStream: true");

    // A canvas holds its backing store until collection — real memory on a phone
    // for a document the reader has already left. Page cleanup is effect-local
    // (pageToCleanup) so a rapid flip cannot release the next page's resources.
    expect(pdfViewer).toContain("canvas.width = 0");
    expect(pdfViewer).toContain("pageToCleanup?.cleanup()");
    expect(pdfViewer).not.toContain("renderedPageRef.current?.cleanup()");
  });

  it("revalidates cached document download URLs on every viewer action", () => {
    const viewer = source("src/components/DocumentViewer.tsx");

    expect(viewer).toContain("const cached = getCachedSignedUrl(endpoint)");
    expect(viewer).toContain('anchor.download = currentDocumentFileName || "clinical-source"');
    expect(viewer).not.toContain("href={downloadSignedUrl}");
    expect(viewer).not.toContain("downloadUrl={downloadSignedUrl}");
  });
});
