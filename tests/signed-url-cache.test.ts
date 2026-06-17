import { describe, expect, it, vi } from "vitest";
import {
  clearCachedSignedUrl,
  clearSignedUrlCache,
  getCachedSignedUrl,
  setCachedSignedUrl,
} from "../src/lib/signed-url-cache";

describe("signed URL cache", () => {
  it("stores signed image URL payloads by endpoint", () => {
    clearSignedUrlCache();

    expect(getCachedSignedUrl("/api/images/a/signed-url")).toBeNull();
    setCachedSignedUrl("/api/images/a/signed-url", {
      url: "/demo-documents/image.png",
      caption: "Image caption",
    });

    expect(getCachedSignedUrl("/api/images/a/signed-url")?.url).toBe("/demo-documents/image.png");
  });

  it("clears one signed URL endpoint without clearing the full cache", () => {
    clearSignedUrlCache();

    setCachedSignedUrl("/api/images/a/signed-url", { url: "/demo-documents/a.png" });
    setCachedSignedUrl("/api/images/b/signed-url", { url: "/demo-documents/b.png" });

    clearCachedSignedUrl("/api/images/a/signed-url");

    expect(getCachedSignedUrl("/api/images/a/signed-url")).toBeNull();
    expect(getCachedSignedUrl("/api/images/b/signed-url")?.url).toBe("/demo-documents/b.png");
  });

  // RET-H3
  it("evicts entries strictly once expiresAt has passed", () => {
    clearSignedUrlCache();
    setCachedSignedUrl("/api/images/expired/signed-url", {
      url: "/demo-documents/expired.png",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(getCachedSignedUrl("/api/images/expired/signed-url")).toBeNull();
  });

  it("does not serve an entry inside the expiry skew window", () => {
    clearSignedUrlCache();
    setCachedSignedUrl("/api/images/soon/signed-url", {
      url: "/demo-documents/soon.png",
      // within the 30s refresh skew
      expiresAt: new Date(Date.now() + 5_000).toISOString(),
    });
    expect(getCachedSignedUrl("/api/images/soon/signed-url")).toBeNull();
  });

  it("caches a payload missing expiresAt only for a bounded default TTL, not forever", () => {
    clearSignedUrlCache();
    setCachedSignedUrl("/api/images/no-exp/signed-url", { url: "/demo-documents/no-exp.png" });
    // Served now (default TTL is in the future)...
    expect(getCachedSignedUrl("/api/images/no-exp/signed-url")?.url).toBe("/demo-documents/no-exp.png");

    // ...but the entry carries a finite hard expiry rather than living forever.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 6 * 60_000);
      expect(getCachedSignedUrl("/api/images/no-exp/signed-url")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("bounds the cache with LRU eviction of the least-recently-used entry", () => {
    clearSignedUrlCache();
    const maxSize = 256;
    for (let i = 0; i < maxSize; i += 1) {
      setCachedSignedUrl(`/api/images/${i}/signed-url`, { url: `/demo-documents/${i}.png` });
    }
    // Touch entry 0 so it becomes most-recently-used.
    expect(getCachedSignedUrl("/api/images/0/signed-url")).not.toBeNull();
    // Insert one more, forcing an eviction of the LRU entry (which is now #1, not #0).
    setCachedSignedUrl("/api/images/overflow/signed-url", { url: "/demo-documents/overflow.png" });

    expect(getCachedSignedUrl("/api/images/0/signed-url")).not.toBeNull();
    expect(getCachedSignedUrl("/api/images/1/signed-url")).toBeNull();
    expect(getCachedSignedUrl("/api/images/overflow/signed-url")).not.toBeNull();
  });
});
