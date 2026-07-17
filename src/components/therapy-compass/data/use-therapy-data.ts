"use client";

import { useCallback, useEffect, useState } from "react";

import type { Pathway, ReferenceData, Therapy, TherapyDataset } from "./types";

// Served as static public assets. Kept outside /mockups so the production
// `/therapy-compass` route can load them — `proxy.ts` 404s every /mockups path
// in production, which would otherwise starve the tool of its dataset.
const BASE = "/therapy-compass-data";

// Module-level cache so the ~2.6 MB dataset is fetched at most once per session,
// shared across every screen.
let cache: Promise<TherapyDataset> | null = null;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

async function loadDataset(): Promise<TherapyDataset> {
  const [therapies, pathways, reference] = await Promise.all([
    fetchJson<Therapy[]>(`${BASE}/therapies.json`),
    fetchJson<Pathway[]>(`${BASE}/pathways.json`),
    fetchJson<ReferenceData>(`${BASE}/reference.json`),
  ]);
  return { therapies, pathways, reference };
}

export type TherapyDataState = {
  data: TherapyDataset | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
};

export function useTherapyData(): TherapyDataState {
  const [state, setState] = useState<Omit<TherapyDataState, "retry">>({ data: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    cache = null;
    // Keep the prior error message mounted so Retry focus is not lost while the
    // next attempt is in flight; success/failure handlers replace it below.
    setState((prev) => ({ ...prev, loading: true }));
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    cache ??= loadDataset();
    const request = cache;
    request
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        // Only clear the shared cache when this request is still the active one.
        // A newer retry may have already replaced `cache` with a fresh promise.
        if (cache === request) cache = null;
        if (active)
          setState({ data: null, loading: false, error: err instanceof Error ? err.message : "Failed to load" });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  return { ...state, retry };
}
