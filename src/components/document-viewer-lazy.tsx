"use client";

/**
 * Compatibility re-export for the document route RSC page.
 *
 * This is NOT a code-splitting boundary — Next still includes DocumentViewer in
 * the document client graph. The real PDF reader split lives in
 * `pdf-readers-lazy.tsx` (`next/dynamic` of PdfCanvasViewer / NativePdfEmbed).
 * Kept so the Server Component can pass `initialDetail` into the client shell
 * without renaming every import site.
 */
export { DocumentViewer as DocumentViewerLazy } from "@/components/DocumentViewer";
