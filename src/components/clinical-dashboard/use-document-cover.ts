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
 * Cached per document for the page's lifetime, including the misses. A document
 * with no cover is the common case for a text-only upload, and re-asking on
 * every drawer open would spend a document-read rate-limit token each time to
 * learn the same `null`.
 */
const coverImageIds = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();

async function loadCoverImageId(documentId: string): Promise<string | null> {
  const cached = coverImageIds.get(documentId);
  if (cached !== undefined) return cached;
  const pending = inFlight.get(documentId);
  if (pending) return pending;

  const request = (async () => {
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/cover`);
      if (!response.ok) return null;
      const payload: unknown = await response.json();
      const value =
        payload && typeof payload === "object" && "coverImageId" in payload
          ? (payload as { coverImageId: unknown }).coverImageId
          : null;
      return typeof value === "string" && value.length > 0 ? value : null;
    } catch {
      // A cover is decoration for a citation, never the citation itself. A
      // failed lookup renders no thumbnail and changes nothing else on screen.
      return null;
    }
  })();

  inFlight.set(documentId, request);
  const resolved = await request;
  inFlight.delete(documentId);
  coverImageIds.set(documentId, resolved);
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
      if (active) setFetched(resolved);
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
