"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useAuthSession } from "@/lib/supabase/client";
import {
  readSavedRegistrySlugs,
  savedDifferentialsStorageKey,
  savedFormsStorageKey,
  savedServicesStorageKey,
  savedTherapiesStorageKey,
  subscribeSavedRegistrySlugs,
  writeSavedRegistrySlugs,
} from "@/lib/saved-registry-storage";

export type FavouriteContentType = "service" | "form" | "differential" | "therapy";

type FavouritesByType = Record<FavouriteContentType, string[]>;
type FavouriteMutationState = {
  confirmed: boolean;
  desired: boolean;
  pending: number;
  tail: Promise<void>;
};

const emptyFavourites: FavouritesByType = { service: [], form: [], differential: [], therapy: [] };
const storageKeyByType = {
  service: savedServicesStorageKey,
  form: savedFormsStorageKey,
  differential: savedDifferentialsStorageKey,
  therapy: savedTherapiesStorageKey,
} satisfies Record<FavouriteContentType, string>;
const demoAccountData = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

function readDemoFavourites(): FavouritesByType {
  return {
    service: readSavedRegistrySlugs(savedServicesStorageKey),
    form: readSavedRegistrySlugs(savedFormsStorageKey),
    differential: readSavedRegistrySlugs(savedDifferentialsStorageKey),
    therapy: readSavedRegistrySlugs(savedTherapiesStorageKey),
  };
}

type AccountDataContextValue = {
  favourites: FavouritesByType;
  ready: boolean;
  /** Failure of GET /api/account/favourites (initial load or reload). */
  loadError: string | null;
  /** Failure of a save/clear mutation after the library was already loaded. */
  error: string | null;
  isAuthenticated: boolean;
  isSaved: (contentType: FavouriteContentType, contentKey: string) => boolean;
  /** Re-issue the account favourites request for the current identity. A failed
      load clears every saved slug, so without this a Retry offered by a
      favourites surface has nothing left to re-request and cannot recover. */
  reload: () => void;
  setFavourite: (contentType: FavouriteContentType, contentKey: string, saved: boolean) => Promise<boolean>;
  clearFavourites: () => Promise<boolean>;
};

const AccountDataContext = createContext<AccountDataContextValue | null>(null);

function normalizedFavourites(value: unknown): FavouritesByType {
  const rows = Array.isArray(value) ? value : [];
  const result: FavouritesByType = { service: [], form: [], differential: [], therapy: [] };
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const contentType = (row as { contentType?: unknown }).contentType;
    const contentKey = (row as { contentKey?: unknown }).contentKey;
    if (
      (contentType === "service" ||
        contentType === "form" ||
        contentType === "differential" ||
        contentType === "therapy") &&
      typeof contentKey === "string" &&
      contentKey.trim()
    ) {
      result[contentType].push(contentKey.trim());
    }
  }
  return result;
}

