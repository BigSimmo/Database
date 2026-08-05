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

  it("adopts one frame around the existing PDF and non-PDF owners without adding another viewer toolbar", () => {
    expect(viewerSource).toContain(
      'import { DocumentFrame, type DocumentFrameSource } from "@/components/ui/document-frame"',
    );
    expect(viewerSource.match(/<DocumentFrame\b/g)).toHaveLength(1);
    expect(viewerSource).toContain("<PdfCanvasViewer");
    expect(viewerSource).toContain("<NativePdfEmbed");
    expect(viewerSource).toContain("<NonPdfSourcePreview");
    expect(viewerSource).not.toContain("controls={");
    expect(pdfOwnerSource.match(/data-testid="pdf-toolbar"/g)).toHaveLength(1);
  });
});
