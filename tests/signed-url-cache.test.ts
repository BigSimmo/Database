import { describe, expect, it, vi } from "vitest";
import {
  clearCachedSignedUrl,
  clearSignedUrlCache,
  getCachedSignedUrl,
  signedUrlCacheScope,
  setCachedSignedUrl,
} from "../src/lib/signed-url-cache";

const publicScope = signedUrlCacheScope("public", 0, null);
const ownerAScope = signedUrlCacheScope("owner", 1, "owner-a");

describe("signed URL cache", () => {
  it("stores signed image URL payloads by endpoint", () => {
    clearSignedUrlCache();

    expect(getCachedSignedUrl("/api/images/a/signed-url", ownerAScope)).toBeNull();
    setCachedSignedUrl("/api/images/a/signed-url", ownerAScope, {
      url: "/demo-documents/image.png",
      caption: "Image caption",
    });

    expect(getCachedSignedUrl("/api/images/a/signed-url", ownerAScope)?.url).toBe("/demo-documents/image.png");
  });

  it("clears one signed URL endpoint without clearing the full cache", () => {
    clearSignedUrlCache();

    setCachedSignedUrl("/api/images/a/signed-url", ownerAScope, { url: "/demo-documents/a.png" });
    setCachedSignedUrl("/api/images/b/signed-url", ownerAScope, { url: "/demo-documents/b.png" });

    clearCachedSignedUrl("/api/images/a/signed-url", ownerAScope);

    expect(getCachedSignedUrl("/api/images/a/signed-url", ownerAScope)).toBeNull();
    expect(getCachedSignedUrl("/api/images/b/signed-url", ownerAScope)?.url).toBe("/demo-documents/b.png");
  });

  // RET-H3
  it("evicts entries strictly once expiresAt has passed", () => {
    clearSignedUrlCache();
    setCachedSignedUrl("/api/images/expired/signed-url", ownerAScope, {
      url: "/demo-documents/expired.png",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(getCachedSignedUrl("/api/images/expired/signed-url", ownerAScope)).toBeNull();
  });

  it("does not serve an entry inside the expiry skew window", () => {
    clearSignedUrlCache();
    setCachedSignedUrl("/api/images/soon/signed-url", ownerAScope, {
      url: "/demo-documents/soon.png",
      // within the 30s refresh skew
      expiresAt: new Date(Date.now() + 5_000).toISOString(),
    });
    expect(getCachedSignedUrl("/api/images/soon/signed-url", ownerAScope)).toBeNull();
  });

  it("caches a payload missing expiresAt only for a bounded default TTL, not forever", () => {
    clearSignedUrlCache();
    setCachedSignedUrl("/api/images/no-exp/signed-url", ownerAScope, { url: "/demo-documents/no-exp.png" });
    // Served now (default TTL is in the future)...
    expect(getCachedSignedUrl("/api/images/no-exp/signed-url", ownerAScope)?.url).toBe("/demo-documents/no-exp.png");

    // ...but the entry carries a finite hard expiry rather than living forever.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 6 * 60_000);
      expect(getCachedSignedUrl("/api/images/no-exp/signed-url", ownerAScope)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("bounds the cache with LRU eviction of the least-recently-used entry", () => {
    clearSignedUrlCache();
    const maxSize = 256;
    for (let i = 0; i < maxSize; i += 1) {
      setCachedSignedUrl(`/api/images/${i}/signed-url`, publicScope, { url: `/demo-documents/${i}.png` });
    }
    // Touch entry 0 so it becomes most-recently-used.
    expect(getCachedSignedUrl("/api/images/0/signed-url", publicScope)).not.toBeNull();
    // Insert one more, forcing an eviction of the LRU entry (which is now #1, not #0).
    setCachedSignedUrl("/api/images/overflow/signed-url", publicScope, { url: "/demo-documents/overflow.png" });

    expect(getCachedSignedUrl("/api/images/0/signed-url", publicScope)).not.toBeNull();
    expect(getCachedSignedUrl("/api/images/1/signed-url", publicScope)).toBeNull();
    expect(getCachedSignedUrl("/api/images/overflow/signed-url", publicScope)).not.toBeNull();
  });

  it("never serves a private bearer URL outside the auth owner and epoch that minted it", () => {
    clearSignedUrlCache();
    const ownerB = signedUrlCacheScope("owner", 2, "owner-b");
    const signedOut = signedUrlCacheScope("owner", 2, null);

    for (const [endpoint, url] of [
      ["/api/documents/private/signed-url", "https://storage.example/private.pdf?token=owner-a"],
      ["/api/images/private/signed-url", "https://storage.example/private.png?token=owner-a"],
    ] as const) {
      setCachedSignedUrl(endpoint, ownerAScope, { url });

      expect(getCachedSignedUrl(endpoint, ownerAScope)?.url).toContain("token=owner-a");
      expect(getCachedSignedUrl(endpoint, ownerB)).toBeNull();
      expect(getCachedSignedUrl(endpoint, signedOut)).toBeNull();
    }
  });
});
