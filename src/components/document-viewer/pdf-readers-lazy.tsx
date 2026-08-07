"use client";

import dynamic from "next/dynamic";

import { PdfPreviewLoading } from "@/components/document-viewer/pdf-preview-loading";

/**
 * Real code-splitting boundary for PDF readers.
 *
 * `document-viewer-lazy.tsx` is only a compatibility re-export of DocumentViewer
 * for RSC prerender — it does not split the client bundle. These `next/dynamic`
 * imports keep pdf.js / canvas / native embed out of the document route's
 * initial chunk (guarded by `tests/document-viewer-pdf-reader-lazy.test.ts`).
 */
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
