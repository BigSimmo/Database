import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BATCH_SIGNED_URLS_MAX_CHUNK,
  fetchBatchSignedImageUrls,
  getUncachedImageIds,
  populateBatchSignedUrlsInCache,
} from "@/lib/batch-signed-urls";
import { clearSignedUrlCache, getCachedSignedUrl, setCachedSignedUrl } from "@/lib/signed-url-cache";
import { POST } from "@/app/api/images/signed-urls/route";

const mockCreateSignedUrls = vi.fn();

const testImageId = "11111111-1111-4111-8111-111111111111";
const testDocId = "22222222-2222-4222-8222-222222222222";
const testUserId = "33333333-3333-4333-8333-333333333333";

const mockAdminClient = {
  from: vi.fn((table: string) => {
    if (table === "document_images") {
      return {
        select: vi.fn(() => ({
          in: vi.fn(() =>
            Promise.resolve({
              data: [
                {
                  id: testImageId,
                  document_id: testDocId,
                  storage_path: `${testUserId}/images/${testImageId}.png`,
                  mime_type: "image/png",
                  caption: null,
                  metadata: { index_generation_id: "gen-1" },
                },
              ],
              error: null,
            }),
          ),
        })),
      };
    }
    if (table === "documents") {
      const docChain: Record<string, unknown> = {
        select: vi.fn(() => docChain),
        in: vi.fn(() => docChain),
        or: vi.fn(() => docChain),
        is: vi.fn(() => docChain),
        eq: vi.fn(() => docChain),
        then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
          return Promise.resolve({
            data: [
              {
                id: testDocId,
                metadata: { index_generation_id: "gen-1" },
              },
            ],
            error: null,
          }).then(resolve, reject);
        },
      };
      return docChain;
    }
    return {
      select: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    };
  }),
  storage: {
    from: vi.fn(() => ({
      createSignedUrls: (...args: unknown[]) => mockCreateSignedUrls(...args),
    })),
  },
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: { id: testUserId, app_metadata: { site_role: "administrator" } } },
      error: null,
    })),
  },
  rpc: vi.fn(async () => ({
    data: [{ limited: false, remaining: 100 }],
    error: null,
  })),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdminClient,
}));

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...actual,
    isDemoMode: () => false,
  };
});

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

    it("rejects a malformed successful payload instead of treating it as an empty result", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        Response.json({ urls: { "img-1": { url: "https://example.test/image.png" } } }),
      );

      await expect(fetchBatchSignedImageUrls(["img-1"])).rejects.toThrow(
        "Signed image URLs returned an invalid response.",
      );
    });

    it("handles 500 server error when createSignedUrls fails", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "Failed to generate signed URL for image: Object not found",
            message: "Failed to generate signed URL for image: Object not found",
          }),
          { status: 500, headers: { "content-type": "application/json" } },
        ),
      );

      const result = await fetchBatchSignedImageUrls(["img-1"]);
      expect(result.status).toBe(500);
      expect(result.urls).toEqual({});
    });
  });

  describe("POST /api/images/signed-urls createSignedUrls error handling", () => {
    function setupMockClient(createSignedUrlsMock: ReturnType<typeof vi.fn>) {
      const docImagesChain = {
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: testImageId,
              document_id: testDocId,
              storage_path: `${testUserId}/images/${testImageId}.png`,
              mime_type: "image/png",
              caption: null,
              metadata: { index_generation_id: "gen-1" },
            },
          ],
          error: null,
        }),
      };

      const docChain: Record<string, unknown> = {
        in: vi.fn(() => docChain),
        or: vi.fn(() => docChain),
        is: vi.fn(() => docChain),
        eq: vi.fn(() => docChain),
        then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
          return Promise.resolve({
            data: [
              {
                id: testDocId,
                metadata: { index_generation_id: "gen-1" },
              },
            ],
            error: null,
          }).then(resolve, reject);
        },
      };

      mockAdminClient.from = vi.fn((table: string) => {
        if (table === "document_images") {
          return { select: vi.fn(() => docImagesChain) } as never;
        }
        if (table === "documents") {
          return { select: vi.fn(() => docChain) } as never;
        }
        return {
          select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) })),
        } as never;
      });

      mockAdminClient.storage = {
        from: vi.fn(() => ({
          createSignedUrls: createSignedUrlsMock,
        })),
      } as never;

      mockAdminClient.auth = {
        getUser: vi.fn(async () => ({
          data: { user: { id: testUserId, app_metadata: { site_role: "administrator" } } },
          error: null,
        })),
      } as never;

      mockAdminClient.rpc = vi.fn(async () => ({
        data: [{ limited: false, remaining: 100 }],
        error: null,
      })) as never;
    }

    it("throws a 500 error when createSignedUrls returns an item with an error", async () => {
      const mockFn = vi.fn().mockResolvedValueOnce({
        data: [
          {
            path: `${testUserId}/images/${testImageId}.png`,
            signedUrl: "",
            error: "Object not found",
          },
        ],
        error: null,
      });
      setupMockClient(mockFn);

      const request = new Request("http://localhost/api/images/signed-urls", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer valid-token",
        },
        body: JSON.stringify({ imageIds: [testImageId] }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Failed to generate signed URL for image: Object not found");
    });

    it("finds and reports the first error when multiple items have errors", async () => {
      const mockFn = vi.fn().mockResolvedValueOnce({
        data: [
          {
            path: "path1.png",
            signedUrl: "https://signed.example.com/1.png",
            error: null,
          },
          {
            path: "path2.png",
            signedUrl: "",
            error: "Bucket not accessible",
          },
          {
            path: "path3.png",
            signedUrl: "",
            error: "Key not found",
          },
        ],
        error: null,
      });
      setupMockClient(mockFn);

      const request = new Request("http://localhost/api/images/signed-urls", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer valid-token",
        },
        body: JSON.stringify({ imageIds: [testImageId] }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Failed to generate signed URL for image: Bucket not accessible");
    });

    it("returns 200 with signed URLs when createSignedUrls returns no item errors", async () => {
      const mockFn = vi.fn().mockResolvedValueOnce({
        data: [
          {
            path: `${testUserId}/images/${testImageId}.png`,
            signedUrl: `https://signed.example.com/${testImageId}.png`,
            error: null,
          },
        ],
        error: null,
      });
      setupMockClient(mockFn);

      const request = new Request("http://localhost/api/images/signed-urls", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer valid-token",
        },
        body: JSON.stringify({ imageIds: [testImageId] }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.urls[testImageId].url).toBe(`https://signed.example.com/${testImageId}.png`);
    });
  });
});