export function AccountDataProvider({ children }: { children: ReactNode }) {
  const auth = useAuthSession();
  const [favourites, setFavourites] = useState<FavouritesByType>(emptyFavourites);
  const favouritesRef = useRef(favourites);
  const favouriteMutationsRef = useRef(new Map<string, FavouriteMutationState>());
  const favouriteClearTailRef = useRef<Promise<void>>(Promise.resolve());
  const [ready, setReady] = useState(auth.status !== "authenticated");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumping this re-runs the load effect unchanged, so an explicit Retry gets
  // exactly the same clearing and abort semantics as an auth transition.
  const [reloadAttempt, setReloadAttempt] = useState(0);
  const reload = useCallback(() => setReloadAttempt((attempt) => attempt + 1), []);
  const replaceFavourites = useCallback((next: FavouritesByType) => {
    favouritesRef.current = next;
    setFavourites(next);
  }, []);
  const applyFavourite = useCallback(
    (contentType: FavouriteContentType, contentKey: string, saved: boolean) => {
      const current = favouritesRef.current;
      replaceFavourites({
        ...current,
        [contentType]: saved
          ? [contentKey, ...current[contentType].filter((item) => item !== contentKey)]
          : current[contentType].filter((item) => item !== contentKey),
      });
    },
    [replaceFavourites],
  );
  // Depended on by identity rather than through `auth`, which would re-run the
  // load effect on every auth-object render. It is a useCallback upstream, so
  // this stays stable.
  const markSessionExpired = auth.markSessionExpired;

  useEffect(() => {
    if (auth.status !== "authenticated") {
      const refreshDemoFavourites = () => replaceFavourites(demoAccountData ? readDemoFavourites() : emptyFavourites);
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) return;
        refreshDemoFavourites();
        setReady(true);
        setLoadError(null);
        setError(null);
      });
      const unsubscribe = demoAccountData ? subscribeSavedRegistrySlugs(refreshDemoFavourites) : undefined;
      return () => {
        cancelled = true;
        unsubscribe?.();
      };
    }

    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setReady(false);
    });
    fetch("/api/account/favourites", {
      cache: "no-store",
      headers: auth.authorizationHeader,
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        // A rejected token cannot be recovered by re-sending it, so an expired
        // session has to change the auth state rather than only the error text.
        // Retry now exists on this path; without this it would reissue the same
        // 401 forever instead of routing the reader to sign in. The mutation
        // paths below already do this.
        if (response.status === 401) markSessionExpired();
        if (!response.ok) throw new Error(payload.message ?? payload.error ?? "Saved items could not be loaded.");
        replaceFavourites(normalizedFavourites(payload.favourites));
        setLoadError(null);
        setError(null);
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        replaceFavourites(emptyFavourites);
        setLoadError(cause instanceof Error ? cause.message : "Saved items could not be loaded.");
        setError(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setReady(true);
      });

    return () => controller.abort();
  }, [auth.authEpoch, auth.authorizationHeader, auth.status, markSessionExpired, reloadAttempt, replaceFavourites]);

  const setFavourite = useCallback(
    async (contentType: FavouriteContentType, contentKey: string, saved: boolean) => {
      if (auth.status !== "authenticated") {
        if (demoAccountData) {
          const current = favouritesRef.current[contentType];
          return writeSavedRegistrySlugs(
            storageKeyByType[contentType],
            saved
              ? [contentKey, ...current.filter((item) => item !== contentKey)]
              : current.filter((item) => item !== contentKey),
          );
        }
        setError("Sign in or create an account to save favourites.");
        return false;
      }

      const key = contentKey.trim();
      if (!key) return false;
      const mutationKey = `${contentType}:${key}`;
      let mutation = favouriteMutationsRef.current.get(mutationKey);
      if (!mutation) {
        mutation = {
          confirmed: favouritesRef.current[contentType].includes(key),
          desired: saved,
          pending: 0,
          tail: Promise.resolve(),
        };
        favouriteMutationsRef.current.set(mutationKey, mutation);
      }

      mutation.desired = saved;
      mutation.pending += 1;
      applyFavourite(contentType, key, saved);

      // Per-item writes remain independent, but every write observes the latest
      // clear-all barrier. A write that begins after Clear therefore cannot race
      // ahead of its DELETE and recreate a favourite out of order.
      const request = Promise.all([mutation.tail, favouriteClearTailRef.current]).then(async () => {
        const response = await fetch("/api/account/favourites", {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...auth.authorizationHeader },
          body: JSON.stringify({ contentType, contentKey: key, saved }),
        }).catch(() => null);
        if (!response?.ok) {
          const payload = await response?.json().catch(() => ({}));
          // Mutation failures must not poison loadError: the library already loaded,
          // and Retry-on-GET would mis-describe a failed write as an unread library.
          setError(payload?.message ?? payload?.error ?? "Saved items could not be updated.");
          if (response?.status === 401) auth.markSessionExpired();
          return false;
        }
        mutation.confirmed = saved;
        setError(null);
        return true;
      });
      mutation.tail = request.then(
        () => undefined,
        () => undefined,
      );

      const succeeded = await request;
      mutation.pending -= 1;
      if (mutation.pending === 0) {
        applyFavourite(contentType, key, mutation.confirmed);
        favouriteMutationsRef.current.delete(mutationKey);
      } else {
        applyFavourite(contentType, key, mutation.desired);
      }
      return succeeded;
    },
    [applyFavourite, auth],
  );

  const clearFavourites = useCallback(async () => {
    if (auth.status !== "authenticated") {
      if (!demoAccountData) return false;
      return (Object.values(storageKeyByType) as string[]).every((key) => writeSavedRegistrySlugs(key, []));
    }

    // Clear is a global mutation boundary. Wait for every already-enqueued PUT,
    // and make later PUTs wait for this DELETE through favouriteClearTailRef.
    const pendingMutationTails = [...favouriteMutationsRef.current.values()].map((mutation) => mutation.tail);
    const request = Promise.all([favouriteClearTailRef.current, ...pendingMutationTails]).then(async () => {
      const response = await fetch("/api/account/favourites", {
        method: "DELETE",
        headers: auth.authorizationHeader,
      }).catch(() => null);
      if (!response?.ok) {
        setError("Saved items could not be cleared.");
        if (response?.status === 401) auth.markSessionExpired();
        return false;
      }

      // Mutations queued behind the clear must roll back against the now-empty
      // server state if their later PUT fails.
      for (const mutation of favouriteMutationsRef.current.values()) {
        mutation.confirmed = false;
      }
      replaceFavourites(emptyFavourites);
      setError(null);
      return true;
    });
    favouriteClearTailRef.current = request.then(
      () => undefined,
      () => undefined,
    );
    return request;
  }, [auth, replaceFavourites]);

  const value = useMemo<AccountDataContextValue>(
    () => ({
      favourites,
      ready,
      loadError,
      error,
      isAuthenticated: auth.status === "authenticated",
      isSaved: (contentType, contentKey) => favourites[contentType].includes(contentKey),
      setFavourite,
      clearFavourites,
      reload,
    }),
    [auth.status, clearFavourites, error, favourites, loadError, ready, reload, setFavourite],
  );

  return <AccountDataContext.Provider value={value}>{children}</AccountDataContext.Provider>;
}

export function useAccountData() {
  const context = useContext(AccountDataContext);
  if (!context) throw new Error("useAccountData must be used within AccountDataProvider.");
  return context;
}
