import { describe, expect, it, vi } from "vitest";
import {
  clearCachedSignedUrl,
  clearSignedUrlCache,
  fetchImageSignedUrl,
  getCachedSignedUrl,
  imageSignedUrlEndpoint,
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

describe("batched image signed-url fetch", () => {
  const imageA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const imageB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  function batchFetchMock(items?: Record<string, unknown>) {
    return vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { ids: string[] };
      const resolved =
        items ?? Object.fromEntries(body.ids.map((id) => [id, { url: `/signed/${id}.png`, caption: null }]));
      return new Response(JSON.stringify({ items: resolved }), { status: 200 });
    });
  }

  it("coalesces concurrent requests into one batch POST and populates the cache", async () => {
    clearSignedUrlCache();
    vi.useFakeTimers();
    const fetchMock = batchFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    try {
      const first = fetchImageSignedUrl(imageA);
      const second = fetchImageSignedUrl(imageB);
      const duplicate = fetchImageSignedUrl(imageA);
      await vi.advanceTimersByTimeAsync(30);
      const [a, b, aDuplicate] = await Promise.all([first, second, duplicate]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, init] = fetchMock.mock.calls[0] as [unknown, RequestInit];
      expect(JSON.parse(String(init.body)).ids).toEqual([imageA, imageB]);
      expect(a?.url).toBe(`/signed/${imageA}.png`);
      expect(aDuplicate?.url).toBe(`/signed/${imageA}.png`);
      expect(b?.url).toBe(`/signed/${imageB}.png`);
      expect(getCachedSignedUrl(imageSignedUrlEndpoint(imageA))?.url).toBe(`/signed/${imageA}.png`);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("resolves null for ids the server withheld and does not cache them", async () => {
    clearSignedUrlCache();
    vi.useFakeTimers();
    const fetchMock = batchFetchMock({ [imageA]: { url: `/signed/${imageA}.png` }, [imageB]: null });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const first = fetchImageSignedUrl(imageA);
      const second = fetchImageSignedUrl(imageB);
      await vi.advanceTimersByTimeAsync(30);

      expect(await first).not.toBeNull();
      expect(await second).toBeNull();
      expect(getCachedSignedUrl(imageSignedUrlEndpoint(imageB))).toBeNull();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("never mixes requests carrying different authorization headers into one batch", async () => {
    clearSignedUrlCache();
    vi.useFakeTimers();
    const fetchMock = batchFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    try {
      const first = fetchImageSignedUrl(imageA, { authorizationHeader: { Authorization: "Bearer user-1" } });
      const second = fetchImageSignedUrl(imageB, { authorizationHeader: { Authorization: "Bearer user-2" } });
      await vi.advanceTimersByTimeAsync(30);
      await Promise.all([first, second]);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const sentAuth = fetchMock.mock.calls.map(
        ([, init]) => (init as RequestInit & { headers: Record<string, string> }).headers.Authorization,
      );
      expect(sentAuth.sort()).toEqual(["Bearer user-1", "Bearer user-2"]);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("reports 401 batches through onUnauthorized and resolves waiters null", async () => {
    clearSignedUrlCache();
    vi.useFakeTimers();
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const pending = fetchImageSignedUrl(imageA, { onUnauthorized });
      await vi.advanceTimersByTimeAsync(30);

      expect(await pending).toBeNull();
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
      expect(getCachedSignedUrl(imageSignedUrlEndpoint(imageA))).toBeNull();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});
