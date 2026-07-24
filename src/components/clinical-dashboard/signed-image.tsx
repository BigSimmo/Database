"use client";

import Image from "next/image";
import { memo, useEffect, useRef, useState } from "react";
import { CircleAlert, Loader2, Maximize2 } from "lucide-react";

import { cn, Skeleton } from "@/components/ui-primitives";
import { getCachedSignedUrl } from "@/lib/signed-url-cache";
import { useSignedImageUrl } from "@/components/clinical-dashboard/use-signed-image-url";
import { ImageLightbox } from "@/components/clinical-dashboard/image-lightbox";

/**
 * Shared renderer for a private image served through a signed-URL endpoint.
 *
 * Consolidates the loading/retry/aspect-frame behaviour that `DocumentImage`
 * (document viewer) and `SourceImage` (answer/evidence surfaces) previously
 * duplicated. Both now delegate here so the behaviour cannot drift again.
 *
 * The network request is deferred behind an `IntersectionObserver` so a long
 * evidence gallery does not fire every signed-URL request — and download every
 * full-resolution image — on mount. The image lives in a fixed 4:3 frame so it
 * never resizes the layout when it decodes (no content shift on load). When
 * `zoomable`, clicking opens a fullscreen lightbox with zoom/pan/rotate.
 */
export const SignedImage = memo(function SignedImage({
  endpoint,
  alt,
  className = "max-h-52",
  failureLabel = "Image preview could not load.",
  retryLabel = "Retry image",
  rootMargin = "640px 0px",
  zoomable = false,
  caption,
}: {
  /** Signed-URL API route, e.g. `/api/images/{id}/signed-url`. */
  endpoint: string;
  /** Accessible description of the image. */
  alt: string;
  /** Extra classes merged onto the fixed-aspect frame (e.g. `max-h-52`). */
  className?: string;
  /** Message shown when the signed URL or image fails to load. */
  failureLabel?: string;
  /** Label for the retry button in the failed state. */
  retryLabel?: string;
  /** IntersectionObserver root margin that gates the network request. */
  rootMargin?: string;
  /** When true, the loaded image is clickable and opens a fullscreen lightbox. */
  zoomable?: boolean;
  /** Lightbox title; falls back to `alt`. */
  caption?: string;
}) {
  const [shouldLoad, setShouldLoad] = useState(() => Boolean(getCachedSignedUrl(endpoint)));
  const [loaded, setLoaded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { url, failed, retry, markFailed } = useSignedImageUrl(endpoint, shouldLoad);

  // Defer the request until the frame is near the viewport. A cached URL seeds
  // `shouldLoad` synchronously, so already-fetched images skip the observer.
  useEffect(() => {
    if (shouldLoad) return () => undefined;

    const element = frameRef.current;
    if (!element || !("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return () => undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin, shouldLoad]);

  function retryImage() {
    setLoaded(false);
    setShouldLoad(true);
    retry();
  }

  function handleImageError() {
    setLoaded(false);
    markFailed();
  }

  if (failed) {
    return (
      <div
        ref={frameRef}
        className={cn(
          className,
          "grid aspect-[4/3] w-full place-items-center rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] p-4 text-center text-xs font-semibold text-[color:var(--warning)]",
        )}
      >
        <div>
          <CircleAlert aria-hidden="true" className="mx-auto mb-2 h-5 w-5" />
          {failureLabel}
          <button
            type="button"
            onClick={retryImage}
            className="mt-3 inline-flex min-h-tap items-center rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--surface)] px-3 text-[color:var(--warning)]"
          >
            {retryLabel}
          </button>
        </div>
      </div>
    );
  }

  // A fixed-aspect frame reserves the image's box up front so the loaded image
  // never resizes the layout (the placeholder and the image share one box). The
  // image object-contains within it and fades in on decode, so nothing below
  // shifts when it arrives.
  return (
    <div
      ref={frameRef}
      className={cn(
        className,
        "group/signed-image relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-[color:var(--surface-inset)]",
      )}
    >
      {url ? (
        // Keep next/image for fill/layout/sizes, but mark private signed previews
        // `unoptimized` so bearer URLs never enter the unauthenticated
        // `/_next/image` optimizer cache (stale-while-revalidate can outlive the
        // signed token). Authorization stays on `/api/.../signed-url` issuance.
        <Image
          src={url}
          alt={alt}
          fill
          sizes="(max-width: 768px) 92vw, 320px"
          unoptimized
          onLoad={() => setLoaded(true)}
          onError={handleImageError}
          className={cn(
            "rounded-lg object-contain transition-opacity duration-300 motion-reduce:transition-none",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
      {zoomable && url && loaded ? (
        <>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label={`Expand image: ${caption?.trim() || alt}`}
            className="absolute inset-0 z-[1] flex cursor-zoom-in items-start justify-end p-2 focus-visible:outline-2 focus-visible:outline-[color:var(--focus)]"
          >
            <span
              aria-hidden="true"
              className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)]/85 p-1 text-[color:var(--text-muted)] opacity-0 shadow-[var(--shadow-tight)] backdrop-blur-md transition group-hover/signed-image:opacity-100 group-focus-within/signed-image:opacity-100 motion-reduce:transition-none"
            >
              <Maximize2 aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
          </button>
          <ImageLightbox
            open={lightboxOpen}
            onClose={() => setLightboxOpen(false)}
            endpoint={endpoint}
            alt={alt}
            caption={caption}
            returnFocusRef={triggerRef}
          />
        </>
      ) : null}
      {!url || !loaded ? (
        <div className="absolute inset-0 flex items-center justify-center text-center text-xs font-semibold text-[color:var(--text-muted)]">
          {shouldLoad ? (
            <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
          ) : (
            <div className="grid place-items-center gap-1">
              Image preview will load when visible
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
});
