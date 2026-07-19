"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuthSession } from "@/lib/supabase/client";
import {
  readSavedRegistrySlugs,
  savedDifferentialsStorageKey,
  savedFormsStorageKey,
  savedServicesStorageKey,
  subscribeSavedRegistrySlugs,
  writeSavedRegistrySlugs,
} from "@/lib/saved-registry-storage";

export type FavouriteContentType = "service" | "form" | "differential";

type FavouritesByType = Record<FavouriteContentType, string[]>;

const emptyFavourites: FavouritesByType = { service: [], form: [], differential: [] };
const storageKeyByType = {
  service: savedServicesStorageKey,
  form: savedFormsStorageKey,
  differential: savedDifferentialsStorageKey,
} satisfies Record<FavouriteContentType, string>;
const demoAccountData = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

function readDemoFavourites(): FavouritesByType {
  return {
    service: readSavedRegistrySlugs(savedServicesStorageKey),
    form: readSavedRegistrySlugs(savedFormsStorageKey),
    differential: readSavedRegistrySlugs(savedDifferentialsStorageKey),
  };
}

type AccountDataContextValue = {
  favourites: FavouritesByType;
  ready: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isSaved: (contentType: FavouriteContentType, contentKey: string) => boolean;
  setFavourite: (contentType: FavouriteContentType, contentKey: string, saved: boolean) => Promise<boolean>;
  clearFavourites: () => Promise<boolean>;
};

const AccountDataContext = createContext<AccountDataContextValue | null>(null);

function normalizedFavourites(value: unknown): FavouritesByType {
  const rows = Array.isArray(value) ? value : [];
  const result: FavouritesByType = { service: [], form: [], differential: [] };
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const contentType = (row as { contentType?: unknown }).contentType;
    const contentKey = (row as { contentKey?: unknown }).contentKey;
    if (
      (contentType === "service" || contentType === "form" || contentType === "differential") &&
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
  const [ready, setReady] = useState(auth.status !== "authenticated");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") {
      const refreshDemoFavourites = () => setFavourites(demoAccountData ? readDemoFavourites() : emptyFavourites);
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) return;
        refreshDemoFavourites();
        setReady(true);
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
        if (!response.ok) throw new Error(payload.message ?? payload.error ?? "Saved items could not be loaded.");
        setFavourites(normalizedFavourites(payload.favourites));
        setError(null);
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setFavourites(emptyFavourites);
        setError(cause instanceof Error ? cause.message : "Saved items could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setReady(true);
      });

    return () => controller.abort();
  }, [auth.authEpoch, auth.authorizationHeader, auth.status]);

  const setFavourite = useCallback(
    async (contentType: FavouriteContentType, contentKey: string, saved: boolean) => {
      if (auth.status !== "authenticated") {
        if (demoAccountData) {
          const current = favourites[contentType];
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
      const previous = favourites;
      setFavourites((current) => ({
        ...current,
        [contentType]: saved
          ? [key, ...current[contentType].filter((item) => item !== key)]
          : current[contentType].filter((item) => item !== key),
      }));

      const response = await fetch("/api/account/favourites", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...auth.authorizationHeader },
        body: JSON.stringify({ contentType, contentKey: key, saved }),
      }).catch(() => null);
      if (!response?.ok) {
        setFavourites(previous);
        const payload = await response?.json().catch(() => ({}));
        setError(payload?.message ?? payload?.error ?? "Saved items could not be updated.");
        if (response?.status === 401) auth.markSessionExpired();
        return false;
      }
      setError(null);
      return true;
    },
    [auth, favourites],
  );

  const clearFavourites = useCallback(async () => {
    if (auth.status !== "authenticated") {
      if (!demoAccountData) return false;
      return (Object.values(storageKeyByType) as string[]).every((key) => writeSavedRegistrySlugs(key, []));
    }
    const previous = favourites;
    setFavourites(emptyFavourites);
    const response = await fetch("/api/account/favourites", {
      method: "DELETE",
      headers: auth.authorizationHeader,
    }).catch(() => null);
    if (!response?.ok) {
      setFavourites(previous);
      setError("Saved items could not be cleared.");
      if (response?.status === 401) auth.markSessionExpired();
      return false;
    }
    setError(null);
    return true;
  }, [auth, favourites]);

  const value = useMemo<AccountDataContextValue>(
    () => ({
      favourites,
      ready,
      error,
      isAuthenticated: auth.status === "authenticated",
      isSaved: (contentType, contentKey) => favourites[contentType].includes(contentKey),
      setFavourite,
      clearFavourites,
    }),
    [auth.status, clearFavourites, error, favourites, ready, setFavourite],
  );

  return <AccountDataContext.Provider value={value}>{children}</AccountDataContext.Provider>;
}

export function useAccountData() {
  const context = useContext(AccountDataContext);
  if (!context) throw new Error("useAccountData must be used within AccountDataProvider.");
  return context;
}
