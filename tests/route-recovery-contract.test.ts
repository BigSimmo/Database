import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routePanel = readFileSync(new URL("../src/components/route-not-found-panel.tsx", import.meta.url), "utf8");
const documentViewer = readFileSync(new URL("../src/components/DocumentViewer.tsx", import.meta.url), "utf8");
const globals = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

describe("route recovery surfaces", () => {
  it("gives the document header an explicit surface paint", () => {
    expect(documentViewer).toMatch(/data-document-sticky-header[\s\S]*?bg-\[color:var\(--surface\)\]/);
  });

  it("marks not-found and document-load failures as recovery states", () => {
    expect(routePanel).toContain('data-route-recovery="true"');
    expect(documentViewer).toContain('data-route-recovery={viewerState !== "ready" ? "true" : undefined}');
  });

  it("keeps install promotion from covering a route recovery action", () => {
    expect(globals).toContain('body:has([data-route-recovery="true"]) .pwa-install-sheet');
    expect(globals).toMatch(/body:has\(\[data-route-recovery="true"\]\) \.pwa-install-sheet\s*\{\s*display: none;/);
  });
});
