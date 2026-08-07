import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const viewerSource = readFileSync(
  fileURLToPath(new URL("../src/components/DocumentViewer.tsx", import.meta.url)),
  "utf8",
);
const readersLazySource = readFileSync(
  fileURLToPath(new URL("../src/components/document-viewer/pdf-readers-lazy.tsx", import.meta.url)),
  "utf8",
);
const viewerLazySource = readFileSync(
  fileURLToPath(new URL("../src/components/document-viewer-lazy.tsx", import.meta.url)),
  "utf8",
);

describe("DocumentViewer PDF reader loading", () => {
  it("keeps both PDF reader exports out of the document route's initial client chunk", () => {
    expect(viewerSource).not.toMatch(
      /import\s*\{[^}]*\b(?:NativePdfEmbed|PdfCanvasViewer)\b[^}]*\}\s*from\s*["']@\/components\/document-viewer\/pdf-canvas-viewer["']/,
    );
    expect(viewerSource).toContain(
      'import { NativePdfEmbed, PdfCanvasViewer } from "@/components/document-viewer/pdf-readers-lazy"',
    );

    expect(readersLazySource).toContain("export const PdfCanvasViewer = dynamic(");
    expect(readersLazySource).toContain(
      '() => import("@/components/document-viewer/pdf-canvas-viewer").then((module) => module.PdfCanvasViewer)',
    );
    expect(readersLazySource).toContain("export const NativePdfEmbed = dynamic(");
    expect(readersLazySource).toContain(
      '() => import("@/components/document-viewer/pdf-canvas-viewer").then((module) => module.NativePdfEmbed)',
    );
    expect(readersLazySource).toContain(
      'import { PdfPreviewLoading } from "@/components/document-viewer/pdf-preview-loading"',
    );

    const canvasStart = readersLazySource.indexOf("export const PdfCanvasViewer = dynamic(");
    const nativeStart = readersLazySource.indexOf("export const NativePdfEmbed = dynamic(");
    const canvasBlock = readersLazySource.slice(canvasStart, nativeStart);
    const nativeBlock = readersLazySource.slice(nativeStart);
    expect(canvasBlock).toContain("ssr: false");
    expect(nativeBlock).toContain("ssr: false");
    expect(canvasBlock).toContain("loading: () => <PdfPreviewLoading />");
    expect(nativeBlock).toContain("loading: () => <PdfPreviewLoading />");
  });

  it("documents that document-viewer-lazy is a re-export, not the PDF code-split", () => {
    expect(viewerLazySource).toContain("export { DocumentViewer as DocumentViewerLazy }");
    expect(viewerLazySource).not.toMatch(/from ["']next\/dynamic["']/);
    expect(viewerLazySource).toContain("pdf-readers-lazy.tsx");
  });
});
