"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Pathway, ReferenceData, Therapy, TherapyDataset } from "./types";
import { THERAPY_CATALOGUE_ASSETS } from "./generated-assets";

// Served as static public assets. Kept outside /mockups so the production
// `/therapy-compass` route can load them — `proxy.ts` 404s every /mockups path
// in production, which would otherwise starve the tool of its dataset.
const BASE = "/therapy-compass-data";

type TherapyDataOptions = {
  catalogue?: "home" | "index" | "full";
  includePathways?: boolean;
  includeReference?: boolean;
};

// Cache each route-sized payload once per session. Home uses the smallest catalogue,
// pathways use the thin browse index, and search/detail/compare/recommend use full records.
const cache = new Map<string, Promise<TherapyDataset>>();

/** Test helper: drop the session-scoped dataset cache between cases. */
export function clearTherapyDataCache() {
  cache.clear();
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

async function loadDataset(options: Required<TherapyDataOptions>): Promise<TherapyDataset> {
  const [therapies, pathways, reference] = await Promise.all([
    fetchJson<Therapy[]>(`${BASE}/${THERAPY_CATALOGUE_ASSETS[options.catalogue]}`),
    options.includePathways ? fetchJson<Pathway[]>(`${BASE}/pathways.json`) : Promise.resolve([]),
    options.includeReference
      ? fetchJson<ReferenceData>(`${BASE}/reference.json`)
      : Promise.resolve({ categories: [], tags: [], measures: [] }),
  ]);
  return { therapies, pathways, reference };
}

export type TherapyDataState = {
  data: TherapyDataset | null;
  loading: boolean;
  error: string | null;
  /** Settles when the replacement request finishes so Retry can stay busy. */
  retry: () => Promise<void>;
};

export function useTherapyData(options: TherapyDataOptions = {}): TherapyDataState {
  const resolved = useMemo<Required<TherapyDataOptions>>(
    () => ({
      catalogue: options.catalogue ?? "full",
      includePathways: options.includePathways ?? true,
      includeReference: options.includeReference ?? true,
    }),
    [options.catalogue, options.includePathways, options.includeReference],
  );
  const requestKey = `${resolved.catalogue}:${resolved.includePathways ? "pathways" : "none"}:${resolved.includeReference ? "reference" : "none"}`;
  const [state, setState] = useState<
    Omit<TherapyDataState, "retry"> & {
      requestKey: string | null;
    }
  >({ requestKey: null, data: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const retryWaitersRef = useRef<Array<() => void>>([]);
  const inFlightRetryRef = useRef<Promise<void> | null>(null);

  const settleRetryWaiters = useCallback(() => {
    const waiters = retryWaitersRef.current;
    retryWaitersRef.current = [];
    inFlightRetryRef.current = null;
    for (const settle of waiters) settle();
  }, []);

  const retry = useCallback((): Promise<void> => {
    // Coalesce repeated clicks onto the same in-flight reload.
    if (inFlightRetryRef.current) return inFlightRetryRef.current;
    cache.delete(requestKey);
    // Keep the prior error message mounted so Retry focus is not lost while the
    // next attempt is in flight; success/failure handlers replace it below.
    setState((prev) => ({ ...prev, loading: true }));
    const promise = new Promise<void>((resolve) => {
      retryWaitersRef.current.push(resolve);
      setAttempt((value) => value + 1);
    });
    inFlightRetryRef.current = promise;
    return promise;
  }, [requestKey]);

  useEffect(() => {
    let active = true;
    if (!cache.has(requestKey)) cache.set(requestKey, loadDataset(resolved));
    const request = cache.get(requestKey)!;
    request
      .then((data) => {
        if (!active) return;
        setState({ requestKey, data, loading: false, error: null });
        // Only the active attempt may settle Retry; a superseded effect must not
        // release waiters belonging to a newer reload.
        settleRetryWaiters();
      })
      .catch((err: unknown) => {
        // Only clear the shared cache when this request is still the active one.
        // A newer retry may have already replaced `cache` with a fresh promise.
        if (cache.get(requestKey) === request) cache.delete(requestKey);
        if (!active) return;
        setState({
          requestKey,
          data: null,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load",
        });
        settleRetryWaiters();
      });
    return () => {
      active = false;
    };
  }, [attempt, requestKey, resolved, settleRetryWaiters]);

  useEffect(() => {
    return () => {
      settleRetryWaiters();
    };
  }, [settleRetryWaiters]);

  if (state.requestKey !== requestKey) return { data: null, loading: true, error: null, retry };
  return { data: state.data, loading: state.loading, error: state.error, retry };
}
