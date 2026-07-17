import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const viewerSource = readFileSync(
  fileURLToPath(new URL("../src/components/DocumentViewer.tsx", import.meta.url)),
  "utf8",
);

describe("DocumentViewer PDF reader loading", () => {
  it("keeps both PDF reader exports out of the document route's initial client chunk", () => {
    expect(viewerSource).not.toMatch(
      /import\s*\{[^}]*\b(?:NativePdfEmbed|PdfCanvasViewer)\b[^}]*\}\s*from\s*["']@\/components\/document-viewer\/pdf-canvas-viewer["']/,
    );

    expect(viewerSource).toContain("const PdfCanvasViewer = dynamic(");
    expect(viewerSource).toContain(
      '() => import("@/components/document-viewer/pdf-canvas-viewer").then((module) => module.PdfCanvasViewer)',
    );
    expect(viewerSource).toContain("const NativePdfEmbed = dynamic(");
    expect(viewerSource).toContain(
      '() => import("@/components/document-viewer/pdf-canvas-viewer").then((module) => module.NativePdfEmbed)',
    );

    const canvasBlock = viewerSource.slice(
      viewerSource.indexOf("const PdfCanvasViewer = dynamic("),
      viewerSource.indexOf("const NativePdfEmbed = dynamic("),
    );
    const nativeBlock = viewerSource.slice(
      viewerSource.indexOf("const NativePdfEmbed = dynamic("),
      viewerSource.indexOf("function PdfPreviewLoading"),
    );
    expect(canvasBlock).toContain("ssr: false");
    expect(nativeBlock).toContain("ssr: false");
    expect(canvasBlock).toContain("loading: () => <PdfPreviewLoading />");
    expect(nativeBlock).toContain("loading: () => <PdfPreviewLoading />");
  });
});
