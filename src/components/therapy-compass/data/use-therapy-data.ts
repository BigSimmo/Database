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
    setState({ data: null, loading: true, error: null });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    cache ??= loadDataset();
    cache
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        // Allow a retry on the next mount if the fetch failed.
        cache = null;
        if (active)
          setState({ data: null, loading: false, error: err instanceof Error ? err.message : "Failed to load" });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  return { ...state, retry };
}
