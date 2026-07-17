import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const viewerSource = readFileSync(
  fileURLToPath(new URL("../src/components/DocumentViewer.tsx", import.meta.url)),
  "utf8",
);

describe("DocumentViewer PDF reader loading", () => {
  it("keeps the PDF reader out of the document route's initial client chunk", () => {
    expect(viewerSource).not.toMatch(
      /import\s*\{[^}]*\b(?:NativePdfEmbed|PdfCanvasViewer)\b[^}]*\}\s*from\s*["']@\/components\/document-viewer\/pdf-canvas-viewer["']/,
    );
    expect(viewerSource).toContain('dynamic(\n  () => import("@/components/document-viewer/pdf-canvas-viewer")');
    expect(viewerSource).toContain("loading: () => <PdfPreviewLoading />");
    expect(viewerSource).toContain("module.PdfCanvasViewer");
    expect(viewerSource).toContain("module.NativePdfEmbed");
  });
});
