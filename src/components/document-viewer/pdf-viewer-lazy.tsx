"use client";

import dynamic from "next/dynamic";
import { PdfPreviewLoading } from "@/components/document-viewer/pdf-preview-loading";

// pdf-canvas-viewer is only needed after a source document has loaded and the
// user is viewing a PDF. Keeping it out of the document route's initial client
// chunk avoids parsing its reader controls for image, text, and download-only
// documents. pdf.js itself remains loaded on demand by that component.
export const PdfCanvasViewer = dynamic(
  () => import("@/components/document-viewer/pdf-canvas-viewer").then((module) => module.PdfCanvasViewer),
  {
    ssr: false,
    loading: () => <PdfPreviewLoading />,
  },
);

export const NativePdfEmbed = dynamic(
  () => import("@/components/document-viewer/pdf-canvas-viewer").then((module) => module.NativePdfEmbed),
  { ssr: false, loading: () => <PdfPreviewLoading /> },
);
