"use client";

/* eslint-disable @next/next/no-img-element */

import { Download, ExternalLink, FileText } from "lucide-react";

import { cn, floatingControl } from "@/components/ui-primitives";

const secondaryButton = floatingControl;

const placeholderSurface =
  "grid min-h-64 place-items-center bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--clinical-accent-soft)_40%,transparent),transparent_22rem),var(--surface-inset)] p-5 text-center text-sm text-[color:var(--text-muted)] sm:min-h-72";

/**
 * Inline preview for non-PDF source documents.
 *
 * PDFs render in PdfCanvasViewer/NativePdfEmbed; everything else lands here:
 * - image/* → the source image inline (native browser view for full-size/zoom),
 * - text/* → a pointer to the already-extracted indexed text below,
 * - other (DOCX/XLSX/…) → an honest "download to view" affordance,
 * - no signed URL yet → the original placeholder.
 */
export function NonPdfSourcePreview({
  fileType,
  title,
  signedUrl,
  downloadSignedUrl,
}: {
  fileType: string | undefined;
  title: string;
  signedUrl: string | null;
  downloadSignedUrl: string | null;
}) {
  const type = fileType ?? "";

  if (!signedUrl) {
    return (
      <div className={placeholderSurface}>
        <div>
          <FileText aria-hidden="true" className="mx-auto mb-2 h-8 w-8" />
          Source preview is available after a signed URL is generated.
        </div>
      </div>
    );
  }

  if (type.startsWith("image/")) {
    return (
      <div className="flex flex-col items-center gap-3 bg-[color:var(--surface-inset)] p-3 sm:p-4">
        <img
          src={signedUrl}
          alt={title}
          loading="lazy"
          decoding="async"
          className="max-h-[70vh] w-auto max-w-full rounded-lg bg-[color:var(--surface)] object-contain shadow-[var(--shadow-tight)]"
        />
        <a href={signedUrl} target="_blank" rel="noreferrer" className={secondaryButton}>
          <ExternalLink aria-hidden="true" className="h-4 w-4" />
          Open full image
        </a>
      </div>
    );
  }

  const isText = type.startsWith("text/");

  return (
    <div className={placeholderSurface}>
      <div className="max-w-md">
        <FileText aria-hidden="true" className="mx-auto mb-2 h-8 w-8" />
        <p className="font-semibold text-[color:var(--text)]">
          {isText ? "Text document" : "Inline preview isn't available for this file type"}
        </p>
        <p className="mt-1">
          {isText
            ? "The extracted text is shown in the indexed page text below."
            : "Open the file in a new tab or download it to view the original."}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <a href={signedUrl} target="_blank" rel="noreferrer" className={cn(secondaryButton, "min-h-11")}>
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
            Open
          </a>
          {downloadSignedUrl ? (
            <a
              href={downloadSignedUrl}
              target="_blank"
              rel="noreferrer"
              download
              className={cn(secondaryButton, "min-h-11")}
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              Download
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
