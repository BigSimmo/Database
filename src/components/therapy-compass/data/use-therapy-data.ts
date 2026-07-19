"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { Pathway, ReferenceData, Therapy, TherapyDataset } from "./types";

// Served as static public assets. Kept outside /mockups so the production
// `/therapy-compass` route can load them — `proxy.ts` 404s every /mockups path
// in production, which would otherwise starve the tool of its dataset.
const BASE = "/therapy-compass-data";

type TherapyDataOptions = {
  catalogue?: "index" | "full";
  includePathways?: boolean;
  includeReference?: boolean;
};

// Cache each route-sized payload once per session. Catalogue routes use the compact
// index; detail/compare/recommend/artifact routes opt into the full records.
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
    fetchJson<Therapy[]>(`${BASE}/${options.catalogue === "full" ? "therapies.json" : "therapies-index.json"}`),
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
  retry: () => void;
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
  const retry = useCallback(() => {
    cache.delete(requestKey);
    // Keep the prior error message mounted so Retry focus is not lost while the
    // next attempt is in flight; success/failure handlers replace it below.
    setState((prev) => ({ ...prev, loading: true }));
    setAttempt((value) => value + 1);
  }, [requestKey]);

  useEffect(() => {
    let active = true;
    if (!cache.has(requestKey)) cache.set(requestKey, loadDataset(resolved));
    const request = cache.get(requestKey)!;
    request
      .then((data) => {
        if (active) setState({ requestKey, data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        // Only clear the shared cache when this request is still the active one.
        // A newer retry may have already replaced `cache` with a fresh promise.
        if (cache.get(requestKey) === request) cache.delete(requestKey);
        if (active)
          setState({
            requestKey,
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load",
          });
      });
    return () => {
      active = false;
    };
  }, [attempt, requestKey, resolved]);

  if (state.requestKey !== requestKey) return { data: null, loading: true, error: null, retry };
  return { data: state.data, loading: state.loading, error: state.error, retry };
}
