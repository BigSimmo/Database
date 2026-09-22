"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import type { OnCallLinkedDocument } from "@/lib/on-call/entry-model";
import { onCallEntryCacheChangedEvent, peekOnCallEntrySessionEpoch } from "@/lib/on-call/entry-cache-keys";

const documentResponseSchema = z.object({
  document: z.object({
    id: z.string().uuid(),
    title: z.string().nullish(),
    file_name: z.string().nullish(),
    created_at: z.string().nullish(),
    updated_at: z.string().nullish(),
  }),
});

/** Resolve only requested sources through the existing permission-checked detail route.
 * No library-wide fetch, private-source promotion, or persistent document cache.
 */
export function useOnCallLinkedDocuments(ids: readonly string[] = []): Readonly<Record<string, OnCallLinkedDocument>> {
  const key = [...new Set(ids)].sort().join(",");
  const [result, setResult] = useState<{
    key: string;
    epoch: number;
    documents: Record<string, OnCallLinkedDocument>;
  } | null>(null);
  const [epoch, setEpoch] = useState(peekOnCallEntrySessionEpoch);
  useEffect(() => {
    const onChange = () => setEpoch(peekOnCallEntrySessionEpoch());
    window.addEventListener(onCallEntryCacheChangedEvent, onChange);
    return () => window.removeEventListener(onCallEntryCacheChangedEvent, onChange);
  }, []);
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const requested = key.split(",").filter((id) => z.string().uuid().safeParse(id).success);
    const documents: Record<string, OnCallLinkedDocument> = {};
    let next = 0;
    async function resolveNext() {
      while (next < requested.length && !controller.signal.aborted) {
        const id = requested[next++];
        try {
          const response = await fetch(`/api/documents/${id}?pageLimit=1&chunkLimit=1&assetScope=window`, {
            signal: controller.signal,
          });
          if (!response.ok) continue;
          const parsed = documentResponseSchema.safeParse(await response.json());
          if (!parsed.success || parsed.data.document.id !== id) continue;
          const row = parsed.data.document;
          const title = row.title?.trim() || row.file_name?.trim();
          if (title) documents[id] = { id, title, date: row.updated_at ?? row.created_at ?? null };
        } catch {
          // The linked ID remains visible as unavailable, never relabelled unlinked.
        }
      }
    }
    void Promise.all(Array.from({ length: Math.min(3, requested.length) }, resolveNext)).then(() => {
      if (!controller.signal.aborted && epoch === peekOnCallEntrySessionEpoch()) setResult({ key, epoch, documents });
    });
    return () => controller.abort();
  }, [key, epoch]);
  return result?.key === key && result.epoch === epoch ? result.documents : {};
}
