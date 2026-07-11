import { afterEach, describe, expect, it, vi } from "vitest";

import { clearClientFetchCache, fetchJsonCached } from "../src/lib/client-fetch-cache";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

afterEach(() => {
  clearClientFetchCache();
  vi.unstubAllGlobals();
});

describe("client fetch cache", () => {
  it("dedupes concurrent identical requests onto one fetch", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ records: [1] }));
    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([
      fetchJsonCached("/api/registry/records?kind=service"),
      fetchJsonCached("/api/registry/records?kind=service"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.status).toBe(200);
    expect(b.payload).toEqual({ records: [1] });
  });

  it("serves repeat requests from cache within the TTL", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ records: [1] }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchJsonCached("/api/medications");
    const second = await fetchJsonCached("/api/medications");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.payload).toEqual({ records: [1] });
  });

  it("refetches once the TTL passes", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn(async () => jsonResponse({ records: [1] }));
      vi.stubGlobal("fetch", fetchMock);

      await fetchJsonCached("/api/medications", { ttlMs: 1_000 });
      vi.setSystemTime(Date.now() + 2_000);
      await fetchJsonCached("/api/medications", { ttlMs: 1_000 });

      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never caches non-OK responses (401 must re-resolve once auth loads)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ records: [1] }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await fetchJsonCached("/api/registry/records?kind=form");
    const second = await fetchJsonCached("/api/registry/records?kind=form");

    expect(first.status).toBe(401);
    expect(second.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keys entries by authorization header so sessions never share payloads", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ records: [1] }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchJsonCached("/api/medications", { headers: { Authorization: "Bearer user-1" } });
    await fetchJsonCached("/api/medications", { headers: { Authorization: "Bearer user-2" } });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears entries by URL prefix", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ records: [1] }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchJsonCached("/api/medications");
    clearClientFetchCache("/api/medications");
    await fetchJsonCached("/api/medications");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
