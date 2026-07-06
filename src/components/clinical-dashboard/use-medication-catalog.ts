"use client";

import { useEffect, useState } from "react";

import type { MedicationRecord, MedicationSearchResult } from "@/lib/medications";

type MedicationCatalogMatch = {
  medication: MedicationRecord;
  result: MedicationSearchResult;
  score: number;
  reasons: string[];
};

type MedicationCatalogResponse = {
  records: MedicationRecord[];
  matches?: MedicationCatalogMatch[];
  total: number;
  demoMode?: boolean;
};

type MedicationDetailResponse = {
  record: MedicationRecord;
  governance?: {
    sourceStatus: string;
    validationStatus: string;
  };
  demoMode?: boolean;
};

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export function useMedicationCatalog(
  query?: string,
  options: { enabled?: boolean } = {},
): AsyncState<MedicationCatalogResponse> {
  const enabled = options.enabled ?? true;
  const trimmed = query?.trim() ?? "";
  const [prevQuery, setPrevQuery] = useState(trimmed);
  const [prevEnabled, setPrevEnabled] = useState(enabled);
  const [state, setState] = useState<AsyncState<MedicationCatalogResponse>>({
    data: null,
    loading: enabled,
    error: null,
  });

  if (trimmed !== prevQuery || enabled !== prevEnabled) {
    setPrevQuery(trimmed);
    setPrevEnabled(enabled);
    setState({
      data: null,
      loading: enabled,
      error: null,
    });
  }

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const url = trimmed ? `/api/medications?q=${encodeURIComponent(trimmed)}` : "/api/medications";
    fetchJson<MedicationCatalogResponse>(url)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : "Could not load medications.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [trimmed, enabled]);

  return state;
}

export function useMedicationDetail(slug?: string): AsyncState<MedicationDetailResponse> {
  const normalized = slug?.trim().toLowerCase() ?? "";
  const [prevSlug, setPrevSlug] = useState(normalized);
  const [state, setState] = useState<AsyncState<MedicationDetailResponse>>(() => ({
    data: null,
    loading: !!normalized,
    error: null,
  }));

  if (normalized !== prevSlug) {
    setPrevSlug(normalized);
    setState({
      data: null,
      loading: !!normalized,
      error: null,
    });
  }

  useEffect(() => {
    if (!normalized) {
      return;
    }
    let cancelled = false;
    fetchJson<MedicationDetailResponse>(`/api/medications/${encodeURIComponent(normalized)}`)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : "Could not load medication.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [normalized]);

  return state;
}
