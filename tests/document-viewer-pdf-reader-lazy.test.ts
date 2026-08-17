import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { sourceFrom } from "./helpers/source-contract";

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
const pdfCanvasSource = readFileSync(
  fileURLToPath(new URL("../src/components/document-viewer/pdf-canvas-viewer.tsx", import.meta.url)),
  "utf8",
);

const securityHeadersSource = readFileSync(
  fileURLToPath(new URL("../src/lib/security-headers.ts", import.meta.url)),
  "utf8",
);

describe("DocumentViewer PDF reader loading", () => {
  it("keeps the PDF reader out of the document route's initial client chunk", () => {
    expect(viewerSource).not.toMatch(
      /import\s*\{[^}]*\bPdfCanvasViewer\b[^}]*\}\s*from\s*["']@\/components\/document-viewer\/pdf-canvas-viewer["']/,
    );
    expect(viewerSource).toContain('import { PdfCanvasViewer } from "@/components/document-viewer/pdf-readers-lazy"');

    expect(readersLazySource).toContain("export const PdfCanvasViewer = dynamic(");
    expect(readersLazySource).toContain(
      '() => import("@/components/document-viewer/pdf-canvas-viewer").then((module) => module.PdfCanvasViewer)',
    );
    expect(readersLazySource).toContain(
      'import { PdfPreviewLoading } from "@/components/document-viewer/pdf-preview-loading"',
    );

    const canvasBlock = sourceFrom(readersLazySource, "export const PdfCanvasViewer = dynamic(", {
      label: "PdfCanvasViewer dynamic declaration",
    });
    expect(canvasBlock).toContain("ssr: false");
    expect(canvasBlock).toContain("loading: () => <PdfPreviewLoading />");
  });

  // The browser-engine reader was removed because it could never work in
  // production: buildContentSecurityPolicy sets `default-src 'self'` and declares
  // no frame-src/child-src, so an <iframe> at the cross-origin Supabase signed URL
  // inherits 'self' and is refused. It only appeared to work against the
  // same-origin demo corpus — which is also all Playwright can exercise, so no
  // browser test can catch its return. This source contract is that guard.
  it("ships no framed PDF reader while the CSP has no cross-origin frame-src", () => {
    for (const source of [viewerSource, readersLazySource, pdfCanvasSource]) {
      expect(source).not.toContain("<iframe");
      expect(source).not.toContain("NativePdfEmbed");
    }
    expect(securityHeadersSource).not.toMatch(/\b(?:frame-src|child-src)\b/);
  });

  it("documents that document-viewer-lazy is a re-export, not the PDF code-split", () => {
    expect(viewerLazySource).toContain("export { DocumentViewer as DocumentViewerLazy }");
    expect(viewerLazySource).not.toMatch(/from ["']next\/dynamic["']/);
    expect(viewerLazySource).toContain("pdf-readers-lazy.tsx");
  });
});
