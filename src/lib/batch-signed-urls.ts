import { z } from "zod";

import { parseApiSuccessResponse } from "@/lib/api-success-response";
import { getCachedSignedUrl, setCachedSignedUrl } from "@/lib/signed-url-cache";

export const BATCH_SIGNED_URLS_MAX_CHUNK = 100;

export const batchSignedUrlItemSchema = z
  .object({
    url: z.string().min(1),
    mimeType: z.string().nullable(),
    caption: z.string().nullable(),
    expiresAt: z.string().datetime({ offset: true }),
    demoMode: z.boolean().optional(),
  })
  .strict();

export const batchSignedUrlsResponseSchema = z
  .object({
    urls: z.record(z.string(), batchSignedUrlItemSchema),
  })
  .strict();

export type BatchSignedUrlItem = z.infer<typeof batchSignedUrlItemSchema>;
export type BatchSignedUrlsResponse = z.infer<typeof batchSignedUrlsResponseSchema>;

/**
 * Filter an array of image IDs to only those that do NOT currently have an active
 * valid signed URL in the client-side LRU cache.
 */
export function getUncachedImageIds(imageIds: string[]): string[] {
  const unique = Array.from(new Set(imageIds.filter(Boolean)));
  return unique.filter((id) => {
    const endpoint = `/api/images/${id}/signed-url`;
    return !getCachedSignedUrl(endpoint);
  });
}

/**
 * Fetch signed URLs for up to 100 image IDs in a single batch request.
 * Automatically chunks larger lists into multiple <= 100 ID requests in parallel.
 */
export async function fetchBatchSignedImageUrls(
  imageIds: string[],
  options: {
    endpoint?: string;
    headers?: HeadersInit;
    signal?: AbortSignal;
    onUnauthorized?: () => void;
  } = {},
): Promise<{ status: number; urls: Record<string, BatchSignedUrlItem> }> {
  const endpoint = options.endpoint ?? "/api/images/signed-urls";
  const uniqueIds = Array.from(new Set(imageIds.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return { status: 200, urls: {} };
  }

  // Split into <= 100 ID chunks
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += BATCH_SIGNED_URLS_MAX_CHUNK) {
    chunks.push(uniqueIds.slice(i, i + BATCH_SIGNED_URLS_MAX_CHUNK));
  }

  const combinedUrls: Record<string, BatchSignedUrlItem> = {};
  let overallStatus = 200;

  const normalizedHeaders = new Headers(options.headers);
  normalizedHeaders.set("content-type", "application/json");

  const responses = await Promise.all(
    chunks.map(async (chunk) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: normalizedHeaders,
        body: JSON.stringify({ imageIds: chunk }),
        signal: options.signal,
      });

      if (response.status === 401 && options.onUnauthorized) {
        options.onUnauthorized();
      }

      if (!response.ok) {
        return { status: response.status, urls: {} };
      }

      const data = await parseApiSuccessResponse(
        response,
        batchSignedUrlsResponseSchema,
        "Signed image URLs returned an invalid response.",
      );
      return { status: response.status, urls: data.urls };
    }),
  );

  for (const res of responses) {
    if (res.status !== 200) overallStatus = res.status;
    Object.assign(combinedUrls, res.urls);
  }

  return { status: overallStatus, urls: combinedUrls };
}

/**
 * Populate the client-side LRU cache with the returned batch signed URLs.
 */
export function populateBatchSignedUrlsInCache(urls: Record<string, BatchSignedUrlItem>): void {
  for (const [id, item] of Object.entries(urls)) {
    if (item && item.url) {
      const endpoint = `/api/images/${id}/signed-url`;
      setCachedSignedUrl(endpoint, {
        url: item.url,
        caption: item.caption ?? undefined,
        mimeType: item.mimeType ?? undefined,
        expiresAt: item.expiresAt,
      });
    }
  }
}
