import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const viewerSource = readFileSync(
  fileURLToPath(new URL("../src/components/DocumentViewer.tsx", import.meta.url)),
  "utf8",
);
const lazyViewerSource = readFileSync(
  fileURLToPath(new URL("../src/components/document-viewer/pdf-viewer-lazy.tsx", import.meta.url)),
  "utf8",
);

describe("DocumentViewer PDF reader loading", () => {
  it("keeps both PDF reader exports out of the document route's initial client chunk", () => {
    expect(viewerSource).not.toMatch(
      /import\s*\{[^}]*\b(?:NativePdfEmbed|PdfCanvasViewer)\b[^}]*\}\s*from\s*["']@\/components\/document-viewer\/pdf-canvas-viewer["']/,
    );

    expect(viewerSource).toContain(
      'import { NativePdfEmbed, PdfCanvasViewer } from "@/components/document-viewer/pdf-viewer-lazy"',
    );
    expect(lazyViewerSource).toContain("export const PdfCanvasViewer = dynamic(");
    expect(lazyViewerSource).toContain(
      '() => import("@/components/document-viewer/pdf-canvas-viewer").then((module) => module.PdfCanvasViewer)',
    );
    expect(lazyViewerSource).toContain("export const NativePdfEmbed = dynamic(");
    expect(lazyViewerSource).toContain(
      '() => import("@/components/document-viewer/pdf-canvas-viewer").then((module) => module.NativePdfEmbed)',
    );

    expect(lazyViewerSource).toContain(
      'import { PdfPreviewLoading } from "@/components/document-viewer/pdf-preview-loading"',
    );

    const canvasStart = lazyViewerSource.indexOf("export const PdfCanvasViewer = dynamic(");
    const nativeStart = lazyViewerSource.indexOf("export const NativePdfEmbed = dynamic(");
    const canvasBlock = lazyViewerSource.slice(canvasStart, nativeStart);
    const nativeBlock = lazyViewerSource.slice(nativeStart);
    expect(canvasBlock).toContain("ssr: false");
    expect(nativeBlock).toContain("ssr: false");
    expect(canvasBlock).toContain("loading: () => <PdfPreviewLoading />");
    expect(nativeBlock).toContain("loading: () => <PdfPreviewLoading />");
  });
});
