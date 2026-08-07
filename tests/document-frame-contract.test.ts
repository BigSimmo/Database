import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const frameSource = readFileSync(
  fileURLToPath(new URL("../src/components/ui/document-frame.tsx", import.meta.url)),
  "utf8",
);
const viewerSource = readFileSync(
  fileURLToPath(new URL("../src/components/DocumentViewer.tsx", import.meta.url)),
  "utf8",
);
const pdfOwnerSource = readFileSync(
  fileURLToPath(new URL("../src/components/document-viewer/pdf-canvas-viewer.tsx", import.meta.url)),
  "utf8",
);
const imageOwnerSource = readFileSync(
  fileURLToPath(new URL("../src/components/document-viewer/non-pdf-source-preview.tsx", import.meta.url)),
  "utf8",
);

describe("DocumentFrame contract", () => {
  it("hides frame controls for print while keeping source content together", () => {
    expect(frameSource).toContain("data-print-hide");
    expect(frameSource).toContain("data-print-keep-together");
    expect(frameSource).toContain("print:break-inside-avoid");
    expect(frameSource).toContain("print:bg-transparent");
    expect(frameSource).toContain("print:shadow-none");
  });

  it("keeps colour transformations out of the frame and both source-pixel owners", () => {
    const forbiddenSourcePixelTreatment = /\b(?:invert|color-scheme|backdrop-filter)\b|\bfilter\s*:/i;
    expect(frameSource).not.toMatch(forbiddenSourcePixelTreatment);
    expect(pdfOwnerSource).not.toMatch(forbiddenSourcePixelTreatment);
    expect(imageOwnerSource).not.toMatch(forbiddenSourcePixelTreatment);
  });

  it("adopts one frame with DocumentFrame zoom/fit controls and keeps PDF page chrome separate", () => {
    expect(viewerSource).toContain(
      'import { DocumentFrame, type DocumentFrameControls, type DocumentFrameSource } from "@/components/ui/document-frame"',
    );
    expect(viewerSource.match(/<DocumentFrame\b/g)).toHaveLength(1);
    expect(viewerSource).toContain("controls={pdfFrameControls}");
    expect(viewerSource).toContain("<PdfCanvasViewer");
    expect(viewerSource).toContain("<NativePdfEmbed");
    expect(viewerSource).toContain("<NonPdfSourcePreview");
    expect(viewerSource).toContain("onFitWidthChange={handlePdfFitWidthChange}");
    expect(viewerSource).toContain("onZoomChange={handlePdfZoomChange}");
    expect(pdfOwnerSource.match(/data-testid="pdf-toolbar"/g)).toHaveLength(1);
    expect(pdfOwnerSource).toContain("frameOwnsZoomChrome");
    // Rapid wheel/pinch functional updates must compose against a ref / React
    // state updater — not a closed-over zoom prop (Sentry 15778840).
    expect(pdfOwnerSource).toContain("zoomRef");
    expect(pdfOwnerSource).toContain("resolveViewerZoomUpdate");
    expect(pdfOwnerSource).toContain("setInternalZoom((current) => resolveViewerZoomUpdate(current, next))");
    expect(pdfOwnerSource).toContain('aria-label="Enter fullscreen document view"');
    expect(pdfOwnerSource).not.toContain('aria-label="Fit page width and enter fullscreen"');
    expect(viewerSource).toContain('from "@/components/document-viewer/viewer-zoom"');
    expect(pdfOwnerSource).toContain('from "@/components/document-viewer/viewer-zoom"');
    expect(frameSource).toContain('from "@/components/document-viewer/viewer-zoom"');
  });

  it("announces canvas-level PDF preview failures after the frame is already ready", () => {
    // Visible fallback stays non-live; LiveAnnouncer owns the assertive SR path (#219).
    expect(pdfOwnerSource).not.toContain('role="alert"');
    expect(pdfOwnerSource).toContain('data-preview-error="true"');
    expect(pdfOwnerSource).toContain("announce(error");
    expect(pdfOwnerSource).toContain('from "@/components/ui/live-announcer"');
    expect(imageOwnerSource).not.toContain('role="alert"');
    expect(imageOwnerSource).toContain('data-preview-error="true"');
  });
});
