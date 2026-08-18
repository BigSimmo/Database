import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BATCH_SIGNED_URLS_MAX_CHUNK,
  fetchBatchSignedImageUrls,
  getUncachedImageIds,
  populateBatchSignedUrlsInCache,
} from "@/lib/batch-signed-urls";
import { clearSignedUrlCache, getCachedSignedUrl, setCachedSignedUrl } from "@/lib/signed-url-cache";

describe("batch-signed-urls", () => {
  beforeEach(() => {
    clearSignedUrlCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearSignedUrlCache();
    vi.restoreAllMocks();
  });

  describe("getUncachedImageIds", () => {
    it("returns all unique non-empty IDs when cache is empty", () => {
      const ids = ["img-1", "img-2", "img-1", "", "img-3"];
      const uncached = getUncachedImageIds(ids);
      expect(uncached).toEqual(["img-1", "img-2", "img-3"]);
    });

    it("filters out IDs that already have active cached signed URLs", () => {
      setCachedSignedUrl("/api/images/img-1/signed-url", {
        url: "https://signed.example.com/img-1.png",
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      });

      const ids = ["img-1", "img-2", "img-3"];
      const uncached = getUncachedImageIds(ids);
      expect(uncached).toEqual(["img-2", "img-3"]);
    });
  });

  describe("populateBatchSignedUrlsInCache", () => {
    it("populates the LRU cache for all returned images", () => {
      const futureExpiry = new Date(Date.now() + 600000).toISOString();
      const urls = {
        "img-10": {
          url: "https://signed.example.com/img-10.png",
          mimeType: "image/png",
          caption: "Table 1",
          expiresAt: futureExpiry,
        },
        "img-20": {
          url: "https://signed.example.com/img-20.jpg",
          mimeType: "image/jpeg",
          caption: "Figure 2",
          expiresAt: futureExpiry,
        },
      };

      populateBatchSignedUrlsInCache(urls);

      const cached1 = getCachedSignedUrl("/api/images/img-10/signed-url");
      expect(cached1).not.toBeNull();
      expect(cached1?.url).toBe("https://signed.example.com/img-10.png");
      expect(cached1?.caption).toBe("Table 1");
      expect(cached1?.mimeType).toBe("image/png");

      const cached2 = getCachedSignedUrl("/api/images/img-20/signed-url");
      expect(cached2?.url).toBe("https://signed.example.com/img-20.jpg");
    });
  });

  describe("fetchBatchSignedImageUrls", () => {
    it("returns empty result when imageIds array is empty", async () => {
      const result = await fetchBatchSignedImageUrls([]);
      expect(result).toEqual({ status: 200, urls: {} });
    });

    it("fetches signed URLs from /api/images/signed-urls in a single request for <= 100 IDs", async () => {
      const mockResponse = {
        urls: {
          "img-1": {
            url: "https://signed.example.com/1.png",
            mimeType: "image/png",
            caption: null,
            expiresAt: new Date(Date.now() + 600000).toISOString(),
          },
        },
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

      const result = await fetchBatchSignedImageUrls(["img-1"]);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const call = fetchSpy.mock.calls[0];
      expect(call[0]).toBe("/api/images/signed-urls");
      expect(JSON.parse(call[1]?.body as string)).toEqual({ imageIds: ["img-1"] });
      expect(result.urls["img-1"].url).toBe("https://signed.example.com/1.png");
    });

    it("chunks requests into batches of at most 100 IDs", async () => {
      const manyIds = Array.from({ length: 150 }, (_, i) => `img-${i}`);

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
        const body = JSON.parse(init?.body as string) as { imageIds: string[] };
        const urls: Record<string, { url: string; mimeType: null; caption: null; expiresAt: string }> = {};
        for (const id of body.imageIds) {
          urls[id] = {
            url: `https://signed.example.com/${id}.png`,
            mimeType: null,
            caption: null,
            expiresAt: new Date(Date.now() + 600000).toISOString(),
          };
        }
        return new Response(JSON.stringify({ urls }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      });

      const result = await fetchBatchSignedImageUrls(manyIds);

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(JSON.parse(fetchSpy.mock.calls[0][1]?.body as string).imageIds.length).toBe(BATCH_SIGNED_URLS_MAX_CHUNK);
      expect(JSON.parse(fetchSpy.mock.calls[1][1]?.body as string).imageIds.length).toBe(50);
      expect(Object.keys(result.urls).length).toBe(150);
    });

    it("invokes onUnauthorized callback when receiving a 401 status", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      );

      const onUnauthorized = vi.fn();
      const result = await fetchBatchSignedImageUrls(["img-1"], { onUnauthorized });

      expect(result.status).toBe(401);
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });
  });
});
