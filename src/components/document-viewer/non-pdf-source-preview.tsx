"use client";

/* eslint-disable @next/next/no-img-element */

import { memo, useState } from "react";
import { CircleAlert, Download, ExternalLink, FileText } from "lucide-react";

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
export const NonPdfSourcePreview = memo(function NonPdfSourcePreview({
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
    // Keyed by signedUrl so a freshly issued URL remounts with a clean failed state.
    return (
      <InlineImagePreview key={signedUrl} signedUrl={signedUrl} downloadSignedUrl={downloadSignedUrl} title={title} />
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
          <a href={signedUrl} target="_blank" rel="noreferrer" className={cn(secondaryButton, "min-h-tap")}>
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
            Open
          </a>
          {downloadSignedUrl ? (
            <a
              href={downloadSignedUrl}
              target="_blank"
              rel="noreferrer"
              download
              className={cn(secondaryButton, "min-h-tap")}
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              Download
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
});

/**
 * Inline image with a failure fallback. The source is a direct signed URL owned
 * by the parent (not a re-fetchable endpoint), so on an expired/broken URL it
 * surfaces the same Open/Download recovery affordance rather than a silently
 * broken <img>.
 */
function InlineImagePreview({
  signedUrl,
  downloadSignedUrl,
  title,
}: {
  signedUrl: string;
  downloadSignedUrl: string | null;
  title: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={placeholderSurface}>
        <div className="max-w-md">
          <CircleAlert aria-hidden="true" className="mx-auto mb-2 h-8 w-8 text-[color:var(--warning)]" />
          <p className="font-semibold text-[color:var(--text)]">Image preview could not load</p>
          <p className="mt-1">The preview link may have expired. Open the image in a new tab or download it.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <a href={signedUrl} target="_blank" rel="noreferrer" className={cn(secondaryButton, "min-h-tap")}>
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              Open
            </a>
            {downloadSignedUrl ? (
              <a
                href={downloadSignedUrl}
                target="_blank"
                rel="noreferrer"
                download
                className={cn(secondaryButton, "min-h-tap")}
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

  return (
    <div className="flex flex-col items-center gap-3 bg-[color:var(--surface-inset)] p-3 sm:p-4">
      <img
        src={signedUrl}
        alt={title}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="max-h-[70vh] w-auto max-w-full rounded-lg bg-[color:var(--surface)] object-contain shadow-[var(--shadow-tight)]"
      />
      <a href={signedUrl} target="_blank" rel="noreferrer" className={secondaryButton}>
        <ExternalLink aria-hidden="true" className="h-4 w-4" />
        Open full image
      </a>
    </div>
  );
}
