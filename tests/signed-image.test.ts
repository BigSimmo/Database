import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// SignedImage calls useAuthSession, which requires an AuthProvider at runtime.
// The consolidated behaviour under test (deferred loading + synchronous cache
// seeding) is independent of auth, so stub the hook with an inert session.
vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => ({ authorizationHeader: {}, markSessionExpired: () => {} }),
}));

import { SignedImage } from "@/components/clinical-dashboard/signed-image";
import { clearSignedUrlCache, setCachedSignedUrl } from "@/lib/signed-url-cache";

const ENDPOINT = "/api/images/consolidated/signed-url";

afterEach(() => {
  vi.unstubAllGlobals();
  clearSignedUrlCache();
});

describe("SignedImage", () => {
  // The perf win of consolidation: with no cached URL the initial render is
  // deferred behind an IntersectionObserver, so a long gallery no longer paints
  // an <img> (or issues a signed-URL request) for every card up front.
  it("defers to a placeholder — no <img> and no fetch — until intersection", () => {
    clearSignedUrlCache();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const markup = renderToStaticMarkup(createElement(SignedImage, { endpoint: ENDPOINT, alt: "Airway diagram" }));

    expect(markup).toContain("Image preview will load when visible");
    expect(markup).not.toContain("<img");
    // The "active" loading spinner must not show before the frame is observed.
    expect(markup).not.toContain("Loading image");
    // Rendering must never fetch synchronously — the request is effect/observer gated.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // A cached signed URL seeds the url state in the useState initializer, so a
  // scrolled-back-to (already fetched) image paints immediately without waiting.
  it("seeds the URL synchronously from the signed-url cache", () => {
    clearSignedUrlCache();
    setCachedSignedUrl(ENDPOINT, { url: "/demo-documents/airway.png", caption: "Airway" });

    const markup = renderToStaticMarkup(createElement(SignedImage, { endpoint: ENDPOINT, alt: "Airway diagram" }));

    expect(markup).toContain("<img");
    // Private previews stay on a direct src (unoptimized) — never rewritten
    // through the public `/_next/image` optimizer cache.
    expect(markup).toContain('src="/demo-documents/airway.png"');
    expect(markup).not.toContain("/_next/image");
    expect(markup).toContain('alt="Airway diagram"');
    // A seeded frame is active, not deferred.
    expect(markup).not.toContain("Image preview will load when visible");
  });

  it("uses the provided alt text and does not render the failure state on a healthy render", () => {
    clearSignedUrlCache();
    setCachedSignedUrl(ENDPOINT, { url: "/demo-documents/ecg.png" });

    const markup = renderToStaticMarkup(
      createElement(SignedImage, {
        endpoint: ENDPOINT,
        alt: "ECG strip",
        failureLabel: "Image preview failed.",
      }),
    );

    expect(markup).toContain('alt="ECG strip"');
    expect(markup).not.toContain("Image preview failed.");
  });
});
