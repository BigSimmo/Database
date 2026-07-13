"use client";

/* eslint-disable @next/next/no-img-element */

import { memo, useEffect, useRef, useState } from "react";
import { CircleAlert, Loader2 } from "lucide-react";

import { cn } from "@/components/ui-primitives";
import { clearCachedSignedUrl, getCachedSignedUrl, setCachedSignedUrl } from "@/lib/signed-url-cache";
import { useAuthSession } from "@/lib/supabase/client";

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
 * never resizes the layout when it decodes (no content shift on load).
 */
export const SignedImage = memo(function SignedImage({
  endpoint,
  alt,
  className = "max-h-52",
  failureLabel = "Image preview could not load.",
  retryLabel = "Retry image",
  rootMargin = "640px 0px",
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
}) {
  const [url, setUrl] = useState(() => getCachedSignedUrl(endpoint)?.url ?? null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [shouldLoad, setShouldLoad] = useState(() => Boolean(getCachedSignedUrl(endpoint)));
  const [loaded, setLoaded] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const { authorizationHeader, markSessionExpired } = useAuthSession();

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

  useEffect(() => {
    if (!shouldLoad) return () => undefined;

    const cached = getCachedSignedUrl(endpoint);
    if (cached) {
      let active = true;
      window.requestAnimationFrame(() => {
        if (!active) return;
        setUrl(cached.url);
        setFailed(false);
      });
      return () => {
        active = false;
      };
    }

    let active = true;
    fetch(endpoint, { headers: authorizationHeader })
      .then((response) => {
        if (response.status === 401) markSessionExpired();
        return response.ok ? response.json() : null;
      })
      .then((data) => {
        if (active && data?.url) {
          setCachedSignedUrl(endpoint, data);
          setUrl(data.url);
          setFailed(false);
        } else if (active) {
          setFailed(true);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [attempt, authorizationHeader, endpoint, markSessionExpired, shouldLoad]);

  function retryImage() {
    clearCachedSignedUrl(endpoint);
    setUrl(null);
    setFailed(false);
    setLoaded(false);
    setShouldLoad(true);
    setAttempt((current) => current + 1);
  }

  function handleImageError() {
    clearCachedSignedUrl(endpoint);
    setLoaded(false);
    setFailed(true);
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
            className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--surface)] px-3 text-[color:var(--warning)]"
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
        "relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-[color:var(--surface-inset)]",
      )}
    >
      {url ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={handleImageError}
          className={cn(
            "absolute inset-0 h-full w-full rounded-lg object-contain transition-opacity duration-300 motion-reduce:transition-none",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
      {!url || !loaded ? (
        <div className="absolute inset-0 grid place-items-center gap-1 text-center text-xs font-semibold text-[color:var(--text-muted)]">
          {shouldLoad ? (
            <>
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              Loading image
            </>
          ) : (
            "Image preview will load when visible"
          )}
        </div>
      ) : null}
    </div>
  );
});

export default SignedImage;
