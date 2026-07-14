"use client";

import { useEffect, useState } from "react";

import type { Pathway, ReferenceData, Therapy, TherapyDataset } from "./types";

const BASE = "/mockups/therapy-compass";

// Module-level cache so the ~2.7 MB dataset is fetched at most once per session,
// shared across every screen. The route is dev-only, so these static assets
// never ship to production.
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
};

export function useTherapyData(): TherapyDataState {
  const [state, setState] = useState<TherapyDataState>({ data: null, loading: true, error: null });

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
  }, []);

  return state;
}
