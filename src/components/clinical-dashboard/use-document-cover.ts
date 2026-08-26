"use client";

import { useEffect, useState } from "react";

/**
 * The first-page cover thumbnail id for a document, fetched on demand.
 *
 * The answer payload does not carry it: the cover rides `RelatedDocument` on
 * the search payload, and putting it on the answer's own source rows would mean
 * editing retrieval hydration — a protected RAG surface, and far more blast
 * radius than a thumbnail earns. So the drawer asks for it when a source opens.
 *
 * Cached per document for the page's lifetime, including the authoritative
 * misses. A document with no cover is the common case for a text-only upload,
 * and re-asking on every drawer open would spend a document-read rate-limit
 * token each time to learn the same `null`.
 *
 * An authoritative miss is not the same as a failed lookup, and the first cut
 * of this cached both as `null`. A 429, a 5xx or an offline blip then pinned
 * "no cover" for the rest of the page's life: every later open found the id in
 * the map and skipped the request, so the thumbnail could not come back without
 * a reload. `undefined` from the loader means "ask again next time" and is the
 * one result that is never cached.
 */
const coverImageIds = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null | undefined>>();

/** `string`/`null` are answers and get cached; `undefined` is a transient failure. */
async function loadCoverImageId(documentId: string): Promise<string | null | undefined> {
  const cached = coverImageIds.get(documentId);
  if (cached !== undefined) return cached;
  const pending = inFlight.get(documentId);
  if (pending) return pending;

  const request = (async () => {
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/cover`);
      // 404 is an answer: the document is gone or not ours to read. Anything
      // else non-ok (429, 5xx) is the server declining for now, not saying no.
      if (response.status === 404) return null;
      if (!response.ok) return undefined;
      const payload: unknown = await response.json();
      const value =
        payload && typeof payload === "object" && "coverImageId" in payload
          ? (payload as { coverImageId: unknown }).coverImageId
          : null;
      return typeof value === "string" && value.length > 0 ? value : null;
    } catch {
      // Offline, aborted, or unparseable. A cover is decoration for a citation,
      // never the citation itself, so this renders no thumbnail and changes
      // nothing else on screen — but it stays retryable.
      return undefined;
    }
  })();

  inFlight.set(documentId, request);
  const resolved = await request;
  inFlight.delete(documentId);
  if (resolved !== undefined) coverImageIds.set(documentId, resolved);
  return resolved;
}

export function useDocumentCoverImageId(documentId: string | null | undefined): string | null {
  const id = documentId ?? null;
  /**
   * Reset happens during render, not in an effect. Clearing the previous
   * document's answer from inside an effect renders one frame with the wrong
   * cover attached to the new source — a picture of the last document beside
   * this document's passage — and `react-hooks/set-state-in-effect` rejects the
   * synchronous set that would cause it. The effect below only ever sets state
   * from the resolved promise.
   */
  const [renderedId, setRenderedId] = useState(id);
  const [fetched, setFetched] = useState<string | null>(null);
  if (renderedId !== id) {
    setRenderedId(id);
    setFetched(null);
  }

  useEffect(() => {
    if (!id || coverImageIds.get(id) !== undefined) return;
    let active = true;
    void loadCoverImageId(id).then((resolved) => {
      if (active) setFetched(resolved ?? null);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (!id) return null;
  const cached = coverImageIds.get(id);
  return cached !== undefined ? cached : fetched;
}

/** Test-only reset for the process-local cover cache. */
export function resetDocumentCoverCacheForTests() {
  coverImageIds.clear();
  inFlight.clear();
}
