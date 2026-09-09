"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Pathway, ReferenceData, Therapy, TherapyDataset } from "./types";
import { THERAPY_CATALOGUE_ASSETS } from "./generated-assets";

// Served as static public assets. Kept outside /mockups so the production
// `/therapy-compass` route can load them — `proxy.ts` 404s every /mockups path
// in production, which would otherwise starve the tool of its dataset.
const BASE = "/therapy-compass-data";

type TherapyDataOptions = {
  catalogue?: "index" | "full";
  includePathways?: boolean;
  includeReference?: boolean;
  /** Skip all catalogue I/O for routes whose first paint uses generated summary metadata only. */
  enabled?: boolean;
};

// Cache each route-sized payload once per session. Therapy home disables I/O and
// renders generated summary metadata; pathways use the thin browse index, and
// search/detail/compare/recommend use full records.
const cache = new Map<string, Promise<TherapyDataset>>();
const EMPTY_DATASET: TherapyDataset = {
  therapies: [],
  pathways: [],
  reference: { categories: [], tags: [], measures: [] },
};

/** Test helper: drop the session-scoped dataset cache between cases. */
export function clearTherapyDataCache() {
  cache.clear();
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

// Unversioned aliases. These names never change, always hold the current data,
// and are served `max-age=0, must-revalidate` (see next.config.ts).
const CATALOGUE_ALIASES = {
  full: "therapies.json",
  index: "therapies-index.json",
} as const;

/**
 * Content-addressed URL first, unversioned alias as the fallback. A session that
 * started before a deploy has the previous hashed filename compiled into its
 * bundle; the generator retains that generation for one deploy, but a client
 * older than that — or one that lands mid-rollout — would otherwise get a 404
 * and an error screen on a route it had already loaded once. The alias is the
 * standing answer to that, so use it rather than surfacing a dead catalogue.
 */
async function fetchCatalogue(catalogue: "index" | "full"): Promise<Therapy[]> {
  try {
    return await fetchJson<Therapy[]>(`${BASE}/${THERAPY_CATALOGUE_ASSETS[catalogue]}`);
  } catch {
    return fetchJson<Therapy[]>(`${BASE}/${CATALOGUE_ALIASES[catalogue]}`);
  }
}

async function loadDataset(options: Required<TherapyDataOptions>): Promise<TherapyDataset> {
  const [therapies, pathways, reference] = await Promise.all([
    fetchCatalogue(options.catalogue),
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
      enabled: options.enabled ?? true,
    }),
    [options.catalogue, options.enabled, options.includePathways, options.includeReference],
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
    if (!resolved.enabled) return Promise.resolve();
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
  }, [requestKey, resolved.enabled]);

  useEffect(() => {
    if (!resolved.enabled) {
      settleRetryWaiters();
      return;
    }
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

  if (!resolved.enabled) {
    // Home deliberately masks catalogue state and performs no I/O. Retain a
    // settled success so a later rich route can reuse the immutable cached
    // dataset, but invalidate a settled failure: its request was removed from
    // `cache`, so it cannot describe the automatic replacement request that
    // starts when catalogue loading is enabled again. Updating during render is
    // safe here because the error guard makes the adjustment self-terminating.
    if (state.error) {
      setState({ requestKey: null, data: null, loading: false, error: null });
    }
    return { data: EMPTY_DATASET, loading: false, error: null, retry };
  }
  if (state.requestKey !== requestKey) return { data: null, loading: true, error: null, retry };
  return { data: state.data, loading: state.loading, error: state.error, retry };
}
