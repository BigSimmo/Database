"use client";

import { useCallback, useEffect, useState } from "react";

import { clearCachedSignedUrl, getCachedSignedUrl, setCachedSignedUrl } from "@/lib/signed-url-cache";
import { useAuthSession } from "@/lib/supabase/client";

/**
 * Resolve a private image's signed URL through its `/signed-url` endpoint, with
 * the client LRU cache in front and the auth-session authorization header.
 *
 * Shared by `SignedImage` (which gates `enabled` behind an IntersectionObserver)
 * and the image lightbox (which enables it while open). A cached URL seeds the
 * state synchronously so an already-fetched image paints without a round-trip.
 */
export function useSignedImageUrl(endpoint: string, enabled: boolean) {
  const [url, setUrl] = useState(() => getCachedSignedUrl(endpoint)?.url ?? null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { authorizationHeader, markSessionExpired } = useAuthSession();

  useEffect(() => {
    if (!enabled) return () => undefined;

    const cached = getCachedSignedUrl(endpoint);
    if (cached) {
      let active = true;
      window.requestAnimationFrame(() => {
        if (!active) return;
        setUrl(cached.url);
        setFailed(false);
      });
      return () => {
        active = false;
      };
    }

    let active = true;
    fetch(endpoint, { headers: authorizationHeader })
      .then((response) => {
        if (response.status === 401) markSessionExpired();
        return response.ok ? response.json() : null;
      })
      .then((data) => {
        if (active && data?.url) {
          setCachedSignedUrl(endpoint, data);
          setUrl(data.url);
          setFailed(false);
        } else if (active) {
          setFailed(true);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [attempt, authorizationHeader, enabled, endpoint, markSessionExpired]);

  // Drop the cached URL and refetch (e.g. after a 403 on an expired URL).
  const retry = useCallback(() => {
    clearCachedSignedUrl(endpoint);
    setUrl(null);
    setFailed(false);
    setAttempt((current) => current + 1);
  }, [endpoint]);

  // Mark the current URL dead (e.g. <img> onError) so the frame shows its failure state.
  const markFailed = useCallback(() => {
    clearCachedSignedUrl(endpoint);
    setUrl(null);
    setFailed(true);
  }, [endpoint]);

  return { url, failed, retry, markFailed };
}
