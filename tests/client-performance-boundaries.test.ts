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

  it("keeps initial dashboard rankers on fixture-free entry points", () => {
    const dashboard = source("src/components/ClinicalDashboard.tsx");
    expect(dashboard).toContain('from "@/lib/form-ranker"');
    expect(dashboard).toContain('from "@/lib/service-ranker"');
    expect(source("src/lib/cross-mode-links.ts")).not.toMatch(/@\/lib\/(forms|services)"/);
  });

  it("loads administration data only after its source surface opens", () => {
    const dashboard = source("src/components/ClinicalDashboard.tsx");
    expect(dashboard).toContain("includeSetup: true, includeDashboardData: false");
    expect(dashboard).toContain("dashboardDataSurfaceVisible && !dashboardDataLoadedRef.current");
    expect(dashboard).toContain("administrationSurfaceVisible && !administrationDataLoadedRef.current");
    expect(dashboard).toContain("userStartedIngestion && activeIndexingWork");
  });

  it("retains PDF.js as an on-demand import", () => {
    const pdfViewer = source("src/components/document-viewer/pdf-canvas-viewer.tsx");
    expect(pdfViewer).toContain('await import("pdfjs-dist")');
    expect(pdfViewer).not.toMatch(/^import(?! type\b).* from "pdfjs-dist";/m);
  });
});
