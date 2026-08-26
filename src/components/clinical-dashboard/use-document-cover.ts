"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuthSession } from "@/lib/supabase/client";

/**
 * The first-page cover thumbnail id for a document, fetched on demand.
 *
 * The answer payload does not carry it: the cover rides `RelatedDocument` on
 * the search payload, and putting it on the answer's own source rows would mean
 * editing retrieval hydration — a protected RAG surface, and far more blast
 * radius than a thumbnail earns. So the drawer asks for it when a source opens.
 *
 * Cached per authenticated identity and document for the page's lifetime,
 * including authoritative misses. A document with no cover is the common case
 * for a text-only upload, and re-asking on every drawer open would spend a
 * document-read rate-limit token each time to learn the same `null`.
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

function coverCacheKey(documentId: string, authIdentity: string | null) {
  return JSON.stringify([authIdentity, documentId]);
}

/** `string`/`null` are answers and get cached; `undefined` is a transient failure. */
async function loadCoverImageId(
  key: string,
  documentId: string,
  authorizationHeader: Record<string, string>,
): Promise<string | null | undefined> {
  const cached = coverImageIds.get(key);
  if (cached !== undefined) return cached;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/cover`, {
        headers: authorizationHeader,
      });
      // 404 is an answer: the document is gone or not ours to read. Anything
      // else non-ok (429, 5xx) is the server declining for now, not saying no.
      if (response.status === 404) return null;
      if (!response.ok) return undefined;
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || !("coverImageId" in payload)) return undefined;
      const value = (payload as { coverImageId: unknown }).coverImageId;
      if (value === null) return null;
      return typeof value === "string" && value.length > 0 ? value : undefined;
    } catch {
      // Offline, aborted, or unparseable. A cover is decoration for a citation,
      // never the citation itself, so this renders no thumbnail and changes
      // nothing else on screen — but it stays retryable.
      return undefined;
    }
  })();

  inFlight.set(key, request);
  const resolved = await request;
  inFlight.delete(key);
  if (resolved !== undefined) coverImageIds.set(key, resolved);
  return resolved;
}

export function useDocumentCoverImageId(documentId: string | null | undefined): {
  coverImageId: string | null;
  markCoverUnavailable: (imageId: string) => void;
} {
  const { authorizationHeader, session } = useAuthSession();
  const id = documentId ?? null;
  const authIdentity = session?.user?.id ?? null;
  const key = id ? coverCacheKey(id, authIdentity) : null;
  /**
   * Reset happens during render, not in an effect. Clearing the previous
   * identity/document answer from inside an effect renders one frame with the
   * wrong cover attached to the new source — a picture from another document
   * or account beside this document's passage. The effect below only ever sets
   * state from the resolved promise.
   */
  const [renderedKey, setRenderedKey] = useState(key);
  const [fetched, setFetched] = useState<string | null>(null);
  const [, notifyCacheChanged] = useState(0);
  if (renderedKey !== key) {
    setRenderedKey(key);
    setFetched(null);
  }

  useEffect(() => {
    if (!id || !key || coverImageIds.get(key) !== undefined) return;
    let active = true;
    void loadCoverImageId(key, id, authorizationHeader).then((resolved) => {
      if (active) setFetched(resolved ?? null);
    });
    return () => {
      active = false;
    };
  }, [authorizationHeader, id, key]);

  const markCoverUnavailable = useCallback(
    (imageId: string) => {
      // A settled image failure can report after the drawer has paged to a new
      // document/account. The captured identity+document key and exact image
      // guard ensure it can only invalidate the result that actually failed;
      // a newer result for that key and every other account remain untouched.
      if (!key || coverImageIds.get(key) !== imageId) return;
      // This is not an authoritative "no cover" answer. The signed-url or
      // object download may have failed transiently, or a reindex may have
      // selected a replacement since this id was resolved. Hide the optional
      // thumbnail for this mounted drawer, but discard the stale lookup so the
      // next open can resolve the current cover instead of pinning a negative
      // result for the rest of the page lifetime.
      coverImageIds.delete(key);
      setFetched(null);
      // `coverImageIds` is external mutable state. `fetched` can already be
      // null, so setting it to null is a React no-op; explicitly notify this
      // hook so the deleted cached id is observed without refetching until a
      // later mount/open runs the effect again.
      notifyCacheChanged((revision) => revision + 1);
    },
    [key],
  );

  if (!id || !key) return { coverImageId: null, markCoverUnavailable };
  const cached = coverImageIds.get(key);
  return { coverImageId: cached !== undefined ? cached : fetched, markCoverUnavailable };
}

/** Test-only reset for the process-local cover cache. */
export function resetDocumentCoverCacheForTests() {
  coverImageIds.clear();
  inFlight.clear();
}
