"use client";

import dynamic from "next/dynamic";

import { PdfPreviewLoading } from "@/components/document-viewer/pdf-preview-loading";

/**
 * Real code-splitting boundary for the PDF reader.
 *
 * `document-viewer-lazy.tsx` is only a compatibility re-export of DocumentViewer
 * for RSC prerender — it does not split the client bundle. This `next/dynamic`
 * import keeps pdf.js and the raster canvas out of the document route's initial
 * chunk (guarded by `tests/document-viewer-pdf-reader-lazy.test.ts`).
 *
 * There is deliberately no second, browser-engine reader. A framed reader
 * pointed at the Supabase signed URL is refused in production:
 * `buildContentSecurityPolicy` (`src/lib/security-headers.ts`) sets
 * `default-src 'self'` and declares no frame-src/child-src, so a cross-origin
 * frame inherits `'self'` and is blocked. It only ever appeared to work against
 * the same-origin demo corpus, which is also all the Playwright suite can
 * exercise. "Open PDF" is a top-level navigation, which CSP does not restrict,
 * and is the escape hatch instead.
 */
export const PdfCanvasViewer = dynamic(
  () => import("@/components/document-viewer/pdf-canvas-viewer").then((module) => module.PdfCanvasViewer),
  {
    ssr: false,
    loading: () => <PdfPreviewLoading />,
  },
);
